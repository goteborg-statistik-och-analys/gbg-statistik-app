# Utökat tabellstöd

Alla 92 befolkningstabeller är nu tillgängliga (89 nytillkomna). Totalt stöds 194 av katalogens 237 tabeller.

Befolkningsprognoser använder källans Prognosår och märks som prognoser. Månadsfolkmängd visas som en tidsserie med perioden ÅÅÅÅ-MM, även i exporter; månader summeras aldrig. Befolkningstäthet hämtas direkt från källan och kan jämföras men inte summeras. Flyttyp, Typ av flyttning och Flyttkategori kan redovisas separat men inte summeras eftersom exempelvis in-, ut- och nettoflyttning överlappar. Negativa förändringar och flyttnetton bevaras.

`data/population-audit.json` innehåller metadata och ett litet verkligt datauttag för var och en av de 89 tillagda tabellerna. Det verifierar format och valda källvärden, inte samtliga celler. `tools/audit-population.mjs` hämtar kontrollunderlaget och `tools/enable-population-tables.mjs` aktiverar granskade tabeller. Resultatet finns i `data/population-table-status.json`.

Arbetsmarknads- och bostadstabeller aktiveras via granskade måttdefinitioner i `src/table-measures.js`, metadata och ett lyckat datauttag från respektive tabell. Okända mått aktiveras inte automatiskt. Inkomst och ohälsotal behöver fortfarande separat hantering.

Enheten följer med till nyckeltal, diagram, tooltip, resultattabell, CSV och Excel. Antal personer, arbetsställen och bostäder hålls åtskilda. Negativa bostadsvärden bevaras, eftersom ombyggnation kan ge negativa förändringar. Saknade värden ersätts inte med noll.

Vissa tabeller innehåller både sysselsatta och ej sysselsatta, eller både UVAS och ej UVAS. Totalt omfattar då båda kategorierna. Resultatets rubrik beskriver hela indelningen; välj kategorier i urvalet för att begränsa resultatet.

## Underlag och återkontroll

- `data/expanded-metadata.json`: metadata för arbetsmarknad och bostäder.
- `data/count-table-checks.json`: kontrollfrågor och svar från källan.
- `data/count-table-audit.json`: aktiverade tabeller och kvarstående hinder.
- `tools/verify-count-tables.mjs`: små datauttag i begränsad takt. Redan godkända kontrolluttag återanvänds.
- `tools/enable-count-tables.mjs`: aktivering efter metadata-, mått- och uttagskontroll.

Provuttagen kontrollerar formatet och ett kategoriurval vid senaste året, inte varje cell i databasen. Automatiska tester kontrollerar dessutom urval, summering, enheter och exporter. Vid ändrade källdefinitioner behöver metadata och berörda kontrolluttag granskas på nytt. Appen hämtar metadata på nytt när en tabell väljs.

## Utbildning

Alla 16 utbildningstabeller stöds (13 nytillkomna): högsta utbildningsnivå, gymnasiebehörighet, högskolebehörighet samt barn efter föräldrarnas utbildningsnivå, på fyra geografiska nivåer. Källans PX-filer bekräftar enheterna Antal personer och Antal barn. Dessa är antal, inte andelar. Totalt för behörighet omfattar både behöriga och ej behöriga. Barnets ålder använder källans grupper 0–5, 6–15 och 16–17 år; API-koderna bevaras.

Underlaget i `data/education-audit.json` innehåller metadata, ett verkligt datauttag per tabell, verifierad enhet och källanmärkningar. Kontrollen omfattar en cell vid senaste året per tabell, inte samtliga värden. Vissa källvärden har ersatts med noll vid sekretessgranskning; den informationen följer med resultat och dataexporter. Källanmärkningarna uppdateras vid katalogkontrollen, medan metadata och valda data hämtas på nytt i appen.

Kör från projektroten:

```sh
node tools/check-education.mjs
node tools/enable-education.mjs
npm test
```

Aktivering görs först efter kontroll av uttag, källenhet och giltiga urval. En katalogombyggnad bevarar de aktiverade tabellerna och deras källanmärkningar. Kommunnivån visas i diagram och tabell; stadsområden, mellanområden och primärområden stöder även karta när urvalet ger ett värde per område och år.
