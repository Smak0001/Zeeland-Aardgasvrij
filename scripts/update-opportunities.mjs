import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// PBL Startanalyse aardgasvrije buurten 2026: per gemeente een ZIP met CSV's.
// Bron: https://dataportaal.pbl.nl/Startanalyse_aardgasvrije_buurten/2026 (CC BY 4.0 NL)
const year = 2026
const source = `https://dataportaal.pbl.nl/data/Startanalyse_aardgasvrije_buurten/${year}/Gemeentedata_op_buurtniveau`
const municipalities = [
  'Borsele', 'Goes', 'Hulst', 'Kapelle', 'Middelburg', 'Noord-Beveland', 'Reimerswaal',
  'Schouwen-Duiveland', 'Sluis', 'Terneuzen', 'Tholen', 'Veere', 'Vlissingen',
]
const dataDirectory = new URL(`../data/startanalyse/${year}/`, import.meta.url)
const zipDirectory = new URL('zip/', dataDirectory)
const csvDirectory = new URL('csv/', dataDirectory)

// Haalt de ZIP's alleen op als ze nog niet lokaal staan; met --vernieuw opnieuw.
const refresh = process.argv.includes('--vernieuw')
await mkdir(zipDirectory, { recursive: true })
await mkdir(csvDirectory, { recursive: true })
for (const municipality of municipalities) {
  const zipFile = new URL(`${municipality}.zip`, zipDirectory)
  if (!refresh && existsSync(zipFile)) continue
  const response = await fetch(`${source}/${municipality}.zip`, { signal: AbortSignal.timeout(60_000) })
  if (!response.ok) throw new Error(`PBL ophalen mislukt voor ${municipality}: ${response.status}`)
  await writeFile(zipFile, Buffer.from(await response.arrayBuffer()))
  console.log(`${municipality}.zip opgehaald`)
}
for (const municipality of municipalities) {
  execFileSync('unzip', ['-q', '-o', fileURLToPath(new URL(`${municipality}.zip`, zipDirectory)), '-d', fileURLToPath(csvDirectory)])
}

// De CSV's gebruiken ';' als scheidingsteken en een komma als decimaalteken.
// Lege cellen staan als '-'. Eén kolom (LN_0BCM_combined.csv) gebruikt een punt;
// die kolom gebruiken we niet.
function parseNumber(value) {
  if (value === undefined || value === '' || value === '-') return null
  const number = Number(value.replace(',', '.'))
  if (!Number.isFinite(number)) throw new Error(`Geen getal: ${value}`)
  return number
}

const lowest = 'Laagste_Nationale_Kosten'
const reference = 'Referentie_2030'
const buurten = new Map()
let mismatches = 0

