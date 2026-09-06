import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
} from "react";
import { AnimatePresence, m } from "framer-motion";

import { HandoffOverlay } from "@demo/components/HandoffOverlay";
import { PhoneFrame } from "@demo/components/PhoneFrame";
import type { PhoneGateError } from "@demo/components/PhoneGateBlock";
import type { ButtonState } from "@demo/components/PrimaryButton";
import { PushBanner } from "@demo/components/bank/PushBanner";
import { COPY, formatMoney } from "@demo/content/copy";
import { track } from "@demo/lib/analytics";
import type { BuiltTheme } from "@demo/theme/build-theme";
import {
  OZON_LABEL,
  OZON_METHOD_ID,
  type TenantConfig,
} from "@demo/theme/tenant.schema";
import { BankPaymentScreen } from "./BankPaymentScreen";
import { BankSplashScreen } from "./BankSplashScreen";
import { BankSuccessScreen } from "./BankSuccessScreen";
import { AppSplashScreen } from "./AppSplashScreen";
import { CarrierPaymentScreen } from "./CarrierPaymentScreen";
import { HomeScreen } from "./HomeScreen";
import { OzonRailScreen } from "./OzonRailScreen";
import { PaidConfirmationScreen } from "./PaidConfirmationScreen";
import type { DemoStage } from "./demo-flow";
import { stageVariants, transitionFor } from "./stage-motion";
import type { ForcedState, PhoneGateSlot, ScreenProps } from "./screen-props";

/*
 * Экраны подрядчика грузятся ПО ТРЕБОВАНИЮ, а не все разом.
 *
 * Подрядчик открывает ОДНУ свою ссылку и видит ОДИН экран, чаще всего с
 * телефона по мобильной сети, — а до этой правки бандл вёз все двенадцать:
 * 375 КБ из 695 приходились на `src/views/`. Тринадцать доноров означают
 * тринадцать самостоятельных вёрсток, и дальше их будет больше, поэтому
 * цена статического импорта растёт с каждой темой.
 *
 * Таблица остаётся ТАБЛИЦЕЙ (`Record<archetype, …>`): компилятор по-прежнему
 * требует экран для каждого значения enum, забыть новый архетип нельзя.
 * Экраны банка, пуш и подтверждение статичны намеренно — они общие для всех
 * тем, идут сразу за экраном подрядчика и в сумме много меньше.
 */
/**
 * Загрузчики экранов подрядчика.
 *
 * Раньше здесь сразу стоял `lazy(...)`, и достать сам импорт было нечем.
 * Теперь фабрики живут отдельно, потому что их нужно уметь вызывать
 * ЗАРАНЕЕ: у темы, которая начинается с домашнего экрана, чанк экрана
 * тянулся в момент показа — и первые 300 мс после заставки под ней висел
 * пустой фон, а контент вставал рывком. Заставка на то и стоит, чтобы за её
 * время экран догрузился.
 */
const CONTRACTOR_LOADERS: Record<
  TenantConfig["archetype"],
  () => Promise<{ default: ComponentType<ScreenProps> }>
> = {
  cart_checkout: () =>
    import("./CartCheckoutScreen").then((m) => ({ default: m.CartCheckoutScreen })),
  subscription_payment: () =>
    import("./SubscriptionPaymentScreen").then((m) => ({
      default: m.SubscriptionPaymentScreen,
    })),
  ticket_checkout: () =>
    import("./TicketCheckoutScreen").then((m) => ({ default: m.TicketCheckoutScreen })),
  store_checkout: () =>
    import("./StoreCheckoutScreen").then((m) => ({ default: m.StoreCheckoutScreen })),
  plan_sheet: () =>
    import("./PlanSheetScreen").then((m) => ({ default: m.PlanSheetScreen })),
  order_steps: () =>
    import("./OrderStepsScreen").then((m) => ({ default: m.OrderStepsScreen })),
  slot_delivery: () =>
    import("./SlotDeliveryScreen").then((m) => ({ default: m.SlotDeliveryScreen })),
  bonus_checkout: () =>
    import("./BonusCheckoutScreen").then((m) => ({ default: m.BonusCheckoutScreen })),
  pickup_checkout: () =>
    import("./PickupCheckoutScreen").then((m) => ({ default: m.PickupCheckoutScreen })),
  carrier_delivery: () =>
    import("./CarrierDeliveryScreen").then((m) => ({ default: m.CarrierDeliveryScreen })),
  order_prepay: () =>
    import("./OrderPrepayScreen").then((m) => ({ default: m.OrderPrepayScreen })),
  subscription_bind: () =>
    import("./SubscriptionBindScreen").then((m) => ({ default: m.SubscriptionBindScreen })),
  subscription_card: () =>
    import("./SubscriptionCardScreen").then((m) => ({ default: m.SubscriptionCardScreen })),
};

