# starry-daily

Planetario 3D nel browser: una mappa celeste navigabile con notizie spaziali e foto reali dei telescopi spaziali. Cliccando una foto la mappa ruota e zooma sul corpo celeste corrispondente.

## Come funziona

- **Mappa 3D** — tre.js: sfera celeste con 9.000 stelle, banda della Via Lattea (16.000 punti lungo il piano galattico), griglia equatoriale RA/Dec e 18 oggetti del cielo profondo posizionati con coordinate J2000 reali.
- **Ricerca** — campo in alto nel pannello (scorciatoia `/` oppure `Ctrl`/`⌘`+`K`): cerca per nome, per nome di catalogo (`M31`, `M42`, `NGC 5128`), per soprannome o per tipo (`pianeta`, `nebulosa`, `galassia`). Frecce e `Invio` per navigare i risultati, che portano la mappa sull'oggetto.
- **Pianeti, Sole e Luna** — posizioni geocentriche calcolate al caricamento con gli elementi orbitali di Schlyter (approssimazione di pochi primi d'arco), quindi sempre aggiornate alla data di oggi; compaiono in mappa con la propria etichetta e nella ricerca.
- **Notizie spaziali** — feed RSS di NASA Science, salvato in `src/data/news.json` insieme al testo degli articoli, così la lettura avviene dentro il sito.
- **Mappa celeste reale** — 5.044 stelle del catalogo (magnitudine ≤ 6) con colore dedotto dall'indice B−V, Via Lattea con banda diffusa e venature, figure e nomi delle 89 costellazioni (pulsante «Costellazioni») e le foto reali dei telescopi al posto degli aloni. Pianeti, Sole e Luna sono sfere con superfici procedurali, illuminate dalla direzione del Sole.
- **Lettore interno** — notizie e schede si aprono in una finestra dentro la pagina (chiusa con `Esc`, il pulsante ✕ o un clic sullo sfondo): nessun collegamento porta fuori dal sito. Le schede di pianeti, Sole e Luna mostrano i dati fisici (diametro, massa, anno, giorno, temperatura, lune).
- **Foto telescopi** — 18 immagini d'archivio NASA (Hubble, Spitzer) in `public/photos`, con titolo, credito, data e link all'archivio.
- **Volo verso l'oggetto** — cliccando una foto (o un'etichetta nella mappa) la camera interpola orientamento e campo visivo fino a centrare l'oggetto, con reticolo di selezione e scheda descrittiva.
- **Interazioni** — trascina per ruotare, rotella o pulsanti +/− per lo zoom, filtri per tipo di oggetto, `Esc` o "Ricentra" per tornare alla vista iniziale.

## Comandi

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # typecheck + build di produzione in dist/
npm run preview  # anteprima del build
```

Aggiornare i dati:

```bash
npm run fetch:news    # riscarica le notizie (NASA Science)
npm run fetch:photos  # riscarica le immagini dalla libreria NASA
```

## Struttura

```
index.html            struttura dell'interfaccia (HUD, pannello, scheda)
src/main.ts           UI: notizie, galleria, filtri, scheda dettaglio
src/three/sky.ts      scena 3D, stelle, Via Lattea, marcatori, camera
src/data/objects.ts   catalogo celeste (coordinate, distanze, descrizioni)
src/data/solar.ts     effemeridi di Sole, Luna e pianeti + schede
src/search.ts         indice e logica di ricerca (alias di catalogo)
src/data/photos.json  metadati immagini (generato)
src/data/news.json    notizie (generato)
public/photos/        immagini JPG (generate)
scripts/              script di acquisizione dati
```

## Fonti

Immagini e notizie provengono dai servizi pubblici NASA ([Image and Video Library](https://images.nasa.gov), [NASA Science](https://science.nasa.gov)). Crediti e link alla scheda originale sono indicati nella scheda di ogni foto.
