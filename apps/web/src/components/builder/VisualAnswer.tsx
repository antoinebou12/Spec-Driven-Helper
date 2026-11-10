import { useMemo } from 'react';
import { BarChart3, Info, ListOrdered, Scale } from 'lucide-react';
import { Badge } from '../ui';
import { useL } from '../../i18n';
import {
  visualAnswerSchema,
  type VisualAnswer,
} from '../../../../../packages/shared/src/visual-answers';
import { CardShell } from './BuilderCards';
import { ComparisonView } from './VisualComparison';
import { StepsView } from './VisualSteps';
import { ChartView } from './VisualChart';
import './visual-answer.css';

/**
 * Answers you can interact with, inside the Build with AI conversation (after CopilotKit's Open
 * Intelligent UI): the AI sends data (`show_visual`) and these native components render it — a
 * comparison whose weights you can change, a walkthrough you can step through, a chart with a table.
 * Nothing the model writes is run as code, and a follow-up you click is sent as an ordinary message.
 */
export function VisualAnswerCard({
  args,
  running,
  onFollowUp,
}: {
  args: unknown;
  running?: boolean;
  onFollowUp?: (message: string) => void;
}) {
  const l = useL();
  const parsed = useMemo(
    () => visualAnswerSchema.safeParse((args as { visual?: unknown } | undefined)?.visual),
    [args],
  );
  if (!parsed.success)
    return running ? (
      <div className="visual-skeleton builder-card" role="status">
        <BarChart3 size={15} aria-hidden />{' '}
        {l('Preparing an interactive answer…', 'Préparation d’une réponse interactive…')}
      </div>
    ) : null;
  return <VisualAnswerView visual={parsed.data} onFollowUp={onFollowUp} />;
}

export function VisualAnswerView({
  visual,
  onFollowUp,
}: {
  visual: VisualAnswer;
  onFollowUp?: (message: string) => void;
}) {
  const l = useL();
  const icon = {
    comparison: <Scale size={15} aria-hidden />,
    steps: <ListOrdered size={15} aria-hidden />,
    chart: <BarChart3 size={15} aria-hidden />,
  }[visual.kind];
  return (
    <CardShell icon={icon} title={visual.title}>
      <p className="visual-kicker">
        <Badge tone="violet">{l('Interactive answer', 'Réponse interactive')}</Badge>
        <span className="muted small">{hint(visual.kind, l)}</span>
      </p>
      {visual.kind === 'comparison' && <ComparisonView v={visual} onFollowUp={onFollowUp} />}
      {visual.kind === 'steps' && <StepsView v={visual} onFollowUp={onFollowUp} />}
      {visual.kind === 'chart' && <ChartView v={visual} />}
      {visual.basis && (
        <p className="visual-basis small">
          <Info size={13} aria-hidden /> {visual.basis}
        </p>
      )}
    </CardShell>
  );
}

const hint = (kind: VisualAnswer['kind'], l: (en: string, fr: string) => string) =>
  ({
    comparison: l(
      'Change what matters most; the ranking follows.',
      'Changez ce qui compte le plus ; le classement suit.',
    ),
    steps: l('Step through it, or play it.', 'Avancez pas à pas, ou lancez la lecture.'),
    chart: l('Hover or focus a bar for its value.', 'Survolez ou ciblez une barre pour sa valeur.'),
  })[kind];
