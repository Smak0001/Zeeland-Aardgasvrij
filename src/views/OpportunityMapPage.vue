<script setup>
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { filterNeighborhoods, getMunicipalities } from '../lib/neighborhoods.js'
import {
  AANNAMES, GEWICHT_KOSTEN, GEWICHT_OMVANG, KLASSEN, MIN_WONINGEN, ROUTES, STRATEGIEEN, VARIANTEN,
  aggregeerWijken, beoordeel, bewonersIndicatie, routeVanGebied, strategieVan,
} from '../lib/opportunities.js'

const levels = {
  buurt: { file: 'zeeland-buurten-2026.geojson', code: 'buurtcode', name: 'buurtnaam', singular: 'buurt', plural: 'buurten' },
  wijk: { file: 'zeeland-wijken-2026.geojson', code: 'wijkcode', name: 'wijknaam', singular: 'wijk', plural: 'wijken' },
}
const klassen = new Map(KLASSEN.map((klasse) => [klasse.key, klasse]))
const euro = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const number = new Intl.NumberFormat('nl-NL')
const euro2 = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })

const mapElement = ref(null)
const level = ref('buurt')
const features = shallowRef({ buurt: [], wijk: [] })
const records = shallowRef({ buurt: new Map(), wijk: new Map() })
const municipalityCode = ref('')
const route = ref('')
const search = ref('')
const selectedCode = ref(null)
const showAll = ref(false)
const loading = ref(true)
const loadError = ref(false)
const tileError = ref(false)

const config = computed(() => levels[level.value])
const currentFeatures = computed(() => features.value[level.value])
const municipalities = computed(() => getMunicipalities(features.value.buurt))
const beforeRoute = computed(() => filterNeighborhoods(currentFeatures.value, municipalityCode.value, search.value, config.value.name))
const filtered = computed(() => (route.value
  ? beforeRoute.value.filter((feature) => routeOf(feature) === route.value)
  : beforeRoute.value))
const routeCounts = computed(() => {
  const counts = new Map(Object.keys(ROUTES).map((key) => [key, 0]))
  for (const feature of beforeRoute.value) {
    const key = routeOf(feature)
    if (counts.has(key)) counts.set(key, counts.get(key) + 1)
  }
  return counts
})
const ranked = computed(() => filtered.value
  .map((feature) => ({ feature, record: recordOf(feature) }))
  .filter(({ record }) => record?.kansScore != null)
  .sort((a, b) => b.record.kansScore - a.record.kansScore))
const shownRanking = computed(() => (showAll.value || search.value ? ranked.value : ranked.value.slice(0, 10)))
const classCounts = computed(() => {
  const counts = new Map(KLASSEN.map(({ key }) => [key, 0]))
  for (const feature of filtered.value) counts.set(klasseOf(feature), counts.get(klasseOf(feature)) + 1)
  return counts
})
const selectedFeature = computed(() => filtered.value.find((feature) => codeOf(feature) === selectedCode.value))
const selected = computed(() => selectedFeature.value && recordOf(selectedFeature.value))
const indicatie = computed(() => selected.value && bewonersIndicatie(selected.value))
const hasFilters = computed(() => Boolean(municipalityCode.value || route.value || search.value))
const routeMix = computed(() => {
  const verdeling = selected.value?.routeVerdeling
  if (!verdeling || Object.keys(verdeling).length < 2) return null
  return Object.entries(verdeling).map(([key, share]) => `${Math.round(share * 100)}% ${ROUTES[key].label.toLowerCase()}`).join(', ')
})

const request = new AbortController()
const cachedLayers = { buurt: new Map(), wijk: new Map() }
let map
let visibleLayers

function codeOf(feature) {
  return feature.properties[levels[feature.properties.niveau].code]
}

function nameOf(feature) {
  return feature.properties[levels[feature.properties.niveau].name]
}

function recordOf(feature) {
  return records.value[feature.properties.niveau].get(codeOf(feature))
}

function klasseOf(feature) {
  return recordOf(feature)?.klasse ?? 'onbekend'
}

function routeOf(feature) {
  const record = recordOf(feature)
  return record ? routeVanGebied(record) : null
}

function routeLabel(key) {
  return ROUTES[key]?.label ?? 'Geen route'
}

function strategyText(variant) {
  const strategie = strategieVan(variant)
  return strategie ? STRATEGIEEN[strategie] : 'Onbekend'
}

function score(value) {
  return Math.round(value * 100)
}

