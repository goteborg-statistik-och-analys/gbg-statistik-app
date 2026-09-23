# Projektpreferenser: faktablad

Dessa önskemål är uttryckligen bekräftade av användaren och gäller alla nya och ändrade faktablad.

- Följ samma tema och komponentbeteende i samtliga faktablad. Använd prognosbladet (`prognos.html`) och jämförelsebladet (`jamforelse.html`) som referenser.
- Använd den gemensamma mörka sidfoten i `styles/site-footer.css` utan lokala bakgrunds- eller paddingöverskrivningar. Diagramkort ska ha diskret skugga i stället för ram, som prognosbladet. I jämförelsebladet visas datapunkter bara vid hovring/fokus, med tydligare punktstorlek; inga fasta slutpunkter.
- Använd kompakt typografi: filteretiketter, filteralternativ och diagramkontroller omkring 12 px, hjälptext 11–12 px. Undvik stora filter och överdimensionerad standardtext; bevara läsbarhet, fokusmarkeringar och användbara klickytor.
- Gemensamma filter ligger i en kompakt, utfällbar vänsterpanel som följer scrollningen. På mobil ska panelen kunna fällas ihop och inte skymma hela diagrammet.
- Filter ska inte få en svart fokusram vid musklick. Behåll en diskret blå fokusmarkering vid tangentbordsnavigation. Sektionslänkar ska se ut som kompakta knappar. KPI-kort ska ha samma ramlösa form, rundning och diskreta skugga som diagramkorten, med en diskret färgaccent längs ovankanten.
- Återanvänd `attachSeriesInteraction` i `src/series-chart.js` och `animateChartEntrance` i `src/chart-animation.js`. Samma tooltip, hjälplinje, markerade punkter, tangentbordsstyrning och respekt för reducerad rörelse på alla faktablad.
- Använd prognosbladets diskreta knappar och ikoner för `Ladda ner` och `Förstora`, inklusive nedladdningsmenyn (CSV, Excel, PNG, SVG och Skriv ut), dialogbeteende och återställning av fokus. Diagram och urval ska fungera även i förstorad vy.
- Exporter ska innehålla aktuellt urval, enhet, år, källa och relevanta metodnoter, med numeriska värden i dataexporter. Exporterade diagram ska vara fullständiga och inte innehålla hover-tooltip eller pågående animering.
- Behåll Göteborgs grafiska profil, stabila kommunfärger och linjetyper samt en tabell som alternativ till varje diagram. Kontrollera laptop- och mobilbredd.

Statistik: använd publicerade totaler, aldrig summor av ettårsåldrar för total folkmängd. Kommunhistoriken i Göteborg i jämförelse är avgränsad till SKR A1/B3 och GR (38 kommuner); alla 290 kommuner hämtas bara för senaste årets tiolistor. Rikets egen historik används som nämnare och valbar referens i tillväxt i procent, åldersstruktur och försörjningskvot. Riket tar ingen kommunplats och visas inte som linje i total folkmängd, Sverigesandel eller tillväxt i antal. Bevara CKM-informationen från 2025.
