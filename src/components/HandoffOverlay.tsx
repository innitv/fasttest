import { useEffect, useRef, useState } from "react";

import { COPY } from "@demo/content/copy";
import { motionMs } from "@demo/views/stage-motion";

/**
 * ═══════════════════════════════════════════════════════════════════════
 *  АРХИТЕКТУРНАЯ ГРАНИЦА
 *
 *  Это НАШ экран, а не экран подрядчика. Здесь тема заканчивается.
 *
 *  Компонент не импортирует и не читает НИ ОДНОГО токена `tenant.json`:
 *  во всём файле нет ни одной переменной `--t-*`. Собственная айдентика
 *  объявлена ниже как `--h-*` и не пересекается с темой подрядчика.
 *
 *  Проверяется code review (`screens.md` → S-C, `figma-layout-ir.json`
 *  → `reads_tenant_theme: false`). Автопроверка — в
 *  `tests/theme-boundary.check.mjs`.
 * ═══════════════════════════════════════════════════════════════════════
 */

const IDENTITY = {
  "--h-surface": "#101418",
  "--h-surface-raised": "#1B2129",
  "--h-title": "#FFFFFF",
  "--h-body": "#AEB8C7",
  "--h-muted": "#7C8698",
  "--h-accent": "#2F6BFF",
  "--h-border": "#2C3542",
  "--h-font": '"Inter", "Segoe UI", system-ui, sans-serif',
} as const;

interface Props {
  onBack: () => void;
  onSettled?: () => void;
}

export function HandoffOverlay({ onBack, onSettled }: Props) {
  const [settled, setSettled] = useState(false);
  const settledRef = useRef(onSettled);
  settledRef.current = onSettled;

  useEffect(() => {
    const frame = requestAnimationFrame(() => setSettled(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!settled) return;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Длительность берётся из той же переменной, что и сам переход
    // (`--k-motion-overlay`): написанное здесь число разъезжалось бы с CSS
    // молча — оверлей отчитывался бы «доехал» раньше, чем доехал.
    const timer = window.setTimeout(
      () => settledRef.current?.(),
      reduced ? 0 : motionMs("overlay"),
    );
    return () => window.clearTimeout(timer);
  }, [settled]);

  return (
    <div
      data-testid="handoff-overlay"
      data-state={settled ? "settled" : "entering"}
      role="dialog"
      aria-modal="true"
      aria-label={COPY["handoff.title"]}
      className="absolute inset-0 z-30 flex flex-col items-center justify-center"
      style={{
        ...IDENTITY,
        background: "var(--h-surface)",
        fontFamily: "var(--h-font)",
        paddingInline: "24px",
        transform: settled ? "translateY(0)" : "translateY(100%)",
        transition: "transform var(--k-motion-overlay) var(--k-ease-overlay)",
      }}
    >
      <span aria-live="assertive" className="sr-only" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
        {settled ? COPY["a11y.handoff_live"] : ""}
      </span>

      <span
        aria-hidden="true"
        style={{
          width: "56px",
          height: "56px",
          borderRadius: "16px",
          background: "var(--h-surface-raised)",
          border: "1px solid var(--h-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "24px",
        }}
      >
        <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
          <path
            d="M4 13h18M15 6l7 7-7 7"
            stroke="var(--h-accent)"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>

      <h2
        style={{
          fontSize: "24px",
          fontWeight: 700,
          color: "var(--h-title)",
          textAlign: "center",
          margin: 0,
          lineHeight: 1.25,
        }}
      >
        {COPY["handoff.title"]}
      </h2>

      <p
        style={{
          fontSize: "16px",
          fontWeight: 400,
          color: "var(--h-body)",
          textAlign: "center",
          marginTop: "8px",
          marginBottom: 0,
          maxWidth: "22em",
          lineHeight: 1.4,
        }}
      >
        {COPY["handoff.body"]}
      </p>

      <p
        data-testid="handoff-demo-note"
        style={{
          fontSize: "13px",
          fontWeight: 400,
          color: "var(--h-muted)",
          textAlign: "center",
          marginTop: "16px",
          marginBottom: 0,
        }}
      >
        {COPY["handoff.demo_note"]}
      </p>

      <button
        type="button"
        data-testid="handoff-back"
        onClick={onBack}
        style={{
          position: "absolute",
          left: "24px",
          right: "24px",
          bottom: "calc(24px + env(safe-area-inset-bottom, 0px))",
          height: "48px",
          borderRadius: "12px",
          background: "transparent",
          border: "1px solid var(--h-border)",
          color: "var(--h-title)",
          fontSize: "16px",
          fontWeight: 600,
          fontFamily: "var(--h-font)",
          cursor: "pointer",
        }}
      >
        {COPY["handoff.back"]}
      </button>
    </div>
  );
}