for (const file of (await readdir(csvDirectory)).filter((name) => name.endsWith('_strategie.csv')).sort()) {
  const lines = (await readFile(new URL(file, csvDirectory), 'utf8')).split(/\r?\n/).filter(Boolean)
  const header = lines[0].split(';')
  const column = (name) => {
    const index = header.indexOf(name)
    if (index < 0) throw new Error(`Kolom ${name} ontbreekt in ${file}`)
    return index
  }
  const indicator = column('Code_Indicator')
  const rows = lines.slice(1).map((line) => line.split(';'))
  if (rows.some((row) => row.length !== header.length)) throw new Error(`Onverwacht aantal kolommen in ${file}`)

  // PBL schrijft een apostrof dubbel ("''s-Gravenpolder"); we zetten die terug.
  const text = (row, name) => row[column(name)].replaceAll("''", "'")

  for (const row of rows) {
    const code = row[column('I01_buurtcode')]
    if (!buurten.has(code)) {
      buurten.set(code, {
        code,
        naam: text(row, 'I02_buurtnaam'),
        wijkcode: row[column('I03_wijkcode')],
        wijknaam: text(row, 'I04_wijknaam'),
        gemeentecode: row[column('I05_gemeentecode')],
        gemeente: text(row, 'I06_gemeentenaam'),
        woningen: parseNumber(row[column('I09_aantal_woningen [Aansluiting]')]),
        weq: parseNumber(row[column('I11_woningequivalenten [Woning]')]),
        uitgesloten: row[column('I13_Uitgesloten')] !== 'False',
        indicatoren: new Map(),
      })
    }
    buurten.get(code).indicatoren.set(row[indicator], row)
  }

  // PBL rekent strategie 4 (groen gas) alleen mee als de buurt groen gas toegewezen
  // krijgt. Daarom nemen we PBL's eigen laagste-kostenkolom en niet het minimum van S1–S4.
  for (const buurt of buurten.values()) {
    if (buurt.kosten !== undefined) continue
    const value = (code, kolom) => {
      const row = buurt.indicatoren.get(code)
      return row ? row[column(kolom)] : undefined
    }
    const number = (code, kolom) => parseNumber(value(code, kolom))
    buurt.variant = value('V01_Strategievariant', lowest) ?? null
    buurt.kosten = buurt.uitgesloten ? null : number('H18_Nat_meerkost_WEQ', lowest)
    buurt.kostenTotaal = buurt.uitgesloten ? null : number('H16_Nat_meerkost', lowest)

    const variantColumn = header.find((name) => name.toLowerCase().startsWith(`variant_${buurt.variant}_`))
    if (buurt.kosten !== null && variantColumn && number('H18_Nat_meerkost_WEQ', variantColumn) !== buurt.kosten) mismatches++

    const schil = number('K19_Gebouw_schil_w', lowest)
    const installatie = number('K20_Gebouw_installatie_w', lowest)
    buurt.jaarlastenWoning = schil !== null && installatie !== null && buurt.woningen
      ? Math.round((schil + installatie) / buurt.woningen) : null
    buurt.gasVoor = number('H35_Input_aardgas_w', reference)
    buurt.elekVoor = number('H37_Input_elektriciteit_w', reference)
    const gasNa = number('H35_Input_aardgas_w', lowest)
    const groenGasNa = number('H36_Input_KlimaatneutraalGas_w', lowest)
    buurt.gasNa = gasNa === null ? null : gasNa + (groenGasNa ?? 0)
    buurt.elekNa = number('H37_Input_elektriciteit_w', lowest)
    delete buurt.indicatoren
  }
}

const rows = [...buurten.values()].sort((a, b) => a.code.localeCompare(b.code))
const counts = new Map()
for (const row of rows) counts.set(row.gemeente, (counts.get(row.gemeente) ?? 0) + 1)
if (counts.size !== municipalities.length) throw new Error(`Verwacht ${municipalities.length} gemeenten, gevonden ${counts.size}`)
for (const [municipality, count] of counts) console.log(`${municipality}: ${count} buurten`)
console.log(`Zonder kosten: ${rows.filter((row) => row.kosten === null).length}`)
console.log(`Laagste kosten wijkt af van de gekozen variantkolom: ${mismatches}`)

const output = {
  metadata: {
    title: `PBL Startanalyse aardgasvrije buurten ${year} — Zeeuwse buurten`,
    year,
    source: `https://dataportaal.pbl.nl/Startanalyse_aardgasvrije_buurten/${year}`,
    license: 'CC BY 4.0 NL',
    retrievedAt: new Date().toISOString(),
    fields: {
      kosten: 'H18 nationale meerkosten per woningequivalent (euro/jaar) in PBL\'s laagste-kostenvariant',
      kostenTotaal: 'H16 nationale meerkosten van de hele buurt (euro/jaar) in dezelfde variant',
      variant: 'V01 code van PBL\'s goedkoopste variant (s1a t/m s4b)',
      woningen: 'I09 aantal woningen',
      weq: 'I11 woningequivalenten (woningen plus utiliteit omgerekend)',
      jaarlastenWoning: 'K19 + K20 kapitaalslasten isolatie en installatie van woningen, gedeeld door het aantal woningen (euro/jaar)',
      gasVoor: 'H35 aardgasinput woningen in Referentie 2030 (GJ per woning per jaar)',
      elekVoor: 'H37 elektriciteitsinput woningen in Referentie 2030 (GJ per woning per jaar)',
      gasNa: 'H35 + H36 aardgas en groen gas woningen in de goedkoopste variant (GJ per woning per jaar)',
      elekNa: 'H37 elektriciteitsinput woningen in de goedkoopste variant (GJ per woning per jaar)',
    },
  },
  buurten: rows,
}

const outputFile = new URL('../public/data/zeeland-kansen.json', import.meta.url)
await writeFile(outputFile, JSON.stringify(output))
console.log(`${rows.length} buurten opgeslagen in public/data/zeeland-kansen.json`)
