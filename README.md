# Impara il cinese

Un sito per studiare il cinese partendo dal proprio catalogo di caratteri, parole e componenti. È una pagina statica: HTML, CSS e JavaScript puro, senza framework e senza installazioni. I progressi restano nel browser.

## Cosa si può fare

- **Ascolto**: senti la parola con la voce del browser e scrivi il pinyin. «Arrenditi» compila la risposta al posto tuo e la conta come resa.
- **Flashcard**: vedi il carattere e scrivi pinyin e significato. Se il tuo significato era giusto ma non era previsto, «Era giusto lo stesso» lo accetta e lo ricorda.
- **Pezzi**: sei tipi di domanda a scelta multipla (quale pezzo dà il suono, quale il significato, come si scrive un carattere, quale carattere nasce da certi pezzi, significato di un pezzo e il contrario). C'è sempre «Mi arrendo».
- **Statistiche**: giuste, sbagliate e arrese (in totale, per esercizio e per categoria), grafico degli ultimi 14 giorni, giorni di fila, obiettivo giornaliero, livelli di ripasso e le voci più difficili.
- **Catalogo**: tutte le voci, con ricerca per carattere, pinyin (anche senza toni) o italiano.
- **Ordine dei tratti**: interruttore *Tratti* in alto, accanto a quello del tema chiaro/scuro. Quando è attivo, il carattere si disegna tratto per tratto appena vedi la risposta.

Altri dettagli: pinyin con i toni scritti come numeri (`ni3hao3`, `nv3` per nǚ), tastiera dei toni sullo schermo, interruttore «Ignora i toni», accettazione del terzo tono che cambia nel parlato (nǐhǎo si sente níhǎo), ripasso intelligente a livelli (sistema Leitner), filtri per categoria, esporta/importa dei progressi, funziona da telefono.

## Provarlo in locale

Basta aprire `index.html` con un doppio clic. In alternativa, da terminale:

```bash
python3 -m http.server 8000
# poi apri http://localhost:8000
```

## Pubblicarlo su GitHub Pages

1. Crea un repository (per esempio `impara-cinese`) e carica tutti i file di questa cartella.
2. Vai in **Settings › Pages**, scegli *Deploy from a branch*, il ramo `main` e la cartella `/ (root)`.
3. Dopo un minuto il sito è online su `https://TUO-NOME.github.io/impara-cinese/`.

## Aggiungere parole

Il catalogo è il file `data/catalogo.txt`, nello stesso formato che usi già:

```
• 你好 nǐhǎo: ciao
```

Dopo ogni modifica rigenera i dati:

```bash
python3 tools/build_data.py
```

Lo script controlla il formato, unisce i duplicati e riscrive `data/catalogo.json` e `js/data.js` (quest'ultimo serve per aprire il sito anche senza server). Non modificare a mano i due file generati.

Per accettare altri significati o altre scritture di una parola, aggiungili nel dizionario `EXTRA_ANSWERS` all'inizio di `tools/build_data.py`.

## Test

```bash
node --test tests/match.test.js
```

Controllano il riconoscimento del pinyin (segni, numeri, spazi, toni mancanti, terzo tono), la tolleranza sui significati e che ogni voce del catalogo abbia un pinyin valido.

## Struttura

```
index.html          pagina unica
css/style.css       stile (carta quadrettata 田字格, tema chiaro e scuro)
js/match.js         controllo di pinyin e significati
js/practice.js      Ascolto e Flashcard
js/pieces.js        modalità Pezzi
js/stats.js         statistiche
js/store.js         impostazioni e progressi (localStorage)
js/speech.js        voce del browser (Web Speech API)
js/strokes.js       ordine dei tratti (Hanzi Writer)
js/app.js           pagine, impostazioni, catalogo
data/catalogo.txt   il catalogo, da modificare
tools/build_data.py trasforma il catalogo in JSON
tests/              test
```

## Note

- **Voce**: l'ascolto usa le voci cinesi del dispositivo. Microsoft Edge ne ha di online già pronte. Su altri browser potrebbe servire installare la lingua Cinese (semplificato) con la sintesi vocale. Se non c'è nessuna voce cinese il sito lo segnala.
- **Particelle in Ascolto**: le particelle a tono neutro (的, 了, 吗, 啊...) non vengono lette da sole, perché la voce non può indovinare il tono. Compaiono nelle flashcard e dentro le parole.
- **Tratti**: la libreria [Hanzi Writer](https://hanziwriter.org) e i dati dei caratteri si caricano da internet (jsDelivr) solo quando servono. Senza connessione o per i componenti che non hanno dati, il carattere resta fermo.
- **Privacy**: nessun account e nessun server. Tutto sta nel `localStorage` del browser; cancellando i dati del sito si perdono i progressi, quindi ogni tanto usa *Esporta*.
- **Come si conta**: una domanda è «giusta» solo se lo è al primo tentativo. Se sbagli e poi correggi, conta come sbagliata; se ti arrendi, come resa.