/*
 * Таблица остаётся ТАБЛИЦЕЙ: компилятор по-прежнему требует запись для
 * каждого архетипа — она проверяется на `CONTRACTOR_LOADERS` выше, — а
 * `lazy` навешивается на готовые загрузчики.
 */
const CONTRACTOR_SCREENS = Object.fromEntries(
  Object.entries(CONTRACTOR_LOADERS).map(([archetype, load]) => [archetype, lazy(load)]),
) as unknown as Record<TenantConfig["archetype"], ComponentType<ScreenProps>>;

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
      : // Тема с `demo.entry="home"` начинается на домашнем экране
        // устройства: форму подрядчика откроет уведомление о счёте.
        // Forced-состояния к нему не относятся — они описывают форму,
        // и заход по ним начинается сразу с неё.
        tenant.demo.entry === "home" && forcedState === null && !showHandoff
        ? "home"
        : "contractor");
  const [stage, setStage] = useState<DemoStage>(startStage);
  const [bankLoading, setBankLoading] = useState(false);
  const [amountOverride, setAmountOverride] = useState<number | null>(null);
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
  /*
   * Домашний экран стоит ровно столько, чтобы его успели заметить, и сам
   * отдаёт кадр уведомлению. Пауза — `push_delay_ms`, та же, что перед
   * пушем платежа: это одно и то же ожидание «сейчас придёт уведомление».
   * Раньше здесь стояла длительность splash — и когда splash удлинили ради
   * сборки знака, вместе с ним удлинилось ожидание первого пуша, хотя к
   * нему это отношения не имеет.
   */
  const [homePushSeen, setHomePushSeen] = useState(false);
  useEffect(() => {
    if (stage !== "home" || homePushSeen) return;
    const id = window.setTimeout(() => {
      setHomePushSeen(true);
      setStage("home_push");
    }, timings.push_delay_ms);
    return () => window.clearTimeout(id);
  }, [stage, homePushSeen, timings.push_delay_ms]);

  /*
   * Кадры до формы — время, за которое её чанк обязан приехать. Иначе
   * заставка растворяется в пустой фон, а контент встаёт рывком уже после
   * неё: замер показывал ~280 мс пустого кадра под уходящей заставкой.
   */
  useEffect(() => {
    if (stage !== "home" && stage !== "home_push" && stage !== "app_splash") return;
    void CONTRACTOR_LOADERS[tenant.archetype]();
  }, [stage, tenant.archetype]);

  /*
   * Готовность экрана под заставкой: включается к концу сборки знака, когда
   * на кадре уже ничего не движется.
   */
  const [splashWarm, setSplashWarm] = useState(false);
  useEffect(() => {
    if (stage !== "app_splash") {
      setSplashWarm(false);
      return;
    }
    const id = window.setTimeout(() => setSplashWarm(true), 1150);
    return () => window.clearTimeout(id);
  }, [stage]);

  /** Splash приложения живёт столько же, сколько splash банка. */
  useEffect(() => {
    if (stage !== "app_splash") return;
    const id = window.setTimeout(() => setStage("contractor"), timings.splash_ms);
    return () => window.clearTimeout(id);
  }, [stage, timings.splash_ms]);

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

    /*
     * Двухшаговый чекаут донора EWA: с экрана доставки кнопка «Оформить
     * заказ» НИЧЕГО не оплачивает — она ведёт на его страницу оплаты, где
     * стоит сетка способов и живёт проверка телефона. Ветка стоит первой:
     * на экране доставки способ оплаты не выбран в принципе, и без неё
     * кнопка упала бы в ветку «gate выключен» и увела бы прямо в push.
     */
    if (tenant.archetype === "carrier_delivery" && stage === "contractor") {
      setStage("ozon_rail");
      return;
    }

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

  // ── Шаг 0: уведомление о счёте на домашнем экране ──────────────────
  const homePush = tenant.content.home_push;

  /**
   * Тап по уведомлению открывает ПРИЛОЖЕНИЕ сервиса: сначала его splash,
   * потом карточка подписки. Без splash переход читался мгновенной подменой
   * экрана, а приложение всё-таки запускается.
   */
  const handleHomePushOpen = useCallback(() => {
    setStage(homePush?.app_icon ? "app_splash" : "contractor");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homePush?.app_icon]);

  /** Свайп вверх: уведомление убрано, пользователь остался на домашнем. */
  const handleHomePushDismiss = useCallback(() => {
    setStage("home");
  }, []);

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

  /*
   * Сумма платежа по умолчанию берётся из темы, но экран с несколькими
   * тарифами вправе её уточнить: цена выбранного тарифа обязана быть той же
   * на шторке, на экранах банка и в подтверждении. Инвариант сквозной суммы
   * при этом сохраняется — источник по-прежнему один, просто выбранный.
   */
  const payload =
    amountOverride === null || amountOverride === bankPayload.amountKopecks
      ? bankPayload
      : {
          ...bankPayload,
          amountKopecks: amountOverride,
          amount: formatMoney(amountOverride),
        };

  const screenProps = {
    tenant,
    selectedMethod: selected,
    onSelectAmount: setAmountOverride,
    onSelectMethod: handleSelect,
    ctaState: phoneChecking ? ("loading" as ButtonState) : ctaState,
    ctaLoadingLabel,
    ctaSentLabel,
    onCta: handleCta,
    forcedState,
    phoneGate: phoneGateSlot,
  };

  /*
   * Экран подрядчика по архетипу — ТАБЛИЦА, а не цепочка ветвлений.
   *
   * Разница не в стиле: у цепочки был хвост `: (<CartCheckoutScreen/>)`, и
   * новый архетип, забытый в ней, молча получал корзину Flowwow вместо своего
   * экрана — расхождение, которое не ловил ни компилятор, ни приёмка. Здесь
   * `Record<archetype, …>` заставляет компилятор потребовать экран для каждого
   * значения enum: забыть нельзя, сборка не пройдёт.
   *
   * Билетный архетип наследует ПОВЕДЕНИЕ архетипа A (инлайн-выбор способа,
   * проверка телефона под рядом методов) и расходится с ним только раскладкой
   * экрана — поэтому ветвление по поведению выше таблицы не касается.
   */
  const ContractorScreen = CONTRACTOR_SCREENS[tenant.archetype];
  const contractorScreen = <ContractorScreen {...screenProps} />;

  // Отдельный экран «Оплата через Ozon Банк» — только архетип B.
  const railScreen =
    tenant.archetype === "carrier_delivery" ? (
      /*
       * У этого донора оплата — ОТДЕЛЬНАЯ СТРАНИЦА чекаута, а не экран одного
       * способа: стадия `ozon_rail` несёт его собственную сетку выбора, куда
       * «Ozon Банк» встаёт первой карточкой из пяти.
       */
      <CarrierPaymentScreen
        tenant={tenant}
        selectedMethod={screenProps.selectedMethod}
        onSelectMethod={screenProps.onSelectMethod}
        ctaState={screenProps.ctaState}
        ctaLoadingLabel={ctaLoadingLabel}
        ctaSentLabel={ctaSentLabel}
        onCta={handleCta}
        onBack={handleOzonRailBack}
        phoneGate={phoneGateSlot}
      />
    ) : (
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
    stage === "home_push"
      ? // Уведомление о счёте приходит на домашний экран, а не к подрядчику:
        // подрядчик за ним ещё не открыт.
        "home"
      : tenant.archetype === "subscription_payment" ||
          tenant.archetype === "carrier_delivery"
        ? "ozon_rail"
        : "contractor";
  const pushOpen = stage === "push" || stage === "home_push";
  const visualStage: DemoStage = pushOpen ? backdropStage : stage;

  // Содержимое одной стадии. Обёртывается в m.div снаружи, поэтому сама
  // возвращает готовый экран. Стадии `push` здесь нет намеренно: баннер живёт
  // отдельным слоем и анимируется собственным spring-выездом.
  const renderStage = (current: DemoStage) => {
    switch (current) {
      case "home":
        return (
          <>
            {/*
             * Экран приложения монтируется ЗДЕСЬ — на кадре с уведомлением,
             * пока ничего не движется. Раньше он монтировался вместе с
             * выездом заставки, и первый рендер тяжёлого экрана съедал кадры
             * ровно во время движения. Скрытый слой не виден, не читается
             * диктором и не ловит касания.
             */}
            {stage === "home_push" && homePush?.app_icon ? (
              /*
               * СВОЙ Suspense с пустой заглушкой. Без него ленивый экран
               * подвешивал ВЕСЬ стадийный слой, и общая заглушка (заставка
               * приложения) на секунду накрывала домашний экран — кадр
               * регресса поймал это раньше человека.
               */
              <Suspense fallback={null}>
                <div
                  aria-hidden
                  className="absolute inset-0"
                  style={{ visibility: "hidden", pointerEvents: "none" }}
                >
                  {contractorScreen}
                </div>
              </Suspense>
            ) : null}
          <HomeScreen
            appName={homePush?.app_name ?? tenant.display_name}
            appMark={tenant.display_name.slice(0, 1)}
            appIcon={homePush?.app_icon ?? null}
            bankName={OZON_LABEL}
          />
          </>
        );
      case "contractor":
        return contractorScreen;
      case "ozon_rail":
        return railScreen;
      case "app_splash":
        if (!homePush?.app_icon) return null;
        /*
         * Под заставкой СРАЗУ монтируется экран приложения — скрытым.
         *
         * Иначе `lazy` разрешается только в момент перехода, и первые ~300 мс
         * после растворения заставки Suspense держит заглушку: экран вставал
         * рывком уже после того, как заставка ушла (замер: fallback жил
         * 1200→1490 мс при переходе с 1190). Предзагрузка чанка этого не
         * лечит — ждать заставку заставляет первый РЕНДЕР ленивого
         * компонента, а не сеть.
         *
         * Скрытый слой не читается диктором и не ловит касания: для
         * пользователя на этом кадре есть только заставка.
         */
        return (
          <>
            {/*
             * Экран под заставкой монтируется НЕ сразу: на выезде заставки и
             * во время сборки знака кадры заняты, и маунт тяжёлого экрана
             * ровно там давал рывок на живом телефоне. К 1.15 с движение
             * закончилось, до перехода остаётся запас.
             */}
            {splashWarm ? (
              <Suspense fallback={null}>
                <div
                  aria-hidden
                  className="absolute inset-0"
                  style={{ visibility: "hidden", pointerEvents: "none" }}
                >
                  {contractorScreen}
                </div>
              </Suspense>
            ) : null}
            <AppSplashScreen name={homePush.app_name} />
          </>
        );
      case "splash":
        return <BankSplashScreen dotsCycleMs={timings.dots_cycle_ms} />;
      case "bank_payment":
        return (
          <BankPaymentScreen
            payload={payload}
            loading={bankLoading}
            onPay={handlePay}
            onClose={handleCancel}
          />
        );
      case "bank_success":
        return <BankSuccessScreen payload={payload} onReturn={handleReturn} />;
      case "paid":
        return (
          <PaidConfirmationScreen
            tenant={tenant}
            payload={payload}
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
        Межэкранный m. `initial={false}` — при прямом заходе на любую
        стадию (deep-link для съёмки и тестов) экран появляется БЕЗ анимации,
        поэтому метрики раскладки, снятые сразу после загрузки, не искажены
        transform'ом. Анимируются только переходы ВНУТРИ сессии.
      */}
      {/*
        `sync` для всех переходов: банк-шиты обязаны выезжать ПОВЕРХ подложки
        (наложение нужно), а stack-переход подрядчика решает конфликт testid
        мгновенным уходом старого экрана (см. exit в stage-m.ts). `wait`
        не используется намеренно: он залипает под prefers-reduced-motion, когда
        exit-анимация нечего анимировать и не завершается.
      */}
      <AnimatePresence initial={false} mode="sync" custom={transitionType}>
        <m.div
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
          {/*
            Экран подрядчика приезжает отдельным чанком, поэтому первый кадр
            ждёт его загрузки. Заглушка ПУСТАЯ и в цвет фона темы: спиннер на
            десяток миллисекунд читался бы как «демо тормозит», а белая
            вспышка — как мигание при переходе.
          */}
          <Suspense
            fallback={
              /*
               * Пока чанк экрана не отрисован, у темы с заставкой держится
               * ЗАСТАВКА, а не пустой фон. Иначе она растворялась в белое
               * поле, и интерфейс вставал рывком уже после перехода: замер
               * показывал ~290 мс пустого кадра. Чанк к этому моменту давно
               * загружен (предзагрузка выше), но первый рендер `lazy`
               * всё равно проходит через Suspense.
               */
              homePush ? (
                <div className="absolute inset-0">
                  <AppSplashScreen name={homePush.app_name} />
                </div>
              ) : (
                <div
                  className="absolute inset-0"
                  style={{ background: "var(--t-surface-background)" }}
                />
              )
            }
          >
            {renderStage(visualStage)}
          </Suspense>
        </m.div>
      </AnimatePresence>

      {/*
        Слой пуша — сосед стадийного слоя, а не его содержимое: он переживает
        смену подложки и не участвует в межэкранном m.
      */}
      {pushOpen && (
        <PushBanner
          merchant={payload.merchant}
          amount={payload.amount}
          // Уведомление о счёте и уведомление о платеже — один компонент и
          // одна айдентика банка, но разные строки: первое зовёт оплатить,
          // второе просит подтвердить уже начатый платёж.
          title={stage === "home_push" ? homePush?.title : undefined}
          body={stage === "home_push" ? homePush?.body : undefined}
          appName={stage === "home_push" ? homePush?.app_name : undefined}
          appIcon={stage === "home_push" ? homePush?.app_icon : undefined}
          onOpen={stage === "home_push" ? handleHomePushOpen : handlePushOpen}
          onDismiss={stage === "home_push" ? handleHomePushDismiss : handlePushDismiss}
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
