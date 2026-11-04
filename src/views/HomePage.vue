<script setup>
import { onBeforeUnmount, onMounted, shallowRef } from 'vue'
import { zeelandCijfers } from '../lib/opportunities.js'

const number = new Intl.NumberFormat('nl-NL')
const cijfers = shallowRef(null)
const request = new AbortController()

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

function share(aantal) {
  return Math.round((aantal / cijfers.value.woningen) * 100)
}
</script>

<template>
  <section class="intro" aria-labelledby="page-title">
    <p class="eyebrow">Zeeland Aardgasvrij</p>
    <h1 id="page-title">Samen op weg naar<br>een <em>aardgasvrij Zeeland.</em></h1>
    <p class="description">
      Waar kan Zeeland het goedkoopst veel woningen van het aardgas halen? En wat betekent dat voor jouw woning?
      Bekijk het per buurt en wijk, op basis van onderzoek van het Planbureau voor de Leefomgeving.
    </p>
    <div class="hero-actions">
      <RouterLink class="button" to="/kansenkaart">
        Bekijk de kansenkaart <span aria-hidden="true">→</span>
      </RouterLink>
      <RouterLink class="button button-secondary" :to="{ path: '/kansenkaart', query: { locatie: '1' } }">
        Zoek mijn buurt
      </RouterLink>
    </div>
  </section>

  <section class="key-figures" aria-labelledby="figures-title">
    <div class="section-heading">
      <p class="eyebrow">Zeeland in cijfers</p>
      <h2 id="figures-title">Waar staan we?</h2>
    </div>
    <div v-if="cijfers" class="figure-grid">
      <div class="figure">
        <strong>{{ number.format(cijfers.woningen) }}</strong>
        <span>woningen in {{ cijfers.buurten }} Zeeuwse buurten</span>
      </div>
      <div class="figure">
        <strong>{{ cijfers.kansrijkeBuurten }}</strong>
        <span>kansrijke buurten, samen {{ number.format(cijfers.kansrijkeWoningen) }} woningen ({{ share(cijfers.kansrijkeWoningen) }}%)</span>
      </div>
      <div class="figure">
        <strong>{{ number.format(cijfers.woningenPerRoute.warmtenet) }}</strong>
        <span>woningen waar een warmtenet het goedkoopst is ({{ share(cijfers.woningenPerRoute.warmtenet) }}%)</span>
      </div>
      <div class="figure">
        <strong>{{ number.format(cijfers.woningenPerRoute.hybride) }}</strong>
        <span>woningen waar een hybride warmtepomp met groen gas het goedkoopst is ({{ share(cijfers.woningenPerRoute.hybride) }}%)</span>
      </div>
    </div>
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
</template>
