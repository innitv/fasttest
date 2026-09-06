import { useEffect, useRef, useState } from "react";
import { m } from "framer-motion";

import { BANK_COPY, COPY } from "@demo/content/copy";
import { focusWithoutScroll } from "@demo/lib/scroll-safety";
import {
  PUSH_BANNER_IN_SPEC,
  PUSH_BANNER_OUT_MS,
  PUSH_BANNER_OUT_SPEC,
  tapPressSpec,
} from "@demo/views/stage-motion";
import { BankAppIcon } from "./BankWordmark";

interface Props {
  merchant: string;
  amount: string;
  /**
   * Свои строки уведомления. Без них баннер говорит то, что говорит в
   * основном флоу: «подтвердите платёж на такую-то сумму». С ними — то, что
   * говорит уведомление о СЧЁТЕ, которое приходит до формы подрядчика.
   * Айдентика и имя приложения в обоих случаях банковские: пуш присылает
   * банк, а строки — данные подрядчика.
   */
  title?: string;
  body?: string;
  /**
   * От какого приложения уведомление. Без этих полей баннер представляется
   * банком — так он и работает в основном флоу, где банк просит подтвердить
   * платёж. Уведомление о СЧЁТЕ присылает сервис подрядчика, и подменять его
   * отправителя нельзя: иначе банк «знает» про счёт раньше, чем человек
   * вообще решил платить.
   */
  appName?: string;
  appIcon?: string;
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
 * В правом верхнем углу — время доставки, как у системного уведомления
 * («Сейчас»). Демо-пометка стояла здесь до 2026-09-06 и снята решением
 * владельца: баннер обязан читаться системным. Обязательная подпись
 * «Демонстрация: платёж не выполняется» живёт на экранах банка и не
 * зависит от этой строки.
 */
export function PushBanner({
  merchant,
  amount,
  title,
  body,
  appName,
  appIcon,
  onOpen,
  onDismiss,
}: Props) {
  const [leaving, setLeaving] = useState(false);
  /*
   * Фокус баннеру ставится программно (см. ниже), и Chromium/WebKit считают
   * такой фокус «клавиатурным»: поверх уведомления рисуется кольцо
   * `:focus-visible` — 2 px чёрным по всему периметру. У системного
   * уведомления обводки нет, и кадр со смены айдентики выглядел обведённым.
   *
   * Кольцо не удаляется, а откладывается до первого нажатия клавиши: пока
   * пользователь не трогал клавиатуру, оно не нужно; как только тронул —
   * возвращается штатное `:focus-visible` из `styles.css`.
   */
  const [autoFocused, setAutoFocused] = useState(true);
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

  useEffect(() => {
    if (!autoFocused) return;
    const onKey = () => setAutoFocused(false);
    window.addEventListener("keydown", onKey, { once: true });
    return () => window.removeEventListener("keydown", onKey);
  }, [autoFocused]);

  const dismiss = () => {
    setLeaving(true);
    window.setTimeout(onDismiss, PUSH_BANNER_OUT_MS);
  };

  return (
    <div
      data-testid="push-layer"
      className="absolute inset-0 z-20"
      style={{ pointerEvents: "none", fontFamily: "var(--bank-font)" }}
    >
      <span aria-live="assertive" className="sr-only">
        {title ? `${title}. ${body ?? ""}` : BANK_COPY.livePush(amount)}
      </span>

      <m.button
        ref={ref}
        type="button"
        data-testid="push-banner"
        data-state={leaving ? "dismissing" : "rest"}
        // Появление: слайд-даун сверху, ЧИТАЕМЫЙ глазом. История: жёсткая пружина
        // (520/34) доходила до места за ~100мс = «появление», не движение; tween с
        // overshoot-кривой фронт-грузил ход (почти весь путь за ~80мс) — та же
        // беда. Мягкая пружина распределяет скорость по времени: баннер заметно
        // едет сверху вниз ~0.5с и мягко доводит с лёгким проскоком (ζ≈0.65 →
        // ~7% overshoot). Сами параметры — в общем слое (`PUSH_BANNER_*_SPEC` в
        // `stage-m.ts`): движение задаёт он, а не компонент. Старт заведомо
        // выше кромки (−170% высоты баннера + верхний отступ) — виден полный ход.
        // Свайп/дисмисс — быстрый уход вверх. Под prefers-reduced-motion
        // `MotionConfig` гасит transform: баннер мгновенно на месте.
        initial={{ y: "-170%", opacity: 0 }}
        animate={{ y: leaving ? "-170%" : 0, opacity: leaving ? 0 : 1 }}
        transition={leaving ? PUSH_BANNER_OUT_SPEC : PUSH_BANNER_IN_SPEC}
        // Просадка под пальцем — той же длительности, что отклик контролов в
        // CSS (`--k-motion-fast`), а не дефолтной пружиной Motion.
        whileTap={{ scale: 0.98, transition: tapPressSpec() }}
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
          // Материал системного уведомления: размытие ПЛЮС насыщение. Без
          // saturate подложка сереет, и баннер читается белой плашкой, а не
          // стеклом поверх экрана (HIG, Materials).
          background: "rgba(252,252,254,0.82)",
          backdropFilter: "blur(28px) saturate(180%)",
          WebkitBackdropFilter: "blur(28px) saturate(180%)",
          // Единственная тень во всём наборе экранов банка: у уведомления
          // iOS она есть, без неё баннер сливается с экраном подрядчика.
          boxShadow: "0 8px 24px rgba(0,0,0,0.16)",
          border: "none",
          outline: autoFocused ? "none" : undefined,
          cursor: "pointer",
        }}
      >
        {appIcon ? (
          <img
            data-testid="push-app-icon"
            alt=""
            aria-hidden="true"
            src={appIcon}
            width={38}
            height={38}
            className="shrink-0"
            style={{
              width: "var(--bank-push-icon)",
              height: "var(--bank-push-icon)",
              display: "block",
            }}
          />
        ) : (
          <BankAppIcon />
        )}

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
            <span style={{ whiteSpace: "nowrap" }}>{appName ?? COPY["push.app"]}</span>
            <span data-testid="push-time" style={{ whiteSpace: "nowrap" }}>
              {COPY["push.time"]}
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
            {title ?? BANK_COPY.pushTitle(amount)}
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
            {body ?? BANK_COPY.pushBody(merchant)}
          </span>
        </span>
      </m.button>
    </div>
  );
}
