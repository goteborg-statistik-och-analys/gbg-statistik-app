# Testa sökningen på kontoret

Testa gärna både vanliga frågor och era egna formuleringar. Förslag:

- Hur många kvinnor 20–64 år bor i Majorna 2020–2025?
- Barn i förskoleålder
- Arbetslöshet bland unga
- Medianinkomst i Majorna
- Utbilding (avsiktligt stavfel)
- Nybyggda bostäder
- Jämför folkmängden i Majorna och Stigberget

Anteckna exakt söktext, önskad tabell eller typ av statistik, vilken träff som kom först och om det föreslagna urvalet stämde. Notera också frågor där rätt tabell saknas helt. Undvik personuppgifter i testanteckningarna.

Ordlistan finns i `search-keywords.js`. Begrepp och titelmönster delas av tabellernas geografiska varianter. `tests/search-relevance.test.mjs` innehåller exempel med förväntade träffar; lägg till nya frågor där när ni har beslutat vilket resultat som är rätt.

Sökningen läser katalogen lokalt och skickar inte söktexter till en söktjänst. Den loggar inte era frågor automatiskt. Stavningsstödet är en kort lista med uttryckliga rättelser, inte generell stavningskontroll. Okända ämnesord måste fortfarande matcha för att undvika orelaterade träffar.

Ett tydligt område, kön eller åldersintervall fylls i när källtabellens metadata stödjer det. Flera områden, kön eller åldersintervall lämnas för manuellt val av jämförelse/summering. Begrepp som ”unga” får inget antaget åldersintervall. Lön behandlas inte som synonym till förvärvsinkomst. Katalogens år påverkar rankningen men tillgängligheten kontrolleras vid tabellval.
