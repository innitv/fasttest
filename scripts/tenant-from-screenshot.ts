import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import { buildTenantUrl } from "../src/theme/tenant-loader";
import { tenantSchema, type TenantConfig } from "../src/theme/tenant.schema";

/**
 * Скриншот чужого платёжного экрана → валидный `tenant.json` + ссылка на демо.
 *
 * Запуск:
 *   yarn tenant:from-screenshot ./shots/donor.png
 *   yarn tenant:from-screenshot ./shots/donor.png --out=tenants/donor.json --archetype=cart_checkout
 *
 * Схема НЕ дублируется: `tenantSchema` импортируется из `src/theme/tenant.schema.ts`,
 * ссылка собирается тем же `buildTenantUrl`, что использует само демо.
 *
 * Node 24 умеет исполнять TypeScript нативно, но `src/` написан в стиле бандлера
 * (импорты без расширений, `import ... from "*.json"`), а нативный загрузчик ESM
 * такое не резолвит. Поэтому запуск идёт через `tsx` — см. npm-скрипт.
 *
 * Скрипт нигде не зовёт `process.exit()`: на Windows выход посреди закрытия
 * HTTP-сокета роняет libuv («Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)»)
 * и подменяет код возврата. Вместо этого ошибка поднимается как `CliError`,
 * печатается наверху и выставляет `process.exitCode = 1`.
 */

// ── Ошибки CLI ────────────────────────────────────────────────────────

class CliError extends Error {
  readonly details: string[];

  constructor(title: string, details: string[]) {
    super(title);
    this.name = "CliError";
    this.details = details.filter(Boolean);
  }
}

/** Единая точка отказа: человекочитаемое сообщение, код возврата 1. */
function fail(title: string, ...details: string[]): never {
  throw new CliError(title, details);
}

// ── Константы ─────────────────────────────────────────────────────────

const MODEL = "claude-opus-5";
const DEFAULT_BASE = "https://fasttest-ten.vercel.app";
const MAX_TOKENS = 16000;

const ARCHETYPES = ["cart_checkout", "subscription_payment"] as const;
type Archetype = (typeof ARCHETYPES)[number];

const USAGE = [
  "Использование:",
  "  yarn tenant:from-screenshot <путь-к-скриншоту> [--out=<файл>] [--archetype=cart_checkout|subscription_payment] [--base=<origin>]",
  "",
  "  --out        куда писать JSON (по умолчанию рядом со скриншотом, <имя>.tenant.json)",
  "  --archetype  принудительно задать архетип вместо выбора моделью",
  `  --base       origin демо для ссылки (по умолчанию ${DEFAULT_BASE})`,
];

const CREDENTIALS_HINT = [
  "Учётные данные Anthropic не найдены или отклонены.",
  "Подойдёт любой из вариантов:",
  "  • переменная окружения ANTHROPIC_API_KEY;",
  "  • переменная окружения ANTHROPIC_AUTH_TOKEN;",
  "  • профиль, созданный командой `ant auth login`.",
  "Ключ в код не зашивается и в репозиторий не кладётся.",
];

// ── Изображение ───────────────────────────────────────────────────────

type SupportedMediaType = "image/png" | "image/jpeg";

/**
 * Тип изображения по сигнатуре файла; расширение — только запасной вариант.
 * Скриншот, переименованный из .png в .jpg, не должен ломать запрос.
 */
function detectMediaType(bytes: Buffer, filePath: string): SupportedMediaType {
  const isPng =
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47;
  if (isPng) return "image/png";

  const isJpeg =
    bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (isJpeg) return "image/jpeg";

  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";

  return fail(
    `не удалось определить тип изображения: ${filePath}`,
    "Поддерживаются PNG и JPEG.",
  );
}

// ── Промпт ────────────────────────────────────────────────────────────

/**
 * Промпт вынесен в экспортируемую константу намеренно: его правят и
 * версионируют отдельно от логики скрипта.
 *
 * Ключевая причина, по которой клампы перечислены текстом. Structured outputs
 * не передают в API числовые ограничения (`min`/`max`/`int`), длины строк и
 * `regex`: SDK вырезает их из отправляемой схемы и проверяет уже на клиенте.
 * Модель о границах не узнает и легко выдаст `radius.card: 32` при максимуме
 * 24 — конфиг не пройдёт валидацию. Поэтому границы дублируются здесь, вместе
 * с причиной каждой (формулировки взяты из комментариев схемы).
 */
