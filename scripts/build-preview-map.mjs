import { readFile, writeFile } from 'node:fs/promises'
import { KLASSEN, aggregeerWijken, beoordeel } from '../src/lib/opportunities.js'

// Maakt een kleine, statische kaart van de Zeeuwse wijken voor de homepage, gekleurd
// per kansklasse. De homepage hoeft zo niet de grote kaartbestanden te laden.
const width = 600
const dataDirectory = new URL('../public/data/', import.meta.url)
const wijken = JSON.parse(await readFile(new URL('zeeland-wijken-2026.geojson', dataDirectory), 'utf8'))
const { buurten } = JSON.parse(await readFile(new URL('zeeland-kansen.json', dataDirectory), 'utf8'))

const records = aggregeerWijken(buurten)
const scores = beoordeel(records)
const colors = new Map(KLASSEN.map(({ key, color }) => [key, color]))

// Eenvoudige projectie: lengtegraden krimpen met de cosinus van de breedtegraad.
let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity]
for (const { geometry } of wijken.features) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  for (const [x, y] of polygons.flat(2)) {
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)
  }
}
const xScale = Math.cos((((minY + maxY) / 2) * Math.PI) / 180)
const scale = width / ((maxX - minX) * xScale)
const height = Math.ceil((maxY - minY) * scale)
const project = ([x, y]) => [Math.round((x - minX) * xScale * scale), Math.round((maxY - y) * scale)]

// Punten die op minder dan anderhalve pixel van het vorige punt liggen, voegen op dit formaat niets toe.
function ringPath(ring) {
  const kept = []
  for (const point of ring.map(project)) {
    const last = kept.at(-1)
    if (!last || Math.hypot(point[0] - last[0], point[1] - last[1]) >= 1.5) kept.push(point)
  }
  if (kept.length < 3) return ''
  return `M${kept.map(([x, y]) => `${x} ${y}`).join('L')}Z`
}

const paths = wijken.features.map(({ id, geometry }) => {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  const d = polygons.flatMap((polygon) => polygon.map(ringPath)).join('')
  const color = colors.get(scores.get(id)?.klasse ?? 'onbekend')
  return d ? `<path fill="${color}" d="${d}"/>` : ''
})

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`
  + `<g stroke="#fff" stroke-width="0.6" stroke-linejoin="round" fill-rule="evenodd">${paths.join('')}</g></svg>`

await writeFile(new URL('zeeland-kansen-preview.svg', dataDirectory), svg)
console.log(`${paths.filter(Boolean).length} wijken getekend, ${(svg.length / 1024).toFixed(0)} kB`)
