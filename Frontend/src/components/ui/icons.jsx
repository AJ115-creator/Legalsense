const iconProps = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' }

export const DocumentIcon = ({ size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...iconProps}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </svg>
)

export const AnalysisIcon = ({ size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...iconProps}>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
    <line x1="11" y1="8" x2="11" y2="14" />
    <line x1="8" y1="11" x2="14" y2="11" />
  </svg>
)

export const ShieldCheckIcon = ({ size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...iconProps}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
)

export const UploadIcon = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...iconProps}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
)

export const CheckDocIcon = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...iconProps}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <path d="M9 15l2 2 4-4" />
  </svg>
)

export const ChevronLeftIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
)

export const ChevronRightIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
)

export const TranslateIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...iconProps}>
    <path d="M5 8l6 0" />
    <path d="M4 6l8 0" />
    <path d="M8 6v-1a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v1" />
    <path d="M4 12c1.5-2 3.6-3.5 6-4" />
    <path d="M12 12c-1.5-2-3.6-3.5-6-4" />
    <path d="M14 14l3 6" />
    <path d="M20 14l-3 6" />
    <path d="M15 18h4" />
  </svg>
)

export const ChevronDownIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
)

export const Spinner = ({ className = '' }) => (
  <div className={`w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin ${className}`} />
)
