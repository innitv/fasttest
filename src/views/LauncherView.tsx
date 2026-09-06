import { type CSSProperties } from "react";

import { COPY } from "@demo/content/copy";

/**
 * Страница со ссылками на все поставляемые демо.
 *
 * ═══════════════════════════════════════════════════════════════════════
 *  Это НАША страница, а не экран подрядчика: собственная айдентика
 *  `--l-*`, ни одного токена `--t-*` и `--bank-*`.
 *
 *  🔴 Она лежит по НЕУГАДЫВАЕМОМУ пути и никогда не отдаётся с корня.
 *  Правило проекта остаётся в силе: подрядчик, получивший свою ссылку, не
 *  должен видеть существования остальных тем. До 2026-09-06 страница
 *  собиралась только в dev; решением владельца она поставляется и в прод —
 *  ему нужна одна ссылка, чтобы показывать демо с телефона, — но адрес
 *  по-прежнему знает только он.
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Список маршрутов приходит СВЕРХУ, из той же константы, что и
 * маршрутизация: страница не может разойтись с тем, что реально работает.
 * Подписи к темам живут здесь; их полноту сторожит `check:registry` —
 * тема без подписи попала бы в список заглушкой и молча.
 */

export interface LauncherRoute {
  path: string;
  tenant: string;
}

/** Как называется подрядчик и что показывает его экран. */
const CAPTIONS: Record<string, { name: string; kind: string }> = {
  "flowwow-like": { name: "Flowwow", kind: "Корзина и оформление заказа" },
  "uchi-like": { name: "UCHi.RU", kind: "Оплата подписки, способ отдельным экраном" },
  voroh: { name: "ВОРОХ", kind: "Билет и форма покупателя, тёмная тема" },
  "voroh-light": { name: "ВОРОХ · светлая", kind: "Тот же билет на светлом фоне" },
  monochrome: { name: "MONOCHROME", kind: "Заказ шагами, корзина под кнопкой" },
  padlhub: { name: "ПАДЛ ХАБ", kind: "Афиши тарифов и шторка оплаты" },
  "yes-atlas": { name: "Цифровые атласы", kind: "Прайс-лист на мягком рельефе" },
  rml: { name: "Ради мира и любви", kind: "Шаги заказа, состав под кнопкой" },
  hval: { name: "Хваловские воды", kind: "Счётчики, слот доставки, оплата списком" },
  bombbar: { name: "Bombbar", kind: "Карточки-секции, бонусы, кнопка над составом" },
  mybox: { name: "MYBOX", kind: "Самовывоз шторкой, приборы, оплата листом" },
  ewa: { name: "EWA PRODUCT", kind: "Сетка перевозчиков, оплата отдельной страницей" },
  tripster: { name: "Tripster", kind: "Предоплата созданного заказа, шторка способов" },
  "yandex-plus": { name: "Яндекс Плюс", kind: "Подключение подписки, согласие на списания" },
  a3pay: { name: "Яндекс Плюс · A3 Pay", kind: "Карточка подписки, старт с домашнего экрана" },
};

/** Сценарий, который стоит показывать первым. */
const FEATURED = "a3pay";

const IDENTITY = {
  "--l-ink": "#eef2f8",
  "--l-ink-soft": "#a7b2c2",
  "--l-ink-faint": "#7b8798",
  "--l-ground": "#0c1016",
  "--l-panel": "#141a23",
  "--l-line": "#232c38",
  "--l-line-soft": "#1b222c",
  "--l-accent": "#6f9df0",
  "--l-accent-soft": "#16233a",
  "--l-font": '"Inter", "Segoe UI", system-ui, -apple-system, sans-serif',
  "--l-mono": 'ui-monospace, "SFMono-Regular", Menlo, "Cascadia Mono", monospace',
} as const;

const label: CSSProperties = {
  margin: 0,
  fontFamily: "var(--l-mono)",
  fontSize: "12px",
  letterSpacing: "0.07em",
  textTransform: "uppercase",
  color: "var(--l-ink-faint)",
};

const pathStyle: CSSProperties = {
  fontFamily: "var(--l-mono)",
  fontSize: "13px",
  color: "var(--l-accent)",
  whiteSpace: "nowrap",
};