function boundaryStyle(feature) {
  const active = codeOf(feature) === selectedCode.value
  return {
    color: active ? '#111' : '#fff',
    weight: active ? 3 : 0.8,
    fillColor: klassen.get(klasseOf(feature)).color,
    fillOpacity: active ? 0.9 : 0.7,
  }
}

function selectArea(feature) {
  selectedCode.value = codeOf(feature)
  const layer = cachedLayers[level.value].get(selectedCode.value)
  if (layer) map.fitBounds(layer.getBounds(), { padding: [24, 24], maxZoom: 14 })
}

function updateSelection() {
  visibleLayers?.eachLayer((layer) => layer.setStyle(boundaryStyle(layer.feature)))
  cachedLayers[level.value].get(selectedCode.value)?.bringToFront()
}

function showFilteredAreas() {
  if (!visibleLayers) return
  if (!filtered.value.some((feature) => codeOf(feature) === selectedCode.value)) selectedCode.value = null
  visibleLayers.clearLayers()
  for (const feature of filtered.value) {
    const layer = cachedLayers[level.value].get(codeOf(feature))
    if (layer) visibleLayers.addLayer(layer)
  }
  updateSelection()
  const bounds = visibleLayers.getBounds()
  if (bounds.isValid()) map.fitBounds(bounds, { padding: [16, 16], maxZoom: 12 })
}

function resetFilters() {
  municipalityCode.value = ''
  route.value = ''
  search.value = ''
  selectedCode.value = null
}

async function fetchJson(file) {
  const response = await fetch(`${import.meta.env.BASE_URL}data/${file}`, {
    signal: AbortSignal.any([request.signal, AbortSignal.timeout(30_000)]),
  })
  if (!response.ok) throw new Error(`${file} niet beschikbaar`)
  return response.json()
}

function withScores(items) {
  const scores = beoordeel(items)
  return new Map(items.map((item) => [item.code, { ...item, ...scores.get(item.code) }]))
}

async function loadData() {
  loading.value = true
  loadError.value = false
  try {
    const [buurtData, wijkData, kansen] = await Promise.all([
      fetchJson(levels.buurt.file), fetchJson(levels.wijk.file), fetchJson('zeeland-kansen.json'),
    ])
    for (const data of [buurtData, wijkData]) {
      if (data.type !== 'FeatureCollection' || !Array.isArray(data.features) || !data.features.length) {
        throw new Error('Ongeldig kaartbestand')
      }
    }
    if (!Array.isArray(kansen.buurten)) throw new Error('Ongeldig kansenbestand')
    if (request.signal.aborted) return

    // Scores worden binnen Zeeland bepaald: buurten tegen buurten en wijken tegen wijken.
    records.value = { buurt: withScores(kansen.buurten), wijk: withScores(aggregeerWijken(kansen.buurten)) }

    const loaded = {}
    for (const [key, data] of [['buurt', buurtData], ['wijk', wijkData]]) {
      const { name } = levels[key]
      loaded[key] = data.features
        .map((feature) => ({ ...feature, properties: { ...feature.properties, niveau: key } }))
        .sort((a, b) => a.properties[name].localeCompare(b.properties[name], 'nl')
          || a.properties.gemeentenaam.localeCompare(b.properties.gemeentenaam, 'nl'))
      L.geoJSON(loaded[key], {
        style: boundaryStyle,
        onEachFeature(feature, layer) {
          const label = document.createElement('span')
          label.textContent = `${nameOf(feature)} · ${feature.properties.gemeentenaam} · ${klassen.get(klasseOf(feature)).label}`
          layer.bindTooltip(label)
          layer.on('click', () => selectArea(feature))
          cachedLayers[key].set(codeOf(feature), layer)
        },
      })
    }
    features.value = loaded
  } catch {
    if (!request.signal.aborted) loadError.value = true
  } finally {
    if (!request.signal.aborted) loading.value = false
  }
}

onMounted(() => {
  map = L.map(mapElement.value, {
    scrollWheelZoom: false, zoomControl: false, preferCanvas: true,
  }).setView([51.49, 3.85], 9)
  L.control.zoom({ position: 'topright', zoomInTitle: 'Inzoomen', zoomOutTitle: 'Uitzoomen' }).addTo(map)
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).on('tileerror', () => { tileError.value = true }).addTo(map)
  visibleLayers = L.featureGroup().addTo(map)
  loadData()
})

