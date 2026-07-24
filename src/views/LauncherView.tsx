import { BUNDLED_TENANTS } from "@demo/theme/tenant-loader";

const ARCHETYPES = [
  { id: "cart_checkout", label: "Корзина / чекаут" },
  { id: "subscription_payment", label: "Оплата подписки" },
] as const;

/**
 * Точка входа демо: перечень готовых комбинаций «тема × архетип».
 *
 * Это НАША страница, а не экран подрядчика — оформлена нашей айдентикой
 * и токенов тенанта не читает. Подрядчику отправляется прямая ссылка на
 * экран, а не этот список.
 */
export function LauncherView() {
  const slugs = Object.keys(BUNDLED_TENANTS);

  return (
    <div
      data-testid="launcher"
      className="no-scrollbar flex h-full w-full justify-center overflow-y-auto"
      style={{
        background: "#101418",
        color: "#FFFFFF",
        fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif',
      }}
    >
      <div className="w-full" style={{ maxWidth: "560px", padding: "40px 24px 56px" }}>
        <p style={{ margin: 0, fontSize: "13px", color: "#7C8698", letterSpacing: "0.06em", textTransform: "uppercase" }}>
          Демо для воронки подрядчиков
        </p>
        <h1 style={{ margin: "8px 0 0", fontSize: "26px", fontWeight: 700, lineHeight: 1.2 }}>
          Ozon Банк в способах оплаты
        </h1>
        <p style={{ margin: "12px 0 0", fontSize: "15px", color: "#AEB8C7", lineHeight: 1.5 }}>
          Один шаблон, две калибровочные темы. Новый подрядчик — это заполненный
          <code style={{ color: "#FFFFFF" }}> tenant.json</code>, а не работа дизайнера.
        </p>

        {slugs.map((slug) => (
          <section key={slug} style={{ marginTop: "28px" }}>
            <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: "#AEB8C7" }}>
              Тема <code style={{ color: "#FFFFFF" }}>{slug}</code>
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "10px" }}>
              {ARCHETYPES.map((archetype) => (
                <a
                  key={archetype.id}
                  href={`?tenant=${slug}&archetype=${archetype.id}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "12px",
                    border: "1px solid #2C3542",
                    borderRadius: "12px",
                    background: "#1B2129",
                    padding: "14px 16px",
                    color: "#FFFFFF",
                    textDecoration: "none",
                    fontSize: "15px",
                  }}
                >
                  {archetype.label}
                  <span style={{ color: "#2F6BFF" }}>→</span>
                </a>
              ))}
            </div>
          </section>
        ))}

        <section style={{ marginTop: "32px" }}>
          <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: "#AEB8C7" }}>
            Параметры адреса
          </h2>
          <ul style={{ margin: "10px 0 0", paddingLeft: "18px", fontSize: "14px", color: "#AEB8C7", lineHeight: 1.7 }}>
            <li>
              <code style={{ color: "#FFFFFF" }}>?tenant=</code> — одна из
              поставляемых тем: {slugs.join(", ")}
            </li>
            <li>
              <code style={{ color: "#FFFFFF" }}>?t=</code> — свой конфиг в
              base64; перекрывает файловый
            </li>
            <li>
              <code style={{ color: "#FFFFFF" }}>?archetype=</code> — раскладка
              экрана: cart_checkout, subscription_payment
            </li>
            <li>
              <code style={{ color: "#FFFFFF" }}>?a11y=</code> — enforced,
              donor_faithful
            </li>
            <li>
              <code style={{ color: "#FFFFFF" }}>?state=</code> — снимок
              состояния: ozon_selected, cta_sent, cta_disabled, field_error,
              promo_open, handoff
            </li>
          </ul>
        </section>

        <p style={{ margin: "28px 0 0", fontSize: "13px", color: "#7C8698", lineHeight: 1.5 }}>
          Демонстрация: платёж не выполняется. Ozon Банк показан первым в списке
          способов оплаты — это условие демонстрации, а не рекомендация
          подрядчику менять порядок способов оплаты.
        </p>
      </div>
    </div>
  );
}
