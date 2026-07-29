import { z } from "zod";

import { isHexColor } from "./color";

/**
 * Контракт `tenant.json`.
 *
 * Источник: `design-brief.md` → Tenant Contract, с обязательными поправками
 * из `figma-layout-ir.json` → `tenant_contract_corrections` (10 позиций).
 *
 * Принцип: конфиг либо валиден, либо загрузка падает с внятным сообщением.
 * Молчаливых фолбэков нет — значение вне диапазона это ошибка, а не повод
 * тихо подставить ближайшую границу.
 */

const hex = (label: string) =>
  z
    .string()
    .refine(isHexColor, { message: `${label}: ожидается hex-цвет вида #RRGGBB` });

const hexOrNull = (label: string) => hex(label).nullable();

/** Кламп с явным сообщением: почему граница именно такая. */
const clamped = (label: string, min: number, max: number, reason: string) =>
  z
    .number()
    .int()
    .min(min, { message: `${label}: минимум ${min} (${reason})` })
    .max(max, { message: `${label}: максимум ${max} (${reason})` });

const radiusValue = (label: string, min: number, max: number) =>
  z.union([
    clamped(label, min, max, "кламп формы из Readability Guarantees §4"),
    z.literal("pill"),
  ]);

export const paymentMethodSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  caption: z.string().nullable().default(null),
  logo: z.enum(["slot", "none"]).default("none"),
});

export const detailRowSchema = z.object({
  label: z.string().min(1),
  label_compact: z.string().nullable().default(null),
  value: z.string().min(1),
  /** true → значение это действие («Добавить»), а не данные. */
  is_action: z.boolean().default(false),
});

export const choiceOptionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  caption: z.string().nullable().default(null),
  price: z.string().nullable().default(null),
  /** Прибавка к итогу в копейках, если вариант выбран. */
  price_delta: z.number().int().min(0).default(0),
});

export const lineItemSchema = z.object({
  title: z.string().min(1),
  period: z.string().nullable().default(null),
  price: z.string().min(1),
  old_price: z.string().nullable().default(null),
  media: z.boolean().default(true),
});

export const totalsSchema = z.object({
  sum: z.number().int().min(0),
  discount: z.number().int().min(0).default(0),
  currency: z.literal("RUB").default("RUB"),
});

