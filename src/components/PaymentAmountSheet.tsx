import { AnimatePresence, motion } from "framer-motion";
import { Fragment, useId } from "react";

import { COPY, methodAccessibleName } from "@demo/content/copy";
import { SHEET_OVERLAY_SPEC, SHEET_SCRIM_SPEC } from "@demo/views/stage-motion";
import type { PaymentMethod } from "@demo/theme/tenant.schema";

interface Props {
  open: boolean;
  onClose: () => void;
  methods: PaymentMethod[];
  selected: string | null;
  onSelect: (id: string) => void;
  /** Заголовок листа. У донора он не совпадает с названием секции экрана. */
  title: string;
  /** Пояснение под заголовком: в какой валюте спишутся деньги. */
  note: string | null;
}

/**
 * Шторка выбора оплаты в подаче `amount_rows` — донор Tripster.
 *
 * Второй вид шторки рядом с `PaymentSheetRow` (MYBOX), а не его настройка:
 * они расходятся моделью выбора, а не оформлением. У MYBOX выбор
 * ДВУХШАГОВЫЙ — радио-строки без заливки и кнопка «Выбрать» внизу, пока она
 * не нажата, значение снаружи не меняется. Здесь нажатие на строку И ЕСТЬ
 * выбор: список собран карточками с заливкой, суммой платежа справа и без
 * единой отметки радио, кнопки подтверждения у донора нет вовсе. Плюс своя
 * шапка — заголовок с круглой кнопкой закрытия и абзац про валюту над
 * списком.
 *
 * Открытием управляет экран: у этого донора шторку раскрывает ГЛАВНАЯ кнопка
 * «Оплатить», а не отдельная строка способа — строки способа на экране нет.
 *
 * Позиционируется `absolute` внутри экрана, а не `fixed`: демо живёт в рамке
 * телефона, и фиксированный слой уехал бы за её пределы.
 */
