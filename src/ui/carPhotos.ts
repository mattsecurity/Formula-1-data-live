/**
 * Studio side-view renders of each driver's car, one per season and race
 * number, stored as `src/assets/cars/<year>/<number>.webp` (transparent
 * background, nose to the right). Missing entries fall back to the vector car.
 */
const PHOTOS = import.meta.glob('../assets/cars/*/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

export function carPhotoUrl(year: number | undefined, num: number): string | undefined {
  if (year == null) return undefined;
  return PHOTOS[`../assets/cars/${year}/${num}.webp`];
}
