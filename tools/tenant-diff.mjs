import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Насколько извлечённый `tenant.json` близок к эталонному.
 *
 * Это метрика качества генератора тем, а не построчный дифф: поля сравниваются
 * по осям (цвета, форма, плотность, типографика, контент…) и по типу значения,
 * а не как текст.
 *
 * Запуск:
 *   yarn tenant:diff <actual.json> <expected.json> [--out=<отчёт.json>]
 *
 * Код возврата всегда 0: скрипт измеряет, а не проверяет.
 *
 * ── Правила сравнения ────────────────────────────────────────────────
 *
 * Цвета. Считается евклидово расстояние в RGB (0…441 для #000000 vs #FFFFFF)
 * плюс разница по каждому каналу. Пороги:
 *   ≤ 8   — «визуально неотличимо» (это ~1.8 % шкалы; на плашке в интерфейсе
 *           такую разницу не видно даже рядом), засчитывается как допуск;
 *   ≤ 40  — «заметно»: другой оттенок того же цвета, расхождение;
 *   > 40  — «другой цвет», расхождение.
 * Пороги выбраны так, чтобы округление hex при извлечении со скриншота
 * (сжатие JPEG, сглаживание краёв) попадало в первый разряд, а подмена
 * фирменного цвета — нет.
 *
 * Числа. Абсолютное отклонение и процент от эталона. Допуском считается
 * |Δ| ≤ max(1, 10 % эталона): 1 px — цена округления при измерении по
 * скриншоту, 10 % — цена ошибки в оценке масштаба кадра. Отдельно
 * проверяется попадание в кламп схемы (границы читаются прямо из
 * `src/theme/tenant.schema.ts`, второго списка клампов здесь нет).
 *
 * Перечисления и строки-идентификаторы (`tenant_id`, `id` способа оплаты,
 * `archetype`, `layout`…). Строгое совпадение.
 *
 * Контентные строки (заголовки, лейблы, подписи). Сравнивается только
 * НАЛИЧИЕ поля, не текст: после замены персональных данных тексты
 * закономерно расходятся, и дословное сравнение давало бы ложный сигнал.
 * Отдельно отмечается случай «есть в одном конфиге, нет в другом».
 *
 * Массивы. Длина, порядок (по `id`, где он есть) и структурные поля
 * элементов; тексты внутри элементов — снова только по наличию.
 */

// ── Аргументы ─────────────────────────────────────────────────────────
const positional = [];
const flags = {};
for (const arg of process.argv.slice(2)) {
  if (arg.startsWith("--")) {
    const [key, ...rest] = arg.slice(2).split("=");
    flags[key] = rest.length > 0 ? rest.join("=") : "true";
  } else {
    positional.push(arg);
  }
}

const [actualPath, expectedPath] = positional;
if (!actualPath || !expectedPath) {
  console.error(
    "Использование: yarn tenant:diff <actual.json> <expected.json> [--out=<отчёт.json>]",
  );
  process.exit(2);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, "..");

const readJson = (file) => {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    console.error(`Не удалось прочитать ${file}: ${error.message}`);
    process.exit(2);
  }
};

const actual = readJson(actualPath);
const expected = readJson(expectedPath);

// ── Клампы: читаются из схемы, а не дублируются ───────────────────────

/**
 * `clamped("density.row_height", 44, 64, …)` и `radiusValue("radius.chip", 4, 999)`
 * в схеме подписаны точным путём поля — этого достаточно, чтобы вытащить
 * границы статически и не заводить второй список, который разойдётся с первым.
 */
function readClamps() {
  const source = readFileSync(
    path.resolve(projectRoot, "src/theme/tenant.schema.ts"),
    "utf8",
  );
  const clamps = {};
  const patterns = [
    /clamped\(\s*"([^"]+)"\s*,\s*(-?\d+)\s*,\s*(-?\d+)/g,
    /radiusValue\(\s*"([^"]+)"\s*,\s*(-?\d+)\s*,\s*(-?\d+)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      clamps[match[1]] = { min: Number(match[2]), max: Number(match[3]) };
    }
  }
  return clamps;
}