export function PaymentAmountSheet({
  open,
  onClose,
  methods,
  selected,
  onSelect,
  title,
  note,
}: Props) {
  const titleId = useId();

  return (
    <AnimatePresence>
      {open ? (
        <Fragment key="payment-amount-sheet">
          {/*
           * 🔴 Затемнение и лист — СОСЕДИ, а не вложенные узлы. Лист внутри
           * затемнения наследует его `opacity`, и пока оно набирает
           * непрозрачность, сквозь лист просвечивает экран под ним: при
           * системном темпе (0.44 с) это добрых полсекунды полупрозрачной
           * шторки. Диагноз — `FIXES.md`, баг 17.
           *
           * Движение — ОБЩИЙ слой демо: затемнение гаснет по
           * `SHEET_SCRIM_SPEC`, лист выезжает снизу по `SHEET_OVERLAY_SPEC`.
           * Тайминги донора сюда не переносятся, `prefers-reduced-motion`
           * обрабатывает MotionConfig в `main.tsx`.
           */}
          <motion.div
            className="absolute inset-0 z-20"
            data-testid="payment-sheet"
            style={{ background: "rgba(0, 0, 0, 0.6)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={SHEET_SCRIM_SPEC}
          >
            {/* Тап по подложке закрывает лист без выбора — так ведёт себя донор. */}
            <button
              type="button"
              aria-label={COPY["a11y.sheet_close"]}
              onClick={onClose}
              className="absolute inset-0 h-full w-full"
              style={{ background: "none", border: "none", cursor: "default" }}
            />
          </motion.div>
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="absolute inset-x-0 bottom-0 z-20"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={SHEET_OVERLAY_SPEC}
            style={{
              background: "var(--t-surface-background)",
              borderRadius: "var(--t-radius-sheet) var(--t-radius-sheet) 0 0",
              // Поля листа у донора равны полям страницы (16), снизу добавлен
              // настоящий вырез устройства.
              padding:
                "0 var(--t-page-padding) calc(24px + env(safe-area-inset-bottom, 0px))",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Шапка листа донора — 64 px: заголовок слева, крестик справа. */}
            <div
              className="flex items-center justify-between"
              style={{ height: "64px", gap: "8px" }}
            >
              <h2
                id={titleId}
                style={{
                  fontSize: "var(--t-font-section-title)",
                  lineHeight: 1.4,
                  fontWeight: "var(--t-emphasis-weight)",
                  color: "var(--t-text-primary)",
                  margin: 0,
                }}
              >
                {title}
              </h2>
              <button
                type="button"
                aria-label={COPY["a11y.sheet_close"]}
                data-testid="payment-sheet-close"
                onClick={onClose}
                className="flex shrink-0 items-center justify-center"
                style={{
                  // Кнопка донора 32×32; зона нажатия расширена до нашего
                  // порога прозрачным полем вокруг, а не растяжением плашки.
                  width: "32px",
                  height: "32px",
                  minWidth: "var(--k-tap-min)",
                  minHeight: "var(--k-tap-min)",
                  background: "none",
                  border: "none",
                  padding: 0,
                  color: "var(--t-text-primary)",
                  cursor: "pointer",
                }}
              >
                <span
                  aria-hidden
                  className="flex items-center justify-center"
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "var(--t-radius-control)",
                    background: "var(--t-surface-card)",
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path
                      d="M5.5 5.5l9 9M14.5 5.5l-9 9"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              </button>
            </div>

            {note && (
              <p
                data-testid="payment-sheet-note"
                style={{
                  fontSize: "var(--t-font-caption)",
                  lineHeight: 1.43,
                  fontWeight: "var(--t-label-weight)",
                  color: "var(--t-text-primary)",
                  margin: "0 0 24px",
                }}
              >
                {note}
              </p>
            )}

            <div
              role="radiogroup"
              aria-label={title}
              className="flex flex-col"
              style={{ gap: "8px" }}
            >
              {methods.map((method) => {
                const checked = selected === method.id;
                return (
                  <button
                    key={method.id}
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    aria-label={methodAccessibleName(method.label, checked)}
                    data-testid={`payment-sheet-option-${method.id}`}
                    data-selected={checked}
                    onClick={() => onSelect(method.id)}
                    className="flex w-full items-center justify-between text-left"
                    style={{
                      // Строка донора 96 px высотой при поле 23/24 — она несёт
                      // две строки текста слева и сумму справа.
                      minHeight: "96px",
                      gap: "12px",
                      padding: "23px 24px",
                      borderRadius: "var(--t-radius-field)",
                      background: "var(--t-surface-card)",
                      /*
                       * Выбор у донора виден не отметкой, а тем, что шторка
                       * закрылась: радио в списке нет. Второй канал состояния
                       * для клавиатуры и скринридера — `aria-checked` и
                       * обводка выбранной строки.
                       */
                      border: `var(--t-selected-border-width) solid ${
                        checked ? "var(--t-text-primary)" : "transparent"
                      }`,
                      cursor: "pointer",
                      transition: "border-color var(--k-motion-fast) ease-out",
                    }}
                  >
                    <span className="flex flex-col" style={{ gap: "4px" }}>
                      <span
                        style={{
                          fontSize: "var(--t-font-body)",
                          lineHeight: 1.25,
                          fontWeight: "var(--t-cta-font-weight)",
                          color: "var(--t-text-primary)",
                        }}
                      >
                        {method.label}
                      </span>
                      {method.caption && (
                        <span
                          style={{
                            fontSize: "var(--t-font-caption)",
                            lineHeight: 1.43,
                            color: "var(--t-text-secondary)",
                          }}
                        >
                          {method.caption}
                        </span>
                      )}
                    </span>
                    {method.amount && (
                      <span
                        className="shrink-0"
                        style={{
                          fontSize: "var(--t-font-body)",
                          lineHeight: 1.25,
                          fontWeight: "var(--t-cta-font-weight)",
                          color: "var(--t-text-primary)",
                        }}
                      >
                        {method.amount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        </Fragment>
      ) : null}
    </AnimatePresence>
  );
}
