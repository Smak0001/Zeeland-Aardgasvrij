function normalize(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('nl').trim()
}

export function filterNeighborhoods(features, municipalityCode, query) {
  const search = normalize(query)
  return features.filter(({ properties }) =>
    (!municipalityCode || properties.gemeentecode === municipalityCode)
    && (!search || normalize(properties.buurtnaam).includes(search)))
}

export function getMunicipalities(features) {
  const municipalities = new Map(features.map(({ properties }) =>
    [properties.gemeentecode, { code: properties.gemeentecode, name: properties.gemeentenaam }]))
  return [...municipalities.values()].sort((a, b) => a.name.localeCompare(b.name, 'nl'))
}
