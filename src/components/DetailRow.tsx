import { Chevron, ResponsiveText } from "./primitives";

interface Props {
  label: string;
  labelCompact?: string | null;
  value: string;
  /** true → значение это действие («Добавить»), пустое состояние донора. */
  isAction?: boolean;
  testId?: string;
  onClick?: () => void;
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
}: Props) {
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
          fontWeight: "var(--t-label-weight)" as unknown as number,
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
