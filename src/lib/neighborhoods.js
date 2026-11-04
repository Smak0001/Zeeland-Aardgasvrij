function normalize(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('nl').trim()
}

export function filterNeighborhoods(features, municipalityCode, query, nameKey = 'buurtnaam') {
  const search = normalize(query)
  return features.filter(({ properties }) =>
    (!municipalityCode || properties.gemeentecode === municipalityCode)
    && (!search || normalize(properties[nameKey]).includes(search)))
}

// Ray casting: een punt ligt in een ring als een lijn ernaartoe de rand een oneven
// aantal keren kruist. Coördinaten zijn [lengtegraad, breedtegraad].
function inRing([x, y], ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

// De eerste ring is de buitenrand, de rest zijn gaten.
function inPolygon(point, [outer, ...holes]) {
  return inRing(point, outer) && !holes.some((hole) => inRing(point, hole))
}

export function findAreaAt(features, longitude, latitude) {
  const point = [longitude, latitude]
  return features.find(({ geometry }) => (geometry.type === 'Polygon'
    ? inPolygon(point, geometry.coordinates)
    : geometry.coordinates.some((polygon) => inPolygon(point, polygon)))) ?? null
}

export function getMunicipalities(features) {
  const municipalities = new Map(features.map(({ properties }) =>
    [properties.gemeentecode, { code: properties.gemeentecode, name: properties.gemeentenaam }]))
  return [...municipalities.values()].sort((a, b) => a.name.localeCompare(b.name, 'nl'))
}
