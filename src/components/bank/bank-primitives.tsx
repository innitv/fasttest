import { useState, type CSSProperties, type ReactNode } from "react";

/**
 * Примитивы экранов банка. Читают только `--bank-*` и `--k-*`;
 * ни одной переменной `--t-*` здесь нет — это архитектурная граница.
 */

/** Круглая кнопка «×». Визуальный диаметр донорский, зона нажатия 44. */
export function CloseCircleButton({
  label,
  onClick,
  diameter = "var(--bank-close-d)",
  testId = "bank-close",
}: {
  label: string;
  onClick: () => void;
  diameter?: string;
  testId?: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-label={label}
      onClick={onClick}
      className="tap-press absolute flex items-center justify-center"
      style={{
        // Зона нажатия 44 центрируется вокруг видимого круга невидимым
        // padding — приём из screens.md для сегмент-контрола.
        width: "var(--k-tap-min)",
        height: "var(--k-tap-min)",
        background: "none",
        border: "none",
        padding: 0,
        cursor: "pointer",
        color: "var(--bank-on-primary)",
      }}
    >
      <span
        aria-hidden="true"
        className="flex items-center justify-center"
        style={{
          width: diameter,
          height: diameter,
          borderRadius: "9999px",
          background: "var(--bank-overlay-white-32)",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="M2 2l10 10M12 2L2 12"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </span>
    </button>
  );
}

/** Статичный чип. НЕ контрол: шеврон и карандаш донора сняты. */
export function StaticChip({
  children,
  fontSize = "14px",
  testId,
}: {
  children: ReactNode;
  fontSize?: string;
  testId?: string;
}) {
  return (
    <span
      data-testid={testId}
      className="inline-flex items-center"
      style={{
        height: "var(--bank-chip-h)",
        paddingInline: "12px",
        borderRadius: "9999px",
        background: "var(--bank-surface-muted)",
        color: "var(--bank-text-secondary)",
        fontSize,
        fontWeight: 400,
        whiteSpace: "nowrap",
        maxWidth: "100%",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
    >
      {children}
    </span>
  );
}

/** Аватар мерчанта. Бейдж СБП донора удалён — чужой товарный знак. */
export function AvatarBadge({
  size,
  radius,
  withBadge = false,
  ring = false,
  testId = "bank-avatar",
  style,
}: {
  size: string;
  radius: string;
  withBadge?: boolean;
  /**
   * Светлое кольцо-ореол вокруг аватара (правка O-3). На O-3 верхняя половина
   * аватара выступает над карточкой-чеком на СИНИЙ градиент; синяя заливка
   * аватара (`--bank-avatar-fill`) на синем градиенте в точке выступа
   * сливается — контраст порядка 1:1. Донор отделяет аватар от фона светлым
   * ореолом/тенью на светлом фоне; наш фон синий, поэтому воспроизводим
   * механику белым кольцом (`--bank-on-primary`). Белое кольцо к градиенту в
   * точке выступа даёт ≥3:1 (WCAG 1.4.11); нижняя половина кольца лежит на
   * белой карточке и там невидима — шов не виден. Тень мягкая (rgba, не
   * токен-цвет) — донорская полировка, квантифицированного контраста не несёт.
   */
  ring?: boolean;
  testId?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      data-testid={testId}
      aria-hidden="true"
      className="relative flex shrink-0 items-center justify-center"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: "var(--bank-avatar-fill)",
        color: "var(--bank-on-primary)",
        boxShadow: ring
          ? "0 0 0 3px var(--bank-on-primary), 0 3px 10px rgba(10, 40, 90, 0.22)"
          : undefined,
        ...style,
      }}
    >
      <svg
        width="46%"
        height="46%"
        viewBox="0 0 24 24"
        fill="none"
        style={{ display: "block" }}
      >
        <path
          d="M12 2.6l2.9 5.9 6.5.95-4.7 4.58 1.11 6.47L12 17.44 6.19 20.5 7.3 14.03 2.6 9.45l6.5-.95L12 2.6Z"
          fill="currentColor"
        />
      </svg>

      {withBadge && (
        <span
          data-testid="bank-success-badge"
          className="absolute flex items-center justify-center"
          style={{
            width: "var(--bank-badge-d)",
            height: "var(--bank-badge-d)",
            right: "-2px",
            bottom: "4px",
            borderRadius: "9999px",
            background: "var(--bank-success)",
            color: "var(--bank-on-primary)",
          }}
        >
          <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
            <path
              d="M2 6.3 4.6 8.9 10 3.3"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      )}
    </span>
  );
}

/**
 * Заглушка 3D-иллюстрации (нейтральный плейсхолдер).
 *
 * Реальный 3D-ассет банка (оранжевая карта + фирменная плитка) — статус
 * `blocked`: воспроизводить чужую иллюстрацию нельзя. Прежняя версия рисовала
 * два случайных полупрозрачных квадрата, смещённых вправо от центра, — это
 * читалось как «сломанный макет».
 *
 * Теперь это отцентрированная по горизонтали читаемая метафора «карта/оплата»:
 * банковская карта со скруглением, чипом и двумя строками номера, плюс лёгкая
 * задняя карта для объёма. Ни логотипа, ни донорских цветов — только белая
 * прозрачность на синем hero (`aria-hidden`, декоративный слой).
 *
 * Бокс 180×130 фиксирован и не меняется: реальный ассет встанет в тот же слот
 * через `object-fit: contain` и не сдвинет ни лист, ни крестик, ни кнопку O-2.
 * Композиция задана в `viewBox` того же размера — центр по X гарантирован.
 */
export function IllustrationSlot() {
  return (
    <span
      data-testid="bank-illustration"
      data-asset-slot="bank_illustration"
      aria-hidden="true"
      className="relative block"
      style={{
        width: "var(--bank-illustration-w)",
        height: "var(--bank-illustration-h)",
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 180 130"
        fill="none"
        style={{ display: "block", color: "var(--bank-on-primary)" }}
      >
        {/* Задняя карта — объём. Симметрично за передней, лёгкий разворот. */}
        <rect
          x="40"
          y="30"
          width="108"
          height="66"
          rx="12"
          transform="rotate(-9 90 65)"
          fill="currentColor"
          fillOpacity="0.14"
        />
        {/* Передняя карта — отцентрирована в боксе (пропорция ≈ банковской). */}
        <rect
          x="32"
          y="28"
          width="116"
          height="74"
          rx="13"
          fill="currentColor"
          fillOpacity="0.22"
          stroke="currentColor"
          strokeOpacity="0.5"
          strokeWidth="1.5"
        />
        {/* Чип. */}
        <rect x="46" y="44" width="20" height="15" rx="3.5" fill="currentColor" fillOpacity="0.6" />
        {/* Строки номера карты — считывают карту как платёжную. */}
        <rect x="46" y="72" width="64" height="6" rx="3" fill="currentColor" fillOpacity="0.42" />
        <rect x="46" y="84" width="40" height="6" rx="3" fill="currentColor" fillOpacity="0.3" />
        {/* Значок бесконтактной оплаты в правом нижнем углу карты. */}
        <path
          d="M120 70a10 10 0 0 1 0 18"
          stroke="currentColor"
          strokeOpacity="0.55"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M126 65a17 17 0 0 1 0 28"
          stroke="currentColor"
          strokeOpacity="0.35"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

/** Главная кнопка экранов банка. Ширина не меняется при смене состояния. */
export function BankPrimaryButton({
  label,
  loadingLabel,
  loading,
  onClick,
  testId = "bank-primary-cta",
  height = "var(--bank-button-h)",
}: {
  label: string;
  loadingLabel: string;
  loading: boolean;
  onClick: () => void;
  testId?: string;
  height?: string;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      type="button"
      data-testid={testId}
      data-state={loading ? "loading" : "default"}
      aria-busy={loading}
      aria-label={label}
      disabled={loading}
      onClick={onClick}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      className="flex w-full items-center justify-center"
      style={{
        height,
        borderRadius: "var(--bank-radius-control)",
        background: "var(--bank-primary)",
        color: "var(--bank-on-primary)",
        fontSize: "17px",
        fontWeight: 700,
        border: "none",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        cursor: loading ? "progress" : "pointer",
        // Микро-отклик нажатия (продавливание). Под reduce глобальное правило
        // обнуляет длительность перехода — смена мгновенная, без движения.
        transform: pressed && !loading ? "scale(0.97)" : "none",
        transition:
          "background-color var(--k-motion-fast) ease-out, transform var(--k-motion-fast) ease-out",
      }}
    >
      {loading ? loadingLabel : label}
    </button>
  );
}