export const TENANT_EXTRACTION_PROMPT = `
Ты разбираешь скриншот платёжного экрана (корзина/оформление заказа или оплата
подписки) стороннего сервиса и превращаешь его в конфиг темы \`tenant.json\` для
демо оплаты. Конфиг задаёт визуальный язык и контент экрана: цвета, форму,
плотность, типографику, состав способов оплаты и тексты.

## 1. Нормализация измерений (сделай это ПЕРВЫМ)

Скриншот почти наверняка снят не в 1:1 CSS-пикселях: это может быть retina-кадр,
кадр планшета, увеличенный фрагмент или обрезок. Порядок действий:

1. Оцени ширину основной колонки контента на скриншоте в пикселях изображения.
2. Прими за эталон мобильную колонку демо шириной 392 CSS px и вычисли масштаб:
   \`масштаб = ширина_колонки_на_скриншоте / 392\`.
3. Все значения \`density.*\`, \`radius.*\` и \`typography.*\` измеряй на
   скриншоте и дели на этот масштаб — в конфиг они идут в CSS-пикселях.

Так, кегль 32 px на retina-скриншоте шириной 784 px — это 16 CSS px, а не 32.
Не переноси сырые пиксели изображения в конфиг.

## 2. Персональные данные

Любые персональные данные на скриншоте замени вымышленными, СОХРАНИВ структуру
и длину строк: имена и фамилии, адреса, номера домов и квартир, телефоны,
e-mail, номера заказов и договоров, последние цифры карт, названия организаций
клиента. «Иванов Пётр Сергеевич» → другое правдоподобное русское ФИО той же
формы; «Казань, улица Волкова, 14» → другой город и улица того же вида.
Суммы, цены и названия товаров/тарифов переноси как есть — это не персональные
данные, а часть раскладки.

Бренд подрядчика (название, написание, фирменные цвета, логотип) переноси
точно как на скриншоте — он и есть предмет извлечения.

## 3. Архетип

- \`cart_checkout\` — корзина/оформление заказа: получатель, адрес, доставка или
  самовывоз, комментарий курьеру, итог с доставкой.
- \`subscription_payment\` — оплата подписки/тарифа: список позиций с ценами,
  автопродление, промокод, форма карты.

Выбери тот, который ближе к скриншоту, и собирай контент под него: у
\`cart_checkout\` обычно заполнены \`content.rows\` и \`content.fulfillment\`, у
\`subscription_payment\` — \`content.line_items\`, \`content.form\`,
\`content.autorenew\`, \`content.promo\`. Неприменимые блоки ставь в \`null\`
(или пустой массив), а не выдумывай.

## 4. Способы оплаты

В \`payment_list.methods\` ПЕРВЫМ элементом всегда идёт наш способ:
\`{ "id": "ozon", "label": "Ozon Банк", "caption": null, "logo": "none" }\`.
Написание «Ozon Банк» — константа, не переводи и не меняй регистр.
Дальше — способы оплаты со скриншота донора (карта, СБП, кошелёк, частями и
т.п.) с короткими \`id\` в snake_case.

## 5. Суммы

\`content.totals.sum\` и \`content.totals.discount\` — целые числа в КОПЕЙКАХ:
2 580 ₽ → \`258000\`. \`currency\` всегда \`"RUB"\`. Цены внутри \`line_items\` и
опций — наоборот, готовые строки для показа («1 490 ₽», «Бесплатно»).

## 6. Границы значений (проверь перед ответом)

Числа целые, если не сказано иное. Значение вне диапазона — ошибка загрузки
конфига, а не повод для молчаливого округления, поэтому подгоняй измерение к
ближайшей границе САМ и не выходи за неё.

Форма:
- \`radius.card\`: 8…24. Меньше 8 читается как таблица, больше 24 — как детская игра.
- \`radius.control\`: 6…28 либо строка \`"pill"\` для полностью скруглённой кнопки.
- \`radius.field\`: 4…16.
- \`radius.chip\`: 4…999 либо \`"pill"\`.
- \`radius.allow_inversion\`: boolean.

Плотность (CSS px):
- \`density.page_padding\`: 12…24. Меньше 12 текст липнет к краю, больше 24 контент теряет ширину на 320 px.
- \`density.block_gap\`: 4…20.
- \`density.row_height\`: 44…64. 44 — нижняя граница зоны нажатия.
- \`density.control_height\`: 44…60.
- \`density.method_button_height\`: 44…60 либо \`null\`, если способы оплаты не кнопки-строки.
- \`density.section_gap\`: 8…28.

Ширины компонентов (доля вьюпорта в процентах):
- \`component_width.choice_card_pct\`: 24…60.
- \`component_width.payment_card_pct\`: 24…60.

Типографика (CSS px, кегли и веса):
- \`typography.body\`: 14…18.
- \`typography.h1\`: 16…32.
- \`typography.section_title\`: 16…24.
- \`typography.caption\`: 11…14.
- \`typography.label_weight\`: 500…700.
- \`typography.title_weight\`: 600…800.

Возвышение:
- \`elevation.border_width\`: 1…2 (может быть дробным).
- \`elevation.selected_border_width\`: 1…3 (может быть дробным).
- \`elevation.shadow\`: либо \`null\`, либо \`{ "y": число, "blur": число, "alpha": 0…1 }\`.

Прочее:
- \`content.form.scheme_plates\`: 0…6 — сколько платёжных систем нарисовано у поля карты.
- \`ozon.position\`: целое ≥ 1.
- \`ozon.phone_gate.check_ms\`: 300…1500.
- \`demo.timings.push_delay_ms\`, \`splash_ms\`, \`pay_loading_ms\`: 0…5000.
- \`demo.timings.dots_cycle_ms\`: 300…3000.
- \`content.totals.sum\`, \`content.totals.discount\`: целые ≥ 0.
- \`price_delta\` у опций: целое ≥ 0 (прибавка к итогу в копейках).

## 7. Допустимые значения полей-перечислений

- \`archetype\`: \`cart_checkout\` | \`subscription_payment\`
- \`header.style\`: \`back_title\` (стрелка + заголовок) | \`centered_logo\`
- \`brand.on_primary\`: \`"auto"\` (подобрать контрастный автоматически) либо hex
- \`brand.logo.kind\`: \`text\` | \`slot\`
- \`surface.form\`: \`"auto"\` | hex | \`null\`
- \`elevation.model\`: \`flat_outline\` (обводка без тени) | \`tonal_fill\` (тональная заливка) | \`shadow\`
- \`typography.family\`: \`system\` | \`rounded\` | \`grotesk\`
- \`cta.placement\`: \`sticky\` (прилипшая снизу) | \`inline\` (в потоке)
- \`payment_list.layout\`: \`horizontal_cards\` | \`vertical_buttons\`
- \`payment_list.selection\`: \`radio_outline\` | \`row_press\`
- \`logo\` у способа оплаты: \`slot\` | \`none\`
- \`ozon.handoff\`: \`overlay\` | \`full_screen\`
- \`a11y_mode\`: \`enforced\` (чинить контраст) | \`donor_faithful\` (оставить как у донора)
- \`content.totals.currency\`: только \`"RUB"\`

## 8. Формат строк

- Все цвета — hex вида \`#RRGGBB\` в верхнем регистре.
- \`tenant_id\` — kebab-case из латиницы и цифр: \`flowwow-like\`, \`uchi-like\`.
  Обычно это имя бренда латиницей с суффиксом \`-like\`.
- \`display_name\` — название бренда как на скриншоте.
- \`cta.label\` — текст главной кнопки; если в нём есть сумма, поставь плейсхолдер
  \`{amount}\` и выставь \`cta.include_amount: true\`.

## 9. Чего не делать

- Не выдумывай блоки, которых на скриншоте нет: пустое место — это \`null\`.
- Не своди палитру к «бренд + серый», если на экране реально больше активных
  цветов: для второй пары есть \`brand.secondary\`, для акцента — \`brand.accent\`.
- Не копируй цвет бренда в \`surface.field_error\`, если ошибка поля на экране
  окрашена иначе.

Верни ТОЛЬКО заполненный конфиг по схеме.
`.trim();

