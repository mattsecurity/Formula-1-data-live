import { useState } from 'react';

/** Official flag image when available, otherwise the 3-letter country code. */
export function Flag({ code, url }: { code?: string | null; url?: string | null }) {
  const [failed, setFailed] = useState(false);
  if (url && !failed) return <img className="flag-img" src={url} alt={code ?? ''} referrerPolicy="no-referrer" loading="lazy" onError={() => setFailed(true)} />;
  return code ? <span className="country-code">{code.toUpperCase()}</span> : null;
}
