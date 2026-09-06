import { LoadingDots } from "@demo/components/LoadingDots";
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
      style={{ background: "var(--bank-primary)", color: "var(--bank-on-primary)", fontFamily: "var(--bank-font)" }}
    >
      <span aria-live="assertive" className="sr-only">
        {COPY["a11y.splash_live"]}
      </span>

      <div className="flex flex-1 flex-col items-center justify-center">
        <BankWordmark variant="splash" />
        {/* Точки — общий компонент демо; цвета и размеры приходят
            значениями из слоя банка, сам компонент токенов не знает. */}
        <LoadingDots
          cycleMs={dotsCycleMs}
          color="var(--bank-on-primary)"
          colorDim="var(--bank-dot-dim)"
          size="var(--bank-dot-d)"
          gap="var(--bank-dot-gap)"
          marginTop="29px"
        />
      </div>
    </div>
  );
}
