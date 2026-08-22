import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { COPY, methodAccessibleName } from "@demo/content/copy";
import { SHEET_OVERLAY_SPEC, SHEET_SCRIM_SPEC } from "@demo/views/stage-motion";
import type { PaymentMethod } from "@demo/theme/tenant.schema";

interface Props {
  methods: PaymentMethod[];
  selected: string | null;
  onSelect: (id: string) => void;
  /** Заголовок шторки. У донора он не совпадает с названием секции. */
  sheetTitle: string;
  /** Метка кнопки подтверждения внутри шторки. */
  ctaLabel: string;
  /** Принудительно раскрытая шторка — для съёмки состояния. */
  forceOpen?: boolean;
}

/**
 * Карандаш правки. Иконку донора забрать не удалось (сервер не отдаёт файл
 * автоматизации), поэтому глиф нарисован в тех же метриках: 20×20, штрих
 * 1.5, цвет наследуется от строки.
 */
function PencilGlyph() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
      style={{ flexShrink: 0 }}
    >
      <path
        d="M13.4 3.6a1.7 1.7 0 0 1 2.4 2.4l-8.3 8.3-3.2.8.8-3.2 8.3-8.3Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Способ оплаты строкой, раскрывающейся в НИЖНЮЮ ШТОРКУ — раскладка
 * `sheet_select` (донор MYBOX).
 *
 * Отличие от `select_list` структурное, а не косметическое: выбор у этого
 * донора ДВУХШАГОВЫЙ. Строка показывает текущее значение и карандаш; нажатие
 * открывает отдельный лист поверх экрана со своим заголовком, радио-списком и
 * кнопкой подтверждения. Пока кнопка не нажата, значение в строке не меняется
 * — поэтому выбор внутри шторки живёт в черновом состоянии и применяется
 * наверх только по `ctaLabel`. Свернуть это в выпадающий список значит убрать
 * шаг, который донор показывает.
 *
 * Шторка позиционируется `absolute` внутри экрана, а не `fixed`: демо живёт в
 * рамке телефона, и фиксированный слой уехал бы за её пределы.
 */
