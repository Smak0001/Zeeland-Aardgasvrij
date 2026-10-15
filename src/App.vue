<script setup>
import StarterCounter from './components/StarterCounter.vue'
</script>

<template>
  <main class="container">
    <header class="brand">Zeeland <span>Aardgasvrij</span></header>
    <section class="intro" aria-labelledby="page-title">
      <p class="eyebrow">Een nieuw begin</p>
      <h1 id="page-title">Samen bouwen aan een aardgasvrij Zeeland.</h1>
      <p class="description">
        Dit is de basis van je project. Vanaf hier kun je pagina’s, componenten
        en functionaliteit toevoegen.
      </p>
    </section>
    <section class="card" aria-labelledby="example-title">
      <h2 id="example-title">Je eerste Vue-component</h2>
      <p>Probeer de teller om te zien hoe Vue de pagina bijwerkt.</p>
      <StarterCounter />
    </section>
    <footer>Gebouwd met Vue en JavaScript. Klaar voor jouw ideeën.</footer>
  </main>
</template>

