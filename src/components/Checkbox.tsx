import { CheckGlyph } from "./primitives";

interface Props {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/**
 * Чекбокс архетипа B. Бокс 22 css, зона нажатия строки — 44.
 * Галка получает цвет из `--t-accent-on`: у донора белая галка на голубом
 * даёт 2.12:1 при пороге 3:1 и корректируется при `a11y_mode="enforced"`.
 */
export function Checkbox({ label, checked, onChange }: Props) {
  return (
    <label
      data-testid="autorenew-checkbox"
      className="flex w-full cursor-pointer items-center"
      style={{ minHeight: "var(--k-tap-min)", gap: "12px" }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="sr-only"
        style={{ position: "absolute", opacity: 0, width: 1, height: 1 }}
      />
      <span
        aria-hidden="true"
        className="flex shrink-0 items-center justify-center"
        style={{
          width: "var(--k-checkbox)",
          height: "var(--k-checkbox)",
          borderRadius: "var(--t-radius-chip)",
          background: checked ? "var(--t-accent, var(--t-brand-primary))" : "var(--t-surface-card)",
          boxShadow: checked
            ? "none"
            : "inset 0 0 0 var(--t-border-width) var(--t-surface-border)",
          color: "var(--t-accent-on, var(--t-brand-primary-on))",
          transition: "background-color var(--k-motion-fast) ease-out",
        }}
      >
        {checked && <CheckGlyph size={14} />}
      </span>
      <span
        style={{
          fontSize: "var(--t-font-body)",
          fontWeight: 400,
          color: "var(--t-text-primary)",
        }}
      >
        {label}
      </span>
    </label>
  );
}