/** Промпт с опциональным принуждением архетипа. */
export function buildExtractionPrompt(archetype: Archetype | null): string {
  if (!archetype) return TENANT_EXTRACTION_PROMPT;
  return `${TENANT_EXTRACTION_PROMPT}\n\n## Принудительный архетип\n\nПоле \`archetype\` задано снаружи и равно \`${archetype}\`. Не выбирай его сам: собери контент под этот архетип, даже если скриншот выглядит иначе.`;
}

// ── Формат ответа ─────────────────────────────────────────────────────

interface Violation {
  path: string;
  code: string;
  message: string;
}

let violations: Violation[] = [];
let rawModelJson: string | null = null;

/**
 * Обёртка над `zodOutputFormat(tenantSchema)`.
 *
 * Штатный `parse` бросает исключение на первой же ошибке валидации, и тогда
 * ответ модели теряется вместе с полным списком нарушений. Здесь схема та же
 * (`tenantSchema`, второго экземпляра нет), но результат разбора складывается
 * в `violations`, а наружу отдаётся `null` — скрипт печатает все пути полей.
 */
const baseFormat = zodOutputFormat(tenantSchema);
const capturingFormat = {
  ...baseFormat,
  parse(content: string): TenantConfig | null {
    rawModelJson = content;

    let candidate: unknown;
    try {
      candidate = JSON.parse(content);
    } catch (error) {
      violations = [
        {
          path: "(корень)",
          code: "invalid_json",
          message: `ответ модели не является корректным JSON: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      ];
      return null;
    }

    const result = tenantSchema.safeParse(candidate);
    if (!result.success) {
      violations = result.error.issues.map((issue) => ({
        path: issue.path.length > 0 ? issue.path.join(".") : "(корень)",
        code: issue.code,
        message: issue.message,
      }));
      return null;
    }

    violations = [];
    return result.data;
  },
};

// ── Основной сценарий ─────────────────────────────────────────────────

async function main(): Promise<void> {
  // Аргументы.
  const positional: string[] = [];
  const flags: Record<string, string> = {};
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--")) {
      const [key, ...rest] = arg.slice(2).split("=");
      flags[key] = rest.length > 0 ? rest.join("=") : "true";
    } else {
      positional.push(arg);
    }
  }

  const imagePath = positional[0];
  if (!imagePath) fail("не указан путь к скриншоту.", ...USAGE);
  if (!existsSync(imagePath)) fail(`файл не найден: ${imagePath}`);

  const base = flags.base ?? DEFAULT_BASE;

  let forcedArchetype: Archetype | null = null;
  if (flags.archetype) {
    if (!(ARCHETYPES as readonly string[]).includes(flags.archetype)) {
      fail(
        `неизвестный архетип «${flags.archetype}».`,
        `Допустимо: ${ARCHETYPES.join(", ")}.`,
      );
    }
    forcedArchetype = flags.archetype as Archetype;
  }

  const outPath =
    flags.out ??
    path.join(
      path.dirname(imagePath),
      `${path.basename(imagePath, path.extname(imagePath))}.tenant.json`,
    );

  const imageBytes = readFileSync(imagePath);
  const mediaType = detectMediaType(imageBytes, imagePath);

  // Клиент: без аргументов SDK сам разрешает учётку из env или профиля `ant`.
  let client: Anthropic;
  try {
    client = new Anthropic();
  } catch (error) {
    fail(
      "не удалось создать клиент Anthropic.",
      ...CREDENTIALS_HINT,
      `Ответ SDK: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  console.log(`Скриншот:  ${imagePath} (${mediaType}, ${imageBytes.length} байт)`);
  console.log(`Модель:    ${MODEL}`);
  console.log(`Архетип:   ${forcedArchetype ?? "выбирает модель"}`);
  console.log("Запрос отправлен, ждём ответ…\n");

  const params = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    // На Opus 5 адаптивное мышление включено по умолчанию; пишем явно, чтобы
    // намерение было видно в коде.
    thinking: { type: "adaptive" as const },
    output_config: {
      effort: "high" as const,
      format: capturingFormat,
    },
    messages: [
      {
        role: "user" as const,
        content: [
          {
            type: "image" as const,
            source: {
              type: "base64" as const,
              media_type: mediaType,
              data: imageBytes.toString("base64"),
            },
          },
          { type: "text" as const, text: buildExtractionPrompt(forcedArchetype) },
        ],
      },
    ],
  };

  let response;
  try {
    response = await client.messages.parse(params);
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      fail(
        "Anthropic отклонил учётные данные (401).",
        ...CREDENTIALS_HINT,
        `Ответ API: ${error.message}`,
      );
    }
    if (error instanceof Anthropic.PermissionDeniedError) {
      fail(
        "у ключа нет доступа к модели (403).",
        `Модель: ${MODEL}.`,
        `Ответ API: ${error.message}`,
      );
    }
    if (error instanceof Anthropic.RateLimitError) {
      fail("превышен лимит запросов (429).", "Повторите позже.", `Ответ API: ${error.message}`);
    }
    if (error instanceof Anthropic.APIConnectionError) {
      fail(
        "не удалось соединиться с api.anthropic.com.",
        "Проверьте сеть и прокси.",
        `Причина: ${error.message}`,
      );
    }
    if (error instanceof Anthropic.APIError) {
      fail(`запрос к Anthropic не прошёл (${error.status ?? "без статуса"}).`, error.message);
    }
    // Учётка не найдена вовсе: SDK разрешает её лениво, уже на запросе,
    // и бросает ошибку без HTTP-статуса и без собственного класса — поэтому
    // распознаём по тексту.
    if (error instanceof Error && /resolve authentication method/i.test(error.message)) {
      fail("не найдено ни одной учётной записи Anthropic.", ...CREDENTIALS_HINT);
    }
    fail(
      "неожиданная ошибка при обращении к Anthropic.",
      error instanceof Error ? error.message : String(error),
    );
  }

  // Отказ проверяется ДО чтения содержимого: на отказе `content` пуст.
  if (response.stop_reason === "refusal") {
    const details = response.stop_details;
    fail(
      "модель отказалась обрабатывать этот скриншот.",
      details && "category" in details ? `Категория: ${details.category ?? "не указана"}` : "",
      details && "explanation" in details && details.explanation
        ? `Пояснение: ${details.explanation}`
        : "",
    );
  }

  if (response.stop_reason === "max_tokens") {
    fail(
      `ответ обрезан по лимиту max_tokens (${MAX_TOKENS}).`,
      "Конфиг получился длиннее лимита — увеличьте MAX_TOKENS в скрипте.",
    );
  }

  const config = response.parsed_output;

  if (!config) {
    if (violations.length === 0) {
      fail(
        "модель не вернула конфиг.",
        `stop_reason: ${response.stop_reason ?? "не указан"}`,
        rawModelJson === null
          ? "В ответе не было текстового блока."
          : `Начало ответа: ${rawModelJson.slice(0, 200)}`,
      );
    }

    fail(
      `конфиг не прошёл схему, нарушений — ${violations.length}:`,
      ...violations.map((violation) => `${violation.path}: ${violation.message} [${violation.code}]`),
      "",
      "Чаще всего это выход за кламп: границы перечислены в промпте (раздел 6),",
      "и если модель их регулярно нарушает — правится промпт, а не схема.",
    );
  }

  // Результат.
  const json = `${JSON.stringify(config, null, 2)}\n`;
  writeFileSync(outPath, json, "utf8");

  const url = buildTenantUrl(config, base);

  console.log("Готово.\n");
  console.log(
    `Файл:            ${path.resolve(outPath)} (${Buffer.byteLength(json, "utf8")} байт)`,
  );
  console.log(`tenant_id:       ${config.tenant_id}`);
  console.log(`Бренд:           ${config.display_name}`);
  console.log(`Архетип:         ${config.archetype}`);
  console.log(`brand.primary:   ${config.brand.primary}`);
  console.log(`brand.accent:    ${config.brand.accent ?? "—"}`);
  console.log(`surface.bg:      ${config.surface.background}`);
  console.log(`surface.text:    ${config.surface.text_primary}`);
  console.log(
    `Способы оплаты:  ${config.payment_list.methods.map((method) => method.id).join(", ")}`,
  );
  console.log(
    `Токены:          ${response.usage.input_tokens} на вход, ${response.usage.output_tokens} на выход`,
  );
  console.log(`\nСсылка на демо (${url.length} символов):\n${url}`);
}

// ── Запуск ────────────────────────────────────────────────────────────

try {
  await main();
} catch (error) {
  if (!(error instanceof CliError)) throw error;
  console.error(`\nОШИБКА: ${error.message}`);
  for (const line of error.details) console.error(`  ${line}`);
  process.exitCode = 1;
}
