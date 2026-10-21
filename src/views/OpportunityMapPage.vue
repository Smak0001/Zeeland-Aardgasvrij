<script setup>
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { filterNeighborhoods, getMunicipalities } from '../lib/neighborhoods.js'

const mapElement = ref(null)
const neighborhoods = shallowRef([])
const municipalityCode = ref('')
const search = ref('')
const selectedCode = ref(null)
const loading = ref(true)
const loadError = ref(false)
const tileError = ref(false)
const municipalities = computed(() => getMunicipalities(neighborhoods.value))
const filtered = computed(() => filterNeighborhoods(neighborhoods.value, municipalityCode.value, search.value))
const selected = computed(() => filtered.value.find(({ properties }) => properties.buurtcode === selectedCode.value))
const hasFilters = computed(() => Boolean(municipalityCode.value || search.value))
const request = new AbortController()
const cachedLayers = new Map()
let map
let visibleLayers

function boundaryStyle(feature) {
  const active = feature.properties.buurtcode === selectedCode.value
  return {
    color: active ? '#1f3f60' : '#007f9b',
    weight: active ? 3 : 1,
    fillColor: '#007f9b',
    fillOpacity: active ? 0.35 : 0.07,
  }
}

function selectNeighborhood(feature) {
  selectedCode.value = feature.properties.buurtcode
  const layer = cachedLayers.get(selectedCode.value)
  if (layer) map.fitBounds(layer.getBounds(), { padding: [24, 24], maxZoom: 14 })
}

function updateSelection() {
  visibleLayers?.eachLayer((layer) => layer.setStyle(boundaryStyle(layer.feature)))
  cachedLayers.get(selectedCode.value)?.bringToFront()
}

function showFilteredNeighborhoods() {
  if (!visibleLayers) return
  if (!filtered.value.some(({ properties }) => properties.buurtcode === selectedCode.value)) {
    selectedCode.value = null
  }
  visibleLayers.clearLayers()
  for (const feature of filtered.value) {
    const layer = cachedLayers.get(feature.properties.buurtcode)
    if (layer) visibleLayers.addLayer(layer)
  }
  updateSelection()
  const bounds = visibleLayers.getBounds()
  if (bounds.isValid()) map.fitBounds(bounds, { padding: [16, 16], maxZoom: 12 })
}

function resetFilters() {
  municipalityCode.value = ''
  search.value = ''
  selectedCode.value = null
  showFilteredNeighborhoods()
}

async function loadNeighborhoods() {
  loading.value = true
  loadError.value = false
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}data/zeeland-buurten-2025.geojson`, {
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(30_000)]),
    })
    if (!response.ok) throw new Error('Buurtgrenzen niet beschikbaar')
    const data = await response.json()
    if (data.type !== 'FeatureCollection' || !Array.isArray(data.features) || !data.features.length) {
      throw new Error('Ongeldig kaartbestand')
    }
    if (request.signal.aborted) return
    const features = data.features.sort((a, b) =>
      a.properties.buurtnaam.localeCompare(b.properties.buurtnaam, 'nl')
      || a.properties.gemeentenaam.localeCompare(b.properties.gemeentenaam, 'nl'))

    L.geoJSON(features, {
      style: boundaryStyle,
      onEachFeature(feature, layer) {
        const label = document.createElement('span')
        label.textContent = `${feature.properties.buurtnaam} · ${feature.properties.gemeentenaam}`
        layer.bindTooltip(label)
        layer.on('click', () => selectNeighborhood(feature))
        cachedLayers.set(feature.properties.buurtcode, layer)
      },
    })
    neighborhoods.value = features
    showFilteredNeighborhoods()
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
  loadNeighborhoods()
})

watch(filtered, showFilteredNeighborhoods)
watch(selectedCode, updateSelection)
onBeforeUnmount(() => {
  request.abort()
  cachedLayers.clear()
  map?.remove()
})
</script>

<template>
  <section class="map-page" aria-labelledby="map-title">
    <div class="map-heading">
      <div>
        <p class="eyebrow">Aardgasvrij Zeeland</p>
        <h1 id="map-title">Kansenkaart</h1>
        <p class="map-description">Zoek een buurt of kies een gemeente om het gebied te verkennen.</p>
      </div>
    </div>

    <div class="map-filters">
      <label for="municipality-filter">
        Gemeente
        <select id="municipality-filter" v-model="municipalityCode" :disabled="loading || loadError">
          <option value="">Heel Zeeland</option>
          <option v-for="municipality in municipalities" :key="municipality.code" :value="municipality.code">
            {{ municipality.name }}
          </option>
        </select>
      </label>
      <label for="neighborhood-search">
        Zoek op buurtnaam
        <input id="neighborhood-search" v-model="search" type="search" placeholder="Bijvoorbeeld Griffioen" :disabled="loading || loadError">
      </label>
      <button v-if="hasFilters" type="button" class="reset-filters" @click="resetFilters">Filters wissen</button>
    </div>

    <p v-if="loading" class="map-data-status" role="status">Buurtgrenzen laden…</p>
    <div v-else-if="loadError" class="map-load-error" role="alert">
      De buurtgrenzen konden niet worden geladen.
      <button type="button" @click="loadNeighborhoods">Opnieuw proberen</button>
    </div>
    <p v-else class="map-data-status" role="status">{{ filtered.length }} buurten gevonden</p>

    <div class="neighborhood-layout">
      <div class="map-panel">
        <div ref="mapElement" class="opportunity-map" role="region" aria-label="Interactieve kaart van Zeeland met CBS-buurtgrenzen"></div>
        <p v-if="tileError" class="map-error" role="status">
          De achtergrondkaart kan niet volledig worden geladen. De buurtgrenzen en zoekfunctie blijven beschikbaar.
        </p>
        <div class="boundary-legend">
          <span><i aria-hidden="true"></i> Buurtgrens</span>
          <span><i class="selected-boundary" aria-hidden="true"></i> Geselecteerde buurt</span>
        </div>
      </div>

      <aside class="neighborhood-sidebar" aria-labelledby="neighborhoods-title" :aria-busy="loading">
        <h2 id="neighborhoods-title">Buurten</h2>
        <p class="sidebar-hint">Selecteer een buurt op de kaart of in de lijst.</p>
        <ul v-if="filtered.length" class="neighborhood-list">
          <li v-for="feature in filtered" :key="feature.properties.buurtcode">
            <button type="button" :aria-pressed="selectedCode === feature.properties.buurtcode" @click="selectNeighborhood(feature)">
              <span>{{ feature.properties.buurtnaam }}</span>
              <small>{{ feature.properties.gemeentenaam }}</small>
            </button>
          </li>
        </ul>
        <p v-else-if="!loading && !loadError" class="sidebar-hint">Geen buurten gevonden. Pas je zoekopdracht of gemeente aan.</p>
        <div class="neighborhood-details" aria-live="polite" aria-atomic="true">
          <template v-if="selected">
            <h3>{{ selected.properties.buurtnaam }}</h3>
            <dl>
              <dt>Gemeente</dt><dd>{{ selected.properties.gemeentenaam }}</dd>
              <dt>Buurtcode</dt><dd>{{ selected.properties.buurtcode }}</dd>
            </dl>
          </template>
          <p v-else class="sidebar-hint">Nog geen buurt geselecteerd.</p>
        </div>
      </aside>
    </div>
    <p class="map-source">Buurtgrenzen: <a href="https://api.pdok.nl/cbs/wijken-en-buurten-2025/ogc/v1">CBS Wijk- en Buurtkaart 2025 via PDOK</a>.</p>
  </section>
</template>
