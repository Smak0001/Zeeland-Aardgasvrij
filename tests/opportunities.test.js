import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  aggregeerWijken, beoordeel, bewonersIndicatie, klasseVan, percentielRangen, strategieVan,
} from '../src/lib/opportunities.js'

const kansen = JSON.parse(readFileSync(new URL('../public/data/zeeland-kansen.json', import.meta.url)))
const kaart = JSON.parse(readFileSync(new URL('../public/data/zeeland-buurten-2026.geojson', import.meta.url)))

const buurt = (code, kosten, woningen, extra = {}) => ({ code, kosten, woningen, ...extra })

test('percentielrang loopt van 0 tot 1 en geeft gelijke waarden dezelfde rang', () => {
  const rang = percentielRangen([30, 10, 20, 20, 40])
  assert.equal(rang(10), 0)
  assert.equal(rang(40), 1)
  assert.equal(rang(20), 0.375)
  assert.equal(percentielRangen([5])(5), 0.5)
})

test('kansScore weegt goedkope kosten voor 70% en het aantal woningen voor 30%', () => {
  const scores = beoordeel([buurt('A', 100, 50), buurt('B', 200, 100), buurt('C', 300, 150)])
  assert.deepEqual(
    ['A', 'B', 'C'].map((code) => Number(scores.get(code).kansScore.toFixed(2))),
    [0.7, 0.5, 0.3],
  )
  assert.equal(scores.get('A').kostenScore, 1)
  assert.equal(scores.get('C').omvangScore, 1)
})

test('klassen volgen de afgesproken grenzen', () => {
  assert.equal(klasseVan({ kosten: -10, kansScore: 0.1 }), 'zeer-kansrijk')
  assert.equal(klasseVan({ kosten: 0, kansScore: 0.1 }), 'zeer-kansrijk')
  assert.equal(klasseVan({ kosten: 50, kansScore: 0.66 }), 'kansrijk')
  assert.equal(klasseVan({ kosten: 50, kansScore: 0.33 }), 'mogelijk')
  assert.equal(klasseVan({ kosten: 50, kansScore: 0.329 }), 'minder-kansrijk')
  assert.equal(klasseVan({ kosten: 50, kansScore: null }), 'onbekend')
})

test('gebieden zonder kosten of met minder dan 10 woningen zijn onbekend en tellen niet mee in de rang', () => {
  const scores = beoordeel([buurt('A', 100, 50), buurt('B', 200, 50), buurt('C', 5, 9), buurt('D', null, 500)])
  assert.equal(scores.get('C').klasse, 'onbekend')
  assert.equal(scores.get('D').klasse, 'onbekend')
  assert.equal(scores.get('A').kostenScore, 1)
  assert.equal(scores.get('B').kostenScore, 0)
})

test('een wijk telt de meerkosten van zijn buurten op en deelt door de woningequivalenten', () => {
  const [wijk] = aggregeerWijken([
    buurt('BU1', 100, 10, { wijkcode: 'WK1', wijknaam: 'Wijk', weq: 10, kostenTotaal: 1000, variant: 's1a' }),
    buurt('BU2', 400, 30, { wijkcode: 'WK1', wijknaam: 'Wijk', weq: 30, kostenTotaal: 12000, variant: 's4b' }),
    buurt('BU3', null, 5, { wijkcode: 'WK1', wijknaam: 'Wijk', weq: 5, kostenTotaal: null, variant: null }),
  ])
  assert.equal(wijk.kosten, 13000 / 40)
  assert.equal(wijk.woningen, 45)
  assert.equal(wijk.variant, 's4b')
  assert.equal(wijk.aantalBuurten, 3)
})

test('de bewonersindicatie rekent gasbesparing min extra stroom min jaarlasten', () => {
  const aannames = { gasprijs: 1, stroomprijs: 0.5, gjPerM3Gas: 0.1, kwhPerGj: 100 }
  const indicatie = bewonersIndicatie({
    variant: 's1a', jaarlastenWoning: 200, gasVoor: 30, elekVoor: 10, gasNa: 0, elekNa: 15,
  }, aannames)
  // Voor: 300 m³ × €1 + 1000 kWh × €0,50 = €800. Na: 1500 kWh × €0,50 = €750.
  assert.equal(indicatie.energieBesparing, 50)
  assert.equal(indicatie.netto, -150)
  assert.equal(indicatie.horizon[20], -3000)
  assert.equal(bewonersIndicatie({ variant: 's1a' }), null)
})

test('bij een warmtenet kost de warmte evenveel als het oude aardgas', () => {
  const indicatie = bewonersIndicatie({
    variant: 's2d', jaarlastenWoning: 0, gasVoor: 30, elekVoor: 10, gasNa: 0, elekNa: 10,
  }, { gasprijs: 1, stroomprijs: 0.5, gjPerM3Gas: 0.1, kwhPerGj: 100 })
  assert.equal(indicatie.energieBesparing, 0)
  assert.equal(indicatie.warmtenet, true)
})

test('strategiecodes worden herkend uit de PBL-variant', () => {
  assert.equal(strategieVan('s2d'), 'S2')
  assert.equal(strategieVan('s4b'), 'S4')
  assert.equal(strategieVan('Ref2030'), null)
  assert.equal(strategieVan(null), null)
})

test('het kansenbestand dekt elke buurt op de kaart en gebruikt de PBL-laagste kosten', () => {
  const codes = new Set(kansen.buurten.map((item) => item.code))
  for (const feature of kaart.features) assert.ok(codes.has(feature.id), `${feature.id} ontbreekt`)
  for (const item of kansen.buurten) {
    assert.ok(Number.isInteger(item.woningen))
    if (item.kosten !== null) assert.ok(strategieVan(item.variant), `${item.code} zonder strategie`)
  }
})
