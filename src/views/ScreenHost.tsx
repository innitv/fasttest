import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { HandoffOverlay } from "@demo/components/HandoffOverlay";
import { PhoneFrame } from "@demo/components/PhoneFrame";
import type { PhoneGateError } from "@demo/components/PhoneGateBlock";
import type { ButtonState } from "@demo/components/PrimaryButton";
import { PushBanner } from "@demo/components/bank/PushBanner";
import { COPY } from "@demo/content/copy";
import { track } from "@demo/lib/analytics";
import type { BuiltTheme } from "@demo/theme/build-theme";
import { OZON_METHOD_ID } from "@demo/theme/tenant.schema";
import { BankPaymentScreen } from "./BankPaymentScreen";
import { BankSplashScreen } from "./BankSplashScreen";
import { BankSuccessScreen } from "./BankSuccessScreen";
import { CartCheckoutScreen } from "./CartCheckoutScreen";
import { OzonRailScreen } from "./OzonRailScreen";
import { PaidConfirmationScreen } from "./PaidConfirmationScreen";
import { SubscriptionPaymentScreen } from "./SubscriptionPaymentScreen";
import { TicketCheckoutScreen } from "./TicketCheckoutScreen";
import type { DemoStage } from "./demo-flow";
import { stageVariants, transitionFor } from "./stage-motion";
import type { ForcedState, PhoneGateSlot } from "./screen-props";

interface Props {
  theme: BuiltTheme;
  forcedState: ForcedState;
  /** Короткий отдельный сценарий «только момент перехода» (`S-C`). */
  showHandoff: boolean;
  /** Принудительная стадия для съёмки и ревью. */
  initialStage: DemoStage | null;
}

/**
 * Оболочка демо: сквозной сценарий от экрана подрядчика до возврата.
 *
 * Решение по `S-C` — вариант 2 (`screens-ozon.md`, рекомендация
 * `design-generator`, утверждено оркестратором): в полном флоу пуш приходит
 * поверх экрана подрядчика, а `HandoffOverlay` остаётся отдельным коротким
 * сценарием по `?state=handoff`.
 *
 * Проверка клиентства (`screens-phone-check.md`) встроена МЕЖДУ выбором
 * «Ozon Банк» и пушем: выбор раскрывает поле телефона, главная кнопка
 * запускает проверку `check_ms`, которая ЗАМЕЩАЕТ прежнюю паузу `push_delay`.
 * Номер живёт только в состоянии React: ни сети, ни storage, ни аналитики
 * с цифрами.
 *
 * Экраны банка получают `theme.bankPayload` и НЕ получают theme.
 */
