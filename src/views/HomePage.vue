<script setup>
import { computed, onBeforeUnmount, onMounted, shallowRef } from 'vue'
import { KLASSEN, ROUTES, zeelandCijfers } from '../lib/opportunities.js'

const number = new Intl.NumberFormat('nl-NL')
const cijfers = shallowRef(null)
const request = new AbortController()
const previewMap = `${import.meta.env.BASE_URL}data/zeeland-kansen-preview.svg`
const legend = KLASSEN.filter(({ key }) => key !== 'zeer-kansrijk')

const steps = [
  { title: 'Kies je buurt of wijk', text: 'Zoek op naam of gebruik je locatie om direct bij je eigen buurt uit te komen.' },
  { title: 'Bekijk de kansen', text: 'Zie de kansscore en welke manier van verwarmen hier het goedkoopst is.' },
  { title: 'Zie wat het betekent', text: 'Een eerste inschatting van de energierekening en kosten voor een gemiddelde woning.' },
]

// Volgorde en kleuren van de routebalk; los van de klassekleuren op de kaart.
const routeColors = { hybride: '#7fbfbd', warmtenet: '#006984', 'all-electric': '#233d5a' }
const routeShares = computed(() => {
  if (!cijfers.value) return []
  const total = Object.values(cijfers.value.woningenPerRoute).reduce((som, aantal) => som + aantal, 0)
  return Object.entries(cijfers.value.woningenPerRoute)
    .map(([key, woningen]) => ({ key, label: ROUTES[key].label, woningen, share: woningen / total, color: routeColors[key] }))
    .sort((a, b) => b.share - a.share)
})

onMounted(async () => {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}data/zeeland-kansen.json`, {
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(30_000)]),
    })
    if (!response.ok) return
    const data = await response.json()
    if (Array.isArray(data.buurten)) cijfers.value = zeelandCijfers(data.buurten)
  } catch {
    // Zonder cijfers blijft de rest van de homepage gewoon bruikbaar.
  }
})
onBeforeUnmount(() => request.abort())

function percent(share) {
  return `${Math.round(share * 100)}%`
}
</script>

<template>
  <section class="home-hero" aria-labelledby="page-title">
    <div class="hero-text">
      <p class="hero-kicker">Kansenkaart voor Zeeland</p>
      <h1 id="page-title">Samen op weg naar een aardgasvrij Zeeland</h1>
      <p class="hero-lead">
        Zie per buurt en wijk waar Zeeland het goedkoopst veel woningen van het aardgas kan halen,
        en wat dat betekent voor jouw woning.
      </p>
      <div class="hero-actions">
        <RouterLink class="pill-link" :to="{ path: '/kansenkaart', query: { locatie: '1' } }">Zoek mijn buurt</RouterLink>
        <RouterLink class="arrow-link" to="/kansenkaart">Bekijk de kansenkaart</RouterLink>
      </div>
    </div>
    <RouterLink class="hero-map" to="/kansenkaart" aria-label="Naar de kansenkaart">
      <img :src="previewMap" width="600" height="596" alt="Kaart van Zeeland met de kansklasse per wijk" loading="eager">
      <ul class="hero-legend" aria-hidden="true">
        <li v-for="klasse in legend" :key="klasse.key"><i :style="{ background: klasse.color }"></i>{{ klasse.label }}</li>
      </ul>
    </RouterLink>
  </section>

  <section class="home-steps" aria-labelledby="steps-title">
    <h2 id="steps-title" class="home-title">Zo werkt het</h2>
    <ol class="step-list">
      <li v-for="step in steps" :key="step.title">
        <h3>{{ step.title }}</h3>
        <p>{{ step.text }}</p>
      </li>
    </ol>
  </section>

  <section class="key-figures" aria-labelledby="figures-title">
    <h2 id="figures-title" class="home-title">Zeeland in cijfers</h2>
    <template v-if="cijfers">
      <div class="figure-grid">
        <div class="figure">
          <strong>{{ number.format(cijfers.woningen) }}</strong>
          <span>woningen in {{ cijfers.buurten }} Zeeuwse buurten</span>
        </div>
        <div class="figure">
          <strong>{{ cijfers.kansrijkeBuurten }}</strong>
          <span>kansrijke buurten, samen {{ number.format(cijfers.kansrijkeWoningen) }} woningen ({{ percent(cijfers.kansrijkeWoningen / cijfers.woningen) }})</span>
        </div>
      </div>
      <div class="route-split">
        <h3>Goedkoopste manier van verwarmen, per woning</h3>
        <div class="route-bar" role="img" :aria-label="routeShares.map((item) => `${item.label} ${percent(item.share)}`).join(', ')">
          <span v-for="item in routeShares" :key="item.key" :style="{ flexGrow: item.share, background: item.color }"></span>
        </div>
        <ul class="route-legend">
          <li v-for="item in routeShares" :key="item.key">
            <i :style="{ background: item.color }" aria-hidden="true"></i>
            <strong>{{ percent(item.share) }}</strong> {{ item.label.toLowerCase() }}
            <small>({{ number.format(item.woningen) }} woningen)</small>
          </li>
        </ul>
      </div>
    </template>
    <p v-else class="figures-fallback">De cijfers worden geladen…</p>
    <p class="figures-context">
      De Zeeuwse gemeenten, de provincie en het waterschap willen in 2030 onder andere 59.000 woningen isoleren
      en het aardgasverbruik met 50% verminderen ten opzichte van 1990 (RES 2.0 Zeeland).
    </p>
    <p class="figures-source">
      Bron: <a href="https://dataportaal.pbl.nl/Startanalyse_aardgasvrije_buurten/2026">PBL Startanalyse aardgasvrije buurten 2026</a>.
      "Kansrijk" betekent een kansscore van 66 of hoger; <RouterLink to="/kansenkaart">op de kansenkaart</RouterLink> lees je hoe die werkt.
    </p>
  </section>

  <section class="home-callout" aria-labelledby="callout-title">
    <h2 id="callout-title" class="home-title">Wat betekent het voor jou?</h2>
    <div class="callout-actions">
      <RouterLink class="pill-link" :to="{ path: '/kansenkaart', query: { locatie: '1' } }">Voor inwoners: zoek mijn buurt</RouterLink>
      <RouterLink class="pill-link" to="/kansenkaart">Voor gemeenten: bekijk alle wijken</RouterLink>
    </div>
  </section>
</template>
