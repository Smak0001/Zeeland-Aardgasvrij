# Berekening van de kansenkaart

Dit document legt precies uit hoe de kansenkaart tot zijn uitkomsten komt: welke
data we gebruiken, welke velden, welke formules en welke keuzes we daarbij maken.
Op de website zelf staat een korte, eenvoudige versie voor inwoners.

De code staat in:

| Onderdeel | Bestand |
| --- | --- |
| Data ophalen en omzetten | [`scripts/update-opportunities.mjs`](../scripts/update-opportunities.mjs) (`npm run data:kansen`) |
| Grenzen ophalen | [`scripts/update-neighborhoods.mjs`](../scripts/update-neighborhoods.mjs) (`npm run data:update`) |
| Berekening | [`src/lib/opportunities.js`](../src/lib/opportunities.js) |
| Tests | [`tests/opportunities.test.js`](../tests/opportunities.test.js) (`npm test`) |

## 1. Bronnen

| Bron | Versie | Gebruikt voor | Licentie |
| --- | --- | --- | --- |
| [PBL Startanalyse aardgasvrije buurten](https://dataportaal.pbl.nl/Startanalyse_aardgasvrije_buurten/2026) | 2026 (bijgewerkt 7 oktober 2026) | kosten, strategie, woningen, energiegebruik, jaarlasten | CC BY 4.0 NL |
| [CBS Wijk- en Buurtkaart via PDOK](https://api.pdok.nl/cbs/wijken-en-buurten-2026/ogc/v1) | 2026 | grenzen en namen van buurten en wijken | CC BY 4.0 |

De PBL-data komt per gemeente als ZIP van
`https://dataportaal.pbl.nl/data/Startanalyse_aardgasvrije_buurten/2026/Gemeentedata_op_buurtniveau/<Gemeente>.zip`,
voor alle dertien Zeeuwse gemeenten. Elke ZIP bevat:

- `<Gemeente>_strategie.csv`: de resultaten per buurt (deze gebruiken we);
- `<Gemeente>_bebouwing.csv` en `<Gemeente>_totaalbebouwing.csv`: woningtypes, bouwjaren en labels (nu niet gebruikt);
- `README_gemeentebestanden.txt`: de uitleg van PBL.

### Dekking

Alle 453 buurten op de kaart staan in de Startanalyse 2026; de buurtindeling is gelijk
aan de CBS-indeling van 2026. Ook alle 169 wijken zijn gedekt.

- 3 buurten hebben geen kostencijfer (Brigdamsepad, Veerse Meer en Bedrijventerrein
  Oost-Souburg West; alle drie zonder woningen).
- 38 buurten hebben minder dan 10 woningen.

Die 38 buurten krijgen geen score en heten op de kaart "onbekend". De 3 buurten zonder
kostencijfer horen daar ook bij, want ze hebben 0 woningen.

## 2. Het CSV-formaat

Waar we op letten bij het inlezen van `_strategie.csv`:

- Het scheidingsteken is `;` en het decimaalteken een komma (`1242,0`).
- Uitzondering: de kolom `LN_0BCM_combined.csv` gebruikt een punt. Die kolom gebruiken we niet.
- Een lege waarde staat als `-`.
- Per buurt staat er **één rij per indicator** (83 indicatoren). De indicatorcode staat in
  `Code_Indicator`, de eenheid in `Eenheid`. Daarna volgen de kolommen per scenario:
  - `Laagste_Nationale_Kosten`;
  - `Referentie_2023` en `Referentie_2030`;
  - `Strategie_1` t/m `Strategie_4`;
  - de 18 varianten (`Variant_s1a_…` t/m `Variant_s4b_…`);
  - `Supplementair_…`.
- De eerste kolommen (`I01` t/m `I25`) beschrijven de buurt en herhalen zich op elke rij.
- Namen bevatten fouten: een apostrof staat dubbel (`''s-Gravenpolder`) en sommige
  tekens zijn verminkt (`E√©n`). Het script herstelt de dubbele apostrof, maar op de kaart
  tonen we altijd de CBS-namen.

## 3. Welke velden we gebruiken

Per buurt slaat het script deze velden op in `public/data/zeeland-kansen.json`:

| Veld | PBL-code | Kolom | Betekenis |
| --- | --- | --- | --- |
| `woningen` | `I09_aantal_woningen` | — | aantal woningen |
| `weq` | `I11_woningequivalenten` | — | woningequivalenten: woningen plus utiliteit, omgerekend naar woningen |
| `kosten` | `H18_Nat_meerkost_WEQ` | `Laagste_Nationale_Kosten` | nationale meerkosten in euro per woningequivalent per jaar |
| `kostenTotaal` | `H16_Nat_meerkost` | `Laagste_Nationale_Kosten` | nationale meerkosten van de hele buurt in euro per jaar |
| `variant` | `V01_Strategievariant` | `Laagste_Nationale_Kosten` | code van de goedkoopste variant (`s1a` t/m `s4b`) |
| `jaarlastenWoning` | `K19_Gebouw_schil_w` + `K20_Gebouw_installatie_w` | `Laagste_Nationale_Kosten` | jaarlasten van isolatie en installaties in woningen, gedeeld door `woningen` |
| `gasVoor` | `H35_Input_aardgas_w` | `Referentie_2030` | aardgas per woning in GJ per jaar, zonder aanpassing |
| `elekVoor` | `H37_Input_elektriciteit_w` | `Referentie_2030` | stroom per woning in GJ per jaar, zonder aanpassing |
| `gasNa` | `H35` + `H36_Input_KlimaatneutraalGas_w` | `Laagste_Nationale_Kosten` | aardgas plus groen gas per woning in GJ per jaar, na de aanpassing |
| `elekNa` | `H37_Input_elektriciteit_w` | `Laagste_Nationale_Kosten` | stroom per woning in GJ per jaar, na de aanpassing |

### Wat zijn "nationale meerkosten"?

PBL berekent wat het Nederland als geheel per jaar extra kost om een buurt aardgasvrij te
maken, vergeleken met doorgaan op aardgas (de referentie). Daarin zitten:

- isolatie en installaties, omgerekend naar jaarlijkse kosten;
- de aanleg en het onderhoud van warmte-, gas- en elektriciteitsnetten;
- energie-inkoop en projectkosten.

Belastingen, subsidies en heffingen zitten er niet in: het zijn kosten voor de maatschappij,
niet de rekening van één huishouden. Een negatief bedrag betekent dat aardgasvrij goedkoper
is dan de referentie.

### Waarom niet het minimum van S1–S4?

PBL rekent vier strategieën door. Elke strategie heeft varianten, waarbij de woningen
worden geïsoleerd tot label B of label D:

| Code | Strategie |
| --- | --- |
| S1 | Elektrische warmtepomp per woning (all-electric) |
| S2 | Warmtenet met middelhoge of hoge temperatuur (restwarmte, aardwarmte) |
| S3 | Warmtenet met lage temperatuur (warmte-koudeopslag, oppervlaktewater) |
| S4 | Hybride warmtepomp met groen gas |

Groen gas is schaars. PBL telt S4 daarom alleen mee als een buurt groen gas toegewezen
krijgt (indicator `H20_Toekenning_klimaatneutraal_gas`). Het simpele minimum van de
kolommen `Strategie_1` t/m `Strategie_4` kiest daardoor soms een route die PBL niet
haalbaar vindt. Alleen al in Middelburg gebeurt dat in 28 van de 72 buurten.

Wij gebruiken daarom PBL's eigen kolom `Laagste_Nationale_Kosten`. Het script controleert
dat het bedrag in die kolom gelijk is aan het bedrag in de kolom van de gekozen variant;
dat klopt voor alle buurten.

In Zeeland is de goedkoopste route:

| Strategie | Aantal buurten |
| --- | --- |
| S4 | 311 |
| S3 | 56 |
| S2 | 47 |
| S1 | 36 |
| zonder route | 3 |

## 4. De kansscore

Een gebied (buurt of wijk) krijgt alleen een score als er een kostencijfer is en er
minstens 10 woningen staan (`MIN_WONINGEN`). De andere gebieden heten "onbekend" en
tellen niet mee in de volgorde.

```
kostenScore = 1 − percentielrang(kosten)
omvangScore = percentielrang(woningen)
kansScore   = 0,7 × kostenScore + 0,3 × omvangScore
```

### Percentielrang

De gebieden met een score worden op volgorde gezet. Het laagste gebied krijgt rang 0,
het hoogste rang 1 en de rest wordt gelijkmatig daartussen verdeeld:
`rang = positie / (n − 1)`. Gelijke waarden krijgen dezelfde, gemiddelde rang. Bij één
gebied is de rang 0,5.

De rang wordt bepaald binnen heel Zeeland en apart per niveau: buurten worden met buurten
vergeleken, wijken met wijken. Een gemeentefilter op de kaart verandert de scores niet.

Een kostenScore van 0,95 betekent dat het gebied goedkoper is dan ongeveer 95% van de
Zeeuwse gebieden. Een omvangScore van 0,95 betekent dat het meer woningen heeft dan
ongeveer 95% van de gebieden.

### Waarom 70/30?

Waar de maatschappelijke kosten het laagst zijn, staat voorop: dat is de hoofdvraag van
de opdracht. Het aantal woningen telt mee omdat een start met veel woningen tegelijk meer
oplevert. De gewichten staan als `GEWICHT_KOSTEN` en `GEWICHT_OMVANG` in de code en zijn
een keuze, geen PBL-gegeven.

### Klassen

| Klasse | Voorwaarde (in deze volgorde) | Kleur |
| --- | --- | --- |
| Onbekend | geen kosten of minder dan 10 woningen | grijs `#bdbdbd` |
| Zeer kansrijk | kosten ≤ 0 | donkerblauw `#08519c` |
| Kansrijk | kansScore ≥ 0,66 | lichtblauw `#6baed6` |
| Mogelijk | kansScore ≥ 0,33 | lichtoranje `#fdae6b` |
| Minder kansrijk | anders | donkeroranje `#d94801` |

De kleuren lopen van blauw naar oranje, zodat ze ook bij kleurenblindheid goed van
elkaar te onderscheiden zijn. Op de site tonen we de kansScore als getal van 0 tot 100.

**Uitkomst voor Zeeland:**

| Klasse | Buurten | Wijken |
| --- | --- | --- |
| Kansrijk | 129 | 46 |
| Mogelijk | 178 | 76 |
| Minder kansrijk | 108 | 43 |
| Onbekend | 38 | 4 |
| Zeer kansrijk | 0 | 0 |

Geen enkele Zeeuwse buurt heeft meerkosten van 0 of lager. De laagste meerkosten zijn
€198 per woningequivalent per jaar.

## 5. Van buurt naar wijk

PBL rekent alleen op buurtniveau. Een wijk berekenen we uit zijn buurten:

```
kosten wijk   = Σ kostenTotaal (buurten met kosten) / Σ weq (dezelfde buurten)
woningen wijk = Σ woningen (alle buurten)
route wijk    = de variant met de meeste woningen
```

De kosten van een wijk zijn dus wat het kost als elke buurt zijn eigen goedkoopste route
volgt, gedeeld door alle woningequivalenten.

De velden voor de bewonersindicatie (`jaarlastenWoning`, `gasVoor`, `elekVoor`, `gasNa`,
`elekNa`) zijn voor een wijk het gemiddelde van de buurten, gewogen naar het aantal woningen.

Daarna krijgen de wijken een eigen kansScore en klasse, met dezelfde formule als hierboven,
maar alleen vergeleken met andere wijken.

## 6. Bewonersindicatie

De bewonersindicatie is een eerste inschatting voor een *gemiddelde* woning in het gebied,
alle bedragen per jaar. De verbruiken en jaarlasten komen van PBL, de energieprijzen zijn
een aanname van ons (`AANNAMES`):

| Aanname | Waarde |
| --- | --- |
| Gasprijs (inclusief belastingen) | €1,30 per m³ |
| Stroomprijs (inclusief belastingen) | €0,28 per kWh |
| Verbrandingswaarde aardgas | 0,03165 GJ per m³ |
| Omrekening stroom | 277,78 kWh per GJ |

```
gaskosten(GJ)   = GJ / 0,03165 × gasprijs
stroomkosten(GJ) = GJ × 277,78 × stroomprijs

energie nu      = gaskosten(gasVoor) + stroomkosten(elekVoor)
warmte          = gaskosten(gasVoor)   bij een warmtenet (S2 of S3), anders 0
energie daarna  = gaskosten(gasNa) + stroomkosten(elekNa) + warmte
besparing       = energie nu − energie daarna
netto per jaar  = besparing − jaarlastenWoning
na N jaar       = netto per jaar × N   (N = 10, 20, 30)
```

Toelichting op de keuzes:

- **Warmtenet.** De warmte die een huishouden koopt staat niet als gas of stroom in de
  PBL-cijfers. Voor de warmteprijs geldt het "niet meer dan anders"-principe, dus we
  rekenen de warmte tegen de oude gasrekening.
- **Groen gas** rekenen we tegen dezelfde prijs als aardgas. In werkelijkheid is het
  waarschijnlijk duurder.
- **Jaarlasten** zijn PBL's kapitaallasten van isolatie en installaties: de investering
  gespreid over de levensduur. Het zijn maatschappelijke kosten, zonder btw of rente
  voor een huishouden.

Wat de inschatting **niet** meeneemt: subsidies (bijvoorbeeld ISDE), leningen,
onderhoud, vastrecht, comfort, woningwaarde en veranderende prijzen. In 7 buurten
ontbreken velden; daar tonen we geen indicatie.

**Uitkomst voor Zeeland:** het netto resultaat per jaar loopt per buurt van ongeveer
−€4.500 tot +€765, met een midden rond −€180. Bij 11 buurten is het positief.

## 7. Bekende beperkingen

- De score kijkt alleen naar maatschappelijke kosten en het aantal woningen. Draagvlak,
  netcapaciteit, uitvoerbaarheid en gemeentelijke plannen zitten er nog niet in.
- De route via groen gas (S4) is bij 311 buurten de goedkoopste, maar hangt af van de
  beschikbaarheid van groen gas.
- Een percentielrang zegt iets over de volgorde, niet over de grootte van het verschil:
  twee buurten die maar €5 verschillen, kunnen een paar punten uit elkaar liggen.
- De bewonersindicatie gebruikt gemiddelden van de buurt. Een individuele woning kan
  sterk afwijken.

## 8. Opnieuw berekenen

```sh
npm run data:update               # CBS-grenzen van buurten en wijken
npm run data:kansen               # PBL-data omzetten (gebruikt lokale ZIP's als die er zijn)
npm run data:kansen -- --vernieuw # PBL-ZIP's opnieuw downloaden
npm test
```

Het script stopt met een foutmelding als er een kolom ontbreekt, een rij een afwijkend
aantal kolommen heeft of er niet precies dertien gemeenten zijn. Het meldt ook hoeveel
buurten geen kosten hebben en of de laagste-kostenkolom afwijkt van de gekozen variant.
