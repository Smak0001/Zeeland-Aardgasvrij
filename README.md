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
- `src/lib/neighborhoods.js`: zoeken op naam en filteren op gemeente.
- `src/lib/opportunities.js`: de kansberekening (kansScore, klassen, wijkcijfers en bewonersindicatie).
- `public/data/zeeland-buurten-2026.geojson` en `zeeland-wijken-2026.geojson`: echte CBS-grenzen voor Zeeland.
- `public/data/zeeland-kansen.json`: kosten, strategie en woningen per buurt uit de PBL Startanalyse 2026.
- `src/router.js`: de routes tussen de pagina’s; hash-routes werken ook op statische hosting.
- `src/assets/main.css`: de algemene styling, ook voor mobiel.
- `src/main.js`: start de Vue-app.
- `public/`: bestanden die rechtstreeks beschikbaar moeten zijn, zoals een favicon.

Maak nieuwe componenten in `src/components/` en importeer ze in `App.vue`.
De basis gebruikt gewone JavaScript en CSS. Voeg extra libraries toe zodra je ze nodig hebt.

De kansenkaart gebruikt Leaflet en OpenStreetMap-achtergrondtegels. Voor de
achtergrondkaart is internet nodig. Grenzen en kansgegevens zijn lokaal beschikbaar.
Je kunt wisselen tussen buurten en wijken, filteren op gemeente en zoeken op naam.

## Grenzen

De kaart gebruikt de [CBS Wijk- en Buurtkaart 2026 via PDOK](https://api.pdok.nl/cbs/wijken-en-buurten-2026/ogc/v1).
De snapshots bevatten de buurten en wijken van de dertien Zeeuwse gemeenten, zonder watergebieden.
Alleen grenzen, namen en gebiedscodes worden opgeslagen; coördinaten worden afgerond
op zes decimalen.

Ververs de snapshot met `npm run data:update` (internet nodig). De bron,
het indelingsjaar en het ophaalmoment staan in de metadata van het GeoJSON-bestand.
Een gewone build en de GitHub-controle gebruiken het opgeslagen bestand.

## Kansen (PBL Startanalyse 2026)

`npm run data:kansen` haalt de buurtbestanden van de
[PBL Startanalyse aardgasvrije buurten 2026](https://dataportaal.pbl.nl/Startanalyse_aardgasvrije_buurten/2026)
op (een ZIP per gemeente, in `data/startanalyse/2026/`, niet in git) en schrijft
`public/data/zeeland-kansen.json`. Met `--vernieuw` worden de ZIP's opnieuw gedownload
(`npm run data:kansen -- --vernieuw`). Het script heeft `unzip` nodig.

Hoe de kansscore, de klassen, de wijkcijfers en de bewonersindicatie precies worden
berekend, met welke PBL-velden en welke aannames, staat in
[`docs/BEREKENING.md`](docs/BEREKENING.md). Op de kaartpagina staat een eenvoudige
uitleg voor inwoners.

## Tests

```sh
npm test
```

## Productiebuild

```sh
npm run build
npm run preview
```

De build komt in `dist/`. Met `preview` bekijk je die build lokaal.

## Automatische controles op GitHub :)

De workflow `.github/workflows/ci.yml` draait bij iedere push en pull request.
Je kunt hem ook handmatig starten via het tabblad **Actions** op GitHub.
Hij heeft twee onderdelen die tegelijk draaien:

- **Tests draaien en productiebuild maken:** voert `npm test` uit (de kansberekening,
  zoeken en filteren, en of elke buurt op de kaart kansgegevens heeft), maakt de build
  met `npm run build` en controleert of de grenzen en `zeeland-kansen.json` in `dist/data/` staan.
- **Devserver starten:** voert `npm install` uit, start `npm run dev` en controleert of de
  devserver binnen 30 seconden via HTTP bereikbaar is.

Faalt een van beide, dan wordt de push of pull request rood gemarkeerd.

Na het committen en pushen van deze bestanden verschijnen de resultaten onder
**Actions → Applicatie controleren**.

## Editor

Voor VS Code staat de extensie **Vue - Official** bij de aanbevolen extensies.

Documentatie: [Vue](https://vuejs.org/guide/) en [Vite](https://vite.dev/guide/).
