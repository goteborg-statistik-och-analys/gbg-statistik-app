# Genomgång av tabellgruppering

Granskning av samtliga 237 tabeller i den lokala katalogen, 2026-09-17. Ändringen gäller hur tabellerna samlas på rader. Källtabeller, API-koder, datauttag och aktiverat tabellstöd ändras inte.

Katalogen går från 109 till 93 rader. Samtliga tabeller och geografival finns kvar.

## Sammanförda rader

| Tabell | Geografier på samma rad |
|---|---|
| Förvärvsarbetande, 2008-2024 | Kommun, Stadsområde, Mellanområde, Primärområde |
| Förvärvsarbetande efter invandringsår 18-74 år, 2008-2024 | Kommun, Stadsområde |
| Ohälsotal efter utbildningsnivå, 2011-2024 | Kommun, Primärområde |
| Dagbefolkning 16-74 år efter näringsgren, 2008-2024 | Mellanområde, Primärområde |
| Befolkningstäthet 1984-2025 | Kommun, Stadsområde, Mellanområde, Primärområde |
| Antal hushåll efter hushållsstorlek och bostadens hustyp, 2015-2025 | Kommun, Stadsområde, Mellanområde, Primärområde |
| Antal hushåll efter hushållsstorlek och bostadens upplåtelseform, 2015-2025 | Kommun, Stadsområde, Mellanområde, Primärområde |
| Befolkningen efter senaste invandringsår 2008-2025 | Kommun, Stadsområde, Mellanområde, Primärområde |
| Nybyggnation av bostäder efter bostadstyp och upplåtelseform 2005-2025 | Mellanområde, Primärområde, Basområde |
| Förvärvsinkomst efter utbildningsnivå 2007-2024 | Stadsområde, Kommun |
| Huvudsaklig inkomstkälla 18- år, 2022-2024 | Stadsområde, Kommun, Mellanområde, Primärområde |
| Inkomststandard efter bakgrund, 2021-2024 | Stadsområde, Kommun |
| Låg ekonomisk standard efter bakgrund, 2020-2024 | Stadsområde, Kommun |
| Förvärvsinkomst efter bakgrund, 2012-2024 | Mellanområde, Primärområde |
| Personbilar i trafik 2003 - 2025 | Kommun, Stadsområde, Mellanområde, Primärområde, Basområde |

## Skillnader som behålls

- Tabeller med och utan könsindelning hålls isär, bland annat dagbefolkning, sysselsatta, vissa förvärvsarbetandetabeller, födda, avlidna och ekonomisk standard.
- Arbetsställenas storleksklasser och tillgång till näringsgren skiljer sig mellan nivåer.
- Folkmängd efter hushållstyp har olika åldersgrupper.
- Förvärvsinkomst efter bakgrund 2007–2024 innehåller 75–84 år respektive 75 år och äldre.
- Förvärvsinkomst efter utbildningsnivå 2012–2024 innehåller 75–117 år respektive 75 år och äldre; dessa har inte antagits vara likvärdiga.
- Olika start- eller slutår, prognosperioder och flyttningsrelationer hålls isär.
- Högsta utbildningsnivå i femårsklasser hålls separat från ettårsklasser.
- Arealtabeller har olika geografier uttryckligen i rubriken och har inte sammanförts automatiskt.

## Regler

Grupperingen normaliserar blanksteg, bindestreck, kommatecken och versaler. Inkomst/Inkomster behandlas som samma tema. Granskade namnvarianter för dimensioner, kategorier, hushållstabeller och nybyggda bostäder jämställs. Numeriska kategorikoder översätts enbart när tabellens egna metadata ger en etikett. Ingen ungefärlig textmatchning används. Skillnader i kategorier och årtal bevaras.

Kontrollen bygger på katalogens beskrivningar och redan hämtade metadata. Den är ingen ny verifiering av samtliga tabellvärden.
