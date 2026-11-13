# starry-daily

Planetario nel browser con il **cielo reale**, un **Universo 3D** che va dai pianeti all'universo osservabile, le **notizie spaziali** e le **ultime foto dallo spazio**, tutto caricato in tempo reale: il sito non salva né rigenera dati.

Due modalità, scelte con il selettore in alto (o con il link diretto `#universo`, anche a una scala: `#universo/galaxy`):

- **Cielo dalla Terra**: le immagini reali del cielo, a tutto schermo.
- **Universo 3D**: zoom continuo dalla superficie di un pianeta fino al bordo dell'universo osservabile.

## Come funziona

- **Cielo reale e zoom vero.** La mappa usa [Aladin Lite](https://aladin.cds.unistra.fr/) (CDS, Strasburgo), che mostra le immagini delle grandi survey del cielo:
  - Mellinger per il cielo intero;
  - DSS2 per la vista ravvicinata;
  - Pan-STARRS e 2MASS, selezionabili dal menu.

  La proiezione è stereografica, come nei planetari: anche allontanandosi il cielo riempie tutto lo schermo invece di diventare un globo. Lo zoom va da 150° di campo ai secondi d'arco, con rotella, pinch o i pulsanti +/−; al campo massimo, continuando ad allontanarsi, compare l'invito a passare all'Universo 3D. Per ogni survey si usa il primo server che risponde: prima il mirror ESA (ESASky), poi il CDS.
- **Sopra il cielo:**
  - Sole, Luna e pianeti nella posizione di oggi, calcolata nel browser con gli elementi orbitali di Schlyter (`src/data/solar.ts`);
  - pianeti nani (Cerere, Plutone, Eris, Haumea, Makemake, Quaoar, Sedna), Vesta, Pallade, le comete di Halley, Encke e 67P, con gli elementi orbitali del JPL Small-Body Database (`src/data/bodies.ts`), e la direzione delle sonde Voyager 1, Voyager 2 e New Horizons;
  - i nomi delle stelle più luminose;
  - gli oggetti celebri;
  - il catalogo Messier, che compare quando ci si avvicina;
  - linee e nomi delle 89 costellazioni.

  I filtri in alto mostrano solo nebulose, galassie, ammassi o resti di supernova.
- **Universo 3D** (three.js, caricato solo quando serve, `src/universe/`). Scorciatoie di scala, barra di scala e distanza dal Sole sono nell'HUD; clic su un nome per volarci sopra e aprire la scheda.
  - **Sistema solare**: Sole, pianeti con le superfici della scheda e l'asse di rotazione reale, anelli di Saturno, orbite, 12 lune principali, pianeti nani, asteroidi e comete nelle posizioni di oggi; fascia degli asteroidi (con i Troiani di Giove), fascia di Kuiper, nube di Oort.
  - **Stelle vicine**: 9.549 stelle reali con la loro posizione 3D (tutte quelle visibili a occhio nudo e tutte quelle entro 50 anni luce, dal database HYG). La luminosità si calcola dalla distanza della camera: da ogni punto il cielo è quello vero.
  - **Via Lattea**: modello con bulge, barra, quattro bracci e Sperone di Orione, con la posizione del Sole; nebulose celebri e Sagittarius A* alla loro distanza.
  - **Gruppo Locale e oltre**: una trentina di galassie e strutture reali (Andromeda, Triangolo, Nubi di Magellano, nane satelliti, M81, M87, ammassi della Vergine e della Chioma, Laniakea, Grande Attrattore, Shapley, Grande Muraglia di Sloan, il quasar 3C 273, la galassia JADES-GS-z14-0).
  - **Universo osservabile**: la sfera di 46,5 miliardi di anni luce con le fluttuazioni della radiazione cosmica di fondo. La rete di filamenti tra le strutture reali è illustrativa.
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

I cataloghi statici (stelle e costellazioni, oggetti Messier, stelle 3D) si rigenerano con `npm run fetch:sky`, `npm run fetch:deepsky` e `npm run fetch:stars3d`; non servono per l'aggiornamento quotidiano.

## Struttura

```
index.html             struttura dell'interfaccia (mappa, HUD, pannello, lettore)
src/main.ts            collega mappa, ricerca, scheda oggetto, notizie e foto
src/sky/aladin.ts      mappa del cielo (Aladin Lite): survey, marker, costellazioni, voli
src/feeds/news.ts      notizie live (Spaceflight News API + NASA Science)
src/feeds/photos.ts    foto live (APOD, EPIC, ESA Webb/Hubble, libreria NASA)
src/feeds/rss.ts       lettore RSS minimale
src/ui/viewer.ts       visore foto a schermo intero con zoom
src/universe/scene.ts  Universo 3D: scale, voli, controlli, livelli dal sistema solare alla CMB
src/universe/          modello della Via Lattea, shader, texture procedurali, etichette, unità
src/three/planet.ts    superfici procedurali e globo 3D nella scheda (caricato solo quando serve)
src/data/objects.ts    oggetti celebri del cielo profondo
src/data/solar.ts      effemeridi di Sole, Luna e pianeti + schede
src/data/bodies.ts     pianeti nani, asteroidi, comete, lune e sonde
src/data/galaxies.ts   galassie e grandi strutture dell'universo
src/data/regions.ts    fasce, Via Lattea, Gruppo Locale, universo osservabile
src/data/stars.ts      stelle con nome (stars-named.json); stars3d.json ha le posizioni 3D (HYG)
src/data/sky.json      costellazioni (d3-celestial, MIT)
src/data/deepsky.json  catalogo Messier (d3-celestial, MIT)
src/search.ts          indice e logica di ricerca
```

## Fonti e licenze

- Immagini del cielo: survey HiPS servite dal CDS e da ESA ESASky.
- Stelle 3D: [HYG Database](https://github.com/astronexus/HYG-Database) v4.1 di astronexus, licenza CC BY-SA 4.0.
- Orbite di pianeti nani, asteroidi e comete: JPL Small-Body Database (NASA/JPL).
- Superfici di pianeti, lune e corpi minori: mappe globali reali delle missioni NASA (MESSENGER, Magellan, Blue Marble, LRO, Viking, Cassini, Galileo, Voyager, Dawn, New Horizons, SDO) dal NASA Photojournal, NASA SVS, NASA Earth Observatory e USGS Astrogeology. Si rigenerano con `npm run fetch:textures` (Python 3 + Pillow); i crediti di ogni mappa sono in `src/data/texture-credits.json` e nella scheda dell'oggetto. Per Saturno, Urano e Nettuno non esistono mappe globali: la texture è ricavata dai colori reali di foto Cassini e Voyager 2. Eris, Haumea, Makemake, Quaoar, Sedna, Pallade, le lune di Urano e Deimos non sono mai stati fotografati da vicino e si vedono con il loro colore medio.
- Notizie: Spaceflight News API, NASA Science.
- Foto: NASA (APOD, EPIC, Image and Video Library), NOAA, ESA/Webb, ESA/Hubble. Crediti e link alla fonte originale sono nel visore.
- Aladin Lite è distribuito con licenza GPL-3.0.
