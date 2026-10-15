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

- `src/App.vue`: het startscherm en de indeling van je app.
- `src/components/StarterCounter.vue`: een herbruikbaar voorbeeldcomponent met
  reactieve JavaScript-state en klikacties.
- `src/assets/main.css`: de algemene styling, ook voor mobiel.
- `src/main.js`: start de Vue-app.
- `public/`: bestanden die rechtstreeks beschikbaar moeten zijn, zoals een favicon.

Maak nieuwe componenten in `src/components/` en importeer ze in `App.vue`.
De basis gebruikt gewone JavaScript en CSS. Voeg extra libraries toe zodra je ze nodig hebt.

## Productiebuild

```sh
npm run build
npm run preview
```

De build komt in `dist/`. Met `preview` bekijk je die build lokaal.

## Editor

Voor VS Code staat de extensie **Vue - Official** bij de aanbevolen extensies.

Documentatie: [Vue](https://vuejs.org/guide/) en [Vite](https://vite.dev/guide/).
