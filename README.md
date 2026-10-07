# Pitwall — F1 Replay 🏎️

Una web app in stile Apple Pro (Liquid Glass, grafica da broadcast, tema scuro) per **rivivere ogni sessione di Formula 1 con i dati reali**: posizioni delle monoposto in pista, classifica che si aggiorna a ogni sorpasso, telemetria di bordo e analisi da muretto box.

È una reinterpretazione web di [f1-race-replay](https://github.com/IAmTomShaw/f1-race-replay) di Tom Shaw e dei suoi contributor. Riprende le funzioni dell'originale (app desktop in Python) e le porta nel browser: non serve installare niente.

## Cosa fa

### Replay della sessione
- Mappa del circuito ricostruita dalla telemetria, con bordi pista, cordoli bianco-rossi nelle curve strette, corsia box, piazzole della griglia, linea del traguardo, settori S1/S2/S3, zone DRS con linea di attivazione, frecce del senso di marcia, scala in metri e curve numerate con il loro nome (es. Variante del Rettifilo, Eau Rouge, Copse, 130R).
- **Vista 3D del circuito** (pulsante 2D/3D o tasto P): asfalto, cordoli, corsia box, zone DRS, linea del traguardo e dislivelli reali ricavati dall'altitudine della telemetria (accentuati per renderli visibili). Tre camere: **Orbita** (ruoti e zoomi liberamente), **Insegui** (dietro la monoposto selezionata o al leader) e **Dall'alto**. Clicca una monoposto per selezionarla.
- **Bandiere per settore**: quando la direzione gara espone la gialla o la doppia gialla, il settore di commissari interessato si illumina sulla mappa (2D e 3D) con una bandierina che sventola. Con la bandiera rossa si colora tutto il tracciato. In basso, accanto ai controlli, una bandiera animata mostra sempre la situazione in pista (verde, gialla, doppia gialla, rossa, SC, VSC, scacchi) con il settore e la curva più vicina.
- **Mappa velocità**: colora il tracciato in base alla velocità del giro di riferimento.
- Quando zoomi, le monoposto diventano sagome viste dall'alto orientate nel senso di marcia. Le etichette mostrano posizione e sigla, come in TV.
- Le monoposto si muovono in tempo reale con scie colorate. Puoi fare zoom e trascinare la mappa, e ruotare il circuito.
- **Classifica live calcolata dalla posizione in pista**: cambia nell'istante del sorpasso, con distacchi live (dal leader o intervallo), frecce di posizioni guadagnate o perse, gomma e giri della gomma, PIT e RIT. In alternativa puoi usare l'ordine del cronometraggio ufficiale.
- **Safety Car simulata** davanti al leader (entra in pista, guida il gruppo, rientra), come nell'originale.
- Barra temporale con giri, periodi di SC, VSC, bandiera rossa e gialle, ritiri e pit stop dei piloti selezionati.
- Controlli: play e pausa, ±10 s, velocità da 0,5× a 128×, ricomincia. Ci sono anche le scorciatoie da tastiera (Spazio, ←/→, ↑/↓, 1–9, R, D, L, T, C, I, F, P, Esc).
- **Link a un momento preciso**: aggiungi `?t=<secondi>` all'indirizzo del replay (es. `#/replay/990011?t=1110&view=3d` apre la demo di Monza in 3D durante una doppia gialla; `view=3d` è facoltativo).
- **Telemetria di bordo** (fino a 3 piloti a confronto): velocità, marcia, RPM, stato del DRS (OFF/ELIG/OPEN), gas e freno, traccia degli ultimi 20 secondi, tempo del giro in corso, **delta live sul giro personale**, minisettori viola/verdi/gialli, gomma e soste. Con la **camera car** segui il pilota con lo zoom.
- Torre dei tempi in stile TV, con colonna selezionabile (intervallo, distacco, ultimo giro, miglior giro) e il marcatore viola del giro più veloce.
- Meteo in pista e messaggi della direzione gara in tempo reale.

### Animazioni
- Semaforo di partenza come in TV: portale con 5 pod e lenti a LED, luci che si accendono una alla volta con un lampo e un riflesso rosso sulla scena, attesa casuale e "Luci spente" con dissolvenza verso la gara.
- Sottopancia in stile TV per bandiera a scacchi (con il vincitore), Safety Car, VSC, bandiera rossa e pista libera.
- Notifiche per sorpassi, giro più veloce, pit stop e ritiri. Un segnale sulla mappa evidenzia ogni sorpasso.
- Tracciati reali che si disegnano con le monoposto in movimento, transizioni tra le pagine e riflessi del vetro che seguono il cursore.

### Analisi (pulsante 📊 o tasto I)
Tempi sul giro con mescole e modalità delta, distacchi dal leader, lap chart delle posizioni, strategia gomme, settori (viola = migliore), pit stop, direzione gara, **team radio ascoltabili**, grafici meteo e **mondiale live** (come cambierebbe la classifica se la gara finisse adesso).
Di base le analisi sono "senza spoiler": mostrano solo i dati fino al momento del replay. Spunta "Tutta la sessione" per vedere tutto.

### Lap Lab
L'equivalente delle qualifiche dell'originale: confronta i giri di più piloti con velocità, gas, freno, marcia, giri motore e **delta tempo metro per metro**. Il cursore è sincronizzato su tutti i grafici, le curve sono segnate lungo l'asse della distanza e un pannello mostra i valori di ogni pilota nello stesso punto del giro. Sulla mappa del giro le auto fantasma corrono una accanto all'altra e il tracciato si colora con il pilota più veloce in ogni mini-settore.

### Altre pagine
- **Calendario** delle stagioni dal 2023 a oggi, con il tracciato reale di ogni circuito.
- **Weekend**: mappa e dati del circuito (lunghezza, primo GP, altitudine), tutte le sessioni e la classifica.
- **Piloti e Team**: ritratti ufficiali e monoposto vista dall'alto nei colori del team.
- **Classifiche** piloti e costruttori.
- **Demo offline**: un Gran Premio d'Italia simulato sul vero tracciato di Monza (sorpassi, Safety Car, pit stop, ritiro) e una qualifica, utili per provare tutto anche senza connessione. Se sei online, la demo usa le foto ufficiali dei piloti.

## Come usarla

### Online con GitHub Pages (consigliato, gratis)
1. Su GitHub apri il repository e vai in **Settings → Pages**.
2. Alla voce **Source** scegli **GitHub Actions**.
3. Unisci questo branch in `main`. Il workflow `Deploy su GitHub Pages` pubblica il sito da solo.
4. Il sito sarà su `https://<tuo-utente>.github.io/<nome-repo>/`.

### Sul tuo computer
Serve [Node.js](https://nodejs.org) versione 20 o più recente.
```bash
npm install
npm run dev
```
Poi apri l'indirizzo che compare nel terminale (di solito http://localhost:5173).

Altri comandi:
- `npm run build` crea la versione pronta da pubblicare nella cartella `dist/`.
- `npm test` esegue i test.

## Da dove arrivano i dati
Da [OpenF1](https://openf1.org), un'API open source e gratuita per i dati storici dal 2023 in poi, senza account. Il browser scarica i dati direttamente da lì.

- La **prima** apertura di una gara scarica la telemetria di tutte le monoposto e può richiedere circa un minuto, perché OpenF1 limita le richieste troppo frequenti. Le volte successive è istantanea, perché i dati vengono salvati nel browser.
- I dati di una sessione sono disponibili qualche ora dopo la sua fine. I dati in diretta di OpenF1 sono a pagamento e non sono usati.
- Le foto dei piloti sono quelle ufficiali fornite da OpenF1.
- I tracciati reali dei circuiti vengono da [bacinger/f1-circuits](https://github.com/bacinger/f1-circuits) (licenza MIT). Numeri delle curve e orientamento TV arrivano dall'API usata da MultiViewer, quando disponibile.

## Struttura del codice
```
src/
├── api/        client OpenF1 (code di richieste, retry, cache) e demo simulata
├── model/      dati di sessione, geometria del circuito, classifica live, analisi
├── replay/     schermata di replay: mappa, classifica, telemetria, analisi, eventi animati
├── lab/        Lap Lab (confronto giri)
├── pages/      home, calendario, weekend, piloti, classifiche
└── ui/         componenti di interfaccia (glass, grafici, icone, monoposto SVG)
```
Tecnologie: React, TypeScript, Vite, Framer Motion, Canvas 2D e three.js (vista 3D, caricata solo quando serve).

### Come funziona la classifica live
Ogni campione di posizione viene proiettato sul tracciato di riferimento, ricostruito da un giro pulito, e trasformato in "distanza di gara" (es. 23,47 giri). La classifica ordina i piloti per questa distanza in ogni istante. Una piccola tolleranza evita sfarfallii quando due auto sono affiancate. I distacchi in secondi si calcolano confrontando quando ciascuna auto è passata dallo stesso punto della pista.

## Crediti e note
- Progetto originale: [IAmTomShaw/f1-race-replay](https://github.com/IAmTomShaw/f1-race-replay) e i suoi [contributor](https://github.com/IAmTomShaw/f1-race-replay/blob/main/contributors.md).
- Dati: [OpenF1](https://openf1.org).
- Tracciati: [bacinger/f1-circuits](https://github.com/bacinger/f1-circuits) di Tomislav Bacinger (MIT).
- Progetto non ufficiale e senza scopo di lucro. Formula 1, F1 e i marchi correlati appartengono ai rispettivi proprietari.
