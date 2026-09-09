export function highlightRuns(text: string, highlights: string[] = []): Array<{ text: string; bold: boolean }> {
  const terms = [...new Set(highlights)].filter(t => t.trim() && t.length < 100 && t.split(/\s+/).length <= 5).sort((a, b) => b.length - a.length).slice(0, 80);
  if (!terms.length) return [{ text, bold: false }];
  const escaped = terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`(?<![\\w])(${escaped.join('|')})(?![\\w])`, 'gi');
  const result: Array<{ text: string; bold: boolean }> = []; let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > cursor) result.push({ text: text.slice(cursor, match.index), bold: false });
    result.push({ text: match[0], bold: true }); cursor = match.index + match[0].length;
  }
  if (cursor < text.length) result.push({ text: text.slice(cursor), bold: false });
  return result;
}
