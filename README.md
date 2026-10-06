# Pitwall — F1 Replay 🏎️

Una web app in stile Apple (Liquid Glass, animazioni fluide, tema scuro) per **rivivere ogni sessione di Formula 1 con i dati reali**: posizioni delle monoposto in pista, classifica che si aggiorna a ogni sorpasso, telemetria di bordo e analisi da muretto box.

È una reinterpretazione web di [f1-race-replay](https://github.com/IAmTomShaw/f1-race-replay) di Tom Shaw e dei suoi contributor. Riprende le funzioni dell'originale (app desktop in Python) e le porta nel browser: non serve installare niente.

## Cosa fa

### Replay della sessione
- Mappa del circuito ricostruita dalla telemetria, con zone DRS animate, settori, linea del traguardo e numeri delle curve.
- Le monoposto si muovono in tempo reale con scie colorate. Puoi fare zoom e trascinare la mappa, e ruotare il circuito.
- **Classifica live calcolata dalla posizione in pista**: cambia nell'istante del sorpasso, con distacchi live (dal leader o intervallo), frecce di posizioni guadagnate o perse, gomma e giri della gomma, PIT e RIT. In alternativa puoi usare l'ordine del cronometraggio ufficiale.
- **Safety Car simulata** davanti al leader (entra in pista, guida il gruppo, rientra), come nell'originale.
- Barra temporale con giri, periodi di SC, VSC e bandiera rossa, ritiri e pit stop dei piloti selezionati.
- Controlli: play e pausa, ±10 s, velocità da 0,5× a 128×, ricomincia. Ci sono anche le scorciatoie da tastiera (Spazio, ←/→, ↑/↓, 1–9, R, D, L, T, C, I, F, Esc).
- **Telemetria di bordo** (fino a 3 piloti a confronto): tachimetro animato, marcia, shift-lights come sul volante, gas, freno, DRS, ultimo e miglior giro. Con **camera car** segui il pilota con lo zoom.
- Meteo in pista e messaggi della direzione gara in tempo reale.

### Animazioni
- Semaforo di partenza a 5 luci prima del via.
- Bandiera a scacchi con coriandoli e la card del vincitore.
- Banner animati per Safety Car, VSC, bandiera rossa e pista libera.
- Notifiche per sorpassi, giro più veloce (viola), pit stop e ritiri.
- Onde d'urto sulla mappa a ogni sorpasso.
- Monoposto che entra in scena nella home, card 3D che si inclinano col cursore, contatori animati.
- Riflessi del vetro che seguono il cursore e transizioni tra le pagine.

### Analisi (pulsante 📊 o tasto I)
Tempi sul giro con mescole e modalità delta, distacchi dal leader, lap chart delle posizioni, strategia gomme, settori (viola = migliore), pit stop, direzione gara, **team radio ascoltabili**, grafici meteo e **mondiale live** (come cambierebbe la classifica se la gara finisse adesso).
Di base le analisi sono "senza spoiler": mostrano solo i dati fino al momento del replay. Spunta "Tutta la sessione" per vedere tutto.

### Lap Lab
L'equivalente delle qualifiche dell'originale: confronta i giri di più piloti con velocità, gas, freno, marcia, giri motore e **delta tempo metro per metro**. Sulla mappa del giro le auto fantasma corrono una accanto all'altra e il tracciato si colora con il pilota più veloce in ogni mini-settore.

### Altre pagine
- **Calendario** delle stagioni 2023 → oggi.
- **Weekend**: tutte le sessioni (prove libere, sprint, qualifiche, gara) e la classifica.
- **Piloti e Team**: card con foto ufficiali e monoposto disegnate con i colori del team.
- **Classifiche** piloti e costruttori.
- **Demo offline**: una gara simulata completa (sorpassi, Safety Car, pit stop, ritiro) e una qualifica, utili per provare tutto anche senza connessione.

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
- Le foto dei piloti sono quelle ufficiali fornite da OpenF1. Le monoposto sono illustrazioni vettoriali con i colori dei team, così non serve nessuna immagine esterna.

### Usare una tua immagine nella home
Metti una foto in `public/img/hero.jpg`: la home la userà al posto dell'illustrazione della monoposto.

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
Tecnologie: React, TypeScript, Vite, Framer Motion e Canvas 2D.

### Come funziona la classifica live
Ogni campione di posizione viene proiettato sul tracciato di riferimento, ricostruito da un giro pulito, e trasformato in "distanza di gara" (es. 23,47 giri). La classifica ordina i piloti per questa distanza in ogni istante. Una piccola tolleranza evita sfarfallii quando due auto sono affiancate. I distacchi in secondi si calcolano confrontando quando ciascuna auto è passata dallo stesso punto della pista.

## Crediti e note
- Progetto originale: [IAmTomShaw/f1-race-replay](https://github.com/IAmTomShaw/f1-race-replay) e i suoi [contributor](https://github.com/IAmTomShaw/f1-race-replay/blob/main/contributors.md).
- Dati: [OpenF1](https://openf1.org).
- Progetto non ufficiale e senza scopo di lucro. Formula 1, F1 e i marchi correlati appartengono ai rispettivi proprietari.
