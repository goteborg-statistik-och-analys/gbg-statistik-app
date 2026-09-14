# Hitta statistik – testversion utan AI

Statisk webbapp med 237 sökbara tabeller från den lokala gbg-api-färdighetens katalog. Sex tabeller kan hämtas direkt i appen: tre folkmängdstabeller (kommun, primärområden och mellanområden), högsta utbildningsnivå (kommun och primärområden) samt gymnasiebehörighet (primärområden). Övriga träffar öppnar källtabellen i statistikdatabasen.

## Start och publicering

Kör `npm start` eller `node tools/serve.mjs` och öppna http://localhost:4173. Utvecklingsservern lyssnar bara lokalt. Kollegorna behöver endast en webbläsare när appen publicerats.

Publicera index.html, styles.css, search-ui.css, app.js, core.js, search.js, search-suggestions.js, table-suggestions.js, catalog-groups.js, catalog-filters.js, exports.js, interactive-chart.js, vendor/ och data/search-catalog.json på en godkänd statisk webbplats. Servern behöver leverera .mjs som JavaScript. Inga npm-installationer, API-nycklar eller byggsteg behövs. Open Sans hämtas från Google Fonts med Arial som reserv. Typsnittet kan läggas lokalt inför drift. Publicering återstår.

Excel-exporten använder en lokal kopia av SheetJS CE 0.20.3, hämtad från https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs. Licensen finns i vendor/LICENSE-sheetjs.txt. Biblioteket laddas först vid Excel-export; data bearbetas i webbläsaren.

## Prova

- Vad har vi för statistik om utbildning? → 32 träffar, inklusive behörighet och relaterade tabeller med utbildningsnivå.
- Vad finns om inkomst? → träffar i katalogen som öppnas i statistikdatabasen.
- Filtrera på Primärområde eller markera Kan visas i appen.
- Välj Högsta utbildningsnivå för primärområden, därefter Majorna, ålder, kön, utbildningsnivå och år.
- Folkmängden i Majorna 2010–2025 → bevarat folkmängdsflöde.
- Töm sökrutan → startläget med hela katalogen återställs direkt, inklusive rubrik och filter. Visa fler tabeller laddar ytterligare sökträffar.

## Urval och beräkning

Sökningen använder nyckelord och synonymer, inte AI. Träffarna omfattar katalogens tabeller, inte en livegenomsökning av hela databasen. Ämne, tabelltitel, dimensioner och områden används vid matchning. Fritextens årtal förs vidare till urvalet för tabeller som kan visas i appen; de filtrerar inte bort sökträffar. Geografiska nivåer kan filtreras. Vid okända frågor visas ingen falsk matchning. Utbildningskategorier väljs manuellt och bekräftas i urvalet.

Folkmängd summerar alla åldrar och båda könen. Utbildning hämtar en vald kategori per dimension och år, utan att summera ihop kategorier. Resultaten är antal personer, inte procentandelar. Ett år ger nyckeltal och tabell, flera år ger även linjediagram. Saknade eller ofullständiga värden blir Uppgift saknas, aldrig noll.

CSV använder UTF-8 BOM och semikolon för svensk Excel. Mått, urval, källa, hämtningstid och källans kolumnanmärkningar följer med. PNG och SVG innehåller mått, urval, geografi, tidsperiod och källa; fullständiga källanmärkningar finns på resultatsidan och i CSV. Utbildningsregistret har ändrad täckning och klassifikation över tid, se anmärkningarna. Alla år är inte jämförbara för alla åldrar.

CSV och Excel använder källnamnet Göteborgs Stads statistikdatabas utan API-adress. Excel (.xlsx) innehåller numeriska värden, tomma celler för saknade uppgifter och urvalsinformation ovanför datatabellen. Diagrammet visar år och värde vid pekning. Det kan också fokuseras med Tab och utforskas med vänster/höger piltangent. Årreglaget har tagits bort. PNG och SVG exporteras utan de interaktiva markeringarna.

## Uppdatering och verifiering

Katalogen är importerad från gbg-api 2026-09-11. Kör `node tools/build-catalog.mjs` och därefter `tools/check-education.ps1` i PowerShell 7 för att uppdatera sökkatalog och metadata för utbildningspiloten. Skripten använder den lokala färdighetens fil och internet. Vid tabellval hämtar appen aktuella metadata, och vid Visa statistiken görs ett nytt datauttag. API:et accepterar JSON som text/plain med CORS; dess OPTIONS-endpoint svarar 404. Ingen proxy eller reservdata används.

`npm test` kör sjutton tester för katalog, matchning, exakta urvalskoder, summering, saknade värden och export, inklusive gruppering utan förlorade tabeller, tabellförslag för tom och delvis inskriven sökning, återinläsning av genererad XLSX och kontroll av CSV utan API-adress. Testfixturerna data/verified-*.json används aldrig av webbappen. Tidigare webbläsarverifiering omfattar utbildningssökning, filtrering, utbildningsnivå för Majorna över flera år, gymnasiebehörighet för ett år samt export. Den nya Excel-knappen och diagraminteraktionen återstår att verifiera i webbläsare. En extern direktlänk har verifierats mot källans webbsida; övriga följer samma PxWeb-format och katalogens adresser.

Sökrutan visar upp till sex tabellförslag vid fokus och filtrerar dem medan man skriver. Pil upp/ned markerar ett förslag, Enter väljer markerad tabell och Escape stänger listan. Enter utan markering gör en vanlig sökning. Diagrammets tooltip visar år ovanför ett fetstilt värde med enhet och har en diskret skugga; den aktiva punkten förstoras och övriga datapunkter tonas ned under interaktion. Ingen vertikal hjälplinje visas.

Katalogen visas som en kompakt lista. Tabeller med samma rubrik, ämne och variabeldefinitioner (utom område) samlas på en rad med separata geografiska val. Olika åldersindelningar och tidsperioder behåller egna rader. Startläget innehåller samtliga 237 tabeller, grupperade på samma sätt som sökträffarna. Tabeller som kan visas i appen ligger först. Tema och geografisk nivå kan kombineras med sökningen och filtret Kan visas i appen. Valda filter behålls vid sökning; en uttrycklig geografisk nivå i söktexten uppdaterar nivåfiltret. Inkomst och Inkomster samlas i temavalet Inkomst. När sökrutan töms återställs hela katalogen och filtren. Tre hela rader och halva nästa visas initialt. Visa fler tabeller visar ytterligare tre rader. En utfällbar hjälptext förklarar områdesnivåerna och länkar till Göteborgs Stads områdesindelning.
