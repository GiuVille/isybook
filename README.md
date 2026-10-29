# IsyBook

IsyBook nasce da un problema molto concreto: le notizie sui libri che mi interessano sono sparse ovunque. Una special edition la annunciano su Instagram, l'uscita Kindle la trovo per caso sul sito dell'editore, il firmacopie lo scopro il giorno dopo. E le edizioni limitate, se non le prendi nelle prime ore, sono andate.

Quindi sto costruendo un sito che raccolga tutto in un posto solo: uscite, edizioni speciali e limitate, promozioni degli editori, eventi e fiere. Per ora mi concentro su romantasy, romance e fantasy YA in Italia, il mondo dove le special edition contano di più.

Non è un catalogo con le recensioni (per quello ci sono già Goodreads e compagnia). Qui conta quello che succede attorno al libro.

L'idea generale del progetto è della mia socia, che consiglia libri su Instagram come [@isyconsigliastorie](https://www.instagram.com/isyconsigliastorie/): è lì che è nato tutto, io mi occupo di trasformarla in un sito.

## Con cosa è fatto

Il budget è zero, quindi ho scelto solo servizi con un piano gratuito che basta per partire:

- **Astro 7** per il sito, generato tutto statico
- **Supabase** per database Postgres, login e permessi (Row Level Security)
- **Cloudflare Pages** per l'hosting
- **Google Books** e **Open Library** per i dati dei libri
- script Node lanciati con `tsx` per gli import, da schedulare poi con GitHub Actions

Serve Node 22.23 o più recente. Io lavoro con la 24.

Per velocizzare il lavoro mi sono fatto aiutare da Claude Code: lo uso come strumento per andare più veloce, mentre progettazione, scelte e revisione restano mie.

## Come è organizzato

```
src/
  pages/            le pagine pubbliche
  layouts/          il layout comune
  components/
  lib/              tipi, accesso ai dati, client Supabase, formattazione
  data/sample.json  dati finti per lavorare senza database
scripts/
  import-isbn.ts    import dei libri per ISBN
  check-promotions.ts  lettura notturna delle promozioni
  sources.json      fonti di prova, usate quando Supabase non è configurato
  lib/              chiamate alle API esterne
supabase/
  migrations/       schema del database
  seed.sql          gli stessi dati finti, versione SQL
```

## Il modello dati, in breve

La scelta che regge tutto è tenere separati opera ed edizione. "La corona di cenere" è un'opera (`works`); la copertina rigida, il Kindle e la limitata da 1500 copie con i bordi decorati sono tre righe in `editions`. Ogni edizione ha il suo ISBN, editore, data, prezzo, tipo (standard, speciale o limitata), tiratura e link d'acquisto.

Il resto ruota attorno a queste due tabelle: autori, editori, generi e tropi collegati alle opere, poi eventi, adattamenti, merch, rubriche e articoli. `review_queue` è dove finiscono i libri importati prima che qualcuno li guardi.

Tutto quello che si può pubblicare ha uno `status` (`draft`, `published`, `archived`). I permessi li gestisce il database: chi visita il sito vede solo ciò che è pubblicato. Non c'è un backend mio in mezzo, quindi è lì che deve stare la sicurezza.

## Farlo girare

```sh
npm install
cp .env.example .env
npm run dev
```

Il sito parte su `localhost:4321`. Se `.env` è vuoto usa i dati di `src/data/sample.json`, che per lavorare sulla grafica bastano e avanzano.

Per collegarlo a Supabase:

