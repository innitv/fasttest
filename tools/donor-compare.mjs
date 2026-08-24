import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

/**
 * Донор и наш экран, положенные рядом по измеримым признакам.
 *
 * Запуск:
 *   yarn donor:compare --url=https://donor.example/checkout --route=tripster
 *   yarn donor:compare --url=... --route=... --width=390 --out=<файл.json>
 *
 * ── Зачем ─────────────────────────────────────────────────────────────
 *
 * Ни одна из проверок демо не сравнивает результат с донором — они сторожат
 * инварианты нашего кода. Это записано в `CLAUDE.md` прямым текстом, и цена
 * известна: за одну сессию владелец нашёл десять расхождений при полностью
 * зелёной приёмке.
 *
 * Пиксельно сравнивать нельзя и не нужно: у донора свой контент, свои
 * размеры и своя длина текстов — «похожесть кадров» здесь ничего не значит.
 * Сравнимы ПРИЗНАКИ, по которым узнаётся чужая страница:
 *
 *   1. Профиль высот — накопленная координата низа. Совпадение всех зазоров
 *      ничего не доказывает: межстрочный интервал донора плотнее дефолтного,
 *      лишние 6-8 px на строке дают под сотню к низу экрана. У совпадающих
 *      страниц накопленная координата сходится, у разошедшихся расхождение
 *      растёт сверху вниз. Диагноз — `FIXES.md`, баг 12.
 *   2. Типографика — набор кеглей и весов, и ФАКТИЧЕСКАЯ гарнитура отдельно
 *      по кириллице и латинице (диагнозы 10 и 16).
 *   3. Палитра — цвета фона и текста по частоте.
 *   4. Плотность — медиана внутренних отступов и радиусов.
 *
 * ── Донор за логином ──────────────────────────────────────────────────
 *
 * У половины доноров нужная страница гостю не отдаётся: чекаут требует живой
 * корзины. Тогда зонд `donor-probe.js` вставляется в консоль браузера
 * владельца, вывод `donorProbe({ mode: "full" })` сохраняется в файл, и он
 * передаётся сюда через `--donor-json=<файл>`. Сравнение то же самое.
 *
 * Инструмент НИЧЕГО не утверждает и всегда возвращает 0: решение о том,
 * расхождение это или намеренное отличие демо, принимает человек. Пороги
 * схемы (зона нажатия 44, кегль поля 16) перебивают донора намеренно и
 * закономерно попадут в отчёт как расхождение — так и должно быть.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, "..");

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const donorUrl = arg("url");
const donorJson = arg("donor-json");
const routeRaw = arg("route");
if ((!donorUrl && !donorJson) || !routeRaw) {
  console.error("Нужны --route=<маршрут демо, например tripster> и один из источников донора:");
  console.error("  --url=<адрес>        — страница донора открывается гостю");
  console.error('  --donor-json=<файл>  — дамп donorProbe({mode:"full"}) из браузера владельца');
  process.exit(2);
}
if (/^[A-Za-z]:[\\/]/.test(routeRaw)) {
  console.error(`Маршрут приехал как путь Windows: ${routeRaw}. Передай без слэша или запусти с MSYS_NO_PATHCONV=1.`);
  process.exit(2);
}

const BASE = arg("base", "http://127.0.0.1:4319");
const ROUTE = routeRaw.startsWith("/") ? routeRaw : `/${routeRaw}`;
const WIDTH = Number(arg("width", "390"));
const HEIGHT = Number(arg("height", "844"));
const OUT = arg("out", path.join(projectRoot, "test-results", "donor-compare.json"));

const probe = readFileSync(path.join(here, "donor-probe.js"), "utf8");

const browser = await chromium.launch();

async function profile(url) {
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    isMobile: WIDTH < 768,
    hasTouch: WIDTH < 768,
  });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
  // Ленивые блоки донора: без прокрутки высоты соврут.
  await page.evaluate(async () => {
    const step = window.innerHeight;
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 200));
  });
  await page.addScriptTag({ content: probe });
  const nodes = JSON.parse(await page.evaluate(() => window.donorProbe({ mode: "full" })));
  const height = await page.evaluate(() => Math.round(document.documentElement.scrollHeight));
  await context.close();
  return { url, height, nodes };
}

/** Медиана — устойчивее среднего к одному огромному блоку. */
const median = (values) => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

