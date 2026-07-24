import { COPY } from "@demo/content/copy";
import { BackChevron } from "./primitives";

interface BackTitleProps {
  style: "back_title";
  title: string;
  onBack?: () => void;
}

interface CenteredLogoProps {
  style: "centered_logo";
  logoText: string;
}

type Props = BackTitleProps | CenteredLogoProps;

/**
 * Шапка экрана — структурно-визуальная ось темы 2.
 *
 * `back_title`: шеврон слева + заголовок по центру ширины ЭКРАНА,
 * а не по остатку после шеврона — иначе на 320 px заголовок уезжает вправо.
 * `centered_logo`: белая полоса с нижней границей и логотипом по центру.
 */
export function ScreenHeader(props: Props) {
  if (props.style === "centered_logo") {
    return (
      <header
        data-testid="screen-header"
        data-style="centered_logo"
        className="flex w-full shrink-0 items-center justify-center"
        style={{
          height: "var(--k-brand-header-h)",
          background: "var(--t-surface-card)",
          borderBottom: "var(--k-brand-header-border) solid var(--t-surface-divider)",
        }}
      >
        <BrandSlot text={props.logoText} />
      </header>
    );
  }

  return (
    <header
      data-testid="screen-header"
      data-style="back_title"
      className="relative flex w-full shrink-0 items-center"
      style={{ height: "var(--k-header-h)", color: "var(--t-text-primary)" }}
    >
      <button
        type="button"
        onClick={props.onBack}
        aria-label={COPY["nav.back"]}
        className="absolute flex items-center justify-center"
        style={{
          left: `calc(var(--t-page-padding) - (var(--k-tap-min) - 24px) / 2)`,
          // Вертикальный центр header: при absolute без top кнопка иначе
          // прилипла бы к верхней кромке 74px-шапки, разъехавшись с заголовком.
          top: "50%",
          transform: "translateY(-50%)",
          width: "var(--k-tap-min)",
          height: "var(--k-tap-min)",
          color: "var(--t-text-primary)",
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
        }}
      >
        <BackChevron />
      </button>
      <h1
        className="w-full truncate text-center"
        style={{
          fontSize: "var(--t-font-h1)",
          fontWeight: "var(--t-title-weight)" as unknown as number,
          color: "var(--t-text-primary)",
          paddingInline: "calc(var(--t-page-padding) + var(--k-tap-min))",
          margin: 0,
          lineHeight: 1.25,
        }}
      >
        {props.title}
      </h1>
    </header>
  );
}

/**
 * Текстовая заглушка бренда. При появлении ассета слот меняет содержимое,
 * но не метрику блока — высота задана константой шаблона.
 */
export function BrandSlot({ text }: { text: string }) {
  return (
    <span
      data-testid="brand-slot"
      className="inline-flex items-center"
      style={{
        height: "var(--k-payment-slot-h)",
        maxWidth: "120px",
        fontSize: "18px",
        fontWeight: 800,
        letterSpacing: "0.02em",
        color: "var(--t-brand-primary)",
        overflow: "hidden",
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}
