import { useEffect, useRef, useState } from "react";

import { COPY } from "@demo/content/copy";
import { formatPhoneMask, normalizePhoneDigits } from "@demo/lib/phone";

/**
 * ═══════════════════════════════════════════════════════════════════════
 *  `PhoneGateBlock` — проверка клиентства по номеру телефона.
 *
 *  Живёт НА ЭКРАНЕ ПОДРЯДЧИКА, до момента смены айдентики. Читает только
 *  тему подрядчика `--t-*` и не содержит ни одного токена банка `--bank-*`:
 *  поле, окрашенное в синий посреди корзины, украло бы момент смены языка
 *  интерфейса за два шага до него (screens-phone-check.md). Проверяется
 *  двусторонним grep в `theme-boundary.check.mjs`.
 *
 *  Анатомия (одна в обоих архетипах, различается только место вставки):
 *    12 зазор + 18 label + 6 + 48 поле + 6 + 18 слот сообщения = 108.
 *  Высота поля — константа шаблона, не токен темы. Слот сообщения
 *  зарезервирован ВСЕГДА: появление ошибки не двигает ни одной координаты
 *  ниже (инвариант раскладки под sticky-панелью архетипа A).
 *
 *  Номер живёт в состоянии React у родителя и никуда не отправляется:
 *  ни сети, ни storage, ни аналитики с цифрами.
 * ═══════════════════════════════════════════════════════════════════════
 */

export type PhoneGateError = "empty" | "incomplete" | "not_client" | null;

interface Props {
  /** Раскрыт ли блок. Раскрытие = выбран «Ozon Банк». */
  expanded: boolean;
  digits: string;
  error: PhoneGateError;
  checking: boolean;
  onChange: (digits: string) => void;
  /** Enter / «Готово» на клавиатуре — то же действие, что главная кнопка. */
  onSubmit: () => void;
  /** Счётчик запроса фокуса: родитель инкрементирует при ошибке. */
  focusSignal: number;
  /**
   * Доводить ли блок до зоны видимости при раскрытии и при ошибке.
   * true (дефолт) — инлайн под sticky-панелью архетипа A: иначе поле уедет
   * под кнопку. false — отдельный экран `ozon_rail` (архетип B): блок и так
   * стоит у верха своего экрана, авто-прокрутка к центру там только мешает.
   */
  autoReveal?: boolean;
}

const INPUT_ID = "phone-input";
const MESSAGE_ID = "phone-message";

function messageFor(error: PhoneGateError): string {
  switch (error) {
    case "empty":
      return COPY["phone.error.empty"];
    case "incomplete":
      return COPY["phone.error.incomplete"];
    case "not_client":
      return COPY["phone.error.not_client"];
    default:
      return COPY["phone.hint"];
  }
}

export function PhoneGateBlock({
  expanded,
  digits,
  error,
  checking,
  onChange,
  onSubmit,
  focusSignal,
  autoReveal = true,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const blockRef = useRef<HTMLDivElement>(null);

  const reducedMotion = () =>
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // При раскрытии блок доводится до зоны видимости выше sticky-панели
  // архетипа A: иначе пользователь видит, что что-то раскрылось, но не видит
  // что. `center` держит поле и слот сообщения над панелью в обоих архетипах.
  // На отдельном экране (`autoReveal=false`) блок и так виден — прокрутка не нужна.
  useEffect(() => {
    if (!expanded || !autoReveal) return;
    const reduced = reducedMotion();
    const timer = window.setTimeout(
      () =>
        blockRef.current?.scrollIntoView({
          block: "center",
          behavior: reduced ? "auto" : "smooth",
        }),
      reduced ? 0 : 210,
    );
    return () => window.clearTimeout(timer);
  }, [expanded, autoReveal]);

  // Родитель просит фокус (после ошибки): каретка в конец значения, блок
  // доводится до видимости, чтобы сообщение не осталось под панелью.
  useEffect(() => {
    if (focusSignal === 0 || !expanded) return;
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    const end = input.value.length;
    input.setSelectionRange(end, end);
    if (!autoReveal) return;
    blockRef.current?.scrollIntoView({
      block: "center",
      behavior: reducedMotion() ? "auto" : "smooth",
    });
  }, [focusSignal, expanded, autoReveal]);

  return (
    <div
      ref={blockRef}
      data-testid="phone-block"
      data-expanded={expanded}
      aria-hidden={expanded ? undefined : true}
      aria-busy={checking || undefined}
      style={{
        // Анимация высоты 200 мс раскрытие / 160 мс сворачивание. При
        // prefers-reduced-motion глобальное правило styles.css делает её
        // мгновенной — движение убрано, но блок и его длительности живут.
        height: expanded ? "108px" : "0px",
        overflow: "hidden",
        transition: `height ${expanded ? 200 : 160}ms ease-in-out`,
      }}
    >
      <div style={{ paddingTop: "12px" }}>
        {/* Объявление проверки для screen reader — polite, чтобы не перебить
            объявление ошибки, идущее следом. */}
        <span
          aria-live="polite"
          className="sr-only"
          style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}
        >
          {checking ? COPY["a11y.phone.checking"] : ""}
        </span>

        <label
          htmlFor={INPUT_ID}
          style={{
            display: "block",
            fontSize: "14px",
            fontWeight: 500,
            lineHeight: "18px",
            color: "var(--t-text-primary)",
            marginBottom: "6px",
          }}
        >
          {COPY["phone.label"]}
        </label>

        <PhoneField
          inputRef={inputRef}
          digits={digits}
          error={error}
          checking={checking}
          expanded={expanded}
          onChange={onChange}
          onSubmit={onSubmit}
        />

        {/* Слот сообщения фиксированной высоты 18. Существует всегда:
            в покое — хинт, в ошибке — причина. role="alert" объявляет
            смену содержимого; контейнер, а не создаётся вместе с текстом. */}
        <div
          id={MESSAGE_ID}
          role="alert"
          data-testid="phone-message"
          data-kind={error ? "error" : "hint"}
          style={{
            height: "18px",
            marginTop: "6px",
            fontSize: "var(--t-font-caption)",
            lineHeight: "18px",
            color: error ? "var(--t-surface-field-error)" : "var(--t-text-secondary)",
            overflow: "hidden",
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
          }}
        >
          {messageFor(error)}
        </div>
      </div>
    </div>
  );
}

