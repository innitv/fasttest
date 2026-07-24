import type { CSSProperties, ReactNode } from "react";

/**
 * Мелкие общие примитивы шаблона.
 * Все размеры и цвета — только из `--k-*` и `--t-*`.
 */

export function Chevron({ size = "var(--k-chevron)" }: { size?: string }) {
  return (
    <svg
      width="10"
      height="16"
      viewBox="0 0 10 16"
      fill="none"
      aria-hidden="true"
      style={{ width: `calc(${size} / 2)`, height: size, flexShrink: 0 }}
    >
      <path
        d="M1.5 1.5 8 8l-6.5 6.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BackChevron() {
  return (
    <svg width="12" height="20" viewBox="0 0 12 20" fill="none" aria-hidden="true">
      <path
        d="M10 1.5 2 10l8 8.5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CheckGlyph({ size = 12, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <path
        d="M2 6.3 4.6 8.9 10 3.3"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ChevronDown({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3.5 6 8 10.5 12.5 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function EyeOffGlyph() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      style={{ width: "var(--k-eye-icon)", height: "var(--k-eye-icon)" }}
    >
      <path
        d="M3 10s2.8-4.5 7-4.5S17 10 17 10s-2.8 4.5-7 4.5S3 10 3 10Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="10" cy="10" r="1.9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 16 16 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Нейтральная плашка вместо чужого товарного знака.
 * Пропорция фиксирована: замена заглушки на реальный ассет
 * не должна менять метрику блока (`BrandSlot`, ограничение контракта).
 */
export function NeutralPlate({
  width,
  height = "var(--k-payment-slot-h)",
  label,
  style,
}: {
  width: string;
  height?: string;
  label?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      aria-hidden={label ? undefined : "true"}
      aria-label={label}
      style={{
        display: "block",
        width,
        height,
        borderRadius: "4px",
        background: "var(--t-surface-border)",
        opacity: 0.85,
        flexShrink: 0,
        ...style,
      }}
    />
  );
}

/** Полноширинная секция экрана. Full-bleed — анти-паттерн R1 запрещает инсет. */
export function SurfaceCard({
  children,
  style,
  testId,
}: {
  children: ReactNode;
  style?: CSSProperties;
  testId?: string;
}) {
  return (
    <section
      data-testid={testId}
      style={{
        background: "var(--t-surface-card)",
        borderRadius: "var(--t-radius-card)",
        boxShadow: "var(--t-shadow)",
        width: "100%",
        ...style,
      }}
    >
      {children}
    </section>
  );
}

/** Переключение полного и компактного варианта строки по ширине рамки. */
export function ResponsiveText({
  full,
  compact,
}: {
  full: string;
  compact: string | null;
}) {
  if (!compact || compact === full) return <>{full}</>;
  return (
    <>
      <span className="copy-wide">{full}</span>
      <span className="copy-narrow">{compact}</span>
    </>
  );
}