const top = (values, limit) => {
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value, n]) => `${value}×${n}`);
};

function digest({ url, height, nodes }) {
  const text = nodes.filter((n) => n.text);
  const px = (v) => (v ? Math.round(parseFloat(v)) : null);

  return {
    url,
    высотаСтраницы: height,
    узлов: nodes.length,
    кегли: top(text.map((n) => px(n.style.fontSize)).filter(Boolean), 6),
    веса: top(text.map((n) => n.style.fontWeight).filter(Boolean), 5),
    гарнитураКириллица: top(text.map((n) => n.fonts?.cyrillic).filter(Boolean), 3),
    гарнитураЛатиница: top(text.map((n) => n.fonts?.latin).filter(Boolean), 3),
    цветаТекста: top(text.map((n) => n.style.color).filter(Boolean), 4),
    фоны: top(nodes.map((n) => n.style.backgroundColor).filter(Boolean), 4),
    медианаРадиуса: median(nodes.map((n) => px(n.style.borderRadius)).filter((v) => v !== null && v < 100)),
    медианаПоляСлева: median(nodes.map((n) => px(n.style.paddingLeft)).filter((v) => v)),
    /*
     * Профиль высот. Обёртки, повторяющие геометрию уже взятого блока,
     * выбрасываются: цепочка body > div > div > section одной высоты
     * забивает список и делает сравнение бессмысленным.
     */
    профиль: nodes
      .filter((n) => n.w >= WIDTH * 0.5 && n.h >= 40)
      .reduce((kept, n) => {
        const duplicate = kept.some((k) => Math.abs(k.y - n.y) <= 2 && Math.abs(k.h - n.h) <= 2);
        if (!duplicate) kept.push(n);
        return kept;
      }, [])
      .slice(0, 24)
      .map((n) => ({ y: n.y, h: n.h, bottom: n.bottom, tag: n.tag, text: n.text?.slice(0, 24) })),
  };
}

const donor = donorJson
  ? digest({
      url: `${path.basename(donorJson)} (дамп из браузера)`,
      // Высота страницы в дампе не хранится: берём низ самого нижнего блока.
      height: Math.max(...JSON.parse(readFileSync(donorJson, "utf8")).map((n) => n.bottom ?? 0)),
      nodes: JSON.parse(readFileSync(donorJson, "utf8")),
    })
  : digest(await profile(donorUrl));
const ours = digest(await profile(`${BASE}${ROUTE}`));
await browser.close();

mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({ donor, ours }, null, 1), "utf8");

const line = (label, a, b) => {
  const same = JSON.stringify(a) === JSON.stringify(b);
  const fmt = (v) => (Array.isArray(v) ? v.join(", ") : String(v));
  console.log(`${same ? "  =" : "  ≠"} ${label}`);
  console.log(`      донор: ${fmt(a)}`);
  console.log(`      наш:   ${fmt(b)}`);
};

console.log(`\nДонор:  ${donor.url}`);
console.log(`Наш:    ${BASE}${ROUTE}\n`);

for (const key of [
  "высотаСтраницы", "кегли", "веса", "гарнитураКириллица", "гарнитураЛатиница",
  "цветаТекста", "фоны", "медианаРадиуса", "медианаПоляСлева",
]) {
  line(key, donor[key], ours[key]);
}

console.log("\nПрофиль высот. Блоки сопоставлены ПО ПОРЯДКУ следования, а не по смыслу:");
console.log("Колонка Δ осмысленна только когда донор — ТА САМАЯ страница, что легла в архетип.");
const rows = Math.max(donor.профиль.length, ours.профиль.length);
for (let i = 0; i < Math.min(rows, 14); i += 1) {
  const d = donor.профиль[i];
  const o = ours.профиль[i];
  const cell = (n) => (n ? `${String(n.bottom).padStart(5)} h${String(n.h).padStart(4)} ${n.tag}`.padEnd(22) : "—".padEnd(22));
  const drift = d && o ? o.bottom - d.bottom : null;
  console.log(`  ${cell(d)} | ${cell(o)} | ${drift === null ? "" : `Δ низа ${drift > 0 ? "+" : ""}${drift}`}`);
}

console.log(`\nОтчёт целиком: ${path.relative(process.cwd(), OUT)}`);
console.log("Инструмент измеряет, а не судит: пороги схемы (зона 44, кегль поля 16) перебивают донора намеренно.");
