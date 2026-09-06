import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

import { decodePng, pixelAt } from "./lib/png-pixels.mjs";

/**
 * Регресс тем: экран сегодня против принятого эталона.
 *
 * Запуск:
 *   yarn check:visual                 # сравнить с эталоном
 *   yarn check:visual --update        # принять текущий вид как эталон
 *   yarn check:visual --only=rml      # один кадр (подстрока имени)
 *
 * ── Зачем ─────────────────────────────────────────────────────────────
 *
 * Тем тринадцать, а общего кода под ними — один. Любая правка компонента,
 * шкалы или схемы задевает все тринадцать сразу, и заметить это может только
 * человек, открывший каждую. Приёмка снимала 55 скриншотов и НИ ОДИН не
 * сравнивала: они были для глаз.
 *
 * Проверка не судит о сходстве с донором — на это она не способна и не должна;
 * она отвечает на другой вопрос: «изменилось ли то, что мы не собирались
 * менять». Расхождение — не всегда дефект: намеренную правку принимают
 * флагом `--update`, и тогда новый вид уезжает в эталон вместе с коммитом,
 * где видно, что именно поехало.
 *
 * ── Почему свой сравниватель ──────────────────────────────────────────
 *
 * Декодер PNG в проекте уже есть (`lib/png-pixels.mjs`, без зависимостей), а
 * сравнение поверх него — цикл по пикселям. Ставить odiff или pixelmatch
 * ради этого значит завести нативный бинарник в сборку, которая его больше
 * нигде не использует.
 *
 * ── Пороги и их цена ──────────────────────────────────────────────────
 *
 * `TOLERANCE` — сглаживание шрифтов и субпиксельные края дают расхождение в
 * младших битах даже между двумя прогонами одного кода. `THRESHOLD` — доля
 * несовпавших пикселей, ниже которой кадр считается тем же. Пороги подобраны
 * так, чтобы сдвиг блока на 1 px уже валил проверку: у кадра 390×844 это
 * ~0.4% площади, вдвое выше порога.
 *
 * Снимок делается с выключенным движением и DPR 1: анимация недетерминирована,
 * а удвоенная плотность утроила бы вес эталонов в репозитории, ничего не
 * добавив к раскладке.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, "..");
const BASELINE = path.join(here, "baseline");
const OUT = path.join(projectRoot, "test-results", "visual");

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const BASE = arg("base", "http://127.0.0.1:4319");
const ONLY = arg("only", null);
const UPDATE = process.argv.includes("--update");

const TOLERANCE = 24;
const THRESHOLD = 0.002;
const WIDTH = 390;
const HEIGHT = 844;

/**
 * Кадры регресса. У каждой темы ДВА кадра, и это не избыточность:
 *
 *   1. первый экран — там живёт айдентика подрядчика;
 *   2. `stage=paid` — экран возврата. Он рисуется В ТЕМЕ ПОДРЯДЧИКА и потому
 *      у каждой выглядит по-своему, а снят был только у одной: правка общего
 *      кода возврата меняла вид у тринадцати тем, и регресс этого не видел.
 *
 * Плюс общие экраны демо (банк и пуш) — их тема не красит, но задеть может
 * любая правка общего кода.
 */
const TENANT_SLUGS = readdirSync(path.join(projectRoot, "tenants"))
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.replace(/\.json$/, ""));

