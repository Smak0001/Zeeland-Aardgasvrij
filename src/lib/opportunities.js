// Kansberekening op basis van de PBL Startanalyse aardgasvrije buurten.
// Alles in dit bestand is pure rekenlogica, zodat het los te testen is.

export const MIN_WONINGEN = 10
export const GEWICHT_KOSTEN = 0.7
export const GEWICHT_OMVANG = 0.3

export const KLASSEN = [
  { key: 'zeer-kansrijk', label: 'Zeer kansrijk', color: '#08519c', uitleg: 'Aardgasvrij is hier goedkoper dan doorgaan met aardgas.' },
  { key: 'kansrijk', label: 'Kansrijk', color: '#6baed6', uitleg: 'Kansscore 66 of hoger.' },
  { key: 'mogelijk', label: 'Mogelijk', color: '#fdae6b', uitleg: 'Kansscore 33 tot 66.' },
  { key: 'minder-kansrijk', label: 'Minder kansrijk', color: '#d94801', uitleg: 'Kansscore lager dan 33.' },
  { key: 'onbekend', label: 'Onbekend', color: '#bdbdbd', uitleg: 'Te weinig woningen (minder dan 10) of geen gegevens.' },
]

export const STRATEGIEEN = {
  S1: 'Elektrische warmtepomp per woning (all-electric)',
  S2: 'Warmtenet met middelhoge of hoge temperatuur',
  S3: 'Warmtenet met lage temperatuur',
  S4: 'Hybride warmtepomp met groen gas',
}

// Gemeenten kiezen in hun warmteplan een route per wijk. S2 en S3 zijn voor hen
// allebei een collectief warmtenet; het verschil zit in temperatuur en bron.
export const ROUTES = {
  warmtenet: { label: 'Warmtenet', strategieen: ['S2', 'S3'] },
  'all-electric': { label: 'All-electric', strategieen: ['S1'] },
  hybride: { label: 'Hybride (groen gas)', strategieen: ['S4'] },
}

// Labels B en D zijn het isolatieniveau waar PBL de woningen in die variant naartoe brengt.
export const VARIANTEN = {
  s1a: 'Luchtwarmtepomp; woningen isoleren tot label B',
  s1b: 'Bodemwarmtepomp; woningen isoleren tot label B',
  s2a: 'Warmtenet op restwarmte; woningen isoleren tot label B',
  s2b: 'Warmtenet op aardwarmte (alleen waar beschikbaar); woningen isoleren tot label B',
  s2c: 'Warmtenet op aardwarmte; woningen isoleren tot label B',
  s2d: 'Warmtenet op restwarmte; woningen isoleren tot label D',
  s2e: 'Warmtenet op aardwarmte (alleen waar beschikbaar); woningen isoleren tot label D',
  s2f: 'Warmtenet op aardwarmte; woningen isoleren tot label D',
  s3a: 'Lagetemperatuur-warmtenet (30 °C); woningen isoleren tot label B',
  s3b: 'Warmtenet met warmte-koudeopslag (15 °C); woningen isoleren tot label B',
  s3c: 'Warmtenet met warmte-koudeopslag (15/70 °C); woningen isoleren tot label B',
  s3d: 'Warmtenet met warmte-koudeopslag (15/50 °C); woningen isoleren tot label B',
  s3e: 'Warmtenet met warmte uit oppervlaktewater; woningen isoleren tot label B',
  s3f: 'Lagetemperatuur-warmtenet (30/70 °C); woningen isoleren tot label D',
  s3g: 'Warmtenet met warmte-koudeopslag (15 °C); woningen isoleren tot label D',
  s3h: 'Warmtenet met warmte-koudeopslag (15/70 °C); woningen isoleren tot label D',
  s4a: 'Hybride warmtepomp met groen gas; woningen isoleren tot label B',
  s4b: 'Hybride warmtepomp met groen gas; woningen isoleren tot label D',
}

// Aannames voor de bewonersindicatie. Dit zijn geen PBL-cijfers: pas ze aan als er
// actuelere consumentenprijzen (inclusief belastingen) beschikbaar zijn.
export const AANNAMES = {
  gasprijs: 1.3, // euro per m³
  stroomprijs: 0.28, // euro per kWh
  gjPerM3Gas: 0.03165, // verbrandingswaarde aardgas (Groningen-equivalent)
  kwhPerGj: 277.78,
}

