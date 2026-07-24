import { COPY, formatMoney } from "@demo/content/copy";
import type { TenantConfig } from "@demo/theme/tenant.schema";

interface Props {
  totals: TenantConfig["content"]["totals"];
  /** Прибавка от выбранного варианта доставки (архетип A). */
  delta?: number;
}

/**
 * Блок итогов.
 *
 * Архетип A — одна строка «Итого» без разделителей.
 * Архетип B — три строки через два разделителя: Итого / Скидка / К оплате.
 * Это строка 8 контрольной таблицы различий архетипов.
 *
 * Скидка передаётся тремя каналами: цветом, знаком «−» и словом «Скидка».
 */
export function SingleRowTotals({ totals, delta = 0 }: Props) {
  return (
    <div
      data-testid="totals-block"
      data-variant="single_row"
      className="flex w-full items-center justify-between"
      style={{ minHeight: "var(--t-row-height)", gap: "12px" }}
    >
      <span
        style={{
          fontSize: "var(--t-font-body)",
          fontWeight: 400,
          color: "var(--t-text-primary)",
        }}
      >
        {COPY["totals.label"]}
      </span>
      <span
        data-testid="totals-value"
        style={{
          fontSize: "var(--t-font-body)",
          fontWeight: 700,
          color: "var(--t-text-primary)",
          whiteSpace: "nowrap",
        }}
      >
        {formatMoney(totals.sum - totals.discount + delta)}
      </span>
    </div>
  );
}

export function ThreeRowTotals({ totals }: Props) {
  const payable = totals.sum - totals.discount;

  return (
    <div data-testid="totals-block" data-variant="three_rows_two_dividers" className="flex w-full flex-col">
      <Divider />
      <Row label={COPY["totals.sum.label"]} value={formatMoney(totals.sum)} />
      <Row
        label={COPY["totals.discount.label"]}
        value={`− ${formatMoney(totals.discount)}`}
        valueColor="var(--t-brand-text-on-bg)"
        testId="totals-discount"
      />
      <Divider />
      <Row
        label={COPY["totals.payable.label"]}
        value={formatMoney(payable)}
        emphasis
        testId="totals-payable"
      />
    </div>
  );
}

function Divider() {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "block",
        width: "100%",
        height: "1px",
        background: "var(--t-surface-divider)",
        marginBlock: "8px",
      }}
    />
  );
}

function Row({
  label,
  value,
  valueColor = "var(--t-text-primary)",
  emphasis = false,
  testId,
}: {
  label: string;
  value: string;
  valueColor?: string;
  emphasis?: boolean;
  testId?: string;
}) {
  return (
    <div
      data-testid={testId}
      className="flex w-full items-center justify-between"
      style={{ minHeight: "var(--k-totals-row-h)", gap: "12px" }}
    >
      <span
        style={{
          fontSize: emphasis ? "20px" : "var(--t-font-body)",
          fontWeight: emphasis ? 700 : 400,
          color: "var(--t-text-primary)",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: emphasis ? "20px" : "var(--t-font-body)",
          fontWeight: emphasis ? 700 : 400,
          color: valueColor,
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </span>
    </div>
  );
}
