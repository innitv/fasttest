import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

/**
 * Снятие донора через Playwright — обёртка над `tools/donor-probe.js`.
 *
 * Сам зонд живёт в отдельном файле и является ИСТОЧНИКОМ ПРАВДЫ: он же
 * вставляется в консоль браузера владельца, когда донор не отдаёт страницу
 * гостю (у половины доноров чекаут требует живой корзины). Здесь только
 * доставка: открыть, дождаться, прокрутить, вызвать, сохранить.
 *
 * Запуск:
 *   yarn donor:snap --url=https://example.com
 *   yarn donor:snap --url=... --mode=full --width=390 --out=<файл.json>
 *
 * Прокрутка до низа обязательна: доноры грузят афиши и карточки лениво, и
 * снимок без прокрутки отдаёт полупустую страницу с неверными высотами.
 *
 * Код возврата всегда 0: это инструмент, а не проверка.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, "..");

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const url = arg("url");
if (!url) {
  console.error("Нужен --url=<адрес донора>");
  process.exit(2);
}

const MODE = arg("mode", "summary");
const WIDTH = Number(arg("width", "390"));
const HEIGHT = Number(arg("height", "844"));
const OUT = arg("out", path.join(projectRoot, "test-results", "donors", `${new URL(url).hostname}.json`));

const probe = readFileSync(path.join(here, "donor-probe.js"), "utf8");

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: WIDTH, height: HEIGHT },
  deviceScaleFactor: 2,
  isMobile: WIDTH < 768,
  hasTouch: WIDTH < 768,
});
const page = await context.newPage();
await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });

// Ленивые блоки: прокрутить до низа и вернуться, иначе высоты соврут.
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
const result = await page.evaluate((mode) => window.donorProbe({ mode }), MODE);

mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, result, "utf8");

const shot = OUT.replace(/\.json$/, ".png");
await page.screenshot({ path: shot, fullPage: true });

await browser.close();

console.log(`Снято: ${url}`);
console.log(`  данные:   ${path.relative(process.cwd(), OUT)} (${(result.length / 1024).toFixed(1)} КБ, режим ${MODE})`);
console.log(`  страница: ${path.relative(process.cwd(), shot)}`);
console.log(`\nСниппет для консоли браузера владельца: tools/donor-probe.js — вставить целиком, затем donorProbe().`);
