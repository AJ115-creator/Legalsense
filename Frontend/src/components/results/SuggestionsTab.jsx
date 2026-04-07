import Card from '../ui/Card'

const SuggestionCard = ({ index, text }) => (
  <Card glass className="stagger-child flex gap-4">
    <span className="shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center">
      {index}
    </span>
    <p className="text-foreground leading-[1.7] text-sm">{text}</p>
  </Card>
)

const SuggestionsTab = ({ suggestions }) => (
  <div className="space-y-3">
    {suggestions.map((s, i) => (
      <SuggestionCard key={i} index={i + 1} text={s} />
    ))}
  </div>
)

export default SuggestionsTab