export function strategieVan(variant) {
  const match = /^s([1-4])/i.exec(variant ?? '')
  return match ? `S${match[1]}` : null
}

export function routeVan(variant) {
  const strategie = strategieVan(variant)
  return Object.keys(ROUTES).find((route) => ROUTES[route].strategieen.includes(strategie)) ?? null
}

// Een buurt heeft één route; een wijk de route met de meeste woningen.
export function routeVanGebied(gebied) {
  return gebied.route !== undefined ? gebied.route : routeVan(gebied.variant)
}

// Percentielrang tussen 0 (laagste waarde) en 1 (hoogste waarde). Gelijke waarden
// krijgen dezelfde, gemiddelde rang zodat de volgorde in de data niet uitmaakt.
export function percentielRangen(waarden) {
  const gesorteerd = [...waarden].sort((a, b) => a - b)
  const n = gesorteerd.length
  const rangen = new Map()
  for (let i = 0; i < n;) {
    let j = i
    while (j + 1 < n && gesorteerd[j + 1] === gesorteerd[i]) j++
    rangen.set(gesorteerd[i], n === 1 ? 0.5 : (i + j) / 2 / (n - 1))
    i = j + 1
  }
  return (waarde) => rangen.get(waarde)
}

function heeftData(gebied) {
  return Number.isFinite(gebied.kosten) && gebied.woningen >= MIN_WONINGEN
}

export function klasseVan({ kosten, kansScore }) {
  if (kansScore == null) return 'onbekend'
  if (kosten <= 0) return 'zeer-kansrijk'
  if (kansScore >= 0.66) return 'kansrijk'
  if (kansScore >= 0.33) return 'mogelijk'
  return 'minder-kansrijk'
}

// Geeft voor elk gebied de scores en de klasse terug. De rangen worden alleen
// bepaald over gebieden met bruikbare data, binnen dezelfde set (buurten óf wijken).
export function beoordeel(gebieden) {
  const bruikbaar = gebieden.filter(heeftData)
  const kostenRang = percentielRangen(bruikbaar.map((gebied) => gebied.kosten))
  const omvangRang = percentielRangen(bruikbaar.map((gebied) => gebied.woningen))

  return new Map(gebieden.map((gebied) => {
    if (!heeftData(gebied)) {
      return [gebied.code, { kostenScore: null, omvangScore: null, kansScore: null, klasse: 'onbekend' }]
    }
    const kostenScore = 1 - kostenRang(gebied.kosten)
    const omvangScore = omvangRang(gebied.woningen)
    const kansScore = GEWICHT_KOSTEN * kostenScore + GEWICHT_OMVANG * omvangScore
    return [gebied.code, { kostenScore, omvangScore, kansScore, klasse: klasseVan({ kosten: gebied.kosten, kansScore }) }]
  }))
}

function gewogenGemiddelde(items, veld, gewicht) {
  const bruikbaar = items.filter((item) => Number.isFinite(item[veld]) && item[gewicht] > 0)
  const totaal = bruikbaar.reduce((som, item) => som + item[gewicht], 0)
  return totaal ? bruikbaar.reduce((som, item) => som + item[veld] * item[gewicht], 0) / totaal : null
}

