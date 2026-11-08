# starry-daily

Planetario nel browser con il **cielo reale**, le **notizie spaziali** e le **ultime foto dallo spazio**, tutto caricato in tempo reale: il sito non salva né rigenera dati.

## Come funziona

- **Cielo reale e zoom vero.** La mappa usa [Aladin Lite](https://aladin.cds.unistra.fr/) (CDS, Strasburgo), che mostra le immagini delle grandi survey del cielo:
  - Mellinger per il cielo intero;
  - DSS2 per la vista ravvicinata;
  - Pan-STARRS e 2MASS, selezionabili dal menu.

  Lo zoom va dal cielo intero ai secondi d'arco, con rotella, pinch o i pulsanti +/−. Per ogni survey si usa il primo server che risponde: prima il mirror ESA (ESASky), poi il CDS.
- **Sopra il cielo:**
  - Sole, Luna e pianeti nella posizione di oggi, calcolata nel browser con gli elementi orbitali di Schlyter (`src/data/solar.ts`);
  - gli oggetti celebri;
  - il catalogo Messier, che compare quando ci si avvicina;
  - linee e nomi delle 89 costellazioni.

  I filtri in alto mostrano solo nebulose, galassie, ammassi o resti di supernova.
- **Ricerca.** Campo nel pannello (scorciatoia `/` o `Ctrl`/`⌘`+`K`): cerca per nome, per sigla di catalogo (`M31`, `NGC 5128`) o per tipo. Per qualunque altro oggetto («Cerca in tutto il cielo») il nome viene risolto con Sesame/Simbad.
- **Notizie.** [Spaceflight News API](https://api.spaceflightnewsapi.net) (NASA, ESA, SpaceNews, Spaceflight Now…) e il feed di NASA Science, unite e ordinate per data. Ogni notizia si apre in un riquadro con un link all'articolo completo.
- **Foto dallo spazio:**
  - foto astronomica del giorno (APOD, dalla REST API di science.nasa.gov);
  - la Terra vista dal satellite DSCOVR (NASA EPIC);
  - gli ultimi comunicati di Webb e Hubble (feed RSS di ESA);
  - le immagini più recenti della libreria NASA.

  Ogni foto si apre in un visore a schermo intero: zoom con rotella, pinch o doppio clic, trascinamento, frecce per scorrere.

## Comandi

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + build di produzione in dist/
npm run preview  # anteprima del build
```

I cataloghi statici (stelle e costellazioni, oggetti Messier) si rigenerano con `npm run fetch:sky` e `npm run fetch:deepsky`; non servono per l'aggiornamento quotidiano.

## Struttura

```
index.html             struttura dell'interfaccia (mappa, HUD, pannello, lettore)
src/main.ts            collega mappa, ricerca, scheda oggetto, notizie e foto
src/sky/aladin.ts      mappa del cielo (Aladin Lite): survey, marker, costellazioni, voli
src/feeds/news.ts      notizie live (Spaceflight News API + NASA Science)
src/feeds/photos.ts    foto live (APOD, EPIC, ESA Webb/Hubble, libreria NASA)
src/feeds/rss.ts       lettore RSS minimale
src/ui/viewer.ts       visore foto a schermo intero con zoom
src/three/planet.ts    globo 3D dei pianeti nella scheda (caricato solo quando serve)
src/data/objects.ts    oggetti celebri del cielo profondo
src/data/solar.ts      effemeridi di Sole, Luna e pianeti + schede
src/data/sky.json      costellazioni (d3-celestial, MIT)
src/data/deepsky.json  catalogo Messier (d3-celestial, MIT)
src/search.ts          indice e logica di ricerca
```

## Fonti e licenze

- Immagini del cielo: survey HiPS servite dal CDS e da ESA ESASky.
- Notizie: Spaceflight News API, NASA Science.
- Foto: NASA (APOD, EPIC, Image and Video Library), NOAA, ESA/Webb, ESA/Hubble. Crediti e link alla fonte originale sono nel visore.
- Aladin Lite è distribuito con licenza GPL-3.0.
