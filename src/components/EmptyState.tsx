import { iconFor } from '../lib/icons';
import type { IconComponent } from '../lib/icons';

export function EmptyState({
  icon = 'wallet',
  title,
  hint,
  action,
}: {
  icon?: string;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  const Icon: IconComponent = iconFor(icon);
  return (
    <div className="sk-empty">
      <span className="sk-empty-art">
        <Icon />
      </span>
      <strong>{title}</strong>
      {hint ? <p style={{ margin: '0 0 0.8rem' }}>{hint}</p> : null}
      {action}
    </div>
  );
}
