import { useState, useRef, useEffect } from 'react'
import { Search } from 'lucide-react'

interface SearchAutocompleteInputProps {
  value: string
  onSearch: (term: string) => void
  suggestions: string[]
  placeholder?: string
  className?: string
}

export function SearchAutocompleteInput({
  value,
  onSearch,
  suggestions,
  placeholder = 'Buscar...',
  className = '',
}: SearchAutocompleteInputProps) {
  const [draft, setDraft] = useState(value)
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setDraft(value)
  }, [value])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const q = draft.trim().toLowerCase()
  const filtered = q
    ? Array.from(new Set(suggestions))
        .filter((item) => item.toLowerCase().includes(q))
        .slice(0, 7)
    : []

  const submitSearch = (term = draft) => {
    setOpen(false)
    onSearch(term)
  }

  return (
    <div ref={containerRef} className={`relative flex items-stretch ${className}`}>
      <input
        type="text"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value)
          setOpen(true)
        }}
        onFocus={() => {
          if (draft.trim()) setOpen(true)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            submitSearch(draft)
          } else if (e.key === 'Escape') {
            setOpen(false)
          }
        }}
        placeholder={placeholder}
        className="flex-1 min-w-0 h-9 px-3 bg-white border border-[#e5e7eb] text-xs text-black focus:outline-none focus:border-black"
      />
      <button
        type="button"
        onClick={() => submitSearch(draft)}
        title="Buscar"
        aria-label="Buscar"
        className="w-9 h-9 bg-[#f4f5f7] hover:bg-[#e5e7eb] border border-l-0 border-[#e5e7eb] grid place-items-center text-black shrink-0 cursor-pointer transition"
      >
        <Search className="w-3.5 h-3.5" />
      </button>

      {open && filtered.length > 0 && (
        <div className="absolute left-0 right-0 top-full bg-white border border-t-0 border-[#e5e7eb] shadow-md z-40 max-h-52 overflow-y-auto">
          {filtered.map((item) => (
            <button
              key={item}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                setDraft(item)
                submitSearch(item)
              }}
              className="w-full text-left px-3 py-2 text-xs text-black hover:bg-[#f4f5f7] border-b border-[#eef0f3] last:border-b-0 cursor-pointer"
            >
              {item}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default SearchAutocompleteInput
