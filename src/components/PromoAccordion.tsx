import { useState } from "react";

import { COPY } from "@demo/content/copy";
import { ChevronDown } from "./primitives";

/**
 * Аккордеон промокода — пятый цвет темы B.
 *
 * Заливка берётся из `brand.secondary`, а НЕ выводится из `brand.primary`:
 * сведение палитры донора к «primary + серый» это анти-паттерн R7.
 */
export function PromoAccordion() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");

  return (
    <div data-testid="promo-accordion" data-state={open ? "expanded" : "collapsed"} className="w-full">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-center"
        style={{
          height: "var(--k-promo-h)",
          borderRadius: "var(--t-radius-card)",
          background: "var(--t-secondary-fill, var(--t-surface-card))",
          color: "var(--t-secondary-text, var(--t-text-primary))",
          fontSize: "var(--t-font-body)",
          fontWeight: 700,
          border: "none",
          cursor: "pointer",
          gap: "8px",
        }}
      >
        {COPY["promo.label"]}
        <span
          style={{
            display: "flex",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform var(--k-motion-medium) ease-in-out",
          }}
        >
          <ChevronDown />
        </span>
      </button>

      {open && (
        <div className="flex w-full items-center" style={{ gap: "8px", marginTop: "8px" }}>
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder={COPY["promo.field.placeholder"]}
            aria-label={COPY["promo.field.placeholder"]}
            style={{
              flex: 1,
              minWidth: 0,
              height: "var(--k-field-h)",
              borderRadius: "var(--t-radius-field)",
              background: "var(--t-surface-card)",
              color: "var(--t-text-primary)",
              fontSize: "var(--t-font-body)",
              paddingInline: "12px",
              border: "none",
              outline: "none",
              boxShadow: "inset 0 0 0 var(--t-border-width) var(--t-surface-border)",
              boxSizing: "border-box",
            }}
          />
          <button
            type="button"
            style={{
              height: "var(--k-field-h)",
              paddingInline: "16px",
              borderRadius: "var(--t-radius-field)",
              background: "var(--t-secondary-fill, var(--t-surface-card))",
              color: "var(--t-secondary-text, var(--t-text-primary))",
              fontSize: "var(--t-font-body)",
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {COPY["promo.apply"]}
          </button>
        </div>
      )}
    </div>
  );
}
