# Göteborg i jämförelse – befolkningsunderlag

## Avgränsning

Underlaget omfattar folkmängd den 31 december, ettårsåldrar och kön, folkökning, medelålder och total demografisk försörjningskvot för 2000–2025. Uttaget är sparat och validerat. Faktabladet finns i `jamforelse.html`, med fem diagram, fyra nyckeltal för Göteborg och två tiolistor med valbar rangordning för senaste årets folkökning.

Kommunurvalet bekräftades 2026-09-23: SKR:s grupper A1 och B3 enligt indelningen 2023 samt Göteborgsregionens 13 medlemskommuner. Det ger 38 unika kommuner: 3 storstäder, 23 större städer och 13 GR-kommuner. Göteborg ingår i både A1 och GR och lagras bara en gång. Grupperna används som ett fast jämförelseurval för hela tidsperioden, inte som historiska klassificeringar.

Kommunlistan med källor finns i `data/goteborg-jamforelse/municipalities.json`. Den bygger på SKR:s officiella arbetsbok (bladet ”Bilaga1 Lista alla kommuner”) och GR:s medlemslista. Kommunkoder och namn har kontrollerats mot båda SCB-tabellerna.

## Verifierat tabellpar

| Egenskap | Historik | Aktuell tabell |
| --- | --- | --- |
| Tabell | BefolkningNy | BefolkningCKM |
| År för uttaget | 2000–2024 | 2025 |
| Folkmängd, ContentsCode | BE0101N1 | 000007ME |
| Ettårsåldrar | 0–99 | 0–99 |
| 100 år och äldre | 100+ | 100+1 (ettårsåldrar) |
| Alla åldrar | tot | TotSA |
| Män / kvinnor | 1 / 2 | 1 / 2 |
| Båda könen | Källans total via utelämnad Kon (elimination=true) | TotSa |
| Civilstånd | Källans total via utelämnad Civilstand (elimination=true) | SC = samtliga civilstånd |

2025-tabellen innehåller också färdiga fem- och tioårsgrupper samt alternativa total- och 100+-koder. De får inte summeras tillsammans med ettårsåldrarna eller räknas som ytterligare personer.

Användaren bekräftade att ettårsåldrar och publicerade totaler ska lagras separat. Detta gäller både alla åldrar och båda könen: 2025 års båda-könen-värden hämtas direkt, inte som summan av män och kvinnor. Inga jokertecken används. Historikens valfria dimensioner utelämnas avsiktligt endast efter att `elimination=true` kontrollerats.

## Mått och beräkningar

| Mått | Källa / beräkning |
| --- | --- |
| Total folkmängd | Källans total för alla åldrar, för respektive kommun, kön och år |
| Valfri åldersgrupp | Summa av valda ettårsåldrar, inklusive 100+ om det öppna slutintervallet ingår |
| Åldersandel | 100 × åldersgruppens folkmängd / publicerad total för samma kommun, kön och år |
| Medelålder | SCB:s BefolkningMedelAlder, BE0101G9, separat för män, kvinnor och totalt |
| Folkökning | BE0101N2 till och med 2024, 000007MG från 2025, alla åldrar |
| Demografisk försörjningskvot | SCB:s FkvotHVD, 00000708 (Försörjningskvot totalt), endast båda könen |

Medelålder beräknas inte ur ettårsåldrarna: 100+ är en öppen kategori och ettårsåldrarna ger inte samma precision som källmåttet. Försörjningskvoten avser personer 0–19 år och 65+ per 100 personer 20–64 år. Det är ett demografiskt förhållande, inte procent av hela folkmängden eller ett mått på faktisk sysselsättning. Delkvoterna från yngre och äldre ingår inte i detta första uttag.

