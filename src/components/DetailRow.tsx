import { Chevron, ResponsiveText } from "./primitives";

interface Props {
  label: string;
  labelCompact?: string | null;
  value: string;
  /** true → значение это действие («Добавить»), пустое состояние донора. */
  isAction?: boolean;
  testId?: string;
  onClick?: () => void;
  /**
   * `row` — label и значение по краям одной строки. `stacked` — подпись
   * серым НАД значением: так устроен донор MONOCHROME, и на его палитре
   * горизонтальная строка сразу читается как чужой шаблон.
   */
  layout?: "row" | "stacked";
}

/**
 * Строка реквизитов.
 *
 * Единственный элемент шаблона с фиксированной одной строкой: усекается
 * ЗНАЧЕНИЕ, label не усекается никогда. Разделителей между строками нет —
 * донорское поведение, добавление линий это анти-паттерн R2.
 */
export function DetailRow({
  label,
  labelCompact = null,
  value,
  isAction = false,
  testId,
  onClick,
  layout = "row",
}: Props) {
  if (layout === "stacked") {
    return (
      <button
        type="button"
        data-testid={testId}
        data-layout="stacked"
        onClick={onClick}
        className="flex w-full items-center text-left"
        style={{
          minHeight: "var(--t-row-height)",
          gap: "8px",
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          color: "var(--t-text-primary)",
        }}
      >
        <span className="flex min-w-0 flex-1 flex-col" style={{ gap: "2px" }}>
          <span
            style={{
              fontSize: "var(--t-font-caption)",
              fontWeight: 400,
              color: "var(--t-text-secondary)",
            }}
          >
            <ResponsiveText full={label} compact={labelCompact} />
          </span>
          <span
            data-testid={testId ? `${testId}-value` : undefined}
            className="min-w-0 truncate"
            style={{
              fontSize: "var(--t-font-body)",
              fontWeight: 400,
              color: "var(--t-text-primary)",
            }}
          >
            {value}
          </span>
        </span>

        <span
          style={{
            color: "var(--t-text-secondary)",
            flexShrink: 0,
            display: "flex",
            marginLeft: "var(--k-chevron-gap)",
          }}
        >
          <Chevron />
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      className="flex w-full items-center text-left"
      style={{
        minHeight: "var(--t-row-height)",
        gap: "8px",
        background: "none",
        border: "none",
        padding: 0,
        cursor: "pointer",
        color: "var(--t-text-primary)",
      }}
    >
      <span
        style={{
          fontSize: "var(--t-font-body)",
          fontWeight: "var(--t-label-weight)",
          color: "var(--t-text-primary)",
          flexShrink: 0,
          whiteSpace: "nowrap",
        }}
      >
        <ResponsiveText full={label} compact={labelCompact} />
      </span>

      <span
        data-testid={testId ? `${testId}-value` : undefined}
        className="min-w-0 flex-1 truncate text-right"
        style={{
          fontSize: "var(--t-font-body)",
          fontWeight: 400,
          color: "var(--t-text-primary)",
        }}
      >
        {value}
      </span>

      <span style={{ color: isAction ? "var(--t-text-secondary)" : "var(--t-text-secondary)", flexShrink: 0, display: "flex", marginLeft: "var(--k-chevron-gap)" }}>
        <Chevron />
      </span>
    </button>
  );
}
