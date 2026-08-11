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
  /**
   * Фотография товара. У доноров-магазинов миниатюра несёт строку целиком:
   * нейтральная плашка на её месте превращает состав заказа в список цен.
   * Путь внутри `public/`, как и у афиш тарифов.
   */
  image: z.string().min(1).nullable().default(null),
  image_alt: z.string().nullable().default(null),
  /**
   * Количество бейджем поверх угла миниатюры (донор RML). `null` — бейджа
   * нет: у доноров с одним товаром в заказе его действительно нет.
   */
  quantity: z.number().int().min(1).nullable().default(null),
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
    "plan_sheet",
    /**
     * `order_steps` — донор RML (radimirailubvi.ru/checkout).
     *
     * Каркас «шаги → кнопка → корзина под ней» роднит его со
     * `store_checkout`, но расходятся четыре вещи, и они узнаются раньше
     * палитры: активный шаг у RML это ЦЕЛАЯ ФОРМА доставки (селект города,
     * радио способов, сетка адресных карточек), пройденный шаг — карточка
     * -сводка заливкой с круглой кнопкой правки, шапка несёт логотип и
     * корзину, а H2 состава стоит ПОД кнопкой оплаты, а не над экраном.
     * Подстановка в `store_checkout` даёт «перекрашенный MONOCHROME».
     */
    "order_steps",
    /**
     * `slot_delivery` — донор «Хваловские воды» (msc.hvalwaters.ru/cart).
     *
     * Родство с `cart_checkout` кончается на слове «корзина»: у этого донора
     * состав правится ПРЯМО на экране заказа счётчиком «− N +», способ оплаты
     * выбирается ВЫПАДАЮЩИМ СПИСКОМ, а под ним стоит блок времени доставки из
     * двух ячеек (дата и интервал). Плюс тумблер «Оставить у двери» с чипом
     * и липкая панель, где слева «Итого» с суммой, а справа кнопка. Шесть
     * блоков, которых нет ни в одном архетипе, — это экран, а не оси.
     */
    "slot_delivery",
    /**
     * `bonus_checkout` — донор Bombbar (bombbar.ru/cart/order).
     *
     * Каркас «кнопка → состав под ней» роднит его со `store_checkout`, но
     * расходятся четыре вещи: секции лежат ИНСЕТНЫМИ карточками с рамкой (а
     * не full-bleed), способ получения выбирается чипами, экран продаёт
     * регистрацию плашкой бонусов, а итоги раскрашены — скидка красная,
     * доставка зелёная, бонусы отдельной строкой. Подстановка в
     * `store_checkout` даёт «перекрашенный MONOCHROME».
     */
    "bonus_checkout",
  ]),

  // Нативной оболочки (статус-бар, home indicator) в контракте больше нет:
  // демо — веб-страница, системный хром рисует устройство.

  // ── Шапка экрана ────────────────────────────────────────────────────
  header: z
    .object({
      /**
       * `logo_cart` — шапка донора RML: знак бренда и стрелка возврата слева,
       * круглая кнопка корзины справа. Прозрачная и залипающая, без полосы и
       * границы. Ни `back_title` (шеврон + заголовок), ни `centered_logo`
       * (полоса с логотипом по центру) её не выражают: у RML в шапке нет ни
       * заголовка, ни центровки, зато есть второй элемент справа.
       */
      style: z.enum([
        "back_title",
        "centered_logo",
        "logo_cart",
        /**
         * `logo_account` — шапка «Хваловских вод»: над рядом с логотипом идёт
         * служебная полоса с городом и телефоном, слева стрелка возврата,
         * справа круглый аватар с инициалами. Ни одна из прежних шапок не
         * несёт ни второй полосы, ни аватара авторизованного пользователя, а
         * именно они сообщают «это мой личный заказ, а не витрина».
         */
        "logo_account",
        /**
         * `logo_support` — шапка Bombbar на шаге оформления: логотип слева,
         * телефон и подпись «Служба поддержки» справа. Каталожной навигации
         * на этом шаге у донора нет вовсе — шапка сведена к «кто мы и куда
         * звонить, если что-то пойдёт не так».
         */
        "logo_support",
      ]),
      back_label: z.string().nullable().default(null),
      /** Точка-индикатор на кнопке корзины (`logo_cart`): у донора она есть. */
      cart_dot: z.boolean().default(false),
      /** Служебная полоса над шапкой (`logo_account`): город и телефон. */
      top_bar: z
        .object({ city: z.string().min(1), phone: z.string().min(1) })
        .nullable()
        .default(null),
      /** Инициалы в круглом аватаре (`logo_account`). */
      account_initials: z.string().min(1).max(3).nullable().default(null),
      /** Телефон поддержки с подписью (`logo_support`). */
      support: z
        .object({ phone: z.string().min(1), caption: z.string().min(1) })
        .nullable()
        .default(null),
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
    /**
     * Цвет «хорошей» суммы в итогах: у Bombbar бесплатная доставка зелёная,
     * а скидка красная, и обе — рядом с чёрными числами. `null` — у донора
     * итоги одноцветные; раскрашивать их «на всякий случай» нельзя, цвет
     * здесь несёт смысл, а не оформление.
     */
    positive: hexOrNull("surface.positive").default(null),
  }),

  // ── Модель возвышения ───────────────────────────────────────────────
  elevation: z
    .object({
      /**
       * `soft` — мягкий рельеф (неоморфизм): карточка не лежит на фоне, а
       * выдавлена из него. Одной тенью это не собирается: нужны парные
       * тёмная и светлая с противоположных сторон плюс внутренние блики.
       * Донору с таким рельефом обычная тень даёт «карточку на подложке» —
       * узнаваемость теряется целиком.
       */
      model: z
        .enum(["flat_outline", "tonal_fill", "shadow", "soft"])
        .default("flat_outline"),
      border_width: z.number().min(1).max(2).default(1),
      selected_border_width: z.number().min(1).max(3).default(1.5),
      shadow: z
        .object({ y: z.number(), blur: z.number(), alpha: z.number().min(0).max(1) })
        .nullable()
        .default(null),
      /**
       * Параметры мягкого рельефа для `model: "soft"`. Смещение одно на обе
       * стороны — тёмная уходит вправо-вниз, светлая влево-вверх; так рельеф
       * читается как один источник света, а не как две независимые тени.
       */
      soft: z
        .object({
          distance: clamped("elevation.soft.distance", 2, 16, "смещение рельефа"),
          blur: clamped("elevation.soft.blur", 4, 40, "размытие рельефа"),
          dark: hex("elevation.soft.dark"),
          light: hex("elevation.soft.light"),
          alpha: z.number().min(0).max(1).default(0.9),
        })
        .nullable()
        .default(null),
    })
    .default({
      model: "flat_outline",
      border_width: 1,
      selected_border_width: 1.5,
      shadow: null,
      soft: null,
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
    /*
     * `pill` разрешён и полю — вслед за контролом и по той же причине, что
     * нижний порог радиусов был снят до нуля. У RML поле города и поле
     * подписки скруглены в капсулу при нулевом радиусе карточек: это не
     * небрежность, а противопоставление, на котором держится вид страницы.
     * Кламп 16 запрещал его выразить, и поле приезжало прямоугольным.
     * Порядок field ≤ control ≤ card при этом нарушается — снимается
     * явным `allow_inversion`, как и задумано.
     */
    field: radiusValue("radius.field", 0, 16),
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
    family: z.enum(["system", "rounded", "grotesk", "mono"]).default("system"),
    /**
     * Гарнитуры донора файлами. Системный стек не заменяет их даже
     * приблизительно: у RML весь интерфейс набран подписями 10–12 px в
     * Neue Machina, и на подстановке гротеска из стека страница перестаёт
     * узнаваться раньше, чем расходится палитра.
     *
     * `display` — заголовки, кнопки, подписи; `body` — текст. Две гарнитуры,
     * а не одна: это разные роли, и донор различает их последовательно.
     * `src` — путь внутри `public/`, поэтому ссылка переживает `?t=`-конфиг.
     */
    fonts: z
      .object({
        display: z
          .object({ family: z.string().min(1), src: z.string().min(1) })
          .nullable()
          .default(null),
        body: z
          .object({ family: z.string().min(1), src: z.string().min(1) })
          .nullable()
          .default(null),
      })
      .nullable()
      .default(null),
    body: clamped("typography.body", 12, 18, "кегль тела"),
    h1: clamped("typography.h1", 16, 32, "кегль H1"),
    section_title: clamped("typography.section_title", 15, 24, "кегль заголовка секции"),
    /*
     * Нижняя граница опущена 11 → 10 вслед за радиусами и весом заголовка
     * (решение владельца 2026-07-29, та же причина). У RML подписи полей,
     * бейджи и метки набраны ровно десятью пикселями, и кламп до 11 стирал
     * плотность, на которой держится минимализм донора. Порог зоны нажатия
     * (44) не затронут: он про попадание пальцем, а не про кегль.
     */
    caption: clamped("typography.caption", 10, 14, "кегль подписи"),
    /**
     * Кегль цены на карточке тарифа. Отдельная ось, а не H1: у доноров с
     * прайс-листом цена крупнее заголовка карточки — она и есть главное,
     * что сравнивают между тарифами.
     */
    price: clamped("typography.price", 18, 44, "кегль цены").default(24),
    label_weight: clamped("typography.label_weight", 400, 700, "вес label"),
    /*
     * Нижняя граница опущена 500 → 400: у RML заголовок состава набран
     * обычным весом дисплейной гарнитуры, и порог 500 заставлял браузер
     * синтезировать полужирное начертание, которого в файле шрифта нет.
     * Синтетический жир на геометрическом гротеске виден сразу.
     */
    title_weight: clamped("typography.title_weight", 400, 800, "вес заголовка"),
  }),

  // ── Главная кнопка ──────────────────────────────────────────────────
  cta: z.object({
    placement: z.enum(["sticky", "inline"]),
    label: z.string().min(1),
    include_amount: z.boolean().default(false),
    /**
     * Липкая панель несёт СЛЕВА подпись «Итого» с суммой, а кнопка занимает
     * оставшуюся ширину (донор «Хваловские воды»). Обычная панель отдаёт
     * кнопке всю ширину; сумма в ней жила бы только внутри метки кнопки, и
     * тогда цена читалась бы как часть действия, а не как результат заказа.
     */
    sticky_total: z
      .object({ label: z.string().min(1).default("Итого") })
      .nullable()
      .default(null),
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
    /*
     * Нижняя граница опущена 13 → 10 по той же причине, что и у `caption`:
     * у RML метка главной кнопки набрана десятью пикселями в дисплейной
     * гарнитуре, и читается это как намеренная сдержанность, а не как ошибка.
     * Высота кнопки при этом остаётся под порогом зоны нажатия — мелкий
     * кегль не даёт права уменьшать цель для пальца.
     */
    font_size: clamped("cta.font_size", 10, 20, "кегль главной кнопки").default(17),
    font_weight: clamped("cta.font_weight", 400, 800, "вес главной кнопки").default(700),
    /**
     * Градиентная заливка кнопки. У доноров, где градиент — единственный
     * акцент на всей странице, плоский цвет стирает главную примету бренда.
     * Контраст текста проверяется по более тёмному концу: он определяет
     * худший случай читаемости.
     */
    gradient: z
      .object({
        from: hex("cta.gradient.from"),
        to: hex("cta.gradient.to"),
        angle: clamped("cta.gradient.angle", 0, 360, "угол градиента").default(135),
      })
      .nullable()
      .default(null),
    /**
     * Цветная тень под кнопкой — тоже часть акцента, а не украшение: у
     * донора она подсвечена в тон заливки и держит кнопку над фоном.
     */
    shadow: z
      .object({
        y: clamped("cta.shadow.y", 0, 24, "смещение тени"),
        blur: clamped("cta.shadow.blur", 0, 48, "размытие тени"),
        color: hex("cta.shadow.color"),
        alpha: z.number().min(0).max(1),
      })
      .nullable()
      .default(null),
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
    layout: z.enum([
      "horizontal_cards",
      "vertical_buttons",
      "radio_rows",
      /**
       * `select_list` — выпадающий список (донор «Хваловские воды»). Способ
       * оплаты у него занимает ОДНУ строку с текущим значением и шевроном, а
       * варианты показываются только по нажатию. Развернуть его в столбик
       * строк — значит отдать оплате втрое больше экрана, чем отдаёт донор,
       * и сломать ритм «поле — поле — поле» его формы заказа.
       */
      "select_list",
      /**
       * `plain_rows` — радио-строки БЕЗ рамки вокруг каждой (донор Bombbar).
       * Отличается от `radio_rows` тем, что рамку несёт карточка секции
       * целиком: своя рамка у строки нарисовала бы вторую границу внутри
       * первой.
       */
      "plain_rows",
    ]),
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
    /**
     * Подача пройденного шага. `bordered` — заголовок снаружи, содержимое в
     * рамке (донор MONOCHROME). `filled_summary` — карточка-сводка заливкой
     * без рамки, подпись и значение в две колонки, правка круглой кнопкой в
     * углу (донор RML). Ось структурная: при одной палитре именно она
     * решает, читается шаг как свой или как чужой шаблон.
     */
    /**
     * `cards` — секция целиком лежит инсетной карточкой: заголовок ВНУТРИ
     * рамки, поля страницы уменьшены до 8 px, между карточками воздух
     * (донор Bombbar). Для full-bleed доноров это анти-паттерн R1, для этого
     * — его собственный вид, и подменять его нельзя.
     */
    sections_presentation: z
      .enum(["bordered", "filled_summary", "cards"])
      .default("bordered"),
    sections: z
      .array(
        z.object({
          title: z.string().min(1),
          done: z.boolean().default(true),
          action_label: z.string().nullable().default(null),
          /**
           * Вид действия правки. `link` — подчёркнутый текст на первой строке
           * (MONOCHROME), `pencil` — круглая кнопка с карандашом в углу
           * карточки (RML). Метка при `pencil` уходит в `aria-label`.
           */
          action_kind: z.enum(["link", "pencil"]).default("link"),
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
    /**
     * Тарифы архетипа `plan_sheet`: у донора это карточки-афиши, а оплата
     * начинается кнопкой под каждой. Состав вынесен в данные, потому что
     * запечённый в картинку текст (как у самого донора) нечитаем на мелком
     * экране и не переводится — это и есть его главная беда с дизайном.
     */
    plans: z
      .array(
        z.object({
          id: z.string().min(1),
          title: z.string().min(1),
          caption: z.string().nullable().default(null),
          /**
           * Цена в копейках, а не строкой: выбранный тариф становится суммой
           * платежа на всех экранах маршрута, включая экраны банка. Строка
           * не даёт сквозной суммы — банк показал бы цену из `totals`, а
           * шторка цену тарифа, и демо противоречило бы само себе.
           */
          sum: z.number().int().min(1),
          /**
           * Афиша тарифа. У донора карточка — цельная картинка: фотография,
           * плашка, состав и тумблеры уже нарисованы в ней. Пересобирать это
           * разметкой значит рисовать второй, отличающийся макет поверх
           * готового; путь к изображению честнее и точнее.
           */
          image: z.string().min(1).nullable().default(null),
          /** Подпись афиши для скринридера: картинка несёт весь смысл карточки. */
          image_alt: z.string().nullable().default(null),
          /**
           * Косая плашка на углу карточки («Выгода: 20%»). У доноров с
           * длинными тарифами она несёт единственный аргумент за дорогой
           * план и потому лежит ПОВЕРХ карточки, вылезая за её край.
           */
          badge: z.string().nullable().default(null),
          /**
           * Своя метка кнопки. У донора последний тариф зовут «Оформить
           * абонемент», а не «подписку»: разовый пакет игр — не подписка, и
           * общая метка на все карточки врала бы на нём.
           */
          cta_label: z.string().nullable().default(null),
          /**
           * Резервный состав на случай, когда афиши нет: тумблерами, а не
           * списком — набор возможностей у тарифов одинаков, и разницу несёт
           * положение переключателя.
           */
          features: z
            .array(
              z.object({
                label: z.string().min(1),
                included: z.boolean().default(true),
              }),
            )
            .default([]),
        }),
      )
      .default([]),
    /**
     * Логотип шапки картинкой. У доноров, где логотип это отрисованный знак
     * со своей гарнитурой и графикой, текстовый слот не заменяет его даже
     * приблизительно — он и есть первое, по чему подрядчик узнаёт свой сайт.
     */
    header_logo: z.string().nullable().default(null),
    /** Подсказка прокрутки под шапкой: у донора она есть и держит ритм экрана. */
    scroll_hint: z.string().nullable().default(null),
    /**
     * Вид карточки тарифа. `poster` — цельная афиша-картинка, кнопка под ней
     * (донор ПАДЛ ХАБ). `panel` — карточка с текстом и кнопкой ВНУТРИ, срок и
     * цена разделены линиями (донор yes-atlas). Это структурная ось: при
     * одинаковой палитре она решает, читается ли экран как свой.
     */
    plan_card: z.enum(["poster", "panel"]).default("poster"),
    /** Заголовок шторки оплаты, открывающейся по кнопке тарифа. */
    sheet_title: z.string().nullable().default(null),
    /**
     * Метка кнопки на карточке тарифа. Отличается от `cta.label`: на карточке
     * это вход в оплату («Оформить подписку»), в шторке — сама оплата
     * («Оплатить 9 800 ₽»). Одна метка на оба места врёт в одном из них.
     */
    plan_cta_label: z.string().nullable().default(null),
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
        /** Заголовок блока состава: у Bombbar это «Ваш заказ». */
        title: z.string().nullable().default(null),
        /**
         * Состав показывается строками `line_items` с миниатюрами, а не одной
         * плашкой товара (донор Bombbar против MONOCHROME).
         */
        use_line_items: z.boolean().default(false),
        rows: z
          .array(
            z.object({
              label: z.string().min(1),
              value: z.string().min(1),
              emphasis: z.boolean().default(false),
              /**
               * Цвет значения несёт смысл: `discount` — вычитание, `positive`
               * — то, что достаётся бесплатно или начисляется. `default` —
               * обычное число цветом текста. Раскрашивать всё подряд нельзя:
               * у донора цветных значений ровно два.
               */
              tone: z.enum(["default", "discount", "positive"]).default("default"),
              /** Мелкая серая пояснительная подпись рядом с меткой строки. */
              hint: z.string().nullable().default(null),
            }),
          )
          .default([]),
        /**
         * Итог отдельной парой, а не последней строкой списка: у донора он
         * стоит СПРАВА в одной строке с бонусами, под чертой, и набран крупнее
         * слагаемых. Строкой списка он вставал бы над бонусами — порядок,
         * которого у донора нет.
         */
        total: z
          .object({ label: z.string().min(1), value: z.string().min(1) })
          .nullable()
          .default(null),
        /** Строка бонусов слева от итога («+42 бонуса»). */
        bonus: z.string().nullable().default(null),
        /** Зачёркнутая цена без скидки под итогом. */
        old_total: z.string().nullable().default(null),
        /** Мелкая справка справа под итогом («Вес заказа: 0.55 кг»). */
        note: z.string().nullable().default(null),
      })
      .nullable()
      .default(null),
    /**
     * Плашка-обещание под H1 (`slot_delivery`): иконка в белом кружке,
     * заголовок и строка пояснения на серой капсуле. У донора она стоит
     * ВЫШЕ состава заказа и задаёт тон всему экрану — «привезём, когда
     * удобно», а не «проверьте товары».
     */
    promise: z
      .object({
        title: z.string().min(1),
        caption: z.string().min(1),
        icon: z.string().min(1).nullable().default(null),
      })
      .nullable()
      .default(null),
    /**
     * Счётчик количества в строке товара. У донора состав заказа правится
     * прямо здесь, а не «в корзине на другом экране»: это не украшение
     * строки, а причина, по которой у экрана вообще есть список товаров.
     */
    items_counter: z.boolean().default(false),
    /**
     * Единица измерения внутри счётчика («бут.»). У донора она стоит рядом с
     * числом и объясняет, что именно прибавляет плюс: бутыли, а не литры и не
     * заказы. `null` — счётчик показывает только число.
     */
    items_counter_unit: z.string().min(1).nullable().default(null),
    /**
     * Карточка адреса доставки (`slot_delivery`): две строки заливкой и
     * круглая кнопка правки справа. Отличается от `sections` тем, что это
     * не пройденный ШАГ, а одно текущее значение с правкой.
     */
    address: z
      .object({
        title: z.string().min(1),
        subtitle: z.string().nullable().default(null),
        action_label: z.string().min(1).default("Изменить адрес"),
      })
      .nullable()
      .default(null),
    /**
     * Строка-тумблер с чипом-пояснением («Оставить у двери» + «онлайн
     * оплата»). Чип здесь не бейдж, а условие: опция доступна только при
     * онлайн-оплате, и донор сообщает это прямо в строке.
     */
    door_toggle: z
      .object({
        label: z.string().min(1),
        tag: z.string().nullable().default(null),
        default_on: z.boolean().default(false),
      })
      .nullable()
      .default(null),
    /**
     * Время доставки двумя ячейками: дата и интервал. Слот — то, ради чего
     * этот донор вообще существует (вода привозится в окно), поэтому блок
     * стоит рядом с оплатой, а не прячется в «дополнительно».
     */
    delivery_slot: z
      .object({
        title: z.string().min(1),
        date: z.string().min(1),
        time: z.string().min(1),
      })
      .nullable()
      .default(null),
    /**
     * Ряды «Дополнительно»: заголовок слева, кнопка «Добавить» справа, всё
     * в рамке. Свёрнутый промокод у этого донора не один — рядом с ним
     * живёт комментарий к заказу, и они устроены одинаково.
     */
    extras_rows: z
      .array(
        z.object({
          title: z.string().min(1),
          action_label: z.string().min(1).default("Добавить"),
        }),
      )
      .default([]),
    /**
     * Свёрнутая разбивка чека под сноской: у донора это мелкий серый список
     * «позиция — сумма», раскрывающийся по строке-ссылке. Он объясняет, из
     * чего сложилось «Итого», когда цены со скидкой не сходятся глазом.
     */
    receipt_breakdown: z
      .object({
        title: z.string().min(1),
        rows: z
          .array(z.object({ name: z.string().min(1), amount: z.string().min(1) }))
          .default([]),
      })
      .nullable()
      .default(null),
    /**
     * Плашка «войдите и получите бонусы» (`bonus_checkout`). У донора это
     * первое, что видно в карточке контактов: экран продаёт регистрацию
     * ровно там, где просит данные.
     */
    bonus_banner: z
      .object({
        title: z.string().min(1),
        text: z.string().min(1),
      })
      .nullable()
      .default(null),
    /** Поле комментария к заказу открытой формой (`bonus_checkout`). */
    comment_field: z
      .object({
        title: z.string().min(1),
        placeholder: z.string().default(""),
      })
      .nullable()
      .default(null),
    /**
     * Чекбоксы согласий. `accent` — тот, что у донора отмечен по умолчанию и
     * залит брендом (согласие на обработку данных под кнопкой); остальные
     * пустые. Список, а не одно поле: у донора их три, и два из них —
     * маркетинговые.
     */
    agreements: z
      .array(
        z.object({
          text: z.string().min(1),
          checked: z.boolean().default(false),
          /** Подписи ссылок внутри текста: подсвечиваются брендом. */
          links: z.array(z.string().min(1)).default([]),
          /** Место: под секциями оплаты или под главной кнопкой. */
          placement: z.enum(["form", "cta"]).default("form"),
        }),
      )
      .default([]),
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
    /**
     * Активный шаг заказа как ФОРМА выбора доставки (архетип `order_steps`).
     *
     * Отличается от `fulfillment` не оформлением, а моделью: `fulfillment` —
     * свёрнутая строка «способ получения → значение» с вариантами-карточками,
     * тогда как у RML это раскрытый шаг из трёх разнородных контролов —
     * поиск города, радио способа и сетка адресных карточек, где сетка
     * появляется только при выбранном самовывозе. Свернуть это в
     * `choiceOptionSchema` нельзя: адрес там многострочный и несёт часы
     * работы с телефоном, а не заголовок с ценой.
     */
    delivery: z
      .object({
        city: z
          .object({ label: z.string().min(1), value: z.string().min(1) })
          .nullable()
          .default(null),
        options: z
          .array(z.object({ id: z.string().min(1), label: z.string().min(1) }))
          .default([]),
        selected: z.string().min(1),
        /** Подпись над сеткой адресов: у донора она объясняет, что выбирать. */
        pickup_hint: z.string().nullable().default(null),
        /** Вариант, при котором показывается сетка адресов. */
        pickup_option_id: z.string().nullable().default(null),
        pickup_points: z
          .array(
            z.object({
              id: z.string().min(1),
              /** Многострочный адрес: переносы значимы, схлопывать нельзя. */
              address: z.string().min(1),
              hours: z.string().nullable().default(null),
              phone: z.string().nullable().default(null),
            }),
          )
          .default([]),
        selected_point: z.string().nullable().default(null),
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
        /**
         * `cards` — ряд карточек-вариантов под строкой (донор Flowwow).
         * `chips` — компактные капсулы В ОДНОЙ СТРОКЕ с заголовком секции,
         * выбранная залита брендом (донор Bombbar). Ось структурная: у
         * второго донора способ получения не занимает отдельного блока
         * вовсе, он умещается справа от подписи.
         */
        presentation: z.enum(["cards", "chips"]).default("cards"),
        /**
         * Выбранный пункт выдачи: заголовок, многострочный адрес, срок и
         * цена доставки, ссылка правки. Свернуть это в `value` нельзя —
         * у донора здесь четыре разных по весу строки.
         */
        pickup: z
          .object({
            title: z.string().min(1),
            address: z.string().min(1),
            meta: z.string().nullable().default(null),
            action_label: z.string().nullable().default(null),
          })
          .nullable()
          .default(null),
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
