import type { Diagnostic } from "@demo/theme/build-theme";

interface Props {
  diagnostics: Diagnostic[];
  source: "url" | "bundled";
  slug: string | null;
}

/**
 * Экран отклонённого конфига.
 *
 * Сборка тенанта падает, а не деградирует молча: коды `E_*` показываются
 * целиком, вместе с полем и причиной. Ни белого экрана, ни отката к дефолту.
 * Оформление — наша айдентика: тема подрядчика не собралась, показывать
 * её нечем.
 */
export function ConfigErrorView({ diagnostics, source, slug }: Props) {
  const errors = diagnostics.filter((item) => item.severity === "error");
  const rest = diagnostics.filter((item) => item.severity !== "error");

  return (
    <div
      data-testid="config-error"
      className="no-scrollbar flex h-full w-full justify-center overflow-y-auto"
      style={{
        background: "#101418",
        color: "#FFFFFF",
        fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif',
      }}
    >
      <div className="w-full" style={{ maxWidth: "560px", padding: "32px 24px 48px" }}>
        <p style={{ margin: 0, fontSize: "13px", color: "#7C8698", letterSpacing: "0.06em", textTransform: "uppercase" }}>
          Сборка тенанта отклонена
        </p>
        <h1 style={{ margin: "8px 0 0", fontSize: "24px", fontWeight: 700, lineHeight: 1.25 }}>
          Конфиг не прошёл проверку
        </h1>
        <p style={{ margin: "12px 0 0", fontSize: "15px", color: "#AEB8C7", lineHeight: 1.5 }}>
          Источник:{" "}
          {source === "url" ? "параметр ?t= в адресе" : `файл tenants/${slug ?? "—"}.json`}. Пока
          ошибки не исправлены, экран подрядчика не рендерится — молчаливого
          фолбэка к теме по умолчанию в этом демо нет.
        </p>

        <ul style={{ listStyle: "none", margin: "24px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
          {[...errors, ...rest].map((item, index) => (
            <li
              key={`${item.code}-${index}`}
              style={{
                border: "1px solid #2C3542",
                borderRadius: "12px",
                background: "#1B2129",
                padding: "14px 16px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                    padding: "3px 8px",
                    borderRadius: "999px",
                    background:
                      item.severity === "error"
                        ? "#3A1620"
                        : item.severity === "warning"
                          ? "#3A2E16"
                          : "#16283A",
                    color:
                      item.severity === "error"
                        ? "#FF8A9B"
                        : item.severity === "warning"
                          ? "#F0C36B"
                          : "#79B8FF",
                  }}
                >
                  {item.code}
                </span>
              </div>
              <p style={{ margin: "8px 0 0", fontSize: "15px", lineHeight: 1.45 }}>{item.message}</p>
              {item.detail && (
                <p style={{ margin: "6px 0 0", fontSize: "13px", color: "#7C8698", lineHeight: 1.45 }}>
                  {item.detail}
                </p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