const CLAMPS = readClamps();

// ── Пороги ────────────────────────────────────────────────────────────
const COLOR_IDENTICAL = 8;
const COLOR_NOTICEABLE = 40;
const NUMBER_TOLERANCE_ABS = 1;
const NUMBER_TOLERANCE_PCT = 0.1;

// ── Доступ к полям ────────────────────────────────────────────────────
const MISSING = Symbol("missing");

function pick(root, dotted) {
  let node = root;
  for (const key of dotted.split(".")) {
    if (node === null || node === undefined || typeof node !== "object") return MISSING;
    if (!(key in node)) return MISSING;
    node = node[key];
  }
  return node === undefined ? MISSING : node;
}

// ── Цвет ──────────────────────────────────────────────────────────────
function hexToRgb(hex) {
  let body = String(hex).slice(1);
  if (body.length === 3) body = body.split("").map((ch) => ch + ch).join("");
  return {
    r: parseInt(body.slice(0, 2), 16),
    g: parseInt(body.slice(2, 4), 16),
    b: parseInt(body.slice(4, 6), 16),
  };
}

const isHex = (value) => typeof value === "string" && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value);

function compareColor(actualValue, expectedValue) {
  const a = hexToRgb(actualValue);
  const e = hexToRgb(expectedValue);
  const channels = { r: a.r - e.r, g: a.g - e.g, b: a.b - e.b };
  const distance = Math.round(
    Math.sqrt(channels.r ** 2 + channels.g ** 2 + channels.b ** 2) * 100,
  ) / 100;

  let perception;
  if (distance <= COLOR_IDENTICAL) perception = "визуально неотличимо";
  else if (distance <= COLOR_NOTICEABLE) perception = "заметно";
  else perception = "другой цвет";

  return {
    status: distance === 0 ? "exact" : distance <= COLOR_IDENTICAL ? "tolerated" : "diverged",
    detail: {
      distance,
      channels,
      perception,
    },
    note: `Δ=${distance} (r${channels.r >= 0 ? "+" : ""}${channels.r} g${
      channels.g >= 0 ? "+" : ""
    }${channels.g} b${channels.b >= 0 ? "+" : ""}${channels.b}) — ${perception}`,
  };
}

// ── Число ─────────────────────────────────────────────────────────────
function inClamp(pathKey, value) {
  const clamp = CLAMPS[pathKey];
  if (!clamp || typeof value !== "number") return null;
  return value >= clamp.min && value <= clamp.max;
}

function compareNumber(pathKey, actualValue, expectedValue) {
  const delta = Math.round((actualValue - expectedValue) * 1000) / 1000;
  const pct =
    expectedValue === 0
      ? null
      : Math.round((delta / expectedValue) * 1000) / 10;
  const tolerance = Math.max(NUMBER_TOLERANCE_ABS, Math.abs(expectedValue) * NUMBER_TOLERANCE_PCT);

  const clamp = CLAMPS[pathKey] ?? null;
  const detail = {
    delta,
    pct,
    clamp,
    actual_in_clamp: inClamp(pathKey, actualValue),
    expected_in_clamp: inClamp(pathKey, expectedValue),
  };

  const clampNote =
    detail.actual_in_clamp === false
      ? `; ВНЕ клампа ${clamp.min}…${clamp.max}`
      : clamp
        ? `; в клампе ${clamp.min}…${clamp.max}`
        : "";

  return {
    status: delta === 0 ? "exact" : Math.abs(delta) <= tolerance ? "tolerated" : "diverged",
    detail,
    note: `${actualValue} vs ${expectedValue}, Δ=${delta}${pct === null ? "" : ` (${pct} %)`}${clampNote}`,
  };
}

// ── Сравнение одного поля ─────────────────────────────────────────────

const show = (value) => (value === MISSING ? "—" : JSON.stringify(value));

