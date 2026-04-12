export function normalizeLlmText(text: string): string {
  const source = (text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const noMarkdown = source
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s*/gm, '');

  const normalized = noMarkdown
    .split('\n')
    .map((line) => line
      .replace(/^\s*[-*•●▪◦‣]+\s+/, '')
      .replace(/^\s*\d+[.)]\s+/, '')
      .replace(/\*/g, '')
      .replace(/\s+/g, ' ')
      .trim())
    .filter((line, index, arr) => line.length > 0 || (index > 0 && arr[index - 1].length > 0))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return normalized;
}
