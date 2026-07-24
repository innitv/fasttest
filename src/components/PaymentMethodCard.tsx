import { methodAccessibleName } from "@demo/content/copy";
import type { PaymentMethod } from "@demo/theme/tenant.schema";
import { CheckGlyph, NeutralPlate } from "./primitives";

interface Props {
  method: PaymentMethod;
  selected: boolean;
  onSelect: (id: string) => void;
}

/**
 * Карточка способа оплаты — горизонтальный ряд архетипа A.
 *
 * Ширина 32 % рамки (`--t-payment-card-w`), высота фиксирована 85 css.
 * Именно фиксированная высота удерживает ряд ровным при метке в одну и в две
 * строки, а фиксированный нижний слот — при наличии и отсутствии логотипа.
 *
 * Метка «Ozon Банк» на ширинах до 392 не помещается в одну строку и
 * переносится по пробелу: «Ozon» / «Банк». Кегль общий для ряда,
 * индивидуальная настройка под одну карточку запрещена (анти-паттерн R8).
 */
export function PaymentMethodCard({ method, selected, onSelect }: Props) {
  /*
   * Метка видна всегда. Правило `05-copy` №5 (при появлении логотипа текст
   * не дублируется) вступит в силу только когда в слот будет привязан
   * настоящий ассет: сейчас ассетов нет ни у одного способа оплаты, а
   * карточка без метки и без логотипа анонимна. Нижний слот при `logo="slot"`
   * занимает обобщённая плашка — она воспроизводит двухчастную композицию
   * донора, не воспроизводя чужой товарный знак.
   */
  const showLabel = true;

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={methodAccessibleName(method.label, selected)}
      data-testid={`payment-method-card-${method.id}`}
      data-selected={selected}
      onClick={() => onSelect(method.id)}
      className="relative flex shrink-0 flex-col text-left"
      style={{
        width: "var(--t-payment-card-w)",
        height: "var(--k-payment-card-h)",
        padding: "var(--k-payment-card-pad)",
        borderRadius: "var(--t-radius-control)",
        background: "var(--t-surface-card)",
        border: "none",
        boxShadow: selected
          ? "inset 0 0 0 var(--t-selected-border-width) var(--t-brand-primary)"
          : "inset 0 0 0 var(--t-border-width) var(--t-surface-border)",
        cursor: "pointer",
        transition:
          "box-shadow var(--k-motion-fast) ease-out, background-color var(--k-motion-fast) ease-out, transform var(--k-motion-fast) ease-out",
        boxSizing: "border-box",
      }}
    >
      {/* Зона метки: до 2 строк, перенос только по пробелу */}
      <span
        aria-hidden="true"
        style={{
          width: "calc(100% - var(--k-radio) - var(--k-radio-gap))",
          fontSize: "var(--t-font-body)",
          fontWeight: 600,
          lineHeight: "var(--k-payment-label-lh)",
          color: "var(--t-text-primary)",
          overflow: "hidden",
          display: "-webkit-box",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: 2,
          wordBreak: "keep-all",
          overflowWrap: "normal",
          hyphens: "none",
        }}
      >
        {showLabel ? method.label : ""}
      </span>

      {/* Нижний слот: зона фиксированной высоты, содержимое опционально.
          Именно она, а не наличие подписей, держит высоты карточек равными. */}
      <span
        data-testid={`payment-method-card-${method.id}-slot`}
        className="mt-auto flex items-center"
        style={{ height: "var(--k-payment-slot-h)", width: "100%" }}
      >
        {method.logo === "slot" && <NeutralPlate width="44px" />}
        {method.caption && (
          <span
            style={{
              fontSize: "var(--t-font-caption)",
              color: "var(--t-text-secondary)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {method.caption}
          </span>
        )}
      </span>

      {/* Radio-маркер: второй канал состояния, не только цвет обводки */}
      <span
        aria-hidden="true"
        className="absolute flex items-center justify-center"
        style={{
          top: "var(--k-payment-card-pad)",
          right: "var(--k-payment-card-pad)",
          width: "var(--k-radio)",
          height: "var(--k-radio)",
          borderRadius: "9999px",
          background: selected ? "var(--t-brand-primary)" : "transparent",
          boxShadow: selected
            ? "none"
            : "inset 0 0 0 var(--t-selected-border-width) var(--t-surface-border)",
          color: "var(--t-brand-primary-on)",
          transition: "background-color var(--k-motion-fast) ease-out",
        }}
      >
        {selected && <CheckGlyph size={12} />}
      </span>
    </button>
  );
}
