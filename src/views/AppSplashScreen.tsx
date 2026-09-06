import { BrandMarkAssembly } from "@demo/components/BrandMarkAssembly";
import { COPY } from "@demo/content/copy";

interface Props {
  /** Имя приложения: читает диктор, на экране его нет — знак и так его называет. */
  name: string;
}

/**
 * `S-1` — splash приложения ПОДРЯДЧИКА: кадр открытия по уведомлению.
 *
 * Зачем. Между тапом по уведомлению и карточкой подписки приложение
 * запускается — и без этого кадра переход читался как мгновенная подмена
 * экрана. Тот же приём, что у splash банка (`O-1`), и он же делает пару
 * симметричной: сначала открывается приложение сервиса, потом приложение
 * банка, и каждое представляется своей айдентикой.
 *
 * Чья айдентика. Подрядчика, целиком: фон — его `brand.primary`, знак — его
 * ассет. Ни одного токена банка здесь нет, как и на его splash нет ни
 * одного токена подрядчика.
 *
 * Демо-пометки нет — по той же причине, что и на splash банка: экран живёт
 * секунду и ничего не утверждает о платеже.
 */
export function AppSplashScreen({ name }: Props) {
  return (
    <div
      data-screen-root
      data-testid="app-splash"
      className="relative flex h-full w-full flex-col"
      style={{
        background: "var(--t-brand-primary)",
        color: "var(--t-brand-primary-on)",
      }}
    >
      <span aria-live="assertive" className="sr-only">
        {COPY["a11y.app_splash_live"](name)}
      </span>

      <div className="flex flex-1 flex-col items-center justify-center">
        {/*
         * Знак СОБИРАЕТСЯ на глазах — брендовая анимация A3 Pay вместо
         * точек загрузки (решение владельца 2026-09-06). Точки говорили
         * «идёт загрузка» и ничего не добавляли к айдентике; сборка знака
         * говорит то же самое временем и при этом показывает бренд. Точек
         * здесь больше нет: два индикатора ожидания на одном кадре
         * соревнуются друг с другом.
         */}
        <BrandMarkAssembly width={168} />
      </div>
    </div>
  );
}
