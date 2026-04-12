export function replaceInitiativePlaceholders(text: string, initiativeName: string): string {
  const name = (initiativeName || '').trim();
  if (!name) return text || '';

  return (text || '').replace(/\[\s*(?:the\s+)?initiative\s*\]/gi, name);
}
