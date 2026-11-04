import { mkdir, writeFile } from 'node:fs/promises'

const year = 2026
const source = `https://api.pdok.nl/cbs/wijken-en-buurten-${year}/ogc/v1/collections/buurten/items`
// Ruime rechthoek rond Zeeland (lengte- en breedtegraad, CRS84). Buurten van
// aangrenzende gemeenten vallen hier ook binnen en worden hieronder weggefilterd.
const zeelandBbox = '3.2,51.1,4.4,51.85'
const municipalityCodes = [
  'GM0654', 'GM0664', 'GM0677', 'GM0678', 'GM0687', 'GM0703', 'GM0715',
  'GM0716', 'GM0717', 'GM0718', 'GM1676', 'GM1695', 'GM1714',
]
const counts = new Map(municipalityCodes.map((code) => [code, 0]))
const features = new Map()

// Zes decimalen geven circa 10 cm precisie en houden het kaartbestand compact.
// Sinds 2026 levert CBS een hoogte (altijd 0) mee; de kaart gebruikt alleen lengte en breedte.
function roundCoordinates(coordinates) {
  if (!Array.isArray(coordinates[0])) {
    return coordinates.slice(0, 2).map((coordinate) => Number(coordinate.toFixed(6)))
  }
  return coordinates.map(roundCoordinates)
}

// Sinds 2026 kan de API niet meer op gemeentecode filteren. Daarom halen we
// alle buurten binnen de rechthoek op en selecteren we zelf de Zeeuwse gemeenten.
let url = new URL(source)
url.search = new URLSearchParams({ f: 'json', limit: '1000', bbox: zeelandBbox })

while (url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) })
  if (!response.ok) throw new Error(`CBS ophalen mislukt: ${response.status}`)
  const data = await response.json()
  if (!Array.isArray(data.features)) throw new Error('Onverwacht CBS-antwoord')

  for (const feature of data.features) {
    const properties = feature.properties
    if (!counts.has(properties.gm_code)) continue
    // Watergebieden zijn geen buurten die voor een woningaanpak worden geselecteerd.
    if (properties.water === 'JA') continue
    if (!feature.geometry || !['Polygon', 'MultiPolygon'].includes(feature.geometry.type)) {
      throw new Error(`Buurt zonder geldige grens: ${properties.bu_code}`)
    }
    if (features.has(properties.bu_code)) throw new Error(`Dubbele buurt: ${properties.bu_code}`)
    // De app gebruikt de vertrouwde veldnamen; de CBS-namen van 2026 worden hier vertaald.
    features.set(properties.bu_code, {
      type: 'Feature',
      id: properties.bu_code,
      properties: {
        buurtcode: properties.bu_code,
        buurtnaam: properties.bu_naam,
        gemeentecode: properties.gm_code,
        gemeentenaam: properties.gm_naam,
        wijkcode: properties.wk_code,
      },
      geometry: { ...feature.geometry, coordinates: roundCoordinates(feature.geometry.coordinates) },
    })
    counts.set(properties.gm_code, counts.get(properties.gm_code) + 1)
  }
  const next = data.links?.find((link) => link.rel === 'next')?.href
  url = next ? new URL(next, url) : null
}

for (const [municipalityCode, count] of counts) {
  if (!count) throw new Error(`Geen buurten gevonden voor ${municipalityCode}`)
  console.log(`${municipalityCode}: ${count} buurten`)
}

const collection = {
  type: 'FeatureCollection',
  metadata: {
    title: `CBS Wijk- en Buurtkaart ${year} — Zeeuwse buurten`,
    year,
    coordinatePrecision: 6,
    source,
    retrievedAt: new Date().toISOString(),
    description: 'CBS-buurtgrenzen, zonder watergebieden. Geen kansbeoordelingen.',
  },
  features: [...features.values()].sort((a, b) => a.id.localeCompare(b.id)),
}

const outputDirectory = new URL('../public/data/', import.meta.url)
await mkdir(outputDirectory, { recursive: true })
await writeFile(new URL(`zeeland-buurten-${year}.geojson`, outputDirectory), JSON.stringify(collection))
console.log(`${collection.features.length} buurtgrenzen opgeslagen.`)