export function LauncherView({ routes }: { routes: LauncherRoute[] }) {
  const featured = routes.find((route) => route.tenant === FEATURED) ?? null;

  return (
    <div
      data-testid="launcher"
      className="no-scrollbar flex w-full justify-center overflow-y-auto"
      style={{
        ...IDENTITY,
        background: "var(--l-ground)",
        color: "var(--l-ink)",
        fontFamily: "var(--l-font)",
        minHeight: "100vh",
      }}
    >
      <div
        className="flex w-full flex-col"
        style={{ maxWidth: "720px", padding: "40px 20px 64px", gap: "36px" }}
      >
        <header className="flex flex-col" style={{ gap: "10px" }}>
          <p style={label}>Демо оплаты для подрядчиков</p>
          <h1
            style={{
              margin: 0,
              fontSize: "30px",
              lineHeight: 1.15,
              fontWeight: 700,
              letterSpacing: "-0.02em",
            }}
          >
            Все ссылки демо
          </h1>
          <p
            style={{
              margin: 0,
              maxWidth: "60ch",
              color: "var(--l-ink-soft)",
              lineHeight: 1.55,
            }}
          >
            {routes.length} тем на одном шаблоне. Каждая ссылка ведёт на свой экран
            оплаты, где «Ozon Банк» стоит в способах, — дальше push, банк и возврат.
          </p>
        </header>

        {featured && (
          <section className="flex flex-col" style={{ gap: "12px" }}>
            <p style={label}>Новый сценарий</p>
            <div
              className="flex flex-col"
              style={{
                gap: "14px",
                padding: "20px",
                borderRadius: "14px",
                background: "var(--l-accent-soft)",
                border: "1px solid var(--l-line)",
              }}
            >
              <div
                className="flex flex-wrap items-baseline justify-between"
                style={{ gap: "12px" }}
              >
                <p style={{ margin: 0, fontSize: "20px", fontWeight: 700 }}>
                  {CAPTIONS[featured.tenant]?.name ?? featured.tenant}
                </p>
                <span style={pathStyle}>{featured.path}</span>
              </div>
              <p style={{ margin: 0, color: "var(--l-ink-soft)", fontSize: "15px" }}>
                Единственный сценарий, который начинается до формы: домашний экран
                устройства, уведомление о счёте от A3 Pay, заставка со сборкой знака —
                и карточка подписки со счётом за август.
              </p>
              <a
                href={featured.path}
                className="inline-flex items-center justify-center"
                style={{
                  minHeight: "48px",
                  paddingInline: "20px",
                  borderRadius: "10px",
                  background: "var(--l-accent)",
                  color: "var(--l-ground)",
                  fontWeight: 600,
                  textDecoration: "none",
                  alignSelf: "flex-start",
                }}
              >
                Открыть сценарий
              </a>
            </div>
          </section>
        )}

        <section className="flex flex-col" style={{ gap: "12px" }}>
          <p style={label}>Темы подрядчиков</p>
          {/* Строки, а не карточки: пятнадцать однородных ссылок. */}
          <div
            className="flex flex-col"
            style={{
              background: "var(--l-panel)",
              border: "1px solid var(--l-line)",
              borderRadius: "14px",
              overflow: "hidden",
            }}
          >
            {routes.map((route, index) => {
              const caption = CAPTIONS[route.tenant];
              return (
                <a
                  key={route.path}
                  href={route.path}
                  className="grid items-center"
                  style={{
                    gridTemplateColumns: "1fr auto",
                    gap: "4px 16px",
                    minHeight: "60px",
                    padding: "12px 16px",
                    textDecoration: "none",
                    color: "inherit",
                    borderTop: index === 0 ? "none" : "1px solid var(--l-line-soft)",
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{caption?.name ?? route.tenant}</span>
                  <span style={{ ...pathStyle, gridRow: "1 / span 2", gridColumn: 2 }}>
                    {route.path}
                  </span>
                  <span
                    style={{
                      gridColumn: 1,
                      fontSize: "13px",
                      color: "var(--l-ink-soft)",
                    }}
                  >
                    {caption?.kind ?? "Тема без подписи"}
                  </span>
                </a>
              );
            })}
          </div>
        </section>

        <section className="flex flex-col" style={{ gap: "12px" }}>
          <p style={label}>Как показывать</p>
          <div
            className="flex flex-col"
            style={{
              gap: "8px",
              padding: "16px",
              borderLeft: "2px solid var(--l-accent)",
              background: "var(--l-panel)",
              borderRadius: "0 10px 10px 0",
              fontSize: "14px",
              color: "var(--l-ink-soft)",
              lineHeight: 1.55,
            }}
          >
            <p style={{ margin: 0 }}>
              Проверка клиентства принимает любой номер — кроме демонстрационного{" "}
              <code style={{ fontFamily: "var(--l-mono)", color: "var(--l-ink)" }}>
                900 000-00-00
              </code>
              : он показывает ветку «не нашли этот номер в Ozon Банке».
            </p>
            <p style={{ margin: 0 }}>
              Корень сайта и любой неизвестный путь отдают нейтральную заглушку:
              подрядчик, получивший свою ссылку, не видит существования остальных тем.
            </p>
          </div>
        </section>

        <footer
          style={{
            fontSize: "13px",
            color: "var(--l-ink-faint)",
            borderTop: "1px solid var(--l-line)",
            paddingTop: "16px",
          }}
        >
          {COPY["bank.demo_note"]}
        </footer>
      </div>
    </div>
  );
}