const FRAMES = [
  ...TENANT_SLUGS.map((slug) => [`tenant-${slug}`, `/?tenant=${slug}`]),
  ...TENANT_SLUGS.map((slug) => [`paid-${slug}`, `/?tenant=${slug}&stage=paid`]),
  ["bank-splash", "/?tenant=flowwow-like&stage=splash"],
  ["bank-payment", "/?tenant=flowwow-like&stage=bank_payment"],
  ["bank-success", "/?tenant=flowwow-like&stage=bank_success"],
  ["bank-push", "/?tenant=flowwow-like&stage=push"],
  /*
   * Экраны банка у темы с подпиской: только там появляются сноска про
   * условия автосписаний под кнопкой и баннер под чеком. У flowwow этих
   * блоков нет вовсе (платёж разовый), поэтому кадрами выше они не
   * сторожатся.
   */
  ["bank-payment-plus", "/?tenant=yandex-plus&stage=bank_payment"],
  ["bank-success-plus", "/?tenant=yandex-plus&stage=bank_success"],
  /*
   * A3 Pay начинается на две стадии раньше остальных тем, и первый кадр
   * (`tenant-a3pay`) снимает домашний экран устройства, а не форму. Поэтому
   * два кадра сверх общего правила: уведомление о счёте на домашнем экране
   * и сама карточка подписки — без них регресс не видел бы ни системного
   * слоя, ни экрана, ради которого тема заведена.
   */
  ["a3pay-home-push", "/?tenant=a3pay&stage=home_push"],
  ["a3pay-card", "/?tenant=a3pay&stage=contractor"],
  // Splash приложения сервиса: пара к splash банка, и такой же кадр
  // смены айдентики — только в обратную сторону.
  ["a3pay-app-splash", "/?tenant=a3pay&stage=app_splash"],
];

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: WIDTH, height: HEIGHT },
  deviceScaleFactor: 1,
  // Движение недетерминировано: кадр, снятый на полпути анимации, разойдётся
  // сам с собой между прогонами.
  reducedMotion: "reduce",
});

mkdirSync(BASELINE, { recursive: true });
mkdirSync(OUT, { recursive: true });

const rows = [];
let failed = 0;
let updated = 0;

for (const [name, query] of FRAMES) {
  if (ONLY && !name.includes(ONLY)) continue;

  const page = await context.newPage();
  await page.goto(`${BASE}${query}`, { waitUntil: "networkidle" });
  // Шрифты темы приезжают файлами: кадр до их готовности снят другой гарнитурой.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
  const shot = await page.screenshot();
  await page.close();

  const goldPath = path.join(BASELINE, `${name}.png`);

  if (UPDATE || !existsSync(goldPath)) {
    writeFileSync(goldPath, shot);
    updated += 1;
    rows.push(`  ${name}: эталон ${existsSync(goldPath) && !UPDATE ? "создан" : "обновлён"}`);
    continue;
  }

  const gold = decodePng(readFileSync(goldPath));
  const now = decodePng(shot);

  if (gold.width !== now.width || gold.height !== now.height) {
    failed += 1;
    rows.push(`  ${name}: РАЗМЕР ${now.width}×${now.height} против эталонных ${gold.width}×${gold.height}`);
    writeFileSync(path.join(OUT, `${name}.now.png`), shot);
    continue;
  }

  let diffPixels = 0;
  let firstDiff = null;
  for (let y = 0; y < gold.height; y += 1) {
    for (let x = 0; x < gold.width; x += 1) {
      const a = pixelAt(gold, x, y);
      const b = pixelAt(now, x, y);
      if (
        Math.abs(a[0] - b[0]) > TOLERANCE ||
        Math.abs(a[1] - b[1]) > TOLERANCE ||
        Math.abs(a[2] - b[2]) > TOLERANCE
      ) {
        diffPixels += 1;
        if (!firstDiff) firstDiff = [x, y];
      }
    }
  }

  const share = diffPixels / (gold.width * gold.height);
  if (share > THRESHOLD) {
    failed += 1;
    writeFileSync(path.join(OUT, `${name}.now.png`), shot);
    rows.push(
      `  ${name}: РАСХОЖДЕНИЕ ${(share * 100).toFixed(2)}% пикселей ` +
        `(порог ${(THRESHOLD * 100).toFixed(1)}%), первое в ${firstDiff.join(",")} — ` +
        `кадр в test-results/visual/${name}.now.png`,
    );
  } else {
    rows.push(`  ${name}: совпал (расхождение ${(share * 100).toFixed(2)}%)`);
  }
}

await browser.close();

console.log("visual: экран против принятого эталона");
console.log(rows.join("\n"));

if (updated > 0) {
  console.log(`\nЭталонов записано: ${updated} → tests/baseline/. Проверь diff коммита: там видно, что именно изменилось.`);
}
if (failed > 0) {
  console.log(`\nРАСХОЖДЕНИЙ: ${failed}. Если правка намеренная — yarn check:visual --update.`);
  process.exit(1);
}
console.log(`\n  кадров сверено: ${rows.length}`);
process.exit(0);
