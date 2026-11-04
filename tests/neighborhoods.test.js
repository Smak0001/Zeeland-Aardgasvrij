import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { filterNeighborhoods, findAreaAt, getMunicipalities } from '../src/lib/neighborhoods.js'

const collection = JSON.parse(readFileSync(new URL('../public/data/zeeland-buurten-2026.geojson', import.meta.url)))
const features = collection.features

test('de bron bevat unieke buurtgrenzen uit alle dertien Zeeuwse gemeenten', () => {
  assert.equal(collection.type, 'FeatureCollection')
  assert.equal(collection.metadata.year, 2026)
  assert.deepEqual(getMunicipalities(features).map(({ code }) => code).sort(), [
    'GM0654', 'GM0664', 'GM0677', 'GM0678', 'GM0687', 'GM0703', 'GM0715',
    'GM0716', 'GM0717', 'GM0718', 'GM1676', 'GM1695', 'GM1714',
  ].sort())
  assert.equal(new Set(features.map((feature) => feature.id)).size, features.length)
  for (const feature of features) {
    assert.match(feature.properties.buurtcode, /^BU\d{8}$/)
    assert.ok(feature.properties.buurtnaam)
    assert.ok(['Polygon', 'MultiPolygon'].includes(feature.geometry.type))
    assert.ok(feature.geometry.coordinates.length)
  }
})

test('een gemeentefilter toont uitsluitend de buurten van die gemeente', () => {
  const results = filterNeighborhoods(features, 'GM0687', '')
  assert.ok(results.length > 0)
  assert.ok(results.every(({ properties }) => properties.gemeentenaam === 'Middelburg (Z.)'))
  assert.equal(filterNeighborhoods(features, '', '').length, features.length)
})

test('zoeken werkt onafhankelijk van hoofdletters en combineert met een gemeente', () => {
  const results = filterNeighborhoods(features, 'GM0687', '  GRIFFIOEN  ')
  assert.ok(results.length > 0)
  assert.ok(results.every(({ properties }) => properties.gemeentecode === 'GM0687'
    && properties.buurtnaam.toLowerCase().includes('griffioen')))
  assert.deepEqual(filterNeighborhoods(features, '', 'een-buurt-die-niet-bestaat'), [])
})

test('een locatie wordt gekoppeld aan de buurt waarin hij ligt', () => {
  // Het Abdijplein in Middelburg.
  const abdij = findAreaAt(features, 3.6114, 51.5003)
  assert.equal(abdij?.properties.buurtcode, 'BU06870003')
  // Brussel ligt buiten Zeeland.
  assert.equal(findAreaAt(features, 4.3517, 50.8503), null)
})

test('een gat in een buurt (bijvoorbeeld water) telt niet als binnen de buurt', () => {
  const square = (size) => [[0, 0], [size, 0], [size, size], [0, size], [0, 0]]
  const donut = { properties: {}, geometry: { type: 'Polygon', coordinates: [square(10), square(4)] } }
  assert.equal(findAreaAt([donut], 2, 2), null)
  assert.equal(findAreaAt([donut], 7, 7), donut)
})
