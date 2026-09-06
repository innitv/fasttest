import { useEffect, useState } from "react";

interface Props {
  /** Полный цикл, мс: делится на три фазы поровну. */
  cycleMs: number;
  /** Цвет активных точек и цвет приглушённой — значениями, не токенами. */
  color: string;
  colorDim: string;
  size: string;
  gap: string;
  marginTop?: string;
}

/**
 * Три точки загрузки: цикл делится на три фазы, в каждой приглушена своя.
 *
 * Живёт в общем слое, а НЕ в экране: одну и ту же механику показывают splash
 * банка и splash приложения подрядчика, а слои токенов у них не
 * пересекаются — банк читает `--bank-*`, подрядчик `--t-*`. Поэтому цвета и
 * размеры приходят ЗНАЧЕНИЯМИ сверху: компонент не знает ни одного токена и
 * потому не нарушает границу ни в одну сторону.
 *
 * При `prefers-reduced-motion` точки статичны: движение убирается, экран и
 * его длительность остаются.
 */
export function LoadingDots({ cycleMs, color, colorDim, size, gap, marginTop }: Props) {
  const [phase, setPhase] = useState(2);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const step = Math.round(cycleMs / 3);
    const timer = window.setInterval(() => setPhase((value) => (value + 1) % 3), step);
    return () => window.clearInterval(timer);
  }, [cycleMs]);

  return (
    <span
      data-testid="loading-dots"
      aria-hidden="true"
      className="flex items-center"
      style={{ gap, marginTop }}
    >
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          style={{
            width: size,
            height: size,
            borderRadius: "9999px",
            background: index === phase ? colorDim : color,
          }}
        />
      ))}
    </span>
  );
}
