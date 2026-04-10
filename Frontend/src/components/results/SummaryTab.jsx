import { useState, useRef, useEffect } from 'react'
import { useAuth } from '@clerk/react'
import { apiFetch } from '../../services/api'
import Card from '../ui/Card'
import { TranslateIcon, ChevronDownIcon, Spinner } from '../ui/icons'

const LANGUAGES = [
  { code: 'Hindi', label: 'Hindi' },
]

const SummaryTab = ({ summary }) => {
  const { getToken } = useAuth()
  const [translatedText, setTranslatedText] = useState(null)
  const [activeLanguage, setActiveLanguage] = useState(null)
  const [loading, setLoading] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [cache, setCache] = useState({})
  const dropdownRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleTranslate = async (lang) => {
    setDropdownOpen(false)

    if (activeLanguage === lang) {
      setActiveLanguage(null)
      setTranslatedText(null)
      return
    }

    if (cache[lang]) {
      setTranslatedText(cache[lang])
      setActiveLanguage(lang)
      return
    }

    setLoading(true)
    try {
      const res = await apiFetch(
        '/translate/',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: summary, target_lang: lang }),
        },
        getToken,
      )
      setCache((prev) => ({ ...prev, [lang]: res.translated }))
      setTranslatedText(res.translated)
      setActiveLanguage(lang)
    } catch {
      setTranslatedText(null)
      setActiveLanguage(null)
    } finally {
      setLoading(false)
    }
  }

  const displayText = activeLanguage ? translatedText : summary

  return (
    <Card glass>
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {activeLanguage ? `Translated to ${activeLanguage}` : 'Original (English)'}
        </span>

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen((o) => !o)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg
              bg-muted/50 hover:bg-muted text-foreground transition-colors duration-150
              disabled:opacity-50 disabled:pointer-events-none"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            ) : (
              <TranslateIcon size={14} />
            )}
            {activeLanguage || 'Translate'}
            <ChevronDownIcon size={12} />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-1 w-48 rounded-lg border border-border bg-card shadow-lg z-10 overflow-hidden">
              {activeLanguage && (
                <button
                  onClick={() => {
                    setActiveLanguage(null)
                    setTranslatedText(null)
                    setDropdownOpen(false)
                  }}
                  className="w-full px-4 py-2.5 text-sm text-left hover:bg-muted/50 transition-colors
                    text-foreground font-medium border-b border-border"
                >
                  Show Original (English)
                </button>
              )}

              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => handleTranslate(lang.code)}
                  className={`w-full px-4 py-2.5 text-sm text-left hover:bg-muted/50 transition-colors
                    ${activeLanguage === lang.code ? 'text-primary font-medium' : 'text-foreground'}`}
                >
                  {lang.label}
                  {activeLanguage === lang.code && ' \u2713'}
                </button>
              ))}

              <div className="px-4 py-2.5 text-xs text-muted-foreground border-t border-border">
                More languages coming soon
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="prose prose-sm max-w-none">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner />
          </div>
        ) : (
          displayText?.split('\n\n').map((p, i) => (
            <p key={i} className="stagger-child text-foreground leading-[1.7] mb-4 last:mb-0">{p}</p>
          ))
        )}
      </div>
    </Card>
  )
}

export default SummaryTab