// Een wijk krijgt de kosten die ontstaan als elke buurt zijn eigen goedkoopste route
// volgt: de totale meerkosten gedeeld door alle woningequivalenten met data.
export function aggregeerWijken(buurten) {
  const perWijk = new Map()
  for (const buurt of buurten) {
    if (!perWijk.has(buurt.wijkcode)) perWijk.set(buurt.wijkcode, [])
    perWijk.get(buurt.wijkcode).push(buurt)
  }
  return [...perWijk].map(([code, items]) => {
    const metKosten = items.filter((buurt) => Number.isFinite(buurt.kostenTotaal) && buurt.weq > 0)
    const weqMetKosten = metKosten.reduce((som, buurt) => som + buurt.weq, 0)
    const woningenPerStrategie = new Map()
    for (const buurt of metKosten) {
      woningenPerStrategie.set(buurt.variant, (woningenPerStrategie.get(buurt.variant) ?? 0) + buurt.woningen)
    }
    const variant = [...woningenPerStrategie].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
    const woningen = items.reduce((som, buurt) => som + buurt.woningen, 0)
    // Aandeel woningen per route, zodat zichtbaar is dat een wijk gemengd kan zijn.
    const routeWoningen = {}
    for (const [buurtVariant, aantal] of woningenPerStrategie) {
      const route = routeVan(buurtVariant)
      routeWoningen[route] = (routeWoningen[route] ?? 0) + aantal
    }
    const woningenMetRoute = Object.values(routeWoningen).reduce((som, aantal) => som + aantal, 0)
    const routeVerdeling = Object.fromEntries(Object.entries(routeWoningen)
      .map(([route, aantal]) => [route, woningenMetRoute ? aantal / woningenMetRoute : 0])
      .sort((a, b) => b[1] - a[1]))
    return {
      code,
      naam: items[0].wijknaam,
      gemeentecode: items[0].gemeentecode,
      gemeente: items[0].gemeente,
      woningen,
      weq: items.reduce((som, buurt) => som + buurt.weq, 0),
      kosten: weqMetKosten ? metKosten.reduce((som, buurt) => som + buurt.kostenTotaal, 0) / weqMetKosten : null,
      variant,
      route: Object.keys(routeVerdeling)[0] ?? null,
      routeVerdeling,
      aantalBuurten: items.length,
      jaarlastenWoning: gewogenGemiddelde(items, 'jaarlastenWoning', 'woningen'),
      gasVoor: gewogenGemiddelde(items, 'gasVoor', 'woningen'),
      elekVoor: gewogenGemiddelde(items, 'elekVoor', 'woningen'),
      gasNa: gewogenGemiddelde(items, 'gasNa', 'woningen'),
      elekNa: gewogenGemiddelde(items, 'elekNa', 'woningen'),
    }
  })
}

// Kerncijfers voor heel Zeeland, op buurtniveau, voor de homepage.
export function zeelandCijfers(buurten) {
  const scores = beoordeel(buurten)
  const kansrijk = buurten.filter((buurt) => ['zeer-kansrijk', 'kansrijk'].includes(scores.get(buurt.code).klasse))
  const woningenPerRoute = Object.fromEntries(Object.keys(ROUTES).map((route) => [route, 0]))
  for (const buurt of buurten) {
    const route = routeVan(buurt.variant)
    if (route) woningenPerRoute[route] += buurt.woningen
  }
  const som = (items) => items.reduce((totaal, buurt) => totaal + buurt.woningen, 0)
  return {
    woningen: som(buurten),
    buurten: buurten.length,
    kansrijkeBuurten: kansrijk.length,
    kansrijkeWoningen: som(kansrijk),
    woningenPerRoute,
  }
}

// Eerste inschatting voor een gemiddelde woning in het gebied. Alle bedragen per jaar.
export function bewonersIndicatie(gebied, aannames = AANNAMES) {
  const velden = ['jaarlastenWoning', 'gasVoor', 'elekVoor', 'gasNa', 'elekNa']
  if (!velden.every((veld) => Number.isFinite(gebied[veld]))) return null
  const gasKosten = (gj) => (gj / aannames.gjPerM3Gas) * aannames.gasprijs
  const stroomKosten = (gj) => gj * aannames.kwhPerGj * aannames.stroomprijs
  const warmtenet = ['S2', 'S3'].includes(strategieVan(gebied.variant))

  const energieVoor = gasKosten(gebied.gasVoor) + stroomKosten(gebied.elekVoor)
  // Bij een warmtenet geldt het 'niet meer dan anders'-principe: de warmte kost
  // ongeveer wat het aardgas kostte. Daarom tellen we die gasrekening gewoon door.
  const warmte = warmtenet ? gasKosten(gebied.gasVoor) : 0
  const energieNa = gasKosten(gebied.gasNa) + stroomKosten(gebied.elekNa) + warmte
  const energieBesparing = energieVoor - energieNa
  const netto = energieBesparing - gebied.jaarlastenWoning

  return {
    energieVoor,
    energieNa,
    energieBesparing,
    jaarlasten: gebied.jaarlastenWoning,
    netto,
    horizon: Object.fromEntries([10, 20, 30].map((jaren) => [jaren, netto * jaren])),
    warmtenet,
  }
}
