'use client';
import { useState, useRef, useEffect, useId } from 'react';
import { Search, X } from 'lucide-react';
import { matchesSymbol } from '@/lib/symbol-search';
interface SymbolOption { symbol: string; name: string; shortName: string }
interface SymbolSearchProps {
  value: string;
  onChange: (symbol: string) => void;
  groups: { label: string; items: SymbolOption[] }[];
  placeholder?: string;
}
export function SymbolSearch({ value, onChange, groups, placeholder = 'Sembol ara...' }: SymbolSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const selected = groups.flatMap(g => g.items).find(i => i.symbol === value);
  const results = groups.flatMap(g => g.items.filter(i => matchesSymbol(i, query)).map(item => ({ ...item, group: g.label }))).slice(0, 30);
  useEffect(() => {
    const outside = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, []);
  function choose(item: SymbolOption) { onChange(item.symbol); setQuery(''); setOpen(false); inputRef.current?.blur(); }
  return <div ref={ref} className="relative">
    <div className="relative">
      <Search aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <input ref={inputRef} role="combobox" aria-label="Sembol ara" aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-list`}
        aria-activedescendant={open && results[active] ? `${id}-${active}` : undefined}
        autoComplete="off" spellCheck={false} value={open ? query : selected ? `${selected.shortName} · ${selected.name}` : query}
        onFocus={() => { setOpen(true); setQuery(''); setActive(0); }}
        onChange={e => { setQuery(e.target.value); setOpen(true); setActive(0); onChange(''); }}
        onBlur={e => { if (!e.currentTarget.parentElement?.parentElement?.contains(e.relatedTarget)) setOpen(false); }}
        onKeyDown={e => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setOpen(true); setActive(i => Math.max(0, Math.min(results.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))); }
          if (e.key === 'Enter' && open) { e.preventDefault(); if (results[active]) choose(results[active]); }
          if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
        }} placeholder={placeholder} className="w-full min-h-[44px] glass-inner border border-black/[0.08] dark:border-white/[0.08] text-foreground rounded-lg pl-9 pr-11 py-3 text-sm focus:border-[#3B82F6] focus:outline-none" />
      {(value || query) && <button type="button" aria-label="Sembolü temizle" onClick={() => { onChange(''); setQuery(''); setOpen(true); setActive(0); inputRef.current?.focus(); }} className="absolute right-0 top-0 min-w-[44px] min-h-[44px] flex items-center justify-center"><X className="w-4 h-4" /></button>}
    </div>
    {open && <div id={`${id}-list`} role="listbox" aria-label="Arama sonuçları" className="absolute z-50 mt-1 w-full max-h-72 overflow-y-auto rounded-xl bg-background border border-black/10 dark:border-white/10 shadow-xl">
      {!results.length && <p className="p-3 text-sm text-muted-foreground">Sonuç bulunamadı</p>}
      {results.map((item, i) => <button key={item.symbol} id={`${id}-${i}`} type="button" role="option" aria-selected={i === active}
        onMouseDown={e => e.preventDefault()} onClick={() => choose(item)}
        className={`w-full min-h-[44px] px-3 py-2 text-left text-sm ${i === active ? 'bg-[#3B82F6]/10' : 'hover:bg-[#3B82F6]/5'}`}>
        <span className="font-semibold">{item.shortName}</span><span className="ml-2 text-muted-foreground">{item.name}</span><span className="block text-xs text-muted-foreground">{item.group}</span>
      </button>)}
      {query && <p role="status" className="px-3 py-2 text-xs text-muted-foreground">{results.length === 30 ? 'İlk 30 sonuç' : `${results.length} sonuç`}</p>}
    </div>}
  </div>;
}
