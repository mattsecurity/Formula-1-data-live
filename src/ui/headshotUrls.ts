/** Size variants of an official F1 headshot URL, best first (each may not exist). */
export function headshotCandidates(url: string | undefined, large = false): string[] {
  if (!url) return [];
  const m = /\/(\d)col\//.exec(url);
  if (!m) return [url];
  const sizes = large ? ['4col', '2col', '1col'] : ['2col', '1col'];
  return [...new Set(sizes.map((s) => url.replace(/\/\dcol\//, `/${s}/`)))];
}
