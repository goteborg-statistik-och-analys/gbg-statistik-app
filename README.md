# Hitta statistik – testversion utan AI

Statisk webbapp med 237 sökbara tabeller. 194 kan hämtas direkt i appen, inklusive samtliga 16 utbildningstabeller på kommun-, stadsområdes-, mellanområdes- och primärområdesnivå. Övriga träffar öppnar källtabellen i statistikdatabasen.

## Start och publicering

Kör `npm start` eller `node tools/serve.mjs` och öppna http://localhost:4173. Utvecklingsservern lyssnar bara lokalt. Kollegorna behöver endast en webbläsare när appen publicerats.

Publicera index.html, hela mapparna src/, styles/, assets/ och vendor/, samt data/search-catalog.json och data/*-map.json. Behåll mappstrukturen. Servern behöver leverera .mjs som JavaScript. Inga npm-installationer, API-nycklar eller byggsteg behövs. Open Sans hämtas från Google Fonts med Arial som reserv. Publicering återstår.

Excel-exporten använder en lokal kopia av SheetJS CE 0.20.3, hämtad från https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs. Licensen finns i vendor/LICENSE-sheetjs.txt. Biblioteket laddas först vid Excel-export; data bearbetas i webbläsaren.

## Projektstruktur

- index.html: appens startsida.
- src/: JavaScript för sökning, urval, diagram, kartor och export.
- styles/: stilmallar.
- assets/ och vendor/: bilder och externa bibliotek.
- data/: katalog, kartunderlag och verifieringsdata.
- tests/: automatiska tester.
- tools/: lokal server samt skript för data och kartunderlag. Kör dem från projektroten.
- docs/: [detaljerade uttag](docs/DETAILED-EXPORTS.md), [söktestning](docs/SEARCH-FEEDBACK.md) och [tabellstöd](docs/TABLE-SUPPORT.md).

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

Katalogen är importerad från gbg-api 2026-09-11. Kör `node tools/build-catalog.mjs` och därefter `node tools/check-education.mjs` samt `node tools/enable-education.mjs` för att kontrollera och aktivera utbildningstabellerna. Skripten använder den lokala färdighetens fil och internet. Vid tabellval hämtar appen aktuella metadata, och vid Visa statistiken görs ett nytt datauttag. API:et accepterar JSON som text/plain med CORS; dess OPTIONS-endpoint svarar 404. Ingen proxy eller reservdata används.

`npm test` kör tester för katalog, matchning, exakta urvalskoder, summering, saknade värden och export, inklusive gruppering utan förlorade tabeller, tabellförslag för tom och delvis inskriven sökning, återinläsning av genererad XLSX och kontroll av CSV utan API-adress. Testfixturerna data/verified-*.json används aldrig av webbappen. Tidigare webbläsarverifiering omfattar utbildningssökning, filtrering, utbildningsnivå för Majorna över flera år, gymnasiebehörighet för ett år samt export. Den nya Excel-knappen och diagraminteraktionen återstår att verifiera i webbläsare. En extern direktlänk har verifierats mot källans webbsida; övriga följer samma PxWeb-format och katalogens adresser.

Sökrutan visar upp till sex tabellförslag vid fokus och filtrerar dem medan man skriver. Pil upp/ned markerar ett förslag, Enter väljer markerad tabell och Escape stänger listan. Enter utan markering gör en vanlig sökning. Diagrammets tooltip visar år ovanför ett fetstilt värde med enhet och har en diskret skugga; den aktiva punkten förstoras och övriga datapunkter tonas ned under interaktion. Ingen vertikal hjälplinje visas.

Katalogen visas som en kompakt lista. Tabeller med samma rubrik, ämne och variabeldefinitioner (utom område) samlas på en rad med separata geografiska val. Skillnader i stora och små bokstäver i variabeldefinitionerna påverkar inte grupperingen. Olika åldersindelningar och tidsperioder behåller egna rader. Startläget innehåller samtliga 237 tabeller, grupperade på samma sätt som sökträffarna. Tabeller som kan visas i appen ligger först. Tema och geografisk nivå kan kombineras med sökningen och filtret Kan visas i appen. Tema, geografisk nivå och Kan visas i appen nollställs när sökrutan får fokus och när en ny sökning skickas, även via exempelfrågorna. En uttrycklig geografisk nivå i den nya söktexten uppdaterar därefter nivåfiltret. Inkomst och Inkomster samlas i temavalet Inkomst. När sökrutan töms återställs hela katalogen och filtren. Tre hela rader och halva nästa visas initialt. Visa fler tabeller visar ytterligare tre rader. En utfällbar hjälptext förklarar områdesnivåerna och länkar till Göteborgs Stads områdesindelning.

## Kartvy för stadsområden, mellanområden och primärområden

Välj en tabell med årsdata på stadsområdes-, mellanområdes- eller primärområdesnivå, en urvalsgrupp, redovisningen Visa varje kategori separat för Område och Summera valda för övriga dimensioner. Efter hämtning visas Diagram | Karta. Kartan använder alla valda områden, oberoende av vilka linjer som är markerade i diagrammet. Årsreglaget visar tillgängliga år, börjar på slutåret och döljs vid ett enda år. Den kontinuerliga, linjära färgskalan går från mycket ljus blå (#e8f1f6) till mörk blå (#173b50). Ljusare betyder mindre och mörkare betyder mer, med samma färgstopp i kartytor och legend. Skalans intervall beräknas en gång från hela urvalets tidsperiod och behåller samma min/max när året ändras. Första versionen omfattar summerbara antalsmått, inte månadsdata eller flera jämförelsegrupper.

Ospecificerat Göteborg utesluts enbart från kartan och dess färgskala; diagram, tabell och CSV/Excel behåller hela urvalet. Saknade värden är streckade, områden utanför urvalet vita och noll är ett numeriskt värde. Områden kan fokuseras med tangentbordet. SVG/PNG-knapparna exporterar den aktiva vyn och kartans valda år. Kartans urval, källa och gränsår följer med exporten.

Kartunderlaget kommer från användarens Stadsområde_shp.zip, angivet som aktuell indelning 2026. Filens registrerings-/ajourdatum är 2025-01-08. Alla år ritas med samma gränser; underlaget verifierar inte historiska gränser eller att tidsserierna har räknats om till denna indelning. Kartan anger därför gränsår och hänvisar till källans områdesindelning. De fyra områdeskoderna matchas mot API-koder som 01 Nordost och även numeriska varianter som 1.

Kartfilerna ingår i publiceringslistan ovan. Kartan kräver ingen karttjänst eller API-nyckel. Det genererade underlaget behåller originalets polygoner, hål och öar i SWEREF 99 12 00 (EPSG:3007), omräknade till SVG-koordinater. Återskapa det med tools/build-area-map.R (sf och jsonlite) efter att originalets SHP/SHX/DBF/PRJ har lagts i data/geography-source/. Lokala originalfiler och tillfälliga verifieringsfiler ignoreras av Git.

För stadsområden har kartans områdeslista rubriken Värden per stadsområde. För mellanområden och primärområden utelämnas listan. Beskrivning och källa ligger under det tunna årsreglaget; exporterna behåller informationen under kartbilden. Diagram/Karta visas som en kompakt sammanhängande knappgrupp med ikoner och mörkblå bakgrund för aktiv vy. Kartan får större utrymme relativt textkolumnen inom en höjd som anpassas till webbläsarfönstret. En flytande tooltip visar område, år, värde och enhet vid pekning, tryck eller tangentbordsfokus; Escape stänger den. Den tidigare grå informationsraden har tagits bort.

Kartans rubrik använder tabellens fullständiga ämnesrubrik utan tidsperiod. Begränsade urval, exempelvis Upplåtelseform: Äganderätt eller Kön: Kvinna, visas direkt vid rubriken. Totalval utelämnas ur den korta underrubriken men finns kvar i urvalsbeskrivningen. Rubriken och urvalet följer med i PNG/SVG; långa texter radbryts.

Karta och diagram delar rubriklogiken i src/result-heading.js. Tabellrubrik, begränsade urval och geografi/period visas på separata rader inne i kartan eller diagrammet, både i appen och i PNG/SVG. Den yttre dubblettrubriken är dold. Vid flera jämförelsegrupper visas endast gemensamma filter i rubriken; gruppspecifika urval framgår av seriernas beskrivningar. Diagrammets interaktion använder bildens faktiska plotthöjd även när exportens rubrik behöver flera rader.

Visualiseringens verktygsrad samlar Diagram/Karta och PNG/SVG. Exportknapparna (även CSV/Excel) är sammanhängande knappgrupper med nedladdningsikoner. Karta och diagram använder samma HTML-rubrik i appen (18 px), oberoende av SVG-bildens skalning; exporterna behåller inbyggda rubriker. Diagrammets enhetsrad visar bara måttets enhet. De långa seriebeskrivningarna visas i en stängd, utfällbar sektion, Visa urval per serie, och ingår fortfarande i PNG/SVG.

Diagram/Karta visas även när kartvyn inte stöder urvalet. Karta är då nedtonad men nåbar med mus och tangentbord; ett tryck visar en konkret orsak och råd utan att byta vy eller påverka exporten. Länken i förklaringen öppnar kartavsnittet i Så fungerar appen. Hjälpen nås också från sidhuvudet och beskriver sökning, urval, diagram, export och kartans begränsningar.

Så här fungerar appen öppnas med informationsknappen uppe till höger i en modal dialog med rullbar text och Kontakt sist. Första avsnittet beskriver Jämför egna grupper med ett exempel på egna åldersintervall. Kartans hjälplänk öppnar dialogen direkt vid kartavsnittet. Dialogen stängs med krysset, Escape eller klick på bakgrunden; fokus återgår till kontrollen som öppnade den. Underliggande urval och resultat behålls.

Vid kartans färgskala finns Lås färgskalan vid senaste år. Min/max tas då från valda områden under urvalets senaste år (Ospecificerat ingår aldrig). Inställningen bevaras mellan år och vyer för samma resultat, återställs för ett nytt resultat och är avstängd som standard. Värden utanför referensintervallet får ändfärgerna utan att numeriska värden ändras. Referensår och eventuell klippning anges i kartbild/export. Saknas alla värden i referensåret är kontrollen inaktiverad. Om referensåret har ett enda värde förklarar legenden färger för under, lika med och över detta värde.

Mellanområdeskartan använder Mellanområde_shp.zip som tillhandahölls i september 2026 (registrerings-/ajourdatum 2025-01-08). Samtliga 36 områdeskoder matchas mot katalogens folkmängdstabell. Värdelistan till höger utelämnas för mellanområden, även vid export; namn och exakta värden finns i tooltip och den vanliga resultattabellen. Färgskala, låsning till senaste år och årsreglage fungerar på samma sätt som för stadsområden. Kartunderlagen laddas och cachas separat per geografisk nivå.

Återskapa mellanområdesunderlaget med `Rscript tools/build-area-map.R mellanomraden` efter att SHP/SHX/DBF/PRJ har lagts i `data/geography-source/mellanomraden/`.


Knapparna delar grundstil via styles/controls.css. Sökexemplen använder ljusblå bakgrund utan synlig ram. Geografivalen och sökpilen behåller sin diskreta rörelse vid hovring, med respekt för minskad rörelse. Välj alla, Rensa och Välj intervallet behåller sin tidigare diskreta textknappstil. Visa statistiken är en fylld mörkblå huvudknapp. Pekskärmar får minst 44 px höga knappytor. Diagrammet visar en punkt vid varje series sista tillgängliga värde. Övriga punkter visas vid hovring eller tangentbordsinspektion med radie 5; linjerna tonas endast svagt ned (85 % opacitet). Valrutor markerar fokus inom befintlig kant utan extra svart ytterram.

Primärområdeskartan använder Primärområde_shp.zip som tillhandahölls i september 2026 (registrerings-/ajourdatum 2025-01-08). Alla 96 områden behåller originalets polygoner, hål och öar. Områdeskoderna matchas mot katalogens primärområdestabeller. Årsreglage, färgskala, låsning till senaste år och SVG/PNG-export fungerar som för övriga kartnivåer. Återskapa underlaget med `Rscript tools/build-area-map.R primaromraden` efter att SHP/SHX/DBF/PRJ har packats upp i `data/geography-source/primaromraden/`.

Utbildning: alla 16 tabeller är aktiverade efter verifiering av metadata, källenheter och datauttag. Omfattar högsta utbildningsnivå, gymnasiebehörighet, högskolebehörighet och barn efter föräldrars utbildning. Måtten är antal personer respektive antal barn. Behörig och ej behörig kan väljas separat; Totalt omfattar båda. Källanmärkningar om sekretess och definitioner följer med resultatet samt CSV/Excel. Se [tabellstöd](docs/TABLE-SUPPORT.md) för underlag och uppdateringskommandon.

Grupperingen har granskats för samtliga teman: 237 tabeller visas på 93 rader. Små skrivskillnader och verifierade kod-/etikettvarianter jämställs; skillnader i kategorier och tidsperioder hålls isär. Se [genomgång av tabellgruppering](docs/CATALOG-GROUPING.md).
