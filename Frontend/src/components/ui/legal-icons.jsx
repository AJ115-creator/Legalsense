const ScaleOfJustice = ({ size = 48 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="24" y1="6" x2="24" y2="40" />
    <line x1="16" y1="40" x2="32" y2="40" />
    <line x1="10" y1="14" x2="38" y2="14" />
    <path d="M10 14 L6 26 Q10 32 14 26 Z" />
    <path d="M38 14 L34 26 Q38 32 42 26 Z" />
    <circle cx="24" cy="6" r="2" />
  </svg>
)

const GavelIcon = ({ size = 48 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="8" y="8" width="14" height="6" rx="1" transform="rotate(-45 15 11)" />
    <line x1="20" y1="20" x2="30" y2="30" />
    <rect x="28" y="28" width="14" height="6" rx="1" transform="rotate(-45 35 31)" />
    <line x1="12" y1="38" x2="36" y2="38" />
    <line x1="14" y1="34" x2="34" y2="34" />
  </svg>
)

const ConstitutionScroll = ({ size = 48 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 8 Q8 8 8 12 L8 36 Q8 40 12 40 L36 40 Q40 40 40 36 L40 12 Q40 8 36 8 Z" />
    <path d="M8 12 Q12 12 12 8" />
    <line x1="16" y1="16" x2="32" y2="16" />
    <line x1="16" y1="21" x2="32" y2="21" />
    <line x1="16" y1="26" x2="28" y2="26" />
    <line x1="16" y1="31" x2="24" y2="31" />
  </svg>
)

const ParagraphSymbol = ({ size = 48 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 8 L20 40" />
    <path d="M28 8 L28 40" />
    <path d="M20 8 L32 8" />
    <path d="M14 16 Q10 16 10 20 Q10 24 14 24 L20 24" />
    <path d="M14 24 Q10 24 10 28 Q10 32 14 32 L20 32" />
  </svg>
)

const DocumentSeal = ({ size = 48 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 6 L32 6 L38 12 L38 42 L10 42 Z" />
    <path d="M32 6 L32 12 L38 12" />
    <line x1="16" y1="18" x2="32" y2="18" />
    <line x1="16" y1="23" x2="32" y2="23" />
    <line x1="16" y1="28" x2="26" y2="28" />
    <circle cx="30" cy="36" r="5" />
    <path d="M28 36 L30 38 L33 34" />
  </svg>
)

export { ScaleOfJustice, GavelIcon, ConstitutionScroll, ParagraphSymbol, DocumentSeal }
