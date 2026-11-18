import { useEffect, useId, useRef, useState, type CSSProperties } from "react";

import { PrimaryButton } from "@demo/components/PrimaryButton";
import { TextField } from "@demo/components/TextField";
import { COPY, formatMoney } from "@demo/content/copy";
import { formatPhoneMask, normalizePhoneDigits } from "@demo/lib/phone";
import type { ScreenProps, WarrantyDraft } from "./screen-props";

const EMPTY_DRAFT: WarrantyDraft = { fields: {}, accepted: true };
const VEHICLE_FIELDS = [
  { name: "make", label: "Марка" },
  { name: "model", label: "Модель" },
  { name: "year", label: "Год выпуска" },
] as const;
const FIELD = { surface: "form", hideLabel: true, useControlHeight: true, required: true } as const;

const heading: CSSProperties = {
  fontSize: "var(--t-font-section-title)",
  fontWeight: "var(--t-title-weight)",
  marginBottom: "var(--t-block-gap)",
};
const control: CSSProperties = {
  minHeight: "var(--t-control-height)",
  borderRadius: "var(--t-radius-control)",
  fontSize: "var(--t-font-caption)",
};
const muted: CSSProperties = {
  fontSize: "var(--t-font-caption)",
  color: "var(--t-text-secondary)",
};