interface FieldProps {
  inputRef: React.RefObject<HTMLInputElement | null>;
  digits: string;
  error: PhoneGateError;
  checking: boolean;
  expanded: boolean;
  onChange: (digits: string) => void;
  onSubmit: () => void;
}

function PhoneField({
  inputRef,
  digits,
  error,
  checking,
  expanded,
  onChange,
  onSubmit,
}: FieldProps) {
  const [focused, setFocused] = useState(false);

  // Обводка по приоритету: ошибка > фокус > покой. Единственный `border`,
  // box-sizing border-box — смена 1↔2 px не двигает высоту 48.
  const borderColor = error
    ? "var(--t-surface-field-error)"
    : focused
      ? "var(--t-focus-ring)"
      : "var(--t-surface-border)";
  const borderWidth = error || focused ? "2px" : "1px";

  const dataState = checking
    ? "checking"
    : error
      ? "error"
      : focused
        ? "focus"
        : digits.length === 10
          ? "filled"
          : digits.length > 0
            ? "partial"
            : "empty";

  return (
    <div
      data-testid="phone-field"
      className="flex w-full items-center"
      style={{
        height: "var(--k-field-h)",
        borderRadius: "var(--t-radius-field)",
        background: "var(--t-surface-card)",
        border: `${borderWidth} solid ${borderColor}`,
        paddingInline: "12px",
        gap: "6px",
        boxSizing: "border-box",
      }}
    >
      {/* Префикс «+7» — нарисован, в значение не входит, каретка перед ним
          не встаёт. aria-hidden: код страны назван в имени поля. */}
      <span
        aria-hidden="true"
        style={{
          fontSize: "var(--t-font-body)",
          fontWeight: 400,
          color: "var(--t-text-primary)",
        }}
      >
        {COPY["phone.prefix"]}
      </span>

      <input
        ref={inputRef}
        id={INPUT_ID}
        data-testid="phone-input"
        data-state={dataState}
        type="text"
        inputMode="tel"
        enterKeyHint="done"
        autoComplete="off"
        tabIndex={expanded ? undefined : -1}
        readOnly={checking}
        value={formatPhoneMask(digits)}
        placeholder={COPY["phone.placeholder"]}
        aria-label={COPY["a11y.phone.field"]}
        aria-describedby={MESSAGE_ID}
        aria-invalid={error ? true : undefined}
        onChange={(event) => onChange(normalizePhoneDigits(event.target.value))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onSubmit();
          }
        }}
        className="w-full min-w-0"
        style={{
          height: "100%",
          border: "none",
          outline: "none",
          background: "transparent",
          color: "var(--t-text-primary)",
          fontSize: "var(--t-font-body)",
          fontWeight: 400,
          padding: 0,
        }}
      />
    </div>
  );
}