/**
 * Виды полей:
 *   id     — идентификатор/перечисление/булево: строгое совпадение;
 *   color  — hex, либо "auto", либо null;
 *   number — число либо null;
 *   radius — число, либо "pill", либо null;
 *   text   — контентная строка: сравнивается только наличие.
 */
function compareField(fieldPath, kind) {
  const a = pick(actual, fieldPath);
  const e = pick(expected, fieldPath);

  if (a === MISSING && e === MISSING) {
    return { path: fieldPath, kind, status: "absent_both", note: "нет ни там, ни там" };
  }
  if (a === MISSING) {
    return {
      path: fieldPath,
      kind,
      status: "missing_in_actual",
      note: `нет в actual, в expected ${show(e)}`,
    };
  }
  if (e === MISSING) {
    return {
      path: fieldPath,
      kind,
      status: "missing_in_expected",
      note: `есть в actual (${show(a)}), нет в expected`,
    };
  }

  if (kind === "text") {
    const filled = (value) => value !== null && value !== "";
    if (filled(a) && filled(e)) {
      return { path: fieldPath, kind, status: "exact", note: "оба заполнены (текст не сверяется)" };
    }
    if (!filled(a) && !filled(e)) {
      return { path: fieldPath, kind, status: "exact", note: "оба пустые" };
    }
    return {
      path: fieldPath,
      kind,
      status: filled(a) ? "missing_in_expected" : "missing_in_actual",
      note: filled(a) ? "заполнено только в actual" : "заполнено только в expected",
    };
  }

  if (a === null || e === null) {
    if (a === null && e === null) {
      return { path: fieldPath, kind, status: "exact", note: "оба null" };
    }
    return {
      path: fieldPath,
      kind,
      status: "diverged",
      note: `${show(a)} vs ${show(e)} — null против значения`,
    };
  }

  if (kind === "color") {
    if (isHex(a) && isHex(e)) {
      const result = compareColor(a, e);
      return { path: fieldPath, kind, ...result };
    }
    // "auto" или неожиданный формат — сравниваем строго.
    return {
      path: fieldPath,
      kind,
      status: a === e ? "exact" : "diverged",
      note: `${show(a)} vs ${show(e)}`,
    };
  }

  if (kind === "radius") {
    if (typeof a === "number" && typeof e === "number") {
      const result = compareNumber(fieldPath, a, e);
      return { path: fieldPath, kind, ...result };
    }
    return {
      path: fieldPath,
      kind,
      status: a === e ? "exact" : "diverged",
      note: `${show(a)} vs ${show(e)}`,
    };
  }

  if (kind === "number") {
    if (typeof a === "number" && typeof e === "number") {
      const result = compareNumber(fieldPath, a, e);
      return { path: fieldPath, kind, ...result };
    }
    return {
      path: fieldPath,
      kind,
      status: a === e ? "exact" : "diverged",
      note: `${show(a)} vs ${show(e)} — не числа`,
    };
  }

  // kind === "id"
  return {
    path: fieldPath,
    kind,
    status: a === e ? "exact" : "diverged",
    note: a === e ? `${show(a)}` : `${show(a)} vs ${show(e)}`,
  };
}

// ── Сравнение массивов ────────────────────────────────────────────────

/**
 * Длина, порядок ключей и структурные поля элементов. Тексты внутри
 * элементов проверяются только на наличие (вид `text`).
 */