export const tenantSchema = z.object({
  // ── Идентификация ───────────────────────────────────────────────────
  tenant_id: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
      message: "tenant_id: ожидается kebab-case",
    }),
  display_name: z.string().min(1),
  archetype: z.enum([
    "cart_checkout",
    "subscription_payment",
    "ticket_checkout",
    "store_checkout",
  ]),

  // Нативной оболочки (статус-бар, home indicator) в контракте больше нет:
  // демо — веб-страница, системный хром рисует устройство.

  // ── Шапка экрана ────────────────────────────────────────────────────
  header: z
    .object({
      style: z.enum(["back_title", "centered_logo"]),
      back_label: z.string().nullable().default(null),
    })
    .strict(),

  // ── Бренд ───────────────────────────────────────────────────────────
  brand: z.object({
    primary: hex("brand.primary"),
    on_primary: z.union([z.literal("auto"), hex("brand.on_primary")]).default("auto"),
    accent: hexOrNull("brand.accent").default(null),
    /**
     * Мягкая подложка бренда: заливка ВЫБРАННОЙ строки способа оплаты.
     *
     * У донора она измеряется пипеткой, а не выводится: VOROH в тёмной теме
     * заливает выбранную строку `#E9EBF1`, в светлой `#021231` — то есть
     * инвертирует фон, а не осветляет бренд. Пока поле вычислялось всегда,
     * такое значение задать было нечем, и тёмная тема получала розовое пятно.
     *
     * `null` (дефолт) — значение у донора не измерено: подложка считается
     * формулой от светлоты `surface.background` (стоп `brand.20` на светлой
     * поверхности, `brand.90` на тёмной). Цвет содержимого подложки —
     * текст и галка — подбирается по контрасту в обоих случаях.
     */
    tonal: hexOrNull("brand.tonal").default(null),
    /**
     * Заливка выключенной главной кнопки.
     *
     * Ровно та же природа, что и `tonal`: у донора это измеримый цвет, а не
     * следствие формулы. `null` (дефолт) — считается от светлоты
     * `surface.background` (стоп `brand.30` на светлой, `brand.80` на тёмной).
     */
    disabled: hexOrNull("brand.disabled").default(null),
    /**
     * Расширение контракта: донор B использует шесть активных цветов
     * (ось темы 23). Сведение к «primary + серый» — анти-паттерн R7,
     * поэтому лавандовая пара и бирюзовая поддержка вынесены в тему.
     */
    secondary: z
      .object({ fill: hex("brand.secondary.fill"), text: hex("brand.secondary.text") })
      .nullable()
      .default(null),
    logo: z
      .object({
        kind: z.enum(["text", "slot"]).default("text"),
        text: z.string().nullable().default(null),
        slot_ratio: z.string().nullable().default(null),
      })
      .default({ kind: "text", text: null, slot_ratio: null }),
  }),

  // ── Поверхности и текст ─────────────────────────────────────────────
  surface: z.object({
    background: hex("surface.background").default("#FFFFFF"),
    card: hex("surface.card").default("#FFFFFF"),
    form: z.union([z.literal("auto"), hex("surface.form")]).nullable().default(null),
    border: hex("surface.border").default("#E5E5E7"),
    divider: hex("surface.divider").default("#DDDDDD"),
    text_primary: hex("surface.text_primary").default("#1A1A1A"),
    text_secondary: hex("surface.text_secondary").default("#6B6B70"),
    danger: hex("surface.danger").default("#D92D20"),
    /** Поправка №9: у донора B цвет ошибки поля не равен бренду. */
    field_error: hex("surface.field_error").default("#D4311E"),
  }),

  // ── Модель возвышения ───────────────────────────────────────────────
  elevation: z
    .object({
      model: z.enum(["flat_outline", "tonal_fill", "shadow"]).default("flat_outline"),
      border_width: z.number().min(1).max(2).default(1),
      selected_border_width: z.number().min(1).max(3).default(1.5),
      shadow: z
        .object({ y: z.number(), blur: z.number(), alpha: z.number().min(0).max(1) })
        .nullable()
        .default(null),
    })
    .default({
      model: "flat_outline",
      border_width: 1,
      selected_border_width: 1.5,
      shadow: null,
    }),

  // ── Форма ───────────────────────────────────────────────────────────
  /*
   * Нижняя граница радиусов снята до нуля решением владельца 2026-07-29.
   *
   * Прежний порог 8 защищал от «случайного нуля» — темы, где скругление
   * забыли задать. Но у минималистичных доноров (MONOCHROME: 1px) жёсткий
   * угол это не забывчивость, а ядро айдентики, и кламп до 8 стирал ровно
   * то, по чему подрядчик узнаёт свой сайт. Верхние границы остались: они
   * ловят другую ошибку — «детскую» пересглаженность.
   */
  radius: z.object({
    card: clamped("radius.card", 0, 24, "> 24 читается как детская игра"),
    control: radiusValue("radius.control", 0, 28),
    field: clamped("radius.field", 0, 16, "кламп формы"),
    chip: radiusValue("radius.chip", 0, 999),
    allow_inversion: z.boolean().default(false),
  }),

  // ── Плотность ───────────────────────────────────────────────────────
  density: z.object({
    page_padding: clamped(
      "density.page_padding",
      12,
      24,
      "< 12 текст липнет к краю, > 24 контент теряет ширину на 320 px",
    ),
    block_gap: clamped("density.block_gap", 4, 20, "кламп плотности"),
    row_height: clamped("density.row_height", 44, 64, "44 — нижняя граница зоны нажатия"),
    /** Поправка №1: кламп опущен с 48 до 44 — измеренное значение донора B = 46. */
    control_height: clamped(
      "density.control_height",
      44,
      60,
      "44 — нижняя граница зоны нажатия",
    ),
    method_button_height: clamped(
      "density.method_button_height",
      44,
      60,
      "44 — нижняя граница зоны нажатия",
    ).nullable().default(null),
    section_gap: clamped("density.section_gap", 8, 28, "кламп плотности"),
  }),

  /** Поправка №10: два разных токена ширины, а не единые 44 %. */
  component_width: z
    .object({
      choice_card_pct: clamped("component_width.choice_card_pct", 24, 60, "доля вьюпорта"),
      payment_card_pct: clamped("component_width.payment_card_pct", 24, 60, "доля вьюпорта"),
    })
    .default({ choice_card_pct: 42, payment_card_pct: 32 }),

  // ── Типографика ─────────────────────────────────────────────────────
  typography: z.object({
    /*
     * Нижние границы кеглей и веса заголовка опущены до донорских решением
     * владельца 2026-07-29 — вслед за порогом радиусов и по той же причине:
     * у минималистичных доноров мелкий кегль и лёгкий заголовок это не
     * небрежность, а способ высказывания, и кламп стирал именно его. Порог
     * зоны нажатия (44) при этом НЕ трогается: он про попадание пальцем, а
     * не про плотность текста.
     */
    family: z.enum(["system", "rounded", "grotesk"]).default("system"),
    body: clamped("typography.body", 13, 18, "кегль тела"),
    h1: clamped("typography.h1", 16, 32, "кегль H1"),
    section_title: clamped("typography.section_title", 15, 24, "кегль заголовка секции"),
    caption: clamped("typography.caption", 11, 14, "кегль подписи"),
    label_weight: clamped("typography.label_weight", 400, 700, "вес label"),
    title_weight: clamped("typography.title_weight", 500, 800, "вес заголовка"),
  }),

  // ── Главная кнопка ──────────────────────────────────────────────────
  cta: z.object({
    placement: z.enum(["sticky", "inline"]),
    label: z.string().min(1),
    include_amount: z.boolean().default(false),
    /**
     * Разрешение противоречия внутри `screens.md`: зона 6 экрана B описывает
     * состояние `disabled` как стартовое, зона 9 объясняет, почему кнопка
     * активна изначально. Поведение вынесено в параметр вместо молчаливого
     * выбора одной из формулировок. Дефолт — донорский (кнопка активна).
     */
    requires_selection: z.boolean().default(false),
    /**
     * Типографика главной кнопки. Раньше была зашита 17/700 и не зависела от
     * донора: у минималиста кнопка набрана тем же кеглем, что заголовок
     * секции, и обычным весом — жирный крупный текст выдавал чужой шаблон.
     */
    font_size: clamped("cta.font_size", 13, 20, "кегль главной кнопки").default(17),
    font_weight: clamped("cta.font_weight", 400, 800, "вес главной кнопки").default(700),
  }),

  /**
   * Раскладка строк реквизитов. `row` — label и значение в одну строку по
   * краям (доноры Flowwow, Ozon). `stacked` — подпись серым НАД значением
   * (донор MONOCHROME). Ось структурная: при одинаковой палитре она сильнее
   * всего решает, читается экран как чужой шаблон или как свой сайт.
   */
  detail_rows: z
    .object({ layout: z.enum(["row", "stacked"]).default("row") })
    .prefault({}),

  // ── Список способов оплаты (точка вставки) ──────────────────────────
  payment_list: z.object({
    /**
     * `radio_rows` — строка с кружком выбора слева и подписью текстом, без
     * рамки и заливки (донор MONOCHROME). Плашка-кнопка на его странице
     * читается как чужой элемент: у донора выбор оплаты весит ровно столько
     * же, сколько строка адреса.
     */
    layout: z.enum(["horizontal_cards", "vertical_buttons", "radio_rows"]),
    /** Заголовок секции: у донора он может называться иначе, чем «Оплата». */
    section_title: z.string().nullable().default(null),
    selection: z.enum(["radio_outline", "row_press"]),
    methods: z.array(paymentMethodSchema),
    default_selected: z.string().nullable().default(null),
  }),

  // ── Наш способ оплаты ───────────────────────────────────────────────
  ozon: z
    .object({
      label: z.string(),
      position: z.number().int().min(1).default(1),
      adopts_tenant_theme: z.boolean().default(true),
      handoff: z.enum(["overlay", "full_screen"]).default("overlay"),
      /**
       * Проверка клиентства по номеру телефона (screens-phone-check.md).
       * Это параметры демо, а не оси темы: ни одного визуального токена.
       * При `enabled=true` выбор «Ozon Банк» раскрывает поле телефона;
       * проверка `check_ms` замещает прежнюю паузу `push_delay_ms`.
       */
      phone_gate: z
        .object({
          enabled: z.boolean().default(true),
          /** Демо-номер «не клиента»: ровно 10 цифр без «+7». */
          not_client_number: z.string().default("0000000000"),
          check_ms: z.number().int().min(300).max(1500).default(700),
        })
        .prefault({}),
    })
    .default({
      label: "Ozon Банк",
      position: 1,
      adopts_tenant_theme: true,
      handoff: "overlay",
      phone_gate: { enabled: true, not_client_number: "0000000000", check_ms: 700 },
    }),

  // ── Контент экрана ──────────────────────────────────────────────────
  content: z.object({
    title: z.string().min(1),
    back_link: z.string().nullable().default(null),
    segments: z
      .object({
        items: z.array(z.object({ id: z.string(), label: z.string() })),
        active: z.string(),
        badge: z.object({ on: z.string(), text: z.string() }).nullable().default(null),
      })
      .nullable()
      .default(null),
    rows: z.array(detailRowSchema).default([]),
    /** Адрес аккаунта под H1: у авторизованного донора он подписывает заказ. */
    account_email: z.string().nullable().default(null),
    /**
     * Секции заказа архетипа `store_checkout`: у донора реквизиты не плоский
     * список, а группы с заголовком капсом, галочкой готовности и своей
     * ссылкой правки. Галочка — не украшение: она и есть индикатор того, что
     * шаг заказа пройден.
     */
    sections: z
      .array(
        z.object({
          title: z.string().min(1),
          done: z.boolean().default(true),
          action_label: z.string().nullable().default(null),
          rows: z
            .array(
              z.object({
                label: z.string().nullable().default(null),
                value: z.string().min(1),
              }),
            )
            .default([]),
        }),
      )
      .default([]),
    /** Строка-вопрос про подарочный сертификат перед списком оплаты. */
    gift_certificate: z.string().nullable().default(null),
    /** Юридическая сноска над кнопкой: у донора она капсом и мелким кеглем. */
    legal_note: z.string().nullable().default(null),
    /**
     * Блок корзины ПОД кнопкой оплаты: миниатюра товара, ссылка правки,
     * количество и итоги тремя строками. Порядок донорский — сначала
     * действие, потом состав.
     */
    cart: z
      .object({
        item_title: z.string().min(1),
        item_meta: z.string().nullable().default(null),
        edit_label: z.string().nullable().default(null),
        quantity_label: z.string().nullable().default(null),
        rows: z
          .array(
            z.object({
              label: z.string().min(1),
              value: z.string().min(1),
              emphasis: z.boolean().default(false),
            }),
          )
          .default([]),
      })
      .nullable()
      .default(null),
    /**
     * Подзаголовок покупки под H1: место и время. Архетип `ticket_checkout`
     * без него нечитаем — билет без площадки и даты не билет, а строка цены.
     */
    event: z
      .object({ venue: z.string().min(1), date: z.string().min(1) })
      .nullable()
      .default(null),
    /**
     * Форма покупателя ПУСТЫМИ полями. Отличается от `rows` не оформлением,
     * а моделью: `rows` показывают уже известные системе данные, форма их
     * спрашивает. У билетного донора данные не хранятся — покупка анонимная,
     * поэтому экран открывается с пустыми обязательными полями.
     */
    buyer_form: z
      .object({
        enabled: z.boolean().default(true),
        fields: z
          .array(
            z.object({
              name: z.string().min(1),
              label: z.string().min(1),
              placeholder: z.string().default(""),
              required: z.boolean().default(true),
              input_mode: z.enum(["text", "numeric"]).default("text"),
            }),
          )
          .default([]),
        required_note: z.string().nullable().default(null),
      })
      .nullable()
      .default(null),
    fulfillment: z
      .object({
        title: z.string(),
        value: z.string(),
        options: z.array(choiceOptionSchema),
        selected: z.string(),
        extras_hint: z.string().nullable().default(null),
        extras_hint_compact: z.string().nullable().default(null),
      })
      .nullable()
      .default(null),
    form: z
      .object({
        enabled: z.boolean().default(true),
        scheme_plates: z.number().int().min(0).max(6).default(3),
      })
      .nullable()
      .default(null),
    autorenew: z
      .object({ enabled: z.boolean(), default_checked: z.boolean().default(true) })
      .nullable()
      .default(null),
    /**
     * Промокод. `accordion` — свёрнутая кнопка донора Uchi, `field` — открытое
     * поле с заголовком (донор ВОРОХ). Дефолт донорский для уже поставляемых
     * тем: они писались до появления второй подачи.
     */
    promo: z
      .object({
        enabled: z.boolean(),
        presentation: z.enum(["accordion", "field"]).default("accordion"),
        title: z.string().nullable().default(null),
      })
      .nullable()
      .default(null),
    items_title: z.string().nullable().default(null),
    items_title_compact: z.string().nullable().default(null),
    line_items: z.array(lineItemSchema).default([]),
    totals: totalsSchema,

    /*
     * Поля, добавленные расширением флоу до экранов банка.
     * Это ДАННЫЕ тенанта, а не тема: они едут в payload банка вместе с
     * мерчантом и суммой и не участвуют ни в одной оси темизации.
     * `null` -> подставляется дефолт по архетипу: пустая строка на экране
     * недопустима, новый подрядчик получает верную строку, ничего не заполняя.
     */
    return_label: z.string().nullable().default(null),
    paid_title: z.string().nullable().default(null),
    payment_purpose: z.string().nullable().default(null),
    payment_category: z.string().nullable().default(null),
    summary_detail: z.string().nullable().default(null),
  }),

  /** Параметры демонстрации: правятся без пересборки. */
  demo: z
    .object({
      balance: z.string().min(1).default("34 190,50 ₽"),
      timings: z
        .object({
          push_delay_ms: z.number().int().min(0).max(5000).default(600),
          splash_ms: z.number().int().min(0).max(5000).default(1200),
          pay_loading_ms: z.number().int().min(0).max(5000).default(900),
          dots_cycle_ms: z.number().int().min(300).max(3000).default(900),
        })
        .prefault({}),
    })
    .prefault({}),

  // ── Режим доступности ───────────────────────────────────────────────
  a11y_mode: z.enum(["enforced", "donor_faithful"]).default("enforced"),
});

export type TenantConfig = z.infer<typeof tenantSchema>;
export type TenantInput = z.input<typeof tenantSchema>;
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;
export type DetailRowConfig = z.infer<typeof detailRowSchema>;
export type ChoiceOption = z.infer<typeof choiceOptionSchema>;
export type LineItemConfig = z.infer<typeof lineItemSchema>;

/** Написание бренда — константа, а не параметр (решение пользователя №1). */
export const OZON_LABEL = "Ozon Банк";
export const OZON_METHOD_ID = "ozon";
export const FORBIDDEN_OZON_SPELLINGS = [
  "Озон Банк",
  "Ozon Bank",
  "Ozone Bank",
  "OZON БАНК",
  "ozon банк",
];
