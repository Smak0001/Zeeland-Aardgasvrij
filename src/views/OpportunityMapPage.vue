<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const mapElement = ref(null)
const tileError = ref(false)
let map

onMounted(() => {
  map = L.map(mapElement.value, { scrollWheelZoom: false, zoomControl: false }).setView([51.49, 3.85], 9)
  L.control.zoom({ position: 'topright', zoomInTitle: 'Inzoomen', zoomOutTitle: 'Uitzoomen' }).addTo(map)
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).on('tileerror', () => { tileError.value = true }).addTo(map)
})

onBeforeUnmount(() => { map?.remove() })
</script>

<template>
  <section class="map-page" aria-labelledby="map-title">
    <div class="map-heading">
      <div>
        <p class="eyebrow">Aardgasvrij Zeeland</p>
        <h1 id="map-title">Kansenkaart</h1>
        <p class="map-description">Kansen voor aardgasvrije wijken in Zeeland.</p>
      </div>
    </div>

    <div class="map-panel">
      <div ref="mapElement" class="opportunity-map" role="region" aria-label="Interactieve kaart van Zeeland"></div>
      <p v-if="tileError" class="map-error" role="status">
        De achtergrondkaart kan niet volledig worden geladen. Controleer je internetverbinding.
      </p>
    </div>
    <p class="map-data-status">Nog geen gebiedsgegevens beschikbaar.</p>
  </section>
</template>