export function ScreenHost({ theme, forcedState, showHandoff, initialStage }: Props) {
  const { tenant, bankPayload } = theme;
  const timings = tenant.demo.timings;
  const phoneGate = tenant.ozon.phone_gate;
  const notClientDigits = phoneGate.not_client_number.replace(/\D/g, "");

  const ozonForced =
    forcedState === "ozon_selected" ||
    forcedState === "phone_expanded" ||
    forcedState === "phone_checking" ||
    forcedState === "phone_error";

  const [selected, setSelected] = useState<string | null>(() =>
    ozonForced || initialStage !== null
      ? OZON_METHOD_ID
      : tenant.payment_list.default_selected,
  );
  const [ctaState, setCtaState] = useState<ButtonState>(
    forcedState === "cta_sent" || initialStage === "push" ? "sent" : "default",
  );
  // Для архетипа B поле проверки телефона живёт на отдельном экране `ozon_rail`,
  // а не инлайн: forced-состояния phone_* и ozon_selected открывают именно его.
  const startStage: DemoStage =
    initialStage ??
    (tenant.archetype === "subscription_payment" && ozonForced
      ? "ozon_rail"
      : "contractor");
  const [stage, setStage] = useState<DemoStage>(startStage);
  const [bankLoading, setBankLoading] = useState(false);
  const [handoff, setHandoff] = useState(showHandoff);

  // ── Состояние проверки телефона ────────────────────────────────────
  const [phoneDigits, setPhoneDigits] = useState<string>(() =>
    forcedState === "phone_checking"
      ? "9991234567"
      : forcedState === "phone_error"
        ? notClientDigits
        : "",
  );
  const [phoneError, setPhoneError] = useState<PhoneGateError>(
    forcedState === "phone_error" ? "not_client" : null,
  );
  const [phoneChecking, setPhoneChecking] = useState(forcedState === "phone_checking");
  const [phoneFocusSignal, setPhoneFocusSignal] = useState(0);

  const timers = useRef<number[]>([]);

  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timers.current.push(id);
  }, []);

  const clearTimers = useCallback(() => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  // Тип межэкранного перехода вычисляется по паре «прошлая стадия → текущая».
  // Ref держит стадию ПРОШЛОГО закоммиченного рендера: эффект обновляет его
  // после коммита, поэтому на рендере смены stage тут ещё старое значение —
  // ровно то, что нужно `AnimatePresence` и мотивам входа/выхода.
  const prevStageRef = useRef<DemoStage | null>(null);
  const transitionType = transitionFor(prevStageRef.current, stage);
  useEffect(() => {
    prevStageRef.current = stage;
  }, [stage]);

  /*
   * Splash живёт заданное время и уходит сам. Длительность НЕ зависит от
   * prefers-reduced-motion: движение убирается, экран и его длительность —
   * нет.
   */
  useEffect(() => {
    if (stage !== "splash") return;
    const id = window.setTimeout(() => setStage("bank_payment"), timings.splash_ms);
    return () => window.clearTimeout(id);
  }, [stage, timings.splash_ms]);

  const base = { archetype: tenant.archetype, tenant_id: tenant.tenant_id };

  const handleSelect = useCallback(
    (id: string) => {
      // Навигационная модель архетипа B (донор Uchi): тап по способу оплаты
      // ведёт на его ОТДЕЛЬНЫЙ экран, а не выбирает строку. Доводится только
      // «Ozon Банк»; СБП и Кошелёк — заглушки вне сценария (тап без перехода).
      if (tenant.archetype === "subscription_payment") {
        if (id === OZON_METHOD_ID) {
          setSelected(OZON_METHOD_ID);
          track("payment_method_selected", { ...base, method_id: id });
          setStage("ozon_rail");
        }
        return;
      }

      // Архетип A: инлайн-выбор, поле телефона раскрывается под рядом карточек.
      setSelected(id);
      // Смена способа оплаты сбрасывает ошибку прошлой проверки; введённые
      // цифры сохраняются в состоянии и подставятся обратно при возврате.
      if (id !== OZON_METHOD_ID) setPhoneError(null);
      track("payment_method_selected", { ...base, method_id: id });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tenant.tenant_id, tenant.archetype],
  );

  /**
   * «‹ Назад» на экране `ozon_rail`: возврат к экрану подписки B. Навигация
   * между экранами подрядчика — не событие воронки, аналитику не пишет
   * (список сигналов зафиксирован в screens.md → analytics_test_hooks).
   */
  const handleOzonRailBack = useCallback(() => {
    setStage("contractor");
    // Навигационная модель: на экране подписки нет выбранного способа.
    setSelected(null);
    setPhoneError(null);
    setCtaState("default");
  }, []);

  const handlePhoneChange = useCallback((digits: string) => {
    setPhoneDigits(digits);
    // Ошибка снимается по первому изменению значения — не по blur и не по
    // повторному нажатию кнопки.
    setPhoneError(null);
  }, []);

  const phoneGateActive = phoneGate.enabled && selected === OZON_METHOD_ID;

  // ── Шаг 1: главная кнопка экрана подрядчика ────────────────────────
  const handleCta = useCallback(() => {
    if (ctaState === "loading" || phoneChecking) return;

    // Ветка проверки телефона: активна, только когда выбран «Ozon Банк»
    // и gate включён. Поле НЕ является источником disabled — кнопка живая.
    if (phoneGateActive) {
      if (phoneDigits.length === 0) {
        setPhoneError("empty");
        setPhoneFocusSignal((n) => n + 1);
        return;
      }
      if (phoneDigits.length < 10) {
        // Ошибка формата ≠ результат проверки: показываем только формат.
        setPhoneError("incomplete");
        setPhoneFocusSignal((n) => n + 1);
        return;
      }

      setPhoneError(null);
      setPhoneChecking(true);
      track("phone_check_started", { ...base, method_id: OZON_METHOD_ID });

      later(() => {
        setPhoneChecking(false);
        if (phoneDigits === notClientDigits) {
          setPhoneError("not_client");
          setPhoneFocusSignal((n) => n + 1);
          track("phone_check_result", {
            ...base,
            method_id: OZON_METHOD_ID,
            result: "not_client",
          });
          return;
        }
        // Успех: кнопка → терминальное «Отправили push», и пуш ПОЯВЛЯЕТСЯ
        // ОДНОВРЕМЕННО. Кнопка называет результат (push отправлен), а не
        // обещает открытие банка: банк откроет тап по push, не кнопка.
        track("phone_check_result", {
          ...base,
          method_id: OZON_METHOD_ID,
          result: "client",
        });
        setCtaState("sent");
        track("handoff_started", { ...base, method_id: OZON_METHOD_ID });
        setStage("push");
      }, phoneGate.check_ms);
      return;
    }

    // Gate выключен, но выбран «Ozon Банк»: тот же терминальный статус и push.
    if (selected === OZON_METHOD_ID) {
      setCtaState("sent");
      track("handoff_started", { ...base, method_id: OZON_METHOD_ID });
      later(() => setStage("push"), timings.push_delay_ms);
      return;
    }

    // Выбран не «Ozon Банк». Демо не реализует другие платёжные рельсы и не
    // притворяется, что открывает Ozon Банк: кнопка не меняет состояние.
    // Единственный доводимый до конца сценарий демо — оплата через Ozon Банк.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    ctaState,
    phoneChecking,
    phoneGateActive,
    phoneDigits,
    notClientDigits,
    phoneGate.check_ms,
    selected,
    timings.push_delay_ms,
    tenant.tenant_id,
    tenant.archetype,
  ]);

  // ── Шаг 2: пуш ─────────────────────────────────────────────────────
  const handlePushOpen = useCallback(() => {
    setStage("splash");
    track("handoff_shown", { ...base, method_id: OZON_METHOD_ID });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant.tenant_id, tenant.archetype]);

  /** Свайп вверх: пуш уходит, пользователь остаётся у подрядчика. */
  const handlePushDismiss = useCallback(() => {
    setStage("contractor");
    setCtaState("default");
    // Архетип B: возврат к экрану подписки, где выбор заменён навигацией.
    if (tenant.archetype === "subscription_payment") setSelected(null);
    track("handoff_returned", { ...base, method_id: selected });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, tenant.tenant_id, tenant.archetype]);

  // ── Шаг 4: оплата в банке ──────────────────────────────────────────
  const handlePay = useCallback(() => {
    if (bankLoading) return;
    setBankLoading(true);
    track("bank_payment_started", { ...base, method_id: OZON_METHOD_ID });
    later(() => {
      setBankLoading(false);
      setStage("bank_success");
      track("bank_payment_succeeded", { ...base, method_id: OZON_METHOD_ID });
    }, timings.pay_loading_ms);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bankLoading, timings.pay_loading_ms, tenant.tenant_id, tenant.archetype]);

  /** Отмена по «×»: возврат к подрядчику БЕЗ оплаты, выбор сохранён. */
  const handleCancel = useCallback(() => {
    clearTimers();
    setBankLoading(false);
    setStage("contractor");
    setCtaState("default");
    track("bank_payment_cancelled", { ...base, method_id: OZON_METHOD_ID });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearTimers, tenant.tenant_id, tenant.archetype]);

  // ── Шаг 5→6: возврат к подрядчику ──────────────────────────────────
  const handleReturn = useCallback(() => {
    setStage("paid");
    track("returned_to_contractor", { ...base, method_id: OZON_METHOD_ID });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant.tenant_id, tenant.archetype]);

  /** «Начать сначала»: сброс демо без перезагрузки страницы. */
  const handleRestart = useCallback(() => {
    clearTimers();
    setBankLoading(false);
    setCtaState("default");
    setSelected(tenant.payment_list.default_selected);
    // Проверка телефона сбрасывается полностью: цифры стираются.
    setPhoneDigits("");
    setPhoneError(null);
    setPhoneChecking(false);
    setStage("contractor");
    track("demo_restarted", { ...base, method_id: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    clearTimers,
    tenant.payment_list.default_selected,
    tenant.tenant_id,
    tenant.archetype,
  ]);

  const phoneGateSlot: PhoneGateSlot | null = phoneGate.enabled
    ? {
        expanded: selected === OZON_METHOD_ID,
        digits: phoneDigits,
        error: phoneError,
        checking: phoneChecking,
        onChange: handlePhoneChange,
        onSubmit: handleCta,
        focusSignal: phoneFocusSignal,
      }
    : null;

  // Единственное «loading»-состояние кнопки — проверка номера: постоянного
  // «Открываем Ozon Банк…» больше нет, его сменил терминальный `sent`.
  const ctaLoadingLabel = COPY["cta.checking"];
  const ctaSentLabel = COPY["cta.sent"];

  const screenProps = {
    tenant,
    selectedMethod: selected,
    onSelectMethod: handleSelect,
    ctaState: phoneChecking ? ("loading" as ButtonState) : ctaState,
    ctaLoadingLabel,
    ctaSentLabel,
    onCta: handleCta,
    forcedState,
    phoneGate: phoneGateSlot,
  };

  // Билетный архетип наследует ПОВЕДЕНИЕ архетипа A (инлайн-выбор способа,
  // проверка телефона под рядом методов) и расходится с ним только раскладкой
  // экрана — поэтому ветвление по поведению выше трогать не пришлось.
  const contractorScreen =
    tenant.archetype === "subscription_payment" ? (
      <SubscriptionPaymentScreen {...screenProps} />
    ) : tenant.archetype === "ticket_checkout" ? (
      <TicketCheckoutScreen {...screenProps} />
    ) : (
      <CartCheckoutScreen {...screenProps} />
    );

  // Отдельный экран «Оплата через Ozon Банк» — только архетип B.
  const railScreen = (
    <OzonRailScreen
      tenant={tenant}
      ctaState={screenProps.ctaState}
      ctaLoadingLabel={ctaLoadingLabel}
      ctaSentLabel={ctaSentLabel}
      onCta={handleCta}
      onBack={handleOzonRailBack}
      phoneGate={phoneGateSlot}
    />
  );

  /*
   * Пуш — НЕ отдельный экран, а слой поверх того, где пользователь стоит.
   *
   * Раньше `push` был обычной стадией `AnimatePresence`: смена ключа сносила
   * экран подрядчика и монтировала его заново как подложку. Новый DOM-узел
   * скролл-контейнера приходит с `scrollTop = 0` — отсюда первый рывок
   * «страница уехала вверх» (а следом второй: свежий блок телефона считал
   * себя только что раскрытым и тянул страницу обратно к полю).
   *
   * Поэтому подложка пуша — это ТА ЖЕ САМАЯ стадия, что была до него:
   * ключ `AnimatePresence` не меняется, компонент не размонтируется,
   * позиция прокрутки остаётся ровно там, где её оставил пользователь.
   * Для B за пушем стоит `ozon_rail` (его кнопка уже «Отправили push»),
   * для A — экран подрядчика. Смена айдентики наступает на самом пуше.
   */
  const backdropStage: DemoStage =
    tenant.archetype === "subscription_payment" ? "ozon_rail" : "contractor";
  const pushOpen = stage === "push";
  const visualStage: DemoStage = pushOpen ? backdropStage : stage;

  // Содержимое одной стадии. Обёртывается в motion.div снаружи, поэтому сама
  // возвращает готовый экран. Стадии `push` здесь нет намеренно: баннер живёт
  // отдельным слоем и анимируется собственным spring-выездом.
  const renderStage = (current: DemoStage) => {
    switch (current) {
      case "contractor":
        return contractorScreen;
      case "ozon_rail":
        return railScreen;
      case "splash":
        return <BankSplashScreen dotsCycleMs={timings.dots_cycle_ms} />;
      case "bank_payment":
        return (
          <BankPaymentScreen
            payload={bankPayload}
            loading={bankLoading}
            onPay={handlePay}
            onClose={handleCancel}
          />
        );
      case "bank_success":
        return <BankSuccessScreen payload={bankPayload} onReturn={handleReturn} />;
      case "paid":
        return (
          <PaidConfirmationScreen
            tenant={tenant}
            payload={bankPayload}
            onRestart={handleRestart}
          />
        );
      default:
        return null;
    }
  };

  return (
    <PhoneFrame
      vars={theme.vars}
      tenantId={tenant.tenant_id}
      archetype={tenant.archetype}
      a11yMode={tenant.a11y_mode}
      stage={stage}
    >
      {/*
        Межэкранный motion. `initial={false}` — при прямом заходе на любую
        стадию (deep-link для съёмки и тестов) экран появляется БЕЗ анимации,
        поэтому метрики раскладки, снятые сразу после загрузки, не искажены
        transform'ом. Анимируются только переходы ВНУТРИ сессии.
      */}
      {/*
        `sync` для всех переходов: банк-шиты обязаны выезжать ПОВЕРХ подложки
        (наложение нужно), а stack-переход подрядчика решает конфликт testid
        мгновенным уходом старого экрана (см. exit в stage-motion.ts). `wait`
        не используется намеренно: он залипает под prefers-reduced-motion, когда
        exit-анимация нечего анимировать и не завершается.
      */}
      <AnimatePresence initial={false} mode="sync" custom={transitionType}>
        <motion.div
          key={visualStage}
          custom={transitionType}
          variants={stageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          // Пока висит баннер, экран под ним скрыт от screen reader: озвучивать
          // положено пуш, а не подложку. Это АТРИБУТ на уже смонтированном
          // узле — ни перерисовки, ни сброса прокрутки он не вызывает.
          aria-hidden={pushOpen || undefined}
          className="absolute inset-0"
          style={{ willChange: "transform" }}
        >
          {renderStage(visualStage)}
        </motion.div>
      </AnimatePresence>

      {/*
        Слой пуша — сосед стадийного слоя, а не его содержимое: он переживает
        смену подложки и не участвует в межэкранном motion.
      */}
      {pushOpen && (
        <PushBanner
          merchant={bankPayload.merchant}
          amount={bankPayload.amount}
          onOpen={handlePushOpen}
          onDismiss={handlePushDismiss}
        />
      )}

      {handoff && (
        <HandoffOverlay
          onBack={() => {
            setHandoff(false);
            setCtaState("default");
          }}
        />
      )}
    </PhoneFrame>
  );
}