`src/comparison-data.js` innehåller funktionen `comparisonValue` för diagrammen. Alla åldrar använder alltid publicerad total, också i åldersvyn. Saknad täljare/nämnare eller en nämnare på noll ger `null`, inte noll procent. Andelar normaliseras aldrig för att tvinga delarna att summera till 100 procent. Egna åldersgrupper märks som summerade och med CKM från 2025. Ändpunkten 100 betyder alltid 100 år och äldre, inte exakt 100 år.

## Uppdatering och filer

Kör `node tools/build-comparison-snapshot.mjs` från projektroten. Det hämtar alla fyra källtabeller, validerar svaren och byter `data/goteborg-jamforelse/metadata.json` först när hela uttaget är kontrollerat. Stora historikuttag delas i kommunblock. Tillfälliga nedladdningar sparas i den ignorerade mappen `tmp/comparison-build`. `--reuse-downloads` får användas för att fortsätta eller testa samma uttag; det alternativet återanvänder hämtningstider och ska inte användas för en ordinarie uppdatering till ny statistik.

- `metadata.json` anger aktuell datafil, granskningsfil, SHA-256-kontrollsummor och årstäckning.
- `population-<hash>.json` innehåller alla 38 kommuner, 26 år, tre könsval och 101 ålderskategorier samt totaler och nyckeltal. Datafilen är cirka 1,27 MB före komprimering.
- `sources-<hash>.json` innehåller exakta API-frågor, metadata, källans fotnoter, uppdaterings- och hämtningstider, svarens kontrollsummor och valideringsresultat.

Start- och slutår är uttryckligen satta till 2000–2025 i byggskriptet. Utöka efter kontroll av nästa års publicering och definitioner. Kommuner och grupper lagras en gång även om en kommun ingår i flera jämförelsegrupper.

## Validering och begränsningar

Kör vid behov `node tools/validate-comparison-sources.mjs` för en separat metadatakontroll av tabellparet. `source-validation.json` avser endast denna kontroll. Den fullständiga värdevalideringen finns i granskningsfilen som `metadata.json` pekar på.

Uttaget innehåller 309 244 värden och inga saknade celler. Alla 3 800 kontroller av historiska ålders- och könssummor mot publicerade totaler passerade exakt. För 2025 registrerades 152 kontroller av summor mot totaler utan krav på exakt likhet; största absoluta avvikelsen var 35 personer. Två avvikelser mellan differensen av årstotaler och publicerad folkökning gäller Stockholm 2020 (totalt respektive kvinnor, en person). Båda måtten bevaras oförändrade; avvikelsens orsak är inte fastställd.

Byggskriptet kontrollerar även dimensionsordning, exakta urval, unika cellnycklar, enheter, referenstid, årstäckning, saknade värden och att källans uppdateringsdatum är oförändrat mellan deluttag. Källornas gemensamma årstäckning innebär inte att de har samma publiceringsdatum.

- Tabellerna saknar överlappande år. Det går därför inte att kontrollera att samma års folkmängd överensstämmer mellan dem.
- CKM infördes från referensår 2025. Publicerade totaler behöver inte motsvara summan av delarna. Avvikelser ska redovisas, inte korrigeras bort eller behandlas som saknade personer.
- Totaler för historiska civilstånd hämtas direkt genom SCB:s elimineringsfunktion. Totalkategorier blandas aldrig med delkategorier i egna summeringar.
- Publicerade totaler hålls isär från egna summeringar. Om ett obligatoriskt värde saknas avbryts bygget och föregående manifest lämnas kvar; beräkningsfunktionen bevarar ändå saknade värden som `null`.
- SCB:s historik använder regional indelning den 1 januari efterföljande år. **Uppsala påverkas av att Knivsta bildades 2003-01-01**. Identiska kommunkoder styrker inte fasta geografiska gränser. Historiken ska inte presenteras som omräknad till dagens indelning.
- Årsförändringar över 2024–2025 påverkas av metodändringen. Metodinformationen behöver följa med till sidan och exporterna.

## Källor

### Komplettering för riksandel och tiolistor

