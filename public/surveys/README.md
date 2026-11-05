# Rilievi reali nell'esploratore

Questi asset sono file locali acquisiti da fonti pubbliche, con licenze e
provenienza nei rispettivi manifest. Sono caricati solo per il circuito
selezionato nell'esploratore; nessuna chiave o account esterno è necessario.

| Circuito | Asset | Copertura e limiti |
|---|---|---|
| Interlagos | `br-1940/survey.glb`, circa 15.5 MB | Nove tasselli GeoSampa MDS 2017; circa 966 mila punti RGB. Tutti i campioni del tracciato, distanziati di 2 m, hanno punti del rilievo entro 5 m. Non è una mesh: avvicinandosi si vedono spazi fra i punti. Quote relative a 762.63 m nel datum originale. |
| Melbourne | `au-1953/context.glb`, circa 23.8 MB | Fotogrammetria municipale 2020, tassello E5-20 a est di Albert Park. Circa 492 mila triangoli, cinque atlanti fotografici. Non comprende la pista. Quote AHD originali. |

La selezione dei dati è in `src/data/surveySources.ts`. Le coordinate sono
metri locali est/alto/sud rispetto all'origine del pacchetto geografico. Il
visualizzatore allinea il rilievo al tracciato senza appiattirne le quote e
inquadra i suoi limiti effettivi. In modalità rilievo nasconde terreno e
edifici sintetici per non sovrapporre geometrie incompatibili.

## Licenze

- Interlagos: Prefeitura do Município de São Paulo / GeoSampa, **CC BY-SA 4.0**.
  Il GLB adattato conserva questa licenza; vedere `br-1940/ATTRIBUTION.md`,
  `metadata.json` e `sources.json` per fonti, trasformazioni e hash.
- Melbourne: City of Melbourne, **CC BY 4.0**. Vedere
  `au-1953/ATTRIBUTION.txt` e `manifest.json`. Le texture sono fotografie del
  rilievo, non materiale generato; la conversione riduce risoluzione e
  raggruppa le texture per limitare memoria e chiamate di disegno.

Le licenze dei dati restano distinte da quelle del codice e dei dati OSM.
Le attribuzioni sono visibili nella vista e collegano le licenze. Le strutture
temporanee e gli interventi successivi alla ripresa possono essere assenti.

## Riproducibilità

Gli script `scripts/prepare-interlagos-survey.py` e
`scripts/convert-melbourne-photomesh.py` documentano dipendenze, cache e opzioni.
I download originali rimangono fuori Git; i manifest includono checksum e
parametri delle conversioni. Le fotografie aeree di altri circuiti e la loro
provenienza sono in `public/orthophotos/`.

Questa integrazione non calibra le quote delle monoposto del replay e non
completa tutti i 25 circuiti con fotogrammetria. Il resto conserva il contesto
geografico indicativo documentato nel progetto.
