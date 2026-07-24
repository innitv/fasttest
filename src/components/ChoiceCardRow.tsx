import { useRef } from "react";

import type { ChoiceOption } from "@demo/theme/tenant.schema";
import { useHorizontalScroll } from "@demo/lib/useHorizontalScroll";
import { CheckGlyph } from "./primitives";

interface Props {
  options: ChoiceOption[];
  selected: string;
  onSelect: (id: string) => void;
  groupLabel: string;
}

/**
 * Ряд вариантов доставки. Ширина карточки 42 % рамки — отдельный токен,
 * не равный ширине карточки способа оплаты (расхождение D1: единые 44 %
 * убивают peek у ряда оплаты).
 *
 * Прокрутка: тач/трекпад — нативно через `overflow-x`, мышь — drag и колесо
 * через `useHorizontalScroll`. Peek третьей карточки сохранён.
 */
export function ChoiceCardRow({ options, selected, onSelect, groupLabel }: Props) {
  const rowRef = useRef<HTMLDivElement>(null);
  useHorizontalScroll(rowRef);

  return (
    <div
      ref={rowRef}
      role="radiogroup"
      aria-label={groupLabel}
      data-testid="choice-card-row"
      className="no-scrollbar flex w-full overflow-x-auto overscroll-x-contain"
      style={{
        gap: "var(--k-choice-card-gap)",
        paddingInline: "var(--t-page-padding)",
      }}
    >
      {options.map((option) => (
        <ChoiceCard
          key={option.id}
          option={option}
          selected={option.id === selected}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function ChoiceCard({
  option,
  selected,
  onSelect,
}: {
  option: ChoiceOption;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      data-testid={`choice-card-${option.id}`}
      data-selected={selected}
      onClick={() => onSelect(option.id)}
      className="relative flex shrink-0 flex-col text-left"
      style={{
        width: "var(--t-choice-card-w)",
        padding: "var(--k-choice-card-pad)",
        gap: "4px",
        borderRadius: "var(--t-radius-control)",
        background: "var(--t-surface-card)",
        border: "none",
        boxShadow: selected
          ? "inset 0 0 0 var(--t-selected-border-width) var(--t-brand-primary)"
          : "inset 0 0 0 var(--t-border-width) var(--t-surface-border)",
        cursor: "pointer",
        boxSizing: "border-box",
        transition:
          "box-shadow var(--k-motion-fast) ease-out, transform var(--k-motion-fast) ease-out",
      }}
    >
      <span
        style={{
          width: "calc(100% - var(--k-radio) - var(--k-radio-gap))",
          fontSize: "var(--t-font-body)",
          fontWeight: 600,
          lineHeight: 1.25,
          color: "var(--t-text-primary)",
        }}
      >
        {option.title}
      </span>

      {option.caption && (
        <span
          style={{
            fontSize: "var(--t-font-caption)",
            lineHeight: 1.3,
            color: "var(--t-text-secondary)",
          }}
        >
          {option.caption}
        </span>
      )}

      <span
        style={{
          fontSize: "var(--t-font-caption)",
          fontWeight: 600,
          lineHeight: 1.3,
          color: "var(--t-text-primary)",
          minHeight: "calc(var(--t-font-caption) * 1.3)",
        }}
      >
        {option.price ?? " "}
      </span>

      <span
        aria-hidden="true"
        className="absolute flex items-center justify-center"
        style={{
          top: "var(--k-choice-card-pad)",
          right: "var(--k-choice-card-pad)",
          width: "var(--k-radio)",
          height: "var(--k-radio)",
          borderRadius: "9999px",
          background: selected ? "var(--t-brand-primary)" : "transparent",
          boxShadow: selected
            ? "none"
            : "inset 0 0 0 var(--t-selected-border-width) var(--t-surface-border)",
          color: "var(--t-brand-primary-on)",
        }}
      >
        {selected && <CheckGlyph size={12} />}
      </span>
    </button>
  );
}
