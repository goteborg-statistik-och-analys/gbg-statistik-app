# Befolkningsprognos – faktablad

Öppna `prognos.html` eller välj **Befolkningsprognos** i appens sidomeny.
Startläge: kommunen, alla åldrar, utfall 2000–2025 och 2026 års prognos till 2050.
Stadsområden och mellanområden har prognos till 2033.

## Användning

- Stadsområden och mellanområden börjar utan valda områden. Diagrammet är tomt tills du gör ett urval.
- Välj stadsområde för att avgränsa listan av mellanområden, eller Alla stadsområden för att välja över gränserna. Avgränsningen väljer inga områden automatiskt.
- Välj en eller flera färdiga åldersgrupper eller ett eget intervall. Högsta valbara ålder är en öppen kategori, markerad ”och äldre”. Alla åldrar är ett eget alternativ; 0–5 år erbjuds inte som snabbval.
- Varje kombination av område och åldersgrupp är en egen linje (högst sju totalt). Utfall är heldraget; prognos är streckat. Den streckade förbindelsen börjar vid sista utfallsåret.
- Exakta värden visas med pekare, tryck eller tangentbord (pilar, Home, End och Escape), samt i den utfällbara tabellen.
- Diagrammet använder appens gemensamma tooltip med punkter för det markerade året. Förstora öppnar diagrammet i en dialog utan intern scrollning.
- CSV och Excel innehåller urval, källa och anmärkningar. PNG och SVG innehåller rubrik, urval, källa och prognosomgång. Utskrift använder sidans aktuella urval.

## Underlag och jämförbarhet

Källorna är Göteborgs Stads sex API-tabeller för årsfolkmängd och prognos på kommun-, stadsområdes- och mellanområdesnivå. Exakta URL:er, uttag, metadata och källanmärkningar följer med respektive datafil. Historikens källmetadata anger Västfolket till 2007 och SCB från 2008; den ska därför inte generellt beskrivas som enbart SCB-statistik.

Statistikansvarig bekräftade i uppdraget 2026-09-22 att delområdesprognosens kategori **99 år betyder 99 år och äldre**. Byggskriptet summerar därför historikens 99 år och 100+ till samma kategori. Kommunen behåller 100+ som högsta kategori. Alla åldrar omfattar hela åldersspannet på respektive nivå. Kontrollera denna definition på nytt om källan ändrar kategorier.

Mellanområdenas stadsområdestillhörighet hämtas från Göteborgs Stads [områdeslista 2025](https://goteborg.se/wps/wcm/connect/d30328ca-09c0-447d-8f96-954445b47efc/Omr%C3%A5deslista%2B2025.xlsx?MOD=AJPERES). Sambanden är sparade i datafilerna; arbetsboken följer inte med till webbplatsen.

Historik och prognos matchas på källans områdeskoder och namn. Källmetadata styrker inte full jämförbarhet i områdesgränser för alla historiska år. Detta anges på sidan och i exporterna. Ospecificerat Göteborg ingår i kommunens totala folkmängd men erbjuds inte som ett eget område; delområdenas summor behöver därför inte motsvara kommunen exakt.

Saknade värden bevaras som `null`. En summa som innehåller ett saknat värde blir saknad, aldrig noll. Rader kontrolleras för komplett urval, dubbletter och oväntade kategorier innan en ny version publiceras lokalt.

## Lagring och publicering

Publicera `prognos.html`, `src/`, `styles/`, `assets/` och hela `data/befolkningsprognos/` tillsammans med appens vanliga filer. Prognosbladet kräver ingen serverkod eller API-nyckel. Produktionsfilerna är avsedda att checkas in i GitHub. Tillfälliga arbetsfiler ligger i ignorerade `tmp/`.

`metadata.json` pekar på tre filer med innehållshash i namnet. Kommunen laddas först; de övriga två hämtas i bakgrunden. Samma fil återanvänds för alla filterändringar och vid återbesök till en nivå under sessionen. Inga anrop till statistik-API:et görs av prognosbladet.

Initial storlek, före HTTP-komprimering: kommun cirka 31 kB, stadsområden 72 kB, mellanområden 480 kB. Tillsammans cirka 582 kB. JavaScript, typsnitt och stilmallar tillkommer. Aktivera gärna gzip/Brotli på webbhotellet; filerna kan cachas eftersom deras namn ändras med innehållet. `metadata.json` hämtas med omvalidering för att upptäcka nya versioner.

## Uppdatering

Kör från projektroten:

```text
node tools/build-forecast-snapshot.mjs
node --test tests/forecast-sheet.test.mjs
```

Byggskriptet hämtar aktuella metadata och data, normaliserar ålder och kön och kontrollerar strukturen. Förändrade tabelladresser, dimensioner eller åldersdefinitioner kräver granskning. Vid en ny prognosomgång uppdateras vid behov tabell-ID:erna i skriptet och katalogens adresser. Tester med kontrollvärden och årtal uppdateras först efter kontroll mot källan.

Samtliga tre nivåer måste byggas färdigt innan nya filer skrivs till produktionsmappen. Versionsfilen byts sist. Ett misslyckat uttag lämnar föregående version tillgänglig. Tidigare innehållsfiler raderas inte automatiskt: de kan behövas av öppna sessioner och kan tas bort vid en senare planerad publicering.

Granska differensen i värden, prognosomgång och källanmärkningar före publicering på webbplatsen. Inga automatiska schemalagda uppdateringar har konfigurerats.

## Verifiering

Tester täcker fullständiga publiceringsfiler, källans kommunala kontrollsumma (2025: 613 276), 99+-kontroller för Nordost (11 + 18) och Centrum (40 + 69), saknade värden, områdeshierarki, giltiga urval, prognosövergång och återanvändning av hämtade filer inklusive återförsök efter fel.
