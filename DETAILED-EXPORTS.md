# Detaljerade uttag

Välj **Välj alla** i de filter där alla delkategorier ska ingå. Välj sedan **Visa varje kategori separat** i varje filter som ska bli en egen indelning i resultatet. Övriga filter summeras enligt urvalet.

Exempel: välj alla primärområden och alla åldrar, redovisa båda separat och välj Totalt för kön. Uttaget får en rad per område, ålder och år. Välj även separat kön för en rad per område, ålder, kön och år.

Totalt är en summa och ställer filtret på summerad redovisning. Välj alla väljer delkategorier utan att lägga på källans total som en extra kategori.

Alla resultat ingår i CSV och Excel. Resultattabellen visar 200 rader per sida. Diagrammet visar högst sju valda serier; vid större uttag behöver man själv välja vilka linjer som ska visas. Det går att söka bland seriernas namn. SVG och PNG innehåller de valda diagramlinjerna.

Uttag över 100 000 källvärden delas längs separat redovisade dimensioner. Högst en miljon källvärden tillåts per uttag; större urval behöver begränsas, exempelvis till färre år. Anropsbegränsningar i statistikdatabasen ger väntan och automatiska återförsök. Ändrade urval stoppar fortsatt hämtning av det gamla uttaget.

Deluttagen fylls upp till högst 100 000 källvärden och hämtas med högst två samtidiga anrop per uttag. Resultaten behåller urvalets ordning även när svaren kommer i annan ordning. Vid anropsbegränsning pausas nya anrop från båda arbetarna i 12 sekunder; varje deluttag har högst tre försök. Redan pågående anrop kan avslutas efter ett ändrat urval, men deras resultat används inte och inga fler delar av det gamla uttaget hämtas. Publicera även JavaScript-modulen `extraction-queue.js`.
