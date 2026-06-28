# Spese Casa Nuova — versione sincronizzata Google Sheets

Questa versione usa Google Sheets tramite Apps Script come database condiviso.

## Come pubblicarla su GitHub Pages

1. Estrai lo ZIP.
2. Carica i file estratti nella root del repository GitHub, sostituendo quelli vecchi.
3. Fai Commit changes.
4. Aspetta il deploy GitHub Pages.
5. Apri l'app aggiungendo `?v=sync1` alla fine del link per evitare cache vecchia.

## Backend collegato

Apps Script Web App URL configurato nel codice:

https://script.google.com/macros/s/AKfycbxVO2TiYLCk4Givdfsi5ega6cNrVa_ARgoGsVCp7tXAp27qUuJcNDzA6Sz-nwCui6Hq5g/exec

## Nota

I dati vengono letti/scritti su Google Sheets. Se la pagina segnala errore di sincronizzazione, controlla che Apps Script sia distribuito come Web App con:

- Execute as: Me
- Who has access: Anyone / Anyone with the link
