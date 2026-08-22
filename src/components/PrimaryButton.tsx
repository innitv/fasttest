import { useState } from "react";

export type ButtonState = "default" | "loading" | "disabled" | "sent";

interface Props {
  label: string;
  loadingLabel: string;
  /**
   * Метка терминального состояния `sent` («Отправили push»). Показывается
   * после успешной проверки номера, одновременно с появлением push.
   */
  sentLabel?: string;
  state: ButtonState;
  onClick: () => void;
  testId?: string;
}

/**
 * Главная кнопка экрана. Ровно одна на экран.
 *
 * Ширина — FILL минус боковые поля, поэтому она НЕ меняется при смене
 * состояния: метки `loading`/`sent` длиннее основной, и на кнопке
 * фиксированной ширины это привело бы к дёрганью (ограничение контракта
 * компонента).
 *
 * Состояние `sent` — терминальное: кнопка не крутится и не «откатывается» в
 * исходную метку, а называет результат («Отправили push»). Банк при этом
 * открывает тап по push, а не кнопка, поэтому текст не обещает открытие банка.
 */
export function PrimaryButton({
  label,
  loadingLabel,
  sentLabel,
  state,
  onClick,
  testId = "primary-cta",
}: Props) {
  const [pressed, setPressed] = useState(false);
  const disabled = state === "disabled";
  const loading = state === "loading";
  const sent = state === "sent";

  // `sent` — успешный терминальный статус: сохраняем фирменную заливку, не
  // гасим в серый (иначе кнопка читается как отменённая), но делаем
  // неинтерактивной — повторное нажатие бессмысленно.
  const background = disabled
    ? "var(--t-brand-disabled)"
    : pressed && !sent
      ? "var(--t-brand-pressed)"
      : "var(--t-brand-fill)";

  const text = sent ? (sentLabel ?? label) : loading ? loadingLabel : label;

  return (
    <button
      type="button"
      data-testid={testId}
      data-state={state}
      aria-busy={loading}
      disabled={disabled || loading || sent}
      onClick={onClick}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      className="flex w-full items-center justify-center"
      style={{
        height: "var(--t-control-height)",
        borderRadius: "var(--t-radius-control)",
        background,
        color: disabled ? "var(--t-text-secondary)" : "var(--t-brand-on)",
        // Тень кнопки — ось темы: у доноров с одним ярким акцентом она
        // подсвечена в тон заливки и держит кнопку над фоном.
        boxShadow: disabled || sent ? "none" : "var(--t-cta-shadow)",
        // Кегль и вес — оси темы, а не константа: у минималистичных доноров
        // кнопка набрана тем же кеглем, что заголовок секции, обычным весом.
        fontSize: "var(--t-cta-font-size)",
        fontWeight: "var(--t-cta-font-weight)",
        border: "none",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        cursor: disabled || sent ? "default" : "pointer",
        // Микро-отклик нажатия: лёгкое продавливание на :active. Под reduce
        // глобальное правило обнуляет длительность — смена мгновенная, без движения.
        transform: pressed && !disabled && !sent ? "scale(0.97)" : "none",
        transition:
          "background-color var(--k-motion-fast) ease-out, transform var(--k-motion-fast) ease-out",
      }}
    >
      {text}
    </button>
  );
}

/**
 * Закреплённая снизу панель CTA (ось темы 20 = `sticky`).
 *
 * Прилипает к низу вьюпорта страницы (панель абсолютна в пределах колонки,
 * колонка занимает высоту вьюпорта). Нижний отступ — обычный отступ страницы
 * плюс настоящий `env(safe-area-inset-bottom)` устройства, а не нарисованная
 * зона home indicator (её больше нет).
 *
 * Скролл-контейнер обязан зарезервировать нижний padding, равный высоте
 * панели, иначе последняя секция уходит под кнопку.
 */
export function StickyCtaPanel({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-testid="cta-sticky-panel"
      className="absolute inset-x-0 bottom-0 z-10"
      style={{
        background: "var(--t-surface-card)",
        paddingTop: "var(--k-cta-panel-pad-top)",
        paddingBottom:
          "calc(var(--k-cta-panel-pad-bottom) + env(safe-area-inset-bottom, 0px))",
        paddingInline: "var(--t-page-padding)",
      }}
    >
      {children}
    </div>
  );
}

/** Высота панели sticky-CTA = резерв нижнего padding скролл-контейнера. */
export const STICKY_PANEL_RESERVE =
  "calc(var(--t-control-height) + var(--k-cta-panel-pad-top) + var(--k-cta-panel-pad-bottom) + env(safe-area-inset-bottom, 0px))";