watch(level, () => {
  selectedCode.value = null
  search.value = ''
  showAll.value = false
})
watch(filtered, showFilteredAreas)
watch(selectedCode, updateSelection)
onBeforeUnmount(() => {
  request.abort()
  cachedLayers.buurt.clear()
  cachedLayers.wijk.clear()
  map?.remove()
})
</script>

<template>
  <section class="map-page" aria-labelledby="map-title">
    <div class="map-heading">
      <div>
        <p class="eyebrow">Aardgasvrij Zeeland</p>
        <h1 id="map-title">Kansenkaart</h1>
        <p class="map-description">
          Waar kan Zeeland het goedkoopst veel woningen van het aardgas halen? Kies buurten of wijken, een gemeente, of zoek op naam.
        </p>
      </div>
    </div>

    <div class="map-filters">
      <fieldset class="level-switch" :disabled="loading || loadError">
        <legend>Niveau</legend>
        <label v-for="(item, key) in levels" :key="key">
          <input v-model="level" type="radio" name="level" :value="key">
          <span>{{ item.plural[0].toUpperCase() + item.plural.slice(1) }}</span>
        </label>
      </fieldset>
      <label for="municipality-filter">
        Gemeente
        <select id="municipality-filter" v-model="municipalityCode" :disabled="loading || loadError">
          <option value="">Heel Zeeland</option>
          <option v-for="municipality in municipalities" :key="municipality.code" :value="municipality.code">
            {{ municipality.name }}
          </option>
        </select>
      </label>
      <label for="route-filter">
        Goedkoopste route
        <select id="route-filter" v-model="route" :disabled="loading || loadError">
          <option value="">Alle routes</option>
          <option v-for="(item, key) in ROUTES" :key="key" :value="key">
            {{ item.label }} ({{ routeCounts.get(key) }})
          </option>
        </select>
      </label>
      <label for="area-search">
        Zoek op {{ config.singular }}naam
        <input id="area-search" v-model="search" type="search" :placeholder="level === 'buurt' ? 'Bijvoorbeeld Griffioen' : 'Bijvoorbeeld Mortiere'" :disabled="loading || loadError">
      </label>
      <button v-if="hasFilters" type="button" class="reset-filters" @click="resetFilters">Filters wissen</button>
    </div>

    <p v-if="loading" class="map-data-status" role="status">Kaart en kansen laden…</p>
    <div v-else-if="loadError" class="map-load-error" role="alert">
      De kaart of de kansgegevens konden niet worden geladen.
      <button type="button" @click="loadData">Opnieuw proberen</button>
    </div>
    <p v-else class="map-data-status" role="status">
      {{ filtered.length }} {{ config.plural }} gevonden<template v-if="route"> waar {{ routeLabel(route).toLowerCase() }} de goedkoopste route is</template>
    </p>
    <p v-if="route === 'hybride' && !loading" class="route-note">
      Let op: een hybride warmtepomp stookt op koude dagen bij met groen gas. PBL kiest deze route alleen als de buurt groen gas toegewezen krijgt, en groen gas is schaars.
    </p>

    <div class="neighborhood-layout">
      <div class="map-panel">
        <div ref="mapElement" class="opportunity-map" role="region" :aria-label="`Kaart van Zeeland met de kansklasse per ${config.singular}`"></div>
        <p v-if="tileError" class="map-error" role="status">
          De achtergrondkaart kan niet volledig worden geladen. De gebieden en zoekfunctie blijven beschikbaar.
        </p>
        <ul class="class-legend" aria-label="Legenda kansklassen">
          <li v-for="klasse in KLASSEN" :key="klasse.key">
            <i :style="{ background: klasse.color }" aria-hidden="true"></i>
            {{ klasse.label }} <small>({{ classCounts.get(klasse.key) }})</small>
          </li>
        </ul>
      </div>

      <aside class="neighborhood-sidebar" aria-labelledby="ranking-title" :aria-busy="loading">
        <h2 id="ranking-title">{{ search ? 'Zoekresultaten' : 'Top startkansen' }}</h2>
        <p class="sidebar-hint">Hoogste kansscore eerst. Klik op een {{ config.singular }} voor details.</p>
        <ol v-if="shownRanking.length" class="ranking-list">
          <li v-for="{ feature, record } in shownRanking" :key="codeOf(feature)">
            <button type="button" :aria-pressed="selectedCode === codeOf(feature)" @click="selectArea(feature)">
              <span class="ranking-name">{{ nameOf(feature) }} <small>{{ feature.properties.gemeentenaam }} · {{ routeLabel(routeOf(feature)) }}</small></span>
              <span class="ranking-bar" aria-hidden="true">
                <span :style="{ width: `${score(record.kansScore)}%`, background: klassen.get(record.klasse).color }"></span>
              </span>
              <span class="ranking-score">{{ score(record.kansScore) }}</span>
            </button>
          </li>
        </ol>
        <p v-else-if="!loading && !loadError" class="sidebar-hint">Geen {{ config.plural }} met kansscore gevonden. Pas je zoekopdracht of gemeente aan.</p>
        <button v-if="!search && ranked.length > 10" type="button" class="reset-filters ranking-toggle" @click="showAll = !showAll">
          {{ showAll ? 'Alleen top 10' : `Volledige lijst (${ranked.length})` }}
        </button>
      </aside>
    </div>

    <section class="area-advice" aria-live="polite" aria-atomic="true" aria-labelledby="advice-title">
      <template v-if="selectedFeature">
        <div class="advice-heading">
          <div>
            <h2 id="advice-title">{{ nameOf(selectedFeature) }} · {{ selectedFeature.properties.gemeentenaam }}</h2>
            <p class="sidebar-hint">
              {{ level === 'buurt' ? 'Buurt' : 'Wijk' }} {{ codeOf(selectedFeature) }}
              <template v-if="level === 'wijk' && selected"> · {{ selected.aantalBuurten }} buurten</template>
              · PBL Startanalyse 2026
            </p>
          </div>
          <span class="class-badge" :style="{ background: klassen.get(selected?.klasse ?? 'onbekend').color }">
            {{ klassen.get(selected?.klasse ?? 'onbekend').label }}
          </span>
        </div>

        <p v-if="!selected || selected.kansScore == null" class="sidebar-hint">
          Voor dit gebied is geen kansscore: er zijn geen PBL-kosten of er staan minder dan {{ MIN_WONINGEN }} woningen.
        </p>
        <template v-else>
          <div class="advice-stats">
            <div><span>Kansscore</span><strong>{{ score(selected.kansScore) }} / 100</strong></div>
            <div><span>Extra kosten per woning per jaar</span><strong>{{ euro.format(selected.kosten) }}</strong></div>
            <div><span>Woningen</span><strong>{{ number.format(selected.woningen) }}</strong></div>
            <div><span>Goedkoopste route</span><strong>{{ routeLabel(routeVanGebied(selected)) }}</strong></div>
          </div>
          <p class="advice-text">
            <template v-if="level === 'wijk'">
              <strong>Route:</strong> {{ routeLabel(routeVanGebied(selected)) }} is de goedkoopste route voor de meeste woningen in deze wijk.
              <template v-if="routeMix"> Verdeling over de woningen: {{ routeMix }}.</template>
              Grootste variant: {{ VARIANTEN[selected.variant] ?? selected.variant }}.
            </template>
            <template v-else>
              <strong>Route volgens PBL:</strong> {{ VARIANTEN[selected.variant] ?? strategyText(selected.variant) }}.
            </template>
            Kosten­score {{ score(selected.kostenScore) }} (goedkoper dan {{ score(selected.kostenScore) }}% van de Zeeuwse {{ config.plural }})
            en omvangscore {{ score(selected.omvangScore) }} (meer woningen dan {{ score(selected.omvangScore) }}%).
          </p>

          <div v-if="indicatie" class="household">
            <h3>Eerste inschatting voor een gemiddelde woning</h3>
            <div class="advice-stats">
              <div><span>Energierekening nu</span><strong>{{ euro.format(indicatie.energieVoor) }} /jaar</strong></div>
              <div><span>Energierekening daarna</span><strong>{{ euro.format(indicatie.energieNa) }} /jaar</strong></div>
              <div><span>Jaarlasten isolatie en installatie</span><strong>{{ euro.format(indicatie.jaarlasten) }} /jaar</strong></div>
              <div><span>Netto per jaar</span><strong :class="indicatie.netto >= 0 ? 'positive' : 'negative'">{{ euro.format(indicatie.netto) }}</strong></div>
            </div>
            <table class="horizon-table">
              <caption>Netto resultaat over de jaren (zonder subsidie, prijsstijgingen of rente)</caption>
              <thead><tr><th scope="col">10 jaar</th><th scope="col">20 jaar</th><th scope="col">30 jaar</th></tr></thead>
              <tbody>
                <tr>
                  <td v-for="jaren in [10, 20, 30]" :key="jaren" :class="indicatie.horizon[jaren] >= 0 ? 'positive' : 'negative'">
                    {{ euro.format(indicatie.horizon[jaren]) }}
                  </td>
                </tr>
              </tbody>
            </table>
            <details>
              <summary>Hoe komen we aan deze bedragen?</summary>
              <ul>
                <li><strong>Energierekening nu:</strong> wat een gemiddelde woning hier ongeveer betaalt voor gas en stroom.</li>
                <li><strong>Energierekening daarna:</strong> wat je betaalt na de overstap.<template v-if="indicatie.warmtenet"> Bij een warmtenet gaan we ervan uit dat de warmte even duur is als het gas nu.</template></li>
                <li><strong>Jaarlasten:</strong> de kosten van isolatie en de nieuwe installatie, verdeeld over de jaren dat ze meegaan.</li>
                <li><strong>Netto per jaar:</strong> wat je bespaart op de energierekening, min de jaarlasten.</li>
                <li>We rekenen met {{ euro2.format(AANNAMES.gasprijs) }} per m³ gas en {{ euro2.format(AANNAMES.stroomprijs) }} per kWh stroom. Subsidies, leningen en prijsstijgingen zitten er nog niet in. Jouw eigen woning kan dus flink afwijken.</li>
              </ul>
            </details>
          </div>
        </template>
      </template>
      <p v-else class="sidebar-hint">Selecteer een {{ config.singular }} op de kaart of in de lijst om het advies te zien.</p>
    </section>

    <section class="method" aria-labelledby="method-title">
      <h2 id="method-title">Hoe bepalen we kansrijk?</h2>
      <p>
        Elke {{ config.singular }} krijgt een kansscore van 0 tot 100. Hoe hoger, hoe beter de plek om te beginnen.
        De score kijkt naar twee vragen:
      </p>
      <ul class="method-questions">
        <li>
          <strong>Hoe goedkoop is het? ({{ GEWICHT_KOSTEN * 100 }}% van de score)</strong>
          Het Planbureau voor de Leefomgeving (PBL) heeft voor elke buurt uitgerekend wat de goedkoopste manier is om van het aardgas af te gaan,
          en wat dat per woning per jaar kost. Hoe goedkoper vergeleken met de rest van Zeeland, hoe hoger de score.
        </li>
        <li>
          <strong>Hoeveel woningen staan er? ({{ GEWICHT_OMVANG * 100 }}% van de score)</strong>
          Met veel woningen tegelijk kun je meer bereiken. Meer woningen geeft een hogere score.
        </li>
      </ul>
      <h3>Wat betekenen de kleuren?</h3>
      <ul class="method-classes">
        <li v-for="klasse in KLASSEN" :key="klasse.key">
          <i :style="{ background: klasse.color }" aria-hidden="true"></i>
          <strong>{{ klasse.label }}:</strong> {{ klasse.uitleg }}
        </li>
      </ul>
      <h3>Goed om te weten</h3>
      <ul class="method-notes">
        <li>Dit is een eerste verkenning, geen besluit. Of een wijk echt van het gas af gaat, beslist de gemeente samen met inwoners.</li>
        <li>Dingen als draagvlak in de buurt en ruimte op het stroomnet zitten nog niet in de score.</li>
        <li>Een wijk is een groep buurten. Bij wijken tellen we de buurten bij elkaar op en vergelijken we wijken met elkaar.</li>
        <li>
          De <strong>goedkoopste route</strong> is de manier van verwarmen die volgens PBL het minst kost:
          een <strong>warmtenet</strong> (warmte via leidingen in de wijk), <strong>all-electric</strong> (een eigen elektrische warmtepomp)
          of <strong>hybride</strong> (een warmtepomp die op koude dagen bijstookt met groen gas). Bij een wijk is dat de route voor de meeste woningen.
        </li>
      </ul>
      <p class="map-source">
        Bron kosten en woningen: <a href="https://dataportaal.pbl.nl/Startanalyse_aardgasvrije_buurten/2026">PBL Startanalyse aardgasvrije buurten 2026</a> (CC BY 4.0).
        Grenzen: <a href="https://api.pdok.nl/cbs/wijken-en-buurten-2026/ogc/v1">CBS Wijk- en Buurtkaart 2026 via PDOK</a>.
      </p>
    </section>
  </section>
</template>
