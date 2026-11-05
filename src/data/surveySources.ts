export interface SurveySource {
  circuitId: string;
  url: string;
  origin: readonly [number, number];
  kind: 'photomesh' | 'pointcloud';
  label: string;
  description: string;
  attribution: string;
  sourceUrl: string;
  license: string;
  licenseUrl: string;
}

/** These are acquired local assets, not promises of complete city coverage. */
const SOURCES: Record<string, SurveySource> = {
  'au-1953': {
    circuitId: 'au-1953', url: 'surveys/au-1953/context.glb',
    origin: [144.97036026712328, -37.845938767123286], kind: 'photomesh',
    label: 'Fotogrammetria parziale · 2020',
    description: 'Rilievo fotografico di una zona a est di Albert Park. Non comprende il circuito: il bordo del modello indica la copertura disponibile. Quote originali AHD.',
    attribution: 'City of Melbourne · Photomesh May 2020',
    sourceUrl: 'https://data.melbourne.vic.gov.au/explore/dataset/city-of-melbourne-3d-textured-mesh-photomesh-2020/information/',
    license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  },
  'br-1940': {
    circuitId: 'br-1940', url: 'surveys/br-1940/survey.glb',
    origin: [-46.698041865497075, -23.70095316374269], kind: 'pointcloud',
    label: 'LiDAR a colori · rilievo storico',
    description: 'Punti misurati del circuito e dintorni, colorati dal rilievo GeoSampa MDS 2017. È una nuvola di punti, non una superficie fotografica continua; data esatta di acquisizione non verificata. Le quote sono relative al terreno mediano del rilievo.',
    attribution: 'Prefeitura do Município de São Paulo / GeoSampa',
    sourceUrl: 'https://download.geosampa.prefeitura.sp.gov.br/',
    license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  },
};

export function surveySource(circuitId: string): SurveySource | undefined {
  return SOURCES[circuitId];
}
