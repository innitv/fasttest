import type { ReactNode } from "react";

export type FieldState = "rest" | "focus" | "error";

interface Props {
  name: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  errorMessage?: string | null;
  inputMode?: "numeric" | "text";
  maxLength?: number;
  trailing?: ReactNode;
  type?: "text" | "password";
  /**
   * Поверхность, на которой лежит поле.
   *
   * `card` — поле светлее фона формы (архетип B: подложка `surface.form`,
   * поля на ней карточкой). `form` — обратная вложенность билетного донора:
   * форма лежит карточкой, а поля внутри неё — на `surface.form`. Без этой
   * оси поле, положенное в карточку, красится её же цветом и исчезает.
   */
  surface?: "card" | "form";
  /** Красная звёздочка обязательного поля — донорская подача билетного чекаута. */
  requiredMark?: boolean;
}

/**
 * Поле ввода архетипа B.
 *
 * В покое обводки нет — белая заливка на тональной подложке (донорское
 * поведение). Ошибка: обводка 2 px `surface.field_error` ПЛЮС текст сообщения
 * под полем. Цвет ошибки отдельный от бренда (расхождение D7): у донора
 * это вермильон, а не коралл. Цвет — не единственный канал.
 */
export function TextField({
  name,
  label,
  placeholder,
  value,
  onChange,
  onBlur,
  errorMessage = null,
  inputMode = "text",
  maxLength,
  trailing,
  type = "text",
  surface = "card",
  requiredMark = false,
}: Props) {
  const hasError = Boolean(errorMessage);
  const errorId = `${name}-error`;

  return (
    <div className="flex w-full min-w-0 flex-col">
      <label
        htmlFor={name}
        style={{
          fontSize: "14px",
          fontWeight: 500,
          color: "var(--t-text-primary)",
          marginBottom: "6px",
        }}
      >
        {label}
        {requiredMark && (
          <span style={{ color: "var(--t-brand-text-on-bg)" }}> *</span>
        )}
      </label>

      <div className="relative w-full">
        <input
          id={name}
          name={name}
          data-testid={`field-${name}`}
          data-state={hasError ? "error" : "rest"}
          type={type}
          inputMode={inputMode}
          maxLength={maxLength}
          value={value}
          placeholder={placeholder}
          aria-invalid={hasError}
          aria-describedby={hasError ? errorId : undefined}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          className="w-full"
          style={{
            height: "var(--k-field-h)",
            borderRadius: "var(--t-radius-field)",
            background:
              surface === "form"
                ? "var(--t-surface-form, var(--t-surface-card))"
                : "var(--t-surface-card)",
            color: "var(--t-text-primary)",
            fontSize: "var(--t-font-body)",
            paddingInline: "12px",
            paddingRight: trailing ? "calc(var(--k-eye-icon) + 24px)" : "12px",
            border: "none",
            outline: hasError
              ? "2px solid var(--t-surface-field-error)"
              : "none",
            outlineOffset: "0px",
            boxSizing: "border-box",
          }}
        />
        {trailing && (
          <span
            className="absolute top-1/2 flex -translate-y-1/2 items-center"
            style={{ right: "12px", color: "var(--t-text-secondary)" }}
          >
            {trailing}
          </span>
        )}
      </div>

      {hasError && (
        <span
          id={errorId}
          role="alert"
          style={{
            marginTop: "6px",
            fontSize: "var(--t-font-caption)",
            color: "var(--t-surface-field-error)",
          }}
        >
          {errorMessage}
        </span>
      )}
    </div>
  );
}