export function PaymentSheetRow({
  methods,
  selected,
  onSelect,
  sheetTitle,
  ctaLabel,
  forceOpen = false,
}: Props) {
  const [open, setOpen] = useState(forceOpen);
  const [draft, setDraft] = useState(selected);
  const titleId = useId();
  const anchorRef = useRef<HTMLButtonElement>(null);
  /*
   * Шторка рендерится в КОРЕНЬ экрана, а не по месту вызова. Строка оплаты
   * лежит внутри скролл-контейнера, и `absolute inset-0` привязался бы к
   * нему: контейнер является содержащим блоком, поэтому шторка уезжала бы
   * вместе с прокруткой (замерено — уехала на −1110 px при скролле в низ
   * экрана и оказалась за пределами видимой области). Убрать `relative` со
   * скролл-контейнера нельзя: он обрезает визуально скрытый блок проверки
   * телефона, иначе тот раздувает scrollHeight колонки.
   */
  const [root, setRoot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setRoot(anchorRef.current?.closest<HTMLElement>("[data-screen-root]") ?? null);
  }, []);

  // Черновик обязан догонять внешнее значение: способ оплаты может смениться
  // не только здесь (например, сбросом состояния демо), и открытая после
  // этого шторка показала бы устаревшую отметку.
  useEffect(() => {
    if (!open) setDraft(selected);
  }, [open, selected]);

  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);

  const current = methods.find((method) => method.id === selected) ?? null;

  const apply = () => {
    if (draft) onSelect(draft);
    setOpen(false);
  };

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        data-testid="payment-sheet-trigger"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between text-left"
        style={{
          // Строка донора не является полем: ни рамки, ни заливки, ни высоты
          // контрола. Это просто значение с карандашом на правом краю. Зона
          // нажатия при этом остаётся нашей — 44 px.
          minHeight: "44px",
          gap: "8px",
          background: "none",
          border: "none",
          padding: 0,
          color: "var(--t-text-primary)",
          cursor: "pointer",
        }}
      >
        <span style={{ fontSize: "var(--t-font-body)", fontWeight: "var(--t-label-weight)" }}>
          {current ? current.label : COPY["payment.select_placeholder"]}
        </span>
        <PencilGlyph />
      </button>

      {/*
        AnimatePresence живёт ВНУТРИ портала, а не снаружи: обёрнутый ею
        `createPortal(...)` она не видит как собственного потомка и не
        монтирует содержимое вовсе — шторка просто перестаёт открываться,
        молча и без ошибки в консоли.
      */}
      {root
        ? createPortal(
            <AnimatePresence>
              {open ? (
        <motion.div
          key="payment-sheet"
          className="absolute inset-0 z-20 flex flex-col justify-end"
          data-testid="payment-sheet"
          style={{ background: "rgba(0, 0, 0, 0.6)" }}
          /*
           * Движение — ОБЩИЙ слой демо, а не тайминги донора: подложка гаснет
           * по `SHEET_SCRIM_SPEC`, лист выезжает снизу пружиной
           * `SHEET_OVERLAY_SPEC` в системном темпе.
           * `prefers-reduced-motion` обрабатывает MotionConfig в main.tsx.
           */
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={SHEET_SCRIM_SPEC}
        >
          {/*
            Подложка закрывает шторку без применения черновика — так ведёт
            себя донор: отменённый выбор не меняет строку.
          */}
          <button
            type="button"
            aria-label={COPY["a11y.sheet_close"]}
            onClick={() => setOpen(false)}
            className="flex-1"
            style={{ background: "none", border: "none", cursor: "default" }}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={SHEET_OVERLAY_SPEC}
            style={{
              background: "var(--t-surface-background)",
              // Поле шторки у донора вдвое шире поля экрана: 30 против 15,
              // и одинаковое со всех сторон.
              padding: "30px 30px calc(30px + env(safe-area-inset-bottom, 0px))",
              // Скругление листа — ось темы (`radius.sheet`), а не константа
              // компонента: у MYBOX оно 24, у Tripster 16. Дефолт схемы равен
              // прежней зашитой цифре, поэтому вид этой шторки не изменился.
              borderRadius: "var(--t-radius-sheet) var(--t-radius-sheet) 0 0",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <h2
              id={titleId}
              style={{
                fontSize: "var(--t-font-section-title)",
                lineHeight: 1.25,
                fontWeight: "var(--t-title-weight)",
                color: "var(--t-text-primary)",
                margin: 0,
              }}
            >
              {sheetTitle}
            </h2>

            <div
              role="radiogroup"
              aria-label={sheetTitle}
              className="flex flex-col"
              /*
               * Зазоры донора: 30 от заголовка до списка, 40 от списка до
               * кнопки. Внутри списка у него шаг строк 38 при высоте отметки
               * 22; у нас строка 44 по зоне нажатия, поэтому зазор нулевой —
               * шаг выходит 44, ближе к донорскому, чем 44 + 16.
               */
              style={{ gap: "0px", margin: "30px 0 40px" }}
            >
              {methods.map((method) => {
                const checked = draft === method.id;
                return (
                  <button
                    key={method.id}
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    aria-label={methodAccessibleName(method.label, checked)}
                    data-testid={`payment-sheet-option-${method.id}`}
                    data-selected={checked}
                    onClick={() => setDraft(method.id)}
                    className="flex w-full items-center text-left"
                    style={{
                      minHeight: "44px",
                      gap: "8px",
                      background: "none",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                    }}
                  >
                    <span
                      aria-hidden
                      className="flex items-center justify-center"
                      style={{
                        width: "22px",
                        height: "22px",
                        flexShrink: 0,
                        borderRadius: "50%",
                        /*
                         * Отметка донора — ПУСТОЕ кольцо: ни точки внутри, ни
                         * заливки. Выбранное состояние отличается только
                         * цветом рамки. Точка внутри кольца выглядит
                         * убедительно и является добавленной деталью.
                         */
                        border: `var(--t-border-width) solid ${
                          checked ? "var(--t-accent)" : "var(--t-text-primary)"
                        }`,
                        transition: "border-color var(--k-motion-fast) ease-out",
                      }}
                    />
                    <span
                      style={{
                        fontSize: "var(--t-font-body)",
                        lineHeight: 1.15,
                        fontWeight: "var(--t-label-weight)",
                        color: "var(--t-text-primary)",
                      }}
                    >
                      {method.label}
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              data-testid="payment-sheet-apply"
              onClick={apply}
              style={{
                minHeight: "56px",
                borderRadius: "var(--t-radius-control)",
                background: "var(--t-brand-primary)",
                color: "var(--t-brand-primary-on)",
                fontSize: "var(--t-cta-font-size)",
                fontWeight: "var(--t-cta-font-weight)",
                border: "none",
                cursor: "pointer",
              }}
            >
              {ctaLabel}
            </button>
          </motion.div>
        </motion.div>
              ) : null}
            </AnimatePresence>,
            root,
          )
        : null}
    </>
  );
}
