import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

/**
 * Статическая проверка архитектурной границы темы.
 *
 * `HandoffOverlay` — наш экран, а не экран подрядчика. Он не имеет права
 * читать ни один токен `tenant.json`. Проверка ищет в файле любое упоминание
 * слоя `--t-*` и любой импорт из `theme/`.
 *
 * Запуск: yarn check:theme  (или node tests/theme-boundary.check.mjs)
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const target = path.resolve(here, "../src/components/HandoffOverlay.tsx");
const source = readFileSync(target, "utf8");

const failures = [];

const tokenMatches = source.match(/--t-[a-z0-9-]+/g);
if (tokenMatches) {
  failures.push(
    `Найдены токены темы подрядчика: ${[...new Set(tokenMatches)].join(", ")}`,
  );
}

const themeImports = source.match(/from\s+"[^"]*theme\/[^"]*"/g);
if (themeImports) {
  failures.push(`Найдены импорты из theme/: ${themeImports.join(", ")}`);
}

if (/tenant/i.test(source.replace(/подрядчик\w*/gi, ""))) {
  const lines = source
    .split("\n")
    .map((line, index) => [index + 1, line])
    .filter(([, line]) => /tenant/i.test(line) && !line.trimStart().startsWith("*"));
  if (lines.length > 0) {
    failures.push(
      `Найдены упоминания tenant вне комментариев: ${lines
        .map(([n]) => `строка ${n}`)
        .join(", ")}`,
    );
  }
}

/**
 * ── Двусторонняя граница темы после расширения флоу ───────────────────
 *
 * Экраны банка (`O-1`…`O-3`, баннер `O-0`) не читают ни одного токена
 * подрядчика; экран возврата (`O-4`) не читает ни одного токена банка.
 * Проверка идёт в ОБЕ стороны — иначе достаточно один раз перепутать
 * направление, и демо перестанет показывать смену айдентики.
 */
const BANK_SOURCES = [
  ...readdirSync(path.resolve(here, "../src/components/bank")).map((file) =>
    path.resolve(here, "../src/components/bank", file),
  ),
  path.resolve(here, "../src/views/BankSplashScreen.tsx"),
  path.resolve(here, "../src/views/BankPaymentScreen.tsx"),
  path.resolve(here, "../src/views/BankSuccessScreen.tsx"),
];

for (const file of BANK_SOURCES) {
  if (!/\.tsx?$/.test(file)) continue;
  const text = readFileSync(file, "utf8");
  const tenantTokens = text.match(/--t-[a-z0-9-]+/g);
  if (tenantTokens) {
    failures.push(
      `${path.basename(file)}: токены темы подрядчика на экране банка — ${[
        ...new Set(tenantTokens),
      ].join(", ")}`,
    );
  }
}

const paidFile = path.resolve(here, "../src/views/PaidConfirmationScreen.tsx");
const paidText = readFileSync(paidFile, "utf8");
const bankTokens = paidText.match(/--bank-[a-z0-9-]+/g);
if (bankTokens) {
  failures.push(
    `PaidConfirmationScreen.tsx: токены банка на экране подрядчика — ${[
      ...new Set(bankTokens),
    ].join(", ")}`,
  );
}

/**
 * Блок проверки телефона живёт НА ЭКРАНЕ ПОДРЯДЧИКА, до смены айдентики:
 * читает тему подрядчика и не содержит ни одного токена банка. Поле, синее
 * посреди корзины, украло бы момент смены языка интерфейса за два шага до него.
 */
const PHONE_SOURCES = [
  path.resolve(here, "../src/components/PhoneGateBlock.tsx"),
  path.resolve(here, "../src/lib/phone.ts"),
];
for (const file of PHONE_SOURCES) {
  const text = readFileSync(file, "utf8");
  const phoneBankTokens = text.match(/--bank-[a-z0-9-]+/g);
  if (phoneBankTokens) {
    failures.push(
      `${path.basename(file)}: токены банка в блоке проверки телефона — ${[
        ...new Set(phoneBankTokens),
      ].join(", ")}`,
    );
  }
}

