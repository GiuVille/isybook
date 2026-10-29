# IsyBooks

IsyBooks nasce da un problema molto concreto: le notizie sui libri che mi interessano sono sparse ovunque. Una special edition la annunciano su Instagram, l'uscita Kindle la trovo per caso sul sito dell'editore, il firmacopie lo scopro il giorno dopo. E le edizioni limitate, se non le prendi nelle prime ore, sono andate.

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
  rebuild-site.ts   aggiornamento del sito quando cambiano i contenuti
  check-promotions.ts  lettura notturna delle promozioni
  check-releases.ts    lettura notturna delle prossime uscite
  sources.json      fonti di prova, usate quando Supabase non è configurato
  lib/              chiamate alle API esterne, lettura delle fonti, scheda del libro per la coda
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

## Lettura notturna delle fonti

Le novità che mi interessano arrivano da decine di pagine diverse: le "prossime uscite" degli editori, le pagine delle promozioni (plaid in omaggio con tre libri, 3x2 sui gialli, segnalibri per chi preordina), i feed RSS. Per non doverle controllare a mano ho scritto due job che ogni notte le leggono e preparano le schede.

```sh
npm run releases       # prossime uscite
npm run promotions     # promozioni
npm run releases -- --dry-run
```

Le fonti stanno nella tabella `sources`, ognuna con il suo scopo (`releases` o `promotions`); senza Supabase uso `scripts/sources.json`. Per ogni fonte:

1. controllo `robots.txt` e salto le pagine escluse; faccio una sola richiesta, con un User-Agent che dice chi siamo;
2. estraggo il testo principale della pagina o del feed e ne calcolo l'impronta: se non è cambiato dall'ultima volta mi fermo lì;
3. se è cambiato, passo all'estrazione automatica dei dati;
4. scarto quello che conosco già e metto il resto nella coda di approvazione. Senza Supabase salvo tutto in `scripts/out/`.

Per le **uscite** estraggo titolo, autori, editore, data, formato, tipo di edizione (standard, speciale o limitata), tiratura e cosa ha di speciale. Un'uscita è un doppione se ha lo stesso ISBN di un'edizione che ho già, oppure lo stesso titolo con lo stesso formato e lo stesso tipo di edizione. Se invece il libro c'è già ma l'edizione è nuova (la limitata con i bordi decorati, per dire), entra come nuova edizione di quell'opera. Quando c'è l'ISBN completo i dati con Google Books e Open Library; trama e tropi li preparo solo per le opere nuove. Per restare nei piani gratuiti preparo al massimo 20 uscite a notte: se una fonte ne ha di più, la rileggo la notte dopo.

Per le **promozioni** estraggo titolo, editore, tipo, premio, condizioni, date, libri citati e, se la pagina parla di una promozione sola, la sua grafica ufficiale.

Niente va online senza che qualcuno l'abbia guardato. Con `--dry-run` leggo le fonti e aggiorno le impronte, ma non estraggo e non scrivo in coda: comodo per provare una fonte nuova.

I due job girano uno dopo l'altro su GitHub Actions alle 5 del mattino (`.github/workflows/nightly.yml`) e si possono lanciare anche a mano. Prendono la configurazione dai secret del repository, con gli stessi nomi del `.env.example`; finché mancano si chiudono senza errori.

## Aggiornamento del sito

Il sito è statico, quindi un contenuto approvato va online solo con una nuova build su Cloudflare Pages. Far partire una build a ogni salvataggio sarebbe uno spreco: approvando dieci libri di fila ne partirebbero dieci, e il piano gratuito ne concede 500 al mese.

Così ho fatto in modo che sia il database a segnare quando qualcosa cambia (un trigger su ogni tabella pubblica aggiorna `site_state`, migrazione 0007). Ogni 15 minuti un job su GitHub Actions (`.github/workflows/rebuild.yml`) guarda lo stato e chiama il deploy hook di Cloudflare solo se le modifiche si sono fermate da almeno 10 minuti, o se qualcuno ha chiesto esplicitamente di aggiornare.

```sh
npm run rebuild            # ricostruisce solo se serve
npm run rebuild -- --force # ricostruisce comunque
```

C'è anche una build fissa ogni mattina, dopo la lettura notturna: le promozioni agli sgoccioli, le uscite "in arrivo" e gli eventi passati dipendono dalla data, quindi il sito va rigenerato anche quando i contenuti non cambiano. Senza il secret `CLOUDFLARE_DEPLOY_HOOK` il job si chiude senza errori.

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
- [x] videoteca: serie e film preferiti, "da vedere" e "visti", e cartelle dedicate, accanto ai libri salvati
- [x] bacheca delle notizie: post-it scritti dalla redazione, con foto ridotte e convertite in WebP prima del caricamento
- [x] promozioni degli editori, con lettura notturna delle fonti e approvazione prima della pubblicazione
- [x] job notturno che legge le pagine "prossime uscite" degli editori, special e limitate comprese
- [x] rebuild automatico del sito dopo le modifiche ai contenuti, più una build ogni mattina
- [x] bozze dei post social dai contenuti pubblicati: post e storie Instagram, caroselli e messaggi per Telegram, con immagini da scaricare
- [ ] deploy su Cloudflare Pages
- [ ] Edicola: uscite delle collane da edicola (fumetti particolari e libri), con piano dell'opera, prezzi e costo totale della collana
- [ ] Edicola: calendario settimanale delle uscite
- [ ] Edicola: tracker dei numeri presi nella libreria personale
- [ ] Edicola, più avanti: uscite di fumetti in libreria e fumetteria
- [ ] più avanti: account per chi legge (per ritrovare preferiti e cartelle su ogni dispositivo), avvisi via email e Telegram

## Licenza

Il codice è pubblico per mostrare il mio lavoro, ma tutti i diritti sono riservati: si può consultare, non copiare né riutilizzare senza il mio permesso. I dettagli sono nel file [LICENSE](LICENSE). Se ti interessa usarlo o collaborare, scrivimi tramite il mio profilo GitHub [@GiuVille](https://github.com/GiuVille).
