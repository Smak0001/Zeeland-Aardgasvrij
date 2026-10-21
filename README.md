# Zeeland Aardgasvrij

Een eenvoudige basis met Vue 3, JavaScript en Vite.

## Lokaal starten

Gebruik Node.js 22.18+ (22.x) of 24.11+ en npm.

```sh
npm install
npm run dev
```

Open het lokale adres dat Vite in je terminal toont. Wijzigingen in je code
worden tijdens het ontwikkelen direct zichtbaar.

## Waar begin je?

- `src/App.vue`: de gedeelde navigatie, pagina-indeling en footer.
- `src/views/HomePage.vue`: de korte introductie op de homepage.
- `src/views/OpportunityMapPage.vue`: de interactieve kaart voor aardgasvrije wijken.
- `src/lib/neighborhoods.js`: zoeken op buurtnaam en filteren op gemeente.
- `public/data/zeeland-buurten-2025.geojson`: echte CBS-buurtgrenzen voor Zeeland.
- `src/router.js`: de routes tussen de pagina’s; hash-routes werken ook op statische hosting.
- `src/assets/main.css`: de algemene styling, ook voor mobiel.
- `src/main.js`: start de Vue-app.
- `public/`: bestanden die rechtstreeks beschikbaar moeten zijn, zoals een favicon.

Maak nieuwe componenten in `src/components/` en importeer ze in `App.vue`.
De basis gebruikt gewone JavaScript en CSS. Voeg extra libraries toe zodra je ze nodig hebt.

De kansenkaart gebruikt Leaflet en OpenStreetMap-achtergrondtegels. Voor de
achtergrondkaart is internet nodig. De buurtgrenzen zijn lokaal beschikbaar,
inclusief zoeken op buurtnaam, filteren op gemeente en buurtselectie.
Er zijn nog geen kansbeoordelingen gekoppeld.

## Buurtgrenzen

De kaart gebruikt de [CBS Wijk- en Buurtkaart 2025 via PDOK](https://api.pdok.nl/cbs/wijken-en-buurten-2025/ogc/v1).
De snapshot bevat de buurten van de dertien Zeeuwse gemeenten, zonder watergebieden.
Alleen grenzen, namen en gebiedscodes worden opgeslagen; coördinaten worden afgerond
op zes decimalen. Dit zijn geen berekende aardgasvrij-kansen.

Ververs de snapshot met `npm run data:update` (internet nodig). De bron,
het indelingsjaar en het ophaalmoment staan in de metadata van het GeoJSON-bestand.
Een gewone build en de GitHub-controle gebruiken het opgeslagen bestand.

Controleer zoeken, filtering en de brongegevens met `node --test tests/neighborhoods.test.js`.

## Productiebuild

```sh
npm run build
npm run preview
```

De build komt in `dist/`. Met `preview` bekijk je die build lokaal.

## Automatische controles op GitHub :)

De workflow `.github/workflows/ci.yml` draait bij iedere push en pull request.
Je kunt hem ook handmatig starten via het tabblad **Actions** op GitHub.
Hij voert `npm install` uit, start `npm run dev` en controleert of de devserver
binnen 30 seconden via HTTP bereikbaar is. Daarna wordt de server gestopt.
Deze controle hangt niet af van specifieke pagina-inhoud of functies.

Na het committen en pushen van deze bestanden verschijnen de resultaten onder
**Actions → Applicatie controleren**.

## Editor

Voor VS Code staat de extensie **Vue - Official** bij de aanbevolen extensies.

Documentatie: [Vue](https://vuejs.org/guide/) en [Vite](https://vite.dev/guide/).
