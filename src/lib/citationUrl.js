export function buildCitationUrl(sourceUrl, quote) {
  const source = String(sourceUrl || '').trim();
  const citation = String(quote || '').replace(/\s+/g, ' ').trim();
  if (!source || !citation) return source;

  const hashIndex = source.indexOf('#');
  const base = hashIndex >= 0 ? source.slice(0, hashIndex) : source;
  const currentHash = hashIndex >= 0 ? source.slice(hashIndex + 1) : '';
  const anchor = currentHash.replace(/:~:text=.*$/i, '');
  return `${base}#${anchor}:~:text=${encodeURIComponent(citation)}`;
}
