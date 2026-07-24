import { useEffect, useState } from "react";

import { BankWordmark } from "@demo/components/bank/BankWordmark";
import { COPY } from "@demo/content/copy";

interface Props {
  dotsCycleMs: number;
}

/**
 * `O-1` — splash приложения банка.
 *
 * Единственный экран демо без единого элемента подрядчика: ни одного
 * токена `--t-*`. Целевой кадр смены айдентики.
 *
 * Демо-пометки здесь нет намеренно: экран живёт 1.2 секунды и не содержит
 * ни одного утверждения о платеже. Добавленная строка была бы единственным
 * элементом, которого у донора нет.
 *
 * При `prefers-reduced-motion` точки статичны, но экран и его длительность
 * сохраняются: длительность несёт смысл (смена айдентики), движение — нет.
 */
export function BankSplashScreen({ dotsCycleMs }: Props) {
  return (
    <div
      data-testid="bank-splash"
      className="relative flex h-full w-full flex-col"
      style={{ background: "var(--bank-primary)", color: "var(--bank-on-primary)" }}
    >
      <span aria-live="assertive" className="sr-only">
        {COPY["a11y.splash_live"]}
      </span>

      <div className="flex flex-1 flex-col items-center justify-center">
        <BankWordmark variant="splash" />
        <LoadingDots cycleMs={dotsCycleMs} />
      </div>
    </div>
  );
}

/** Три точки, цикл 900 мс: три фазы по 300, в каждой приглушена своя. */
function LoadingDots({ cycleMs }: { cycleMs: number }) {
  const [phase, setPhase] = useState(2);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const step = Math.round(cycleMs / 3);
    const timer = window.setInterval(
      () => setPhase((value) => (value + 1) % 3),
      step,
    );
    return () => window.clearInterval(timer);
  }, [cycleMs]);

  return (
    <span
      data-testid="loading-dots"
      aria-hidden="true"
      className="flex items-center"
      style={{ gap: "var(--bank-dot-gap)", marginTop: "29px" }}
    >
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          style={{
            width: "var(--bank-dot-d)",
            height: "var(--bank-dot-d)",
            borderRadius: "9999px",
            background:
              index === phase ? "var(--bank-dot-dim)" : "var(--bank-on-primary)",
          }}
        />
      ))}
    </span>
  );
}