1. creo il progetto e copio URL, anon key e service role key nel `.env`;
2. applico lo schema con `npx supabase link --project-ref <ref>` e poi `npx supabase db push` (oppure incollo i file di `supabase/migrations/` nell'SQL editor, in ordine). Se voglio i dati finti anche lì, eseguo `supabase/seed.sql`.

Altri comandi utili: `npm run build` per la build in `dist/`, `npm run check` per il controllo dei tipi.

## Importare libri

```sh
npm run import -- 9781649374042
npm run import -- 9781649374042 --format hardcover --type limited
```

Si possono passare più ISBN insieme. `--format` accetta `paperback`, `hardcover`, `kindle` e `audio`; `--type` accetta `standard`, `special` e `limited`. Con `--raw` prendo solo i dati bibliografici, senza preparare trama e tropi.

L'import non pubblica niente: mette il libro in una coda e lo approvo io prima che vada online. Se nel `.env` manca la service role key, salva il risultato in `scripts/out/` così posso guardarlo comunque.

Una nota pratica: senza `GOOGLE_BOOKS_API_KEY` Google Books risponde spesso con un 429. In quel caso i dati arrivano solo da Open Library, che va bene ma a volte non ha la data d'uscita.

## Promozioni automatiche

Plaid in omaggio con tre libri, 3x2 sui gialli, segnalibri per chi preordina: le promozioni degli editori cambiano di settimana in settimana e ognuno le annuncia a modo suo. Per non doverle cercare a mano ho scritto un job che ogni notte legge le fonti e prepara le schede.

```sh
npm run promotions
npm run promotions -- --dry-run
```

Per ogni fonte (la tabella `sources` con `purpose = 'promotions'`, oppure `scripts/sources.json` senza Supabase):

1. controlla `robots.txt` e salta le pagine escluse; fa una sola richiesta, con un User-Agent che dice chi siamo;
2. estrae il testo principale della pagina o del feed RSS e ne calcola l'impronta: se non è cambiato dall'ultima volta si ferma lì;
3. se è cambiato, passa all'estrazione automatica dei dati (titolo, editore, tipo, premio, condizioni, date, libri citati) e scarta le promozioni che conosco già;
4. mette le nuove nella coda di approvazione. Senza Supabase le salva in `scripts/out/promotions-AAAA-MM-GG.json`.

Niente va online senza che qualcuno l'abbia guardato. Con `--dry-run` legge le fonti e aggiorna le impronte, ma non estrae e non scrive in coda: comodo per provare una fonte nuova.

Il job gira su GitHub Actions alle 5 del mattino (`.github/workflows/promotions.yml`) e si può lanciare anche a mano. Prende la configurazione dai secret del repository, con gli stessi nomi del `.env.example`; finché mancano si chiude senza errori.

## Cosa manca

- [x] pagine del sito: home, schede libro, calendario uscite
- [x] schema del database con i permessi
- [x] import per ISBN
- [x] gestione dei contenuti con coda di approvazione
- [x] ricerca e filtri per tropes, generi, ambientazione, autore, editore e tipo di edizione (speciale, limitata, prima edizione)
- [x] filtri per prezzo massimo e pagine massime, ordinamento per prezzo, uscita e pagine
- [x] scheda libro completa: saga, gadget, serie TV e film, libri simili, ebook e audiolibro, pagine, spicy
- [x] preferiti, cartelle personali e interessi salvati nel browser, con il feed "Per te"
- [x] calendario eventi e fiere, con ricerca, filtri e il file da aggiungere al calendario
- [x] serie TV e film tratti dai libri: stagioni o durata, dove vederli, titoli simili
- [x] pagine autore con saghe, tropes ricorrenti, adattamenti ed eventi
- [x] videoteca: serie e film "da vedere" e cartelle dedicate, accanto ai libri salvati
- [x] promozioni degli editori, con lettura notturna delle fonti e approvazione prima della pubblicazione
- [ ] rebuild automatico del sito dopo le modifiche ai contenuti
- [ ] job notturno che legge le pagine "prossime uscite" degli editori
- [ ] generatore di bozze per i post social
- [ ] deploy su Cloudflare Pages
- [ ] Edicola: collezioni da edicola a fumetti e fantasy, con piano dell'opera, prezzi e costo totale della collana
- [ ] Edicola: calendario settimanale delle uscite
- [ ] Edicola: tracker dei numeri presi nella libreria personale
- [ ] Edicola, più avanti: uscite di fumetti in libreria e fumetteria
- [ ] più avanti: account per chi legge (per ritrovare preferiti e cartelle su ogni dispositivo), avvisi via email e Telegram

## Licenza

Il codice è pubblico per mostrare il mio lavoro, ma tutti i diritti sono riservati: si può consultare, non copiare né riutilizzare senza il mio permesso. I dettagli sono nel file [LICENSE](LICENSE). Se ti interessa usarlo o collaborare, scrivimi tramite il mio profilo GitHub [@GiuVille](https://github.com/GiuVille).
