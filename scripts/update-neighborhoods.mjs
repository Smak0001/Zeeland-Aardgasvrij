import { mkdir, writeFile } from 'node:fs/promises'

const year = 2026
const api = `https://api.pdok.nl/cbs/wijken-en-buurten-${year}/ogc/v1`
// Ruime rechthoek rond Zeeland (lengte- en breedtegraad, CRS84). Gebieden van
// aangrenzende gemeenten vallen hier ook binnen en worden hieronder weggefilterd.
const zeelandBbox = '3.2,51.1,4.4,51.85'
const municipalityCodes = [
  'GM0654', 'GM0664', 'GM0677', 'GM0678', 'GM0687', 'GM0703', 'GM0715',
  'GM0716', 'GM0717', 'GM0718', 'GM1676', 'GM1695', 'GM1714',
]

// De app gebruikt de vertrouwde veldnamen; de CBS-namen van 2026 worden hier vertaald.
const layers = [
  {
    collection: 'buurten',
    label: 'buurten',
    code: 'bu_code',
    properties: (p) => ({
      buurtcode: p.bu_code, buurtnaam: p.bu_naam, gemeentecode: p.gm_code, gemeentenaam: p.gm_naam, wijkcode: p.wk_code,
    }),
  },
  {
    collection: 'wijken',
    label: 'wijken',
    code: 'wk_code',
    properties: (p) => ({
      wijkcode: p.wk_code, wijknaam: p.wk_naam, gemeentecode: p.gm_code, gemeentenaam: p.gm_naam,
    }),
  },
]

// Zes decimalen geven circa 10 cm precisie en houden het kaartbestand compact.
// Sinds 2026 levert CBS een hoogte (altijd 0) mee; de kaart gebruikt alleen lengte en breedte.
function roundCoordinates(coordinates) {
  if (!Array.isArray(coordinates[0])) {
    return coordinates.slice(0, 2).map((coordinate) => Number(coordinate.toFixed(6)))
  }
  return coordinates.map(roundCoordinates)
}

async function fetchLayer(layer) {
  const source = `${api}/collections/${layer.collection}/items`
  const counts = new Map(municipalityCodes.map((code) => [code, 0]))
  const features = new Map()

  // Sinds 2026 kan de API niet meer op gemeentecode filteren. Daarom halen we
  // alle gebieden binnen de rechthoek op en selecteren we zelf de Zeeuwse gemeenten.
  let url = new URL(source)
  url.search = new URLSearchParams({ f: 'json', limit: '1000', bbox: zeelandBbox })

  while (url) {
    const response = await fetch(url, { signal: AbortSignal.timeout(60_000) })
    if (!response.ok) throw new Error(`CBS ophalen mislukt: ${response.status}`)
    const data = await response.json()
    if (!Array.isArray(data.features)) throw new Error('Onverwacht CBS-antwoord')

    for (const feature of data.features) {
      const properties = feature.properties
      const code = properties[layer.code]
      if (!counts.has(properties.gm_code)) continue
      // Watergebieden zijn geen gebieden die voor een woningaanpak worden geselecteerd.
      if (properties.water === 'JA') continue
      if (!feature.geometry || !['Polygon', 'MultiPolygon'].includes(feature.geometry.type)) {
        throw new Error(`Gebied zonder geldige grens: ${code}`)
      }
      if (features.has(code)) throw new Error(`Dubbel gebied: ${code}`)
      features.set(code, {
        type: 'Feature',
        id: code,
        properties: layer.properties(properties),
        geometry: { ...feature.geometry, coordinates: roundCoordinates(feature.geometry.coordinates) },
      })
      counts.set(properties.gm_code, counts.get(properties.gm_code) + 1)
    }
    const next = data.links?.find((link) => link.rel === 'next')?.href
    url = next ? new URL(next, url) : null
  }

  for (const [municipalityCode, count] of counts) {
    if (!count) throw new Error(`Geen ${layer.label} gevonden voor ${municipalityCode}`)
    console.log(`${municipalityCode}: ${count} ${layer.label}`)
  }

  return {
    type: 'FeatureCollection',
    metadata: {
      title: `CBS Wijk- en Buurtkaart ${year} — Zeeuwse ${layer.label}`,
      year,
      coordinatePrecision: 6,
      source,
      retrievedAt: new Date().toISOString(),
      description: `CBS-grenzen van ${layer.label}, zonder watergebieden. Geen kansbeoordelingen.`,
    },
    features: [...features.values()].sort((a, b) => a.id.localeCompare(b.id)),
  }
}

const outputDirectory = new URL('../public/data/', import.meta.url)
await mkdir(outputDirectory, { recursive: true })
for (const layer of layers) {
  const collection = await fetchLayer(layer)
  await writeFile(new URL(`zeeland-${layer.label}-${year}.geojson`, outputDirectory), JSON.stringify(collection))
  console.log(`${collection.features.length} grenzen van ${layer.label} opgeslagen.`)
}
