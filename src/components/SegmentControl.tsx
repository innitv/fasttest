import { useState } from "react";

interface Segment {
  id: string;
  label: string;
}

interface Props {
  items: Segment[];
  active: string;
  badge: { on: string; text: string } | null;
}

/**
 * Сегмент-контрол архетипа A.
 *
 * Донорская визуальная высота — 31 css, что ниже порога зоны нажатия 44.
 * Конфликт разрешён так, как записано в `screens.md`: невидимый padding
 * расширяет зону нажатия до 44, визуальная высота не меняется.
 * Бейдж выступает за верхнюю границу трека — донорская асимметрия,
 * воспроизводится намеренно.
 */
export function SegmentControl({ items, active, badge }: Props) {
  const [selected, setSelected] = useState(active);

  return (
    <div
      data-testid="segment-control"
      role="tablist"
      className="relative flex w-full"
      style={{
        height: "var(--k-segment-h)",
        background: "var(--t-surface-card)",
        borderRadius: "var(--t-radius-control)",
        padding: "2px",
      }}
    >
      {items.map((item) => {
        const isActive = item.id === selected;
        return (
          <div key={item.id} className="relative flex-1">
            <button
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setSelected(item.id)}
              className="flex w-full items-center justify-center"
              style={{
                // Зона нажатия расширена вверх и вниз невидимым padding:
                // визуальная заливка остаётся высотой сегмента.
                height: "var(--k-tap-min)",
                marginBlock: "calc((var(--k-segment-h) - 4px - var(--k-tap-min)) / 2)",
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
              }}
            >
              <span
                className="flex w-full items-center justify-center"
                style={{
                  height: "calc(var(--k-segment-h) - 4px)",
                  borderRadius: "var(--k-segment-inner-radius)",
                  background: isActive ? "var(--t-brand-fill)" : "transparent",
                  color: isActive ? "var(--t-brand-on)" : "var(--t-text-primary)",
                  fontSize: "var(--t-font-body)",
                  fontWeight: 600,
                  transition: "background-color var(--k-motion-fast) ease-out, color var(--k-motion-fast) ease-out",
                }}
              >
                {item.label}
              </span>
            </button>

            {badge && badge.on === item.id && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute flex items-center justify-center"
                style={{
                  top: "calc(-1 * var(--k-badge-overhang))",
                  right: "6px",
                  height: "var(--k-badge-h)",
                  paddingInline: "8px",
                  borderRadius: "var(--t-radius-chip)",
                  background: "var(--t-accent, var(--t-brand-primary))",
                  color: "var(--t-accent-on, var(--t-brand-primary-on))",
                  fontSize: "11px",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                }}
              >
                {badge.text}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