Kör `node tools/build-comparison-context.mjs` efter huvuduttaget. Det separata `context-metadata.json` pekar på ett kompletterande underlag och en granskningsfil med de exakta API-frågorna och svaren. Avgränsningen är:

- Rikets publicerade totalfolkmängd: en uppgift per år 2000–2025, som nämnare för riksandelen.
- De 38 jämförelsekommunernas totalfolkmängd 1999: beräkningsgrund för procentuell folkökning 2000.
- Samtliga 290 kommuner: endast totalfolkmängd 2024 och 2025 samt publicerad folkökning 2025. Ingen ålders-/könsuppdelning och ingen ytterligare kommunhistorik hämtas för tiolistorna.

Alla gemensamma totaler och tillväxtvärden för 2024–2025 måste stämma med huvudunderlaget innan kompletteringen publiceras. Appen kontrollerar att versionerna hör ihop. Framtida uppdateringar kräver att slutår och föregående år ändras i både byggskript och presentation.

`src/comparison-indicators.js` beräknar riksandel och procentuell tillväxt med publicerade totaler. Procentuell tillväxt = SCB:s publicerade folkökning / föregående års folkmängd × 100. Rankning sker före avrundning, med delad placering vid lika värden och alfabetisk ordning inom delad placering. Tiolistorna begränsas till tio rader; Göteborg läggs till separat om kommunen finns i urvalet men utanför listan.

Kommunvalet i diagrammen är gemensamt, med Göteborg fast och högst tre andra kommuner. Färg och linjetyp för en vald kommun behålls tills den tas bort. Åldersbilden visar femårsklasser från 0–4 till 95–99 år samt 100+, med ålder på x-axeln och andel på y-axeln, och varje diagram har en tabell. Tiolistornas gruppfilter är oberoende av diagramvalet. Tester finns i `tests/comparison-indicators.test.mjs`.

### Officiella källor

- [Historisk folkmängd, SCB](https://www.statistikdatabasen.scb.se/pxweb/sv/ssd/START__BE__BE0101__BE0101A/BefolkningNy/)
- [Folkmängd 2025, SCB](https://www.statistikdatabasen.scb.se/pxweb/sv/ssd/START__BE__BE0101__BE0101A/BefolkningCKM/)
- [SCB:s frågor och svar om CKM](https://www.scb.se/FAQ-CKM)
- [Medelålder, SCB](https://www.statistikdatabasen.scb.se/pxweb/sv/ssd/START__BE__BE0101__BE0101B/BefolkningMedelAlder/)
- [Demografisk försörjningskvot, SCB](https://www.statistikdatabasen.scb.se/pxweb/sv/ssd/START__BE__BE0101__BE0101A/FkvotHVD/)
- [SKR:s kommungruppsindelning](https://skr.se/kommunerochregioner/kommungruppsindelning.8281.html)
- [Göteborgsregionens medlemskommuner](https://goteborgsregionen.se/)

### Valbar riksreferens

`node tools/build-comparison-national.mjs` körs efter huvuduttaget och kompletteringen. Det hämtar endast Region 00 (riket): publicerad folkmängd och ettårsåldrar, folkökning, medelålder och försörjningskvot 2000–2025 samt folkmängd 1999 som tillväxtbas. Inga nya kommunhistoriker hämtas.

`national-metadata.json` pekar på data och fullständiga API-svar med kontrollsummor. Rikets totaler måste matcha den befintliga nämnaren för samtliga år. Historiska ålderssummor kontrolleras exakt; CKM-avvikelsen 2025 registreras utan normalisering. Appen kontrollerar att riks-, kommun- och kompletteringsversionerna hör ihop.

Kryssrutan ”Visa riket” lägger till en separat streckad referens i tillväxt i procent, åldersstruktur och försörjningskvot, samt rikets medelålder i KPI-kortet. Riket tar ingen kommunplats, deltar inte i tiolistorna och ingår i tooltip, tabell, förstoring och export när referensen är vald. I tillväxt i antal döljs referensen tills användaren väljer procent igen.
