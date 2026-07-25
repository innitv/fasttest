import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

import { BANK_COPY, COPY } from "@demo/content/copy";
import { focusWithoutScroll } from "@demo/lib/scroll-safety";
import { BankAppIcon } from "./BankWordmark";

interface Props {
  merchant: string;
  amount: string;
  onOpen: () => void;
  onDismiss: () => void;
}

/**
 * `O-0` — баннер системного уведомления поверх экрана подрядчика.
 *
 * Смысл кадра: два визуальных языка одновременно. Подложка — неизменённый
 * экран подрядчика со всеми его токенами, баннер целиком в `--bank-*`.
 * Затемнения нет: iOS не затемняет экран под баннером, а затемнение
 * сделало бы кадр модальным и смазало бы контраст двух айдентик.
 *
 * Автоскрытия нет намеренно: в живом показе исчезнувший баннер оставляет
 * наблюдателя без точки продолжения.
 *
 * Демо-пометка стоит в шапке на месте времени iOS — попадает в любой
 * скриншот баннера и не добавляет ни одной строки к его высоте.
 */
export function PushBanner({ merchant, amount, onOpen, onDismiss }: Props) {
  const [leaving, setLeaving] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const touchStartY = useRef<number | null>(null);
  const swiped = useRef(false);

  useEffect(() => {
    // Фокус нужен (клавиатура: Enter открывает банк, Escape убирает баннер;
    // screen reader объявляет заголовок и текст при получении фокуса).
    // Прокрутка — нет: баннер стартует ВЫШЕ кромки экрана (`y: -170%`), и
    // обычный `focus()` заставляет браузер «доставить» его в видимую область,
    // прокручивая ближайшего прокручиваемого предка. На живом iPhone это
    // сдвигало весь экран вверх: низ подтягивался, а верх баннера уезжал за
    // кромку. `focusWithoutScroll` держит и `preventScroll`, и восстановление
    // позиций предков — на движки, где опция срабатывает не всегда.
    focusWithoutScroll(ref.current);
  }, []);

  const dismiss = () => {
    setLeaving(true);
    window.setTimeout(onDismiss, 200);
  };

  return (
    <div
      data-testid="push-layer"
      className="absolute inset-0 z-20"
      style={{ pointerEvents: "none" }}
    >
      <span aria-live="assertive" className="sr-only">
        {BANK_COPY.livePush(amount)}
      </span>

      <motion.button
        ref={ref}
        type="button"
        data-testid="push-banner"
        data-state={leaving ? "dismissing" : "rest"}
        // Появление: слайд-даун сверху, ЧИТАЕМЫЙ глазом. История: жёсткая пружина
        // (520/34) доходила до места за ~100мс = «появление», не движение; tween с
        // overshoot-кривой фронт-грузил ход (почти весь путь за ~80мс) — та же
        // беда. Мягкая пружина (150/16) распределяет скорость по времени: баннер
        // заметно едет сверху вниз ~0.5с и мягко доводит с лёгким проскоком
        // (ζ≈0.65 → ~7% overshoot). Старт заведомо выше кромки (−170% высоты
        // баннера + верхний отступ) — виден полный ход. Свайп/дисмисс — быстрый
        // уход вверх. Под prefers-reduced-motion `MotionConfig` гасит transform:
        // баннер мгновенно на месте (движение убрано).
        initial={{ y: "-170%", opacity: 0 }}
        animate={{ y: leaving ? "-170%" : 0, opacity: leaving ? 0 : 1 }}
        transition={
          leaving
            ? { duration: 0.2, ease: "easeIn" }
            : {
                y: { type: "spring", stiffness: 150, damping: 16, mass: 1 },
                opacity: { duration: 0.16, ease: "easeOut" },
              }
        }
        whileTap={{ scale: 0.98 }}
        onClick={() => {
          // После свайпа браузер всё равно шлёт click — открывать банк по
          // жесту, который означал «убрать», нельзя.
          if (swiped.current) {
            swiped.current = false;
            return;
          }
          onOpen();
        }}
        onPointerDown={(event) => {
          touchStartY.current = event.clientY;
          // Захват указателя обязателен: свайп вверх уводит палец за
          // границы баннера, и без захвата pointerup придёт другому узлу,
          // а жест молча не сработает.
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerUp={(event) => {
          const start = touchStartY.current;
          touchStartY.current = null;
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
          // Свайп вверх убирает баннер и возвращает пользователя на экран
          // подрядчика с сохранённым выбором.
          if (start !== null && start - event.clientY > 24) {
            event.preventDefault();
            swiped.current = true;
            dismiss();
          }
        }}
        onPointerCancel={() => {
          touchStartY.current = null;
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") dismiss();
        }}
        className="absolute flex text-left"
        style={{
          pointerEvents: "auto",
          left: "var(--bank-push-inset)",
          right: "var(--bank-push-inset)",
          // Отступ от верхней кромки КОЛОНКИ. Безопасная зона устройства
          // (вырез, строка статуса) уже вычтена отступом самой колонки в
          // `PhoneFrame`, поэтому второй раз `env(safe-area-inset-top)` здесь
          // не прибавляется — иначе баннер отъедет вниз на двойной инсет.
          top: "var(--bank-push-top)",
          minHeight: "var(--bank-push-min-h)",
          padding: "var(--bank-push-pad)",
          gap: "12px",
          borderRadius: "var(--bank-radius-push)",
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          // Единственная тень во всём наборе экранов банка: у уведомления
          // iOS она есть, без неё баннер сливается с экраном подрядчика.
          boxShadow: "0 8px 24px rgba(0,0,0,0.16)",
          border: "none",
          cursor: "pointer",
        }}
      >
        <BankAppIcon />

        <span className="flex min-w-0 flex-1 flex-col">
          <span
            className="flex items-baseline justify-between"
            style={{
              gap: "8px",
              fontSize: "13px",
              fontWeight: 400,
              color: "var(--bank-text-secondary)",
            }}
          >
            <span style={{ whiteSpace: "nowrap" }}>{COPY["push.app"]}</span>
            <span data-testid="push-demo-tag" style={{ whiteSpace: "nowrap" }}>
              {COPY["push.demo_tag"]}
            </span>
          </span>

          <span
            data-testid="push-title"
            style={{
              marginTop: "2px",
              fontSize: "15px",
              fontWeight: 600,
              color: "var(--bank-text-primary)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {BANK_COPY.pushTitle(amount)}
          </span>

          {/* Усечение бьёт по мерчанту, не по сумме: сумма стоит
              в заголовке и повторяется на трёх экранах ниже. */}
          <span
            data-testid="push-body"
            style={{
              fontSize: "15px",
              fontWeight: 400,
              color: "var(--bank-text-primary)",
              display: "-webkit-box",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: 2,
              overflow: "hidden",
            }}
          >
            {BANK_COPY.pushBody(merchant)}
          </span>
        </span>
      </motion.button>
    </div>
  );
}
