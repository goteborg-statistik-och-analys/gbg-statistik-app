# Kommungränser för Sverigekartan

Källa: [SCB, digitala gränser](https://www.scb.se/hitta-statistik/regional-statistik-och-kartor/regionala-indelningar/digitala-granser/).
Licens: CC0. Hämtat 2026-09-25 från SCB:s länkade arkiv `shape_svenska_260225.zip`.
Originalets kommunfil: `Kommun_Sweref99TM.zip`, projektion SWEREF 99 TM (EPSG:3006).

SCB beskriver gränserna som förenklade och avsedda för tematisering av statistik,
inte geografiska analyser. Arkivets namn är ingen garanti för gränsernas referensår.
Samtliga 290 kommunkoder har kontrollerats mot den befintliga statistiken för 2025.

`tools/build-sweden-map.py <sökväg till nedladdat arkiv>` skapar JSON-filen.
Polygonernas samtliga ringar behålls, nord är uppåt och skalan är lika i båda axlar.
Endast koordinaternas skala och avrundning till SVG-koordinater ändras.
Arkivets SHA-256 och källadresser finns i JSON-filen. Inga externa karttjänster
anropas när besökaren använder kartan.

Färgklasserna har fasta symmetriska gränser: ±500 personer respektive ±1 procent.
Noll har en separat klass; saknade värden och kommuner utanför urvalet är vita.
Ettårsvalet använder SCB:s publicerade folkökning delad med föregående års
publicerade folkmängd. För 3, 5 och 10 år används förändringen mellan publicerade
folkmängdstotaler, i procent av startårets total. Kartan och tiolistorna använder
samma beräkning och avser perioder som slutar 2025. De tre extra basåren 2022,
2020 och 2015 finns i det versionsbundna periodunderlaget i `goteborg-jamforelse/`.
`tools/build-comparison-periods.mjs` hämtar och validerar dessa totaler från SCB.
