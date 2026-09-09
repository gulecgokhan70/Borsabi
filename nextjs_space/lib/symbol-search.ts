export function searchText(value: string) {
  return value.toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i').trim();
}
export function matchesSymbol(item: { symbol: string; shortName: string; name: string }, query: string) {
  const terms = searchText(query).split(/\s+/).filter(Boolean);
  const text = searchText(`${item.symbol} ${item.shortName} ${item.name}`);
  return terms.every(term => text.includes(term));
}
