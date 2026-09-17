# Mätning av stort folkmängdsuttag, 2026-09-17

Urval: 97 primärområden (inklusive Ospecificerat Göteborg), 101 ålderskategorier, båda könen summerade, 1984–2025. Område och ålder redovisas separat. Totalt 822 948 källvärden, 9 797 serier och 411 474 resultatrader.

| Metod | Antal anrop | Samtidiga anrop | Första körningen | Upprepad körning |
|---|---:|---:|---:|---:|
| Nuvarande halvering | 16 | 1 | 23,46 s | 17,66 s |
| Större delar (högst 100 000 värden) | 9 | 1 | 22,82 s | 17,49 s |
| Större delar och parallell hämtning | 9 | 2 | 10,85 s | 10,91 s |

Körordning: nuvarande, större delar, parallellt, större delar igen, parallellt igen, nuvarande igen. Inga körningar överlappade. Alla anrop gav HTTP 200 utan återförsök. Alla sex körningar gav samma SHA-256 för kanoniskt sorterade områdes-/ålderskoder och samtliga resultatår och värden: `ccec3d32b3c2f393ab3ee9d170c5e38141a6eb270d01bbc0835e3367e8b3493b`.

Större delar ensamt gav liten skillnad, särskilt vid upprepningen. Parallell hämtning gav cirka 38 procent kortare tid än upprepad nuvarande metod och cirka 54 procent kortare tid än första referenskörningen. Detta är observationer från ett uttag och två körningar per metod, ingen garanti vid annan belastning eller fler samtidiga användare. Tid till svarshuvuden sjönk tydligt vid upprepning, förenligt med cache eller varierande serverbelastning; cache kunde inte bekräftas.

Mätningen använder Node.js och appens urvals-, summerings- och tabellfunktioner. Totalen omfattar planering, överföring, JSON-tolkning och bearbetning fram till färdiga tabelldata. Metadatahämtning och kontrollhash ligger utanför totalen. Webbläsarens DOM, layout och uppritning ingår inte. `networkMs` i JSON är summan av anropens tider; vid parallell körning överlappar dessa och är inte total förfluten tid. `bytes` avser JSON-textens storlek efter eventuell dekomprimering, inte nödvändigtvis överförda nätverksbyte.

Experimentet ändrar endast mätskriptet, inte appens produktionshämtning. Rådata finns i extraction-baseline.json, extraction-packed.json, extraction-parallel.json och motsvarande filer med -repeat.

Återskapa med `node tools/measure-extraction.mjs <utfil.json> <baseline|packed> <1|2>`. Kör varianterna efter varandra. Skriptet gör riktiga API-uttag.
