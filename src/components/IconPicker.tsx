import { ICON_KEYS, iconFor } from '../lib/icons';

export function IconPicker({
  value,
  onChange,
  label = 'Pilih ikon',
}: {
  value: string;
  onChange: (key: string) => void;
  label?: string;
}) {
  return (
    <div>
      <p className="sk-eyebrow" style={{ marginBottom: '0.45rem' }}>
        {label}
      </p>
      <div className="sk-icon-grid" role="radiogroup" aria-label={label}>
        {ICON_KEYS.map((key) => {
          const Icon = iconFor(key);
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={value === key}
              aria-label={key}
              className="sk-icon-cell"
              data-active={value === key}
              onClick={() => onChange(key)}
            >
              <Icon />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function IconBadge({ name, tone }: { name?: string; tone?: string }) {
  const Icon = iconFor(name);
  return (
    <span className="sk-row-icon" data-tone={tone}>
      <Icon />
    </span>
  );
}
