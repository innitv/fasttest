import { useRef, type CSSProperties, type ReactNode } from "react";

import { usePageCanvas } from "@demo/lib/page-canvas";

interface Props {
  vars: Record<string, string>;
  tenantId: string;
  archetype: string;
  /**
   * Режим доступности — параметр демо, не токен темы. Управляет тремя
   * коррекциями контраста в слое `--bank-*` через `data-bank-a11y`.
   */
  a11yMode: "enforced" | "donor_faithful";
  /** Текущая стадия сквозного сценария — для съёмки и тестов. */
  stage: string;
  children: ReactNode;
}

/**
 * Корневой контейнер страницы демо.
 *
 * Это НЕ рамка телефона: нарисованного bezel, статус-бара и home indicator
 * здесь нет — их рисует настоящий системный хром устройства, на котором
 * открывают демо (решение пользователя 2026-07-23). Демо — адаптивная
 * мобильная веб-страница.
 *
 * Но роль корневого контейнера сохранена: это единственное место, куда
 * приземляются токены темы `--t-*`. Дальше вниз они идут только как
 * `var(--t-*)`; ни один компонент не получает цвета пропсами.
 *
 * Адаптив mobile-first: на телефонах (≈320→480) колонка тянется по ширине
 * вьюпорта; на планшете/десктопе (768/1280) остаётся центрированной колонкой
 * шириной ≤ `--k-frame-max-w` (480). `container-type: inline-size` делает
 * ширину колонки единицей `cqw`, поэтому доли вьюпорта (32 % карточки оплаты,
 * 42 % карточки доставки) считаются от ширины КОЛОНКИ, а не окна браузера, и
 * пропорции переносятся как есть на любую ширину.
 */
export function PhoneFrame({
  vars,
  tenantId,
  archetype,
  a11yMode,
  stage,
  children,
}: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  // Системные зоны устройства красятся фоном страницы: держим его равным
  // фону верхней кромки текущего экрана (см. `lib/page-canvas.ts`).
  usePageCanvas(frameRef, stage);

  return (
    <div
      className="flex h-full w-full justify-center"
      style={{
        // Боковые вырезы устройства (альбомная ориентация, PWA). Отступ на
        // ОБЁРТКЕ, а не на колонке: ширина колонки — единица `cqw`, и сдвигать
        // её внутренние пропорции безопасной зоной нельзя.
        paddingLeft: "env(safe-area-inset-left, 0px)",
        paddingRight: "env(safe-area-inset-right, 0px)",
      }}
    >
      <div
        ref={frameRef}
        data-testid="phone-frame"
        data-tenant={tenantId}
        data-archetype={archetype}
        data-bank-a11y={a11yMode}
        data-stage={stage}
        className="relative h-full w-full overflow-hidden"
        style={
          {
            ...vars,
            containerType: "inline-size",
            containerName: "frame",
            maxWidth: "var(--k-frame-max-w)",
            /*
             * `clip`, а не `hidden`. Разница не косметическая: `hidden`
             * создаёт ПРОКРУЧИВАЕМЫЙ бокс — колонку можно сдвинуть программно
             * (`scrollIntoView`, `focus`, автоскролл к полю), и тогда весь
             * экран уезжает вверх вместе с пуш-баннером. `clip` обрезает без
             * создания скролл-порта: сдвинуть колонку нечем. Класс
             * `overflow-hidden` оставлен фолбэком для браузеров без `clip`.
             */
            overflow: "clip",
            // Верхний вырез (альбомная ориентация, PWA). В портретном Safari
            // инсет равен нулю и метрика экрана не меняется.
            paddingTop: "env(safe-area-inset-top, 0px)",
            background: "var(--t-surface-background)",
            color: "var(--t-text-primary)",
            fontFamily: "var(--t-font-family)",
            fontSize: "var(--t-font-body)",
            // Мягкая тень отделяет колонку от нейтрального фона страницы на
            // десктопе. На телефоне колонка = ширина вьюпорта, и тень уходит
            // за край экрана — не мешает.
            boxShadow: "0 0 0 1px rgba(0,0,0,0.04), 0 12px 48px rgba(0,0,0,0.10)",
          } as CSSProperties
        }
      >
        {children}
      </div>
    </div>
  );
}