function compareArray(arrayPath, { keyField = null, itemFields = [] } = {}) {
  const findings = [];
  const a = pick(actual, arrayPath);
  const e = pick(expected, arrayPath);

  if (a === MISSING && e === MISSING) {
    return [{ path: arrayPath, kind: "array", status: "absent_both", note: "нет ни там, ни там" }];
  }
  if (a === MISSING || e === MISSING) {
    return [
      {
        path: arrayPath,
        kind: "array",
        status: a === MISSING ? "missing_in_actual" : "missing_in_expected",
        note: "массив есть только в одном конфиге",
      },
    ];
  }

  const aList = Array.isArray(a) ? a : [];
  const eList = Array.isArray(e) ? e : [];

  findings.push({
    path: `${arrayPath}.length`,
    kind: "number",
    status: aList.length === eList.length ? "exact" : "diverged",
    note: `${aList.length} vs ${eList.length}`,
    detail: { delta: aList.length - eList.length },
  });

  if (keyField) {
    const aKeys = aList.map((item) => item?.[keyField] ?? "?");
    const eKeys = eList.map((item) => item?.[keyField] ?? "?");
    const same = aKeys.length === eKeys.length && aKeys.every((key, i) => key === eKeys[i]);
    findings.push({
      path: `${arrayPath}.order[${keyField}]`,
      kind: "id",
      status: same ? "exact" : "diverged",
      note: `[${aKeys.join(", ")}] vs [${eKeys.join(", ")}]`,
    });
  }

  const shared = Math.min(aList.length, eList.length);
  for (let index = 0; index < shared; index += 1) {
    for (const [field, kind] of itemFields) {
      findings.push(compareField(`${arrayPath}.${index}.${field}`, kind));
    }
  }

  return findings;
}

// ── Оси сравнения ─────────────────────────────────────────────────────

const CATEGORIES = [
  {
    name: "identity",
    title: "Идентификация",
    fields: [
      ["tenant_id", "id"],
      ["display_name", "id"],
      ["archetype", "id"],
      ["header.style", "id"],
      ["header.back_label", "text"],
      ["a11y_mode", "id"],
    ],
  },
  {
    name: "brand",
    title: "Бренд (цвета)",
    fields: [
      ["brand.primary", "color"],
      ["brand.on_primary", "color"],
      ["brand.accent", "color"],
      ["brand.secondary.fill", "color"],
      ["brand.secondary.text", "color"],
      ["brand.logo.kind", "id"],
      ["brand.logo.text", "text"],
      ["brand.logo.slot_ratio", "text"],
    ],
  },
  {
    name: "surface",
    title: "Поверхности (цвета)",
    fields: [
      ["surface.background", "color"],
      ["surface.card", "color"],
      ["surface.form", "color"],
      ["surface.border", "color"],
      ["surface.divider", "color"],
      ["surface.text_primary", "color"],
      ["surface.text_secondary", "color"],
      ["surface.danger", "color"],
      ["surface.field_error", "color"],
    ],
  },
  {
    name: "elevation",
    title: "Возвышение",
    fields: [
      ["elevation.model", "id"],
      ["elevation.border_width", "number"],
      ["elevation.selected_border_width", "number"],
      ["elevation.shadow.y", "number"],
      ["elevation.shadow.blur", "number"],
      ["elevation.shadow.alpha", "number"],
    ],
  },
  {
    name: "radius",
    title: "Форма",
    fields: [
      ["radius.card", "radius"],
      ["radius.control", "radius"],
      ["radius.field", "radius"],
      ["radius.chip", "radius"],
      ["radius.allow_inversion", "id"],
    ],
  },
  {
    name: "density",
    title: "Плотность",
    fields: [
      ["density.page_padding", "number"],
      ["density.block_gap", "number"],
      ["density.row_height", "number"],
      ["density.control_height", "number"],
      ["density.method_button_height", "number"],
      ["density.section_gap", "number"],
    ],
  },
  {
    name: "component_width",
    title: "Ширины компонентов",
    fields: [
      ["component_width.choice_card_pct", "number"],
      ["component_width.payment_card_pct", "number"],
    ],
  },
  {
    name: "typography",
    title: "Типографика",
    fields: [
      ["typography.family", "id"],
      ["typography.body", "number"],
      ["typography.h1", "number"],
      ["typography.section_title", "number"],
      ["typography.caption", "number"],
      ["typography.label_weight", "number"],
      ["typography.title_weight", "number"],
    ],
  },
  {
    name: "cta",
    title: "Главная кнопка",
    fields: [
      ["cta.placement", "id"],
      ["cta.label", "text"],
      ["cta.include_amount", "id"],
      ["cta.requires_selection", "id"],
    ],
  },
  {
    name: "payment_list",
    title: "Способы оплаты",
    fields: [
      ["payment_list.layout", "id"],
      ["payment_list.selection", "id"],
      ["payment_list.default_selected", "id"],
    ],
    arrays: [
      [
        "payment_list.methods",
        {
          keyField: "id",
          itemFields: [
            ["logo", "id"],
            ["caption", "text"],
          ],
        },
      ],
    ],
  },
  {
    name: "ozon",
    title: "Наш способ оплаты",
    fields: [
      ["ozon.label", "id"],
      ["ozon.position", "number"],
      ["ozon.adopts_tenant_theme", "id"],
      ["ozon.handoff", "id"],
      ["ozon.phone_gate.enabled", "id"],
      ["ozon.phone_gate.not_client_number", "id"],
      ["ozon.phone_gate.check_ms", "number"],
    ],
  },
  {
    name: "content",
    title: "Контент (структура)",
    fields: [
      ["content.title", "text"],
      ["content.back_link", "text"],
      ["content.segments.active", "id"],
      ["content.segments.badge.on", "id"],
      ["content.segments.badge.text", "text"],
      ["content.fulfillment.title", "text"],
      ["content.fulfillment.value", "text"],
      ["content.fulfillment.selected", "id"],
      ["content.fulfillment.extras_hint", "text"],
      ["content.fulfillment.extras_hint_compact", "text"],
      ["content.form.enabled", "id"],
      ["content.form.scheme_plates", "number"],
      ["content.autorenew.enabled", "id"],
      ["content.autorenew.default_checked", "id"],
      ["content.promo.enabled", "id"],
      ["content.items_title", "text"],
      ["content.items_title_compact", "text"],
      ["content.totals.sum", "number"],
      ["content.totals.discount", "number"],
      ["content.totals.currency", "id"],
      ["content.return_label", "text"],
      ["content.paid_title", "text"],
      ["content.payment_purpose", "text"],
      ["content.payment_category", "text"],
      ["content.summary_detail", "text"],
    ],
    arrays: [
      ["content.segments.items", { keyField: "id" }],
      [
        "content.rows",
        {
          itemFields: [
            ["is_action", "id"],
            ["label_compact", "text"],
          ],
        },
      ],
      [
        "content.fulfillment.options",
        {
          keyField: "id",
          itemFields: [
            ["price_delta", "number"],
            ["caption", "text"],
            ["price", "text"],
          ],
        },
      ],
      [
        "content.line_items",
        {
          itemFields: [
            ["media", "id"],
            ["period", "text"],
            ["old_price", "text"],
          ],
        },
      ],
    ],
  },
  {
    name: "demo",
    title: "Параметры демо",
    fields: [
      ["demo.balance", "text"],
      ["demo.timings.push_delay_ms", "number"],
      ["demo.timings.splash_ms", "number"],
      ["demo.timings.pay_loading_ms", "number"],
      ["demo.timings.dots_cycle_ms", "number"],
    ],
  },
];