export function WarrantyCheckoutScreen({
  tenant,
  ctaState,
  ctaLoadingLabel,
  onCta,
  phoneGate,
  selectedAmount,
  onSelectAmount,
  warrantyForm,
}: ScreenProps) {
  const { content } = tenant;
  const id = useId();
  const form = useRef<HTMLFormElement>(null);
  const [otherShown, setOtherShown] = useState(false);
  const { fields, accepted } = warrantyForm?.draft ?? EMPTY_DRAFT;
  const amount = selectedAmount ?? content.totals.sum - content.totals.discount;
  const busy = ctaState === "loading" || ctaState === "sent";
  const phoneError = phoneGate?.error;
  const phoneFocusSignal = phoneGate?.focusSignal;
  const contactId = `${id}-phone`;
  const otherMethod = tenant.payment_list.methods.find((method) => method.id === "other");

  useEffect(() => {
    if (phoneFocusSignal) document.getElementById(contactId)?.focus();
  }, [contactId, phoneFocusSignal]);

  const changeField = (name: string, value: string) => {
    setOtherShown(false);
    warrantyForm?.onChange({ fields: { ...fields, [name]: value }, accepted });
  };

  const selectAmount = (sum: number) => {
    setOtherShown(false);
    onSelectAmount?.(sum);
  };

  const query = new URLSearchParams(window.location.search);
  const urlVin = (query.get("VIN") ?? query.get("vin") ?? "")
    .toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, "").slice(0, 17);
  const vin = fields.vin ?? (urlVin.length === 17 ? urlVin : (content.warranty_demo?.vin ?? urlVin));

  return (
    <div data-screen-root className="flex h-full w-full flex-col"
      style={{
        background: "var(--t-surface-background)",
        color: "var(--t-text-primary)",
        fontWeight: "var(--t-label-weight)",
      }}>
      <div data-testid="scroll-container" className="no-scrollbar flex-1 overflow-y-auto">
        <form ref={form} className="mx-auto grid"
          style={{
            width: "80%",
            gap: "var(--t-section-gap)",
            paddingTop: "var(--t-page-padding)",
            paddingBottom: "var(--k-page-bottom-reserve)",
          }}
          onSubmit={(event) => {
            event.preventDefault();
            if (!busy) setOtherShown(true);
          }}
        >
          <h1 className="sr-only">{content.title}</h1>
          <section aria-labelledby={`${id}-vehicle`}>
            <h2 id={`${id}-vehicle`} style={heading}>Данные автомобиля</h2>
            <div className="grid gap-2">
              {VEHICLE_FIELDS.map(({ name, label }) => (
                <TextField {...FIELD} key={name}
                  name={`${id}-${name}`} label={label} placeholder={label}
                  value={fields[name] ?? ""} onChange={(value) => changeField(name, value)}
                  inputMode={name === "year" ? "numeric" : "text"}
                  maxLength={name === "year" ? 4 : undefined}
                  pattern={name === "year" ? "[0-9]{4}" : undefined} />
              ))}
              <TextField {...FIELD} name={`${id}-vin`} label="VIN" placeholder="VIN"
                value={vin} onChange={(value) => changeField("vin", value.toUpperCase())}
                maxLength={17} pattern="[A-HJ-NPR-Z0-9]{17}" />
            </div>
          </section>

          <section aria-labelledby={`${id}-contacts`}>
            <h2 id={`${id}-contacts`} style={heading}>Контактные данные</h2>
            <div className="grid gap-2">
              <TextField {...FIELD} name={contactId} label="Телефон (+7)"
                placeholder={COPY["phone.placeholder"]}
                value={phoneGate
                  ? formatPhoneMask(phoneGate.digits)
                  : (fields.phone ?? formatPhoneMask(content.warranty_demo?.phone ?? ""))}
                onChange={(value) => {
                  setOtherShown(false);
                  if (phoneGate) phoneGate.onChange(normalizePhoneDigits(value));
                  else changeField("phone", value);
                }}
                type="tel" autoComplete="tel-national" pattern="[0-9]{3} [0-9]{3}-[0-9]{2}-[0-9]{2}"
                leading={<span style={{ fontSize: "var(--t-font-body)" }}>+7</span>}
                errorMessage={phoneError ? COPY[`phone.error.${phoneError}`] : null} />
              <TextField {...FIELD} name={`${id}-email`} label="Почта" placeholder="Почта"
                value={fields.email ?? ""} onChange={(value) => changeField("email", value)}
                type="email" autoComplete="email" />
              <TextField {...FIELD} name={`${id}-name`} label="ФИО" placeholder="ФИО"
                value={fields.name ?? ""} onChange={(value) => changeField("name", value)}
                autoComplete="name" />
            </div>
          </section>

          <section aria-labelledby={`${id}-payment`}>
            <h2 id={`${id}-payment`} style={heading}>Способ оплаты</h2>
            <div role="group" aria-label="Период оплаты" className="mb-3 flex rounded-full p-1"
              style={{ background: "var(--t-surface-form)" }}>
              {content.plans.map((plan) => {
                const active = plan.sum === amount;
                return (
                  <button key={plan.id} id={`warranty-period-${plan.id}`}
                    type="button" aria-pressed={active} disabled={busy}
                    onClick={() => selectAmount(plan.sum)}
                    className="tap-press flex-1 rounded-full px-2 font-semibold"
                    style={{
                      minHeight: "var(--k-tap-min)",
                      fontSize: "var(--t-font-caption)",
                      background: active ? "var(--t-secondary-fill)" : "transparent",
                      color: active ? "var(--t-secondary-text)" : "var(--t-text-primary)",
                    }}>
                    {plan.title}
                  </button>
                );
              })}
            </div>
            <div role="group" aria-label="Цена по тарифу" className="grid gap-2">
              {content.plans.map((plan) => {
                const active = plan.sum === amount;
                return (
                  <button key={plan.id} id={`warranty-price-${plan.id}`}
                    type="button" aria-pressed={active} disabled={busy}
                    onClick={() => selectAmount(plan.sum)}
                    className="tap-press w-full font-bold"
                    style={{
                      ...control,
                      background: active ? "var(--t-secondary-fill)" : "var(--t-surface-card)",
                      color: active ? "var(--t-secondary-text)" : "var(--t-text-primary)",
                      border: active ? "1px solid transparent" : "1px solid var(--t-text-primary)",
                    }}>
                    {formatMoney(plan.sum)}{plan.caption ? ` ${plan.caption}` : ""}
                  </button>
                );
              })}
            </div>
            <span role="status" className="sr-only" data-testid="warranty-total">{formatMoney(amount)}</span>
            <label className="my-2 flex items-center gap-3" style={{
              ...muted, minHeight: "var(--k-tap-min)", fontSize: "10px",
              fontWeight: "var(--t-label-weight)",
            }}>
              <input type="checkbox" required checked={accepted}
                onChange={(event) => {
                  setOtherShown(false);
                  warrantyForm?.onChange({ fields, accepted: event.target.checked });
                }}
                className="size-4 shrink-0" style={{ accentColor: "var(--t-brand-primary)" }} />
              {content.legal_note}
            </label>

            <div className="grid gap-2">
              <button type="submit" data-testid="warranty-other-payment" disabled={busy}
                className="tap-press flex w-full items-center justify-center px-2"
                style={{
                  ...control,
                  background: "var(--t-brand-fill)", color: "var(--t-brand-on)",
                  fontSize: "var(--t-cta-font-size)", fontWeight: "var(--t-cta-font-weight)",
                }}>
                {otherMethod?.label ?? "Оплатить другим способом"}
              </button>
              <PrimaryButton label={tenant.cta.label} state={ctaState}
                loadingLabel={ctaLoadingLabel}
                onClick={() => {
                  if (!form.current?.reportValidity()) return;
                  setOtherShown(false);
                  onCta();
                }} />
              {otherShown && (
                <p role="status" style={muted}>
                  В демо доступна оплата через Ozon Банк.
                </p>
              )}
            </div>
          </section>
        </form>
      </div>
    </div>
  );
}
