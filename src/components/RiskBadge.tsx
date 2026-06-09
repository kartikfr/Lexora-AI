import { RISK_COLORS, RISK_DOT_COLORS, RiskLevel } from '../types';

const VALID_LEVELS = new Set<string>(['Low', 'Medium', 'High', 'Critical']);

type Props = { level: RiskLevel | string | undefined; size?: 'sm' | 'md' };

export default function RiskBadge({ level, size = 'md' }: Props) {
  const safeLevel: RiskLevel = VALID_LEVELS.has(level as string)
    ? (level as RiskLevel)
    : 'Medium';

  const colorClass = RISK_COLORS[safeLevel];
  const dotClass = RISK_DOT_COLORS[safeLevel];
  const sizeClass = size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-xs px-2 py-1';

  return (
    <span className={`inline-flex items-center gap-1.5 font-medium rounded-md border ${colorClass} ${sizeClass} ${safeLevel === 'Critical' ? 'risk-critical' : ''}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotClass}`} />
      {safeLevel}
    </span>
  );
}