// ── Прогон ────────────────────────────────────────────────────────────

const STATUSES = [
  "exact",
  "tolerated",
  "diverged",
  "missing_in_actual",
  "missing_in_expected",
  "absent_both",
];

const report = { categories: [] };

for (const category of CATEGORIES) {
  const findings = [];
  for (const [fieldPath, kind] of category.fields ?? []) {
    findings.push(compareField(fieldPath, kind));
  }
  for (const [arrayPath, options] of category.arrays ?? []) {
    findings.push(...compareArray(arrayPath, options));
  }

  const counts = Object.fromEntries(STATUSES.map((status) => [status, 0]));
  for (const finding of findings) counts[finding.status] += 1;

  report.categories.push({
    name: category.name,
    title: category.title,
    counts,
    compared: findings.length - counts.absent_both,
    findings,
  });
}

const total = Object.fromEntries(STATUSES.map((status) => [status, 0]));
for (const category of report.categories) {
  for (const status of STATUSES) total[status] += category.counts[status];
}
const compared = Object.values(total).reduce((sum, value) => sum + value, 0) - total.absent_both;
const matched = total.exact + total.tolerated;

report.summary = {
  compared,
  ...total,
  match_pct: compared === 0 ? 0 : Math.round((matched / compared) * 1000) / 10,
  exact_pct: compared === 0 ? 0 : Math.round((total.exact / compared) * 1000) / 10,
};

