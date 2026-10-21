import { mkdir, writeFile } from 'node:fs/promises'

const source = 'https://api.pdok.nl/cbs/wijken-en-buurten-2025/ogc/v1/collections/buurten/items'
const municipalityCodes = [
  'GM0654', 'GM0664', 'GM0677', 'GM0678', 'GM0687', 'GM0703', 'GM0715',
  'GM0716', 'GM0717', 'GM0718', 'GM1676', 'GM1695', 'GM1714',
]
const features = new Map()

// Zes decimalen geven circa 10 cm precisie en houden het kaartbestand compact.
function roundCoordinates(coordinates) {
  return coordinates.map((coordinate) => Array.isArray(coordinate)
    ? roundCoordinates(coordinate)
    : Number(coordinate.toFixed(6)))
}

for (const municipalityCode of municipalityCodes) {
  let url = new URL(source)
  url.search = new URLSearchParams({
    f: 'json', limit: '1000', filter: `gemeentecode = '${municipalityCode}'`,
  })
  let count = 0

  while (url) {
    const response = await fetch(url, { signal: AbortSignal.timeout(60_000) })
    if (!response.ok) throw new Error(`CBS ophalen mislukt: ${response.status}`)
    const data = await response.json()
    if (!Array.isArray(data.features)) throw new Error('Onverwacht CBS-antwoord')

    for (const feature of data.features) {
      const properties = feature.properties
      if (properties.gemeentecode !== municipalityCode) throw new Error('Onjuist gemeentefilter')
      // Watergebieden zijn geen buurten die voor een woningaanpak worden geselecteerd.
      if (properties.water === 'JA') continue
      if (!feature.geometry || !['Polygon', 'MultiPolygon'].includes(feature.geometry.type)) {
        throw new Error(`Buurt zonder geldige grens: ${properties.buurtcode}`)
      }
      if (features.has(properties.buurtcode)) throw new Error(`Dubbele buurt: ${properties.buurtcode}`)
      features.set(properties.buurtcode, {
        type: 'Feature',
        id: properties.buurtcode,
        properties: {
          buurtcode: properties.buurtcode,
          buurtnaam: properties.buurtnaam,
          gemeentecode: properties.gemeentecode,
          gemeentenaam: properties.gemeentenaam,
          wijkcode: properties.wijkcode,
        },
        geometry: { ...feature.geometry, coordinates: roundCoordinates(feature.geometry.coordinates) },
      })
      count++
    }
    const next = data.links?.find((link) => link.rel === 'next')?.href
    url = next ? new URL(next, url) : null
  }

  if (!count) throw new Error(`Geen buurten gevonden voor ${municipalityCode}`)
  console.log(`${municipalityCode}: ${count} buurten`)
}

const collection = {
  type: 'FeatureCollection',
  metadata: {
    title: 'CBS Wijk- en Buurtkaart 2025 — Zeeuwse buurten',
    year: 2025,
    coordinatePrecision: 6,
    source,
    retrievedAt: new Date().toISOString(),
    description: 'CBS-buurtgrenzen, zonder watergebieden. Geen kansbeoordelingen.',
  },
  features: [...features.values()].sort((a, b) => a.id.localeCompare(b.id)),
}

const outputDirectory = new URL('../public/data/', import.meta.url)
await mkdir(outputDirectory, { recursive: true })
await writeFile(new URL('zeeland-buurten-2025.geojson', outputDirectory), JSON.stringify(collection))
console.log(`${collection.features.length} buurtgrenzen opgeslagen.`)