/**
 * ── Написание бренда: граница по РОЛИ УЗЛА, не по подстроке ───────────
 *
 * Строчное «ozon банк» допустимо только внутри `BankWordmark` — он слот
 * графического ассета, а не текстовый узел. Исключение привязано к файлу
 * компонента-слота: список разрешённых подстрок начал бы пропускать
 * опечатки в обычном тексте.
 */
const WORDMARK_SLOT = path.resolve(
  here,
  "../src/components/bank/BankWordmark.tsx",
);
const FORBIDDEN_SPELLINGS = [
  "ozon банк",
  "Озон Банк",
  "Ozon Bank",
  "Ozone Bank",
  "OZON БАНК",
];

const allSources = [];
for (const dir of ["../src/components", "../src/components/bank", "../src/views", "../src/content"]) {
  const abs = path.resolve(here, dir);
  for (const file of readdirSync(abs)) {
    const full = path.resolve(abs, file);
    if (/\.tsx?$/.test(file)) allSources.push(full);
  }
}

for (const file of allSources) {
  if (file === WORDMARK_SLOT) continue; // слот ассета — исключение по роли
  const text = readFileSync(file, "utf8");
  for (const spelling of FORBIDDEN_SPELLINGS) {
    if (text.includes(spelling)) {
      failures.push(
        `${path.basename(file)}: запрещённое написание бренда «${spelling}» вне слота BankWordmark`,
      );
    }
  }
}

const wordmarkText = readFileSync(WORDMARK_SLOT, "utf8");
if (!wordmarkText.includes('aria-hidden="true"')) {
  failures.push("BankWordmark: графика логотипа не помечена aria-hidden");
}
if (!wordmarkText.includes('a11y.bank_logo')) {
  failures.push("BankWordmark: отсутствует визуально скрытая метка «Ozon Банк»");
}

/**
 * Гигиена токенов: ни один компонент экрана подрядчика не содержит зашитых
 * цветов. Исключения — наши собственные поверхности, которые тему подрядчика
 * не читают по определению.
 */
const OUR_SURFACES = new Set([
  "HandoffOverlay.tsx",
  "ConfigErrorView.tsx",
  "LauncherView.tsx",
  "StubView.tsx",
  // Экраны банка — наша сторона: собственный слой `--bank-*`, тему
  // подрядчика не читают. Донорский градиент задан стопами в файле.
  "BankSuccessScreen.tsx",
]);

const scanDirs = [
  path.resolve(here, "../src/components"),
  path.resolve(here, "../src/components/bank"),
  path.resolve(here, "../src/views"),
];

const hardcoded = [];
for (const dir of scanDirs) {
  for (const file of readdirSync(dir)) {
    if (!/\.tsx?$/.test(file) || OUR_SURFACES.has(file)) continue;
    const text = readFileSync(path.join(dir, file), "utf8");
    text.split("\n").forEach((line, index) => {
      const match = line.match(/#[0-9A-Fa-f]{3,8}\b/);
      if (match) hardcoded.push(`${file}:${index + 1} → ${match[0]}`);
    });
  }
}
if (hardcoded.length > 0) {
  failures.push(`Зашитые цвета в компонентах экранов: ${hardcoded.join(", ")}`);
}

if (failures.length > 0) {
  console.error("theme-boundary: ПРОВАЛ");
  failures.forEach((item) => console.error(`  - ${item}`));
  process.exit(1);
}

console.log(
  "theme-boundary: пройдено\n" +
    "  - HandoffOverlay не читает ни одного токена tenant.json\n" +
    "  - экраны банка не содержат ни одной переменной --t-*\n" +
    "  - PaidConfirmation не содержит ни одной переменной --bank-*\n" +
    "  - строчное написание бренда встречается только внутри слота BankWordmark\n" +
    "  - зашитых цветов в компонентах экранов подрядчика нет",
);