// ── Вывод ─────────────────────────────────────────────────────────────

const rel = (file) => path.relative(process.cwd(), path.resolve(file)) || file;

console.log(`actual:   ${rel(actualPath)}`);
console.log(`expected: ${rel(expectedPath)}`);
console.log(
  `клампов прочитано из схемы: ${Object.keys(CLAMPS).length}` +
    ` (пороги: цвет ≤${COLOR_IDENTICAL} — допуск, ≤${COLOR_NOTICEABLE} — заметно;` +
    ` число ≤ max(${NUMBER_TOLERANCE_ABS}, ${NUMBER_TOLERANCE_PCT * 100} %) — допуск)\n`,
);

const pad = (value, width) => String(value).padEnd(width);
const padStart = (value, width) => String(value).padStart(width);

console.log(
  `${pad("Ось", 22)}${padStart("точно", 7)}${padStart("допуск", 8)}${padStart("расх.", 7)}${padStart(
    "нет в A",
    9,
  )}${padStart("нет в E", 9)}${padStart("сверено", 9)}`,
);
console.log("-".repeat(71));
for (const category of report.categories) {
  console.log(
    pad(category.name, 22) +
      padStart(category.counts.exact, 7) +
      padStart(category.counts.tolerated, 8) +
      padStart(category.counts.diverged, 7) +
      padStart(category.counts.missing_in_actual, 9) +
      padStart(category.counts.missing_in_expected, 9) +
      padStart(category.compared, 9),
  );
}
console.log("-".repeat(71));
console.log(
  pad("ИТОГО", 22) +
    padStart(total.exact, 7) +
    padStart(total.tolerated, 8) +
    padStart(total.diverged, 7) +
    padStart(total.missing_in_actual, 9) +
    padStart(total.missing_in_expected, 9) +
    padStart(compared, 9),
);

console.log(
  `\nСовпадение: ${report.summary.match_pct} % (точно ${report.summary.exact_pct} %),` +
    ` полей сверено ${compared}, пропущено как отсутствующие в обоих — ${total.absent_both}.`,
);

const problems = report.categories.flatMap((category) =>
  category.findings
    .filter((finding) => finding.status !== "exact" && finding.status !== "absent_both")
    .map((finding) => ({ category: category.name, ...finding })),
);

if (problems.length === 0) {
  console.log("\nРасхождений нет: конфиги совпадают по всем сверяемым осям.");
} else {
  console.log(`\nРасхождения (${problems.length}):`);
  let current = null;
  for (const problem of problems) {
    if (problem.category !== current) {
      current = problem.category;
      console.log(`\n  [${current}]`);
    }
    const label =
      problem.status === "tolerated"
        ? "допуск"
        : problem.status === "diverged"
          ? "расх. "
          : problem.status === "missing_in_actual"
            ? "нет в A"
            : "нет в E";
    console.log(`    ${label}  ${problem.path}`);
    console.log(`             ${problem.note}`);
  }
}

// ── Машинный отчёт ────────────────────────────────────────────────────

const outPath = path.resolve(projectRoot, flags.out ?? "test-results/tenant-diff.json");
mkdirSync(path.dirname(outPath), { recursive: true });
writeFileSync(
  outPath,
  JSON.stringify(
    {
      at: new Date().toISOString(),
      actual: rel(actualPath),
      expected: rel(expectedPath),
      thresholds: {
        color_identical: COLOR_IDENTICAL,
        color_noticeable: COLOR_NOTICEABLE,
        number_tolerance_abs: NUMBER_TOLERANCE_ABS,
        number_tolerance_pct: NUMBER_TOLERANCE_PCT,
      },
      clamps: CLAMPS,
      ...report,
    },
    null,
    2,
  ),
  "utf8",
);

console.log(`\nОтчёт: ${rel(outPath)}`);
