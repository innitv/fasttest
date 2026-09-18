import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

/**
 * Превью первых экранов для страницы ссылок `/__launcher`.
 *
 * ── Зачем ─────────────────────────────────────────────────────────────
 *
 * Шестнадцать строк «имя + путь + одна фраза» различаются хуже, чем кажется:
 * выбирая, какую ссылку показать, человек вспоминает ВИД экрана, а не
 * формулировку архетипа. Миниатюра отвечает на это одним взглядом.
 *
 * ── Почему отдельный скрипт, а не эталоны регресса ────────────────────
 *
 * Кадры в `tests/baseline/` — источник правды для `check:visual`: они
 * снимаются в своём профиле, принимаются осознанно и лежат вне `public/`.
 * Показывать их на странице значит связать две несвязанные вещи: обновление
 * превью начало бы валить регресс, а принятие регресса — молча менять
 * страницу. Поэтому превью снимаются отдельно и живут в `public/previews/`.
 *
 * ── Вес ───────────────────────────────────────────────────────────────
 *
 * JPEG вместо PNG и обрезка до верхних 420 px: шестнадцать PNG-кадров 375×812
 * весят около 1.6 МБ, шестнадцать обрезанных JPEG — около 250 КБ. Страница
 * служебная, но грузится с телефона по мобильной сети.
 *
 * Запуск: yarn previews  (нужен поднятый `yarn preview` на 4319)
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, "..");
const OUT = path.join(projectRoot, "public", "previews");

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const BASE = arg("base", "http://127.0.0.1:4319");

const slugs = readdirSync(path.join(projectRoot, "tenants"))
  .filter((file) => file.endsWith(".json"))
  .map((file) => file.replace(/\.json$/, ""));

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 375, height: 812 },
  deviceScaleFactor: 2,
  // Кадр на полпути анимации — это кадр другого экрана.
  reducedMotion: "reduce",
});

const rows = [];
for (const slug of slugs) {
  const page = await context.newPage();
  await page.goto(`${BASE}/?tenant=${slug}`, { waitUntil: "networkidle" });
  // Шрифты темы приезжают файлами: кадр до их готовности снят чужой гарнитурой.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
  const shot = await page.screenshot({
    type: "jpeg",
    quality: 62,
    clip: { x: 0, y: 0, width: 375, height: 420 },
  });
  writeFileSync(path.join(OUT, `${slug}.jpg`), shot);
  rows.push(`  ${slug}: ${(shot.length / 1024).toFixed(0)} КБ`);
  await page.close();
}

await browser.close();

const total = slugs.reduce(
  (sum, slug) => sum + readFileSync(path.join(OUT, `${slug}.jpg`)).length,
  0,
);
console.log(`previews: снято ${slugs.length}`);
console.log(rows.join("\n"));
console.log(`  всего: ${(total / 1024).toFixed(0)} КБ → public/previews/`);
