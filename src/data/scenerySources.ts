/** Only datasets explicitly configured by the project owner are contacted. */
export interface PhotogrammetrySource {
  url: string;
  attribution: string;
  /** Ellipsoid altitude of the local origin, metres. Calibrate against the source survey. */
  originAltitude: number;
}
export interface ScenerySources { version: 1; circuits: Record<string, PhotogrammetrySource> }
export async function loadPhotogrammetrySource(id: string, signal: AbortSignal): Promise<PhotogrammetrySource | null> {
  const response = await fetch(`${import.meta.env.BASE_URL}scenery-sources.json`, { signal });
  if (!response.ok) return null;
  const config = await response.json() as ScenerySources;
  const source = config.version === 1 ? config.circuits?.[id] : undefined;
  if (!source || typeof source.url !== 'string' || typeof source.attribution !== 'string' || !Number.isFinite(source.originAltitude)) return null;
  const url = new URL(source.url, document.baseURI);
  if (!['https:', 'http:'].includes(url.protocol)) return null;
  return { ...source, url: url.href };
}
