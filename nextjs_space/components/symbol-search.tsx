'use client';
import { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, X } from 'lucide-react';

interface SymbolOption {
  symbol: string;
  name: string;
  shortName: string;
}

interface SymbolSearchProps {
  value: string;
  onChange: (symbol: string) => void;
  groups: { label: string; items: SymbolOption[] }[];
  placeholder?: string;
}

export function SymbolSearch({ value, onChange, groups, placeholder = 'Sembol ara...' }: SymbolSearchProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Find selected item name
  const allItems = groups.flatMap(g => g.items);
  const selected = allItems.find(i => i.symbol === value);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const q = search.toLowerCase().trim();

  const filteredGroups = groups.map(g => ({
    ...g,
    items: q
      ? g.items.filter(i =>
          i.shortName.toLowerCase().includes(q) ||
          i.name.toLowerCase().includes(q)
        )
      : g.items,
  })).filter(g => g.items.length > 0);

  const totalFiltered = filteredGroups.reduce((sum, g) => sum + g.items.length, 0);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full bg-[#0F172A] border border-white/[0.08] text-white rounded-lg px-3 py-2.5 text-sm text-left flex items-center justify-between hover:border-[#475569] focus:border-[#3B82F6] focus:outline-none transition-colors"
      >
        <span className={selected ? 'text-white' : 'text-[#64748B]'}>
          {selected ? `${selected.shortName} - ${selected.name}` : 'Sembol seçin'}
        </span>
        <ChevronDown className={`w-4 h-4 text-[#64748B] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full glass-card rounded-xl shadow-xl overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-white/[0.08]">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#64748B]" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={placeholder}
                className="w-full bg-[#0F172A] border border-white/[0.08] text-white rounded-lg pl-8 pr-8 py-2 text-sm focus:border-[#3B82F6] focus:outline-none placeholder-[#64748B]"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <p className="text-[10px] text-[#64748B] mt-1 px-1">
              {totalFiltered} sonuç
            </p>
          </div>

          {/* Results */}
          <div className="max-h-[280px] overflow-y-auto scrollbar-thin scrollbar-thumb-[#334155]">
            {filteredGroups.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-[#64748B]">
                Sonuç bulunamadı
              </div>
            ) : (
              filteredGroups.map(group => (
                <div key={group.label}>
                  <div className="px-3 py-1.5 text-[10px] font-semibold text-[#64748B] uppercase tracking-wider glass-inner sticky top-0">
                    {group.label} ({group.items.length})
                  </div>
                  {group.items.slice(0, q ? 50 : 30).map(item => (
                    <button
                      key={item.symbol}
                      onClick={() => {
                        onChange(item.symbol);
                        setOpen(false);
                        setSearch('');
                      }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-white/[0.06]/50 flex items-center gap-2 transition-colors ${
                        item.symbol === value ? 'bg-[#3B82F6]/10 text-[#3B82F6]' : 'text-white'
                      }`}
                    >
                      <span className="font-mono text-xs w-10 flex-shrink-0">{item.shortName}</span>
                      <span className="text-xs text-[#94A3B8] truncate">{item.name}</span>
                    </button>
                  ))}
                  {group.items.length > (q ? 50 : 30) && (
                    <div className="px-3 py-1.5 text-[10px] text-[#64748B] text-center">
                      +{group.items.length - (q ? 50 : 30)} daha... Arama yaparak daraltın
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
