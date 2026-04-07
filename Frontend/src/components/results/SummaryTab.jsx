import Card from '../ui/Card'

const SummaryTab = ({ summary }) => (
  <Card glass>
    <div className="prose prose-sm max-w-none">
      {summary.split('\n\n').map((p, i) => (
        <p key={i} className="stagger-child text-foreground leading-[1.7] mb-4 last:mb-0">{p}</p>
      ))}
    </div>
  </Card>
)

export default SummaryTab
