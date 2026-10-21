<template>
  <a class="skip-link" href="#inhoud" @click.prevent="$refs.content.focus()">Naar de inhoud</a>
  <header class="site-header container">
    <RouterLink class="brand" to="/">Zeeland <span>Aardgasvrij</span><span class="brand-dot" aria-hidden="true">.</span></RouterLink>
    <nav aria-label="Hoofdnavigatie">
      <RouterLink to="/">Home</RouterLink>
      <RouterLink to="/kansenkaart">Kansenkaart</RouterLink>
    </nav>
  </header>

  <main id="inhoud" ref="content" class="container" tabindex="-1">
    <RouterView />
  </main>

  <footer class="container site-footer">
    <span>Zeeland Aardgasvrij</span>
    <span>Deze website is in ontwikkeling.</span>
  </footer>
</template>
