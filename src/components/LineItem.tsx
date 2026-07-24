import type { LineItemConfig } from "@demo/theme/tenant.schema";

/**
 * Позиция заказа архетипа B.
 *
 * Медиа-слот — нейтральный квадрат: иллюстрации донора не воспроизводятся
 * (Disallowed Copying), но размер и радиус те же, чтобы ритм не поехал.
 *
 * Старая цена зачёркнута И окрашена: зачёркивание — второй канал смысла,
 * поэтому информация не теряется даже когда цвет корректируется по контрасту.
 * Подарочная позиция старой цены не имеет и в `totals.sum` не входит —
 * это ограничение содержания, снять его на вёрстке нельзя.
 */
export function LineItem({ item, index }: { item: LineItemConfig; index: number }) {
  return (
    <div
      data-testid={`line-item-${index + 1}`}
      className="flex w-full items-center"
      style={{ gap: "12px" }}
    >
      {item.media && (
        <span
          aria-hidden="true"
          style={{
            width: "var(--k-media-slot)",
            height: "var(--k-media-slot)",
            borderRadius: "var(--t-radius-field)",
            background: "var(--t-surface-border)",
            flexShrink: 0,
          }}
        />
      )}

      <span className="flex min-w-0 flex-1 flex-col" style={{ gap: "2px" }}>
        <span
          style={{
            fontSize: "var(--t-font-body)",
            fontWeight: 400,
            color: "var(--t-text-primary)",
            lineHeight: 1.25,
          }}
        >
          {item.title}
        </span>
        {item.period && (
          <span
            style={{
              fontSize: "12px",
              color: "var(--t-text-secondary)",
              lineHeight: 1.2,
            }}
          >
            {item.period}
          </span>
        )}
      </span>

      <span className="flex shrink-0 flex-col items-end" style={{ gap: "2px" }}>
        <span
          style={{
            fontSize: "var(--t-font-body)",
            fontWeight: 600,
            color: "var(--t-text-primary)",
            whiteSpace: "nowrap",
          }}
        >
          {item.price}
        </span>
        {item.old_price && (
          <span
            data-testid={`line-item-${index + 1}-old-price`}
            style={{
              fontSize: "var(--t-font-caption)",
              color: "var(--t-brand-text-on-bg)",
              textDecoration: "line-through",
              whiteSpace: "nowrap",
            }}
          >
            {item.old_price}
          </span>
        )}
      </span>
    </div>
  );
}
