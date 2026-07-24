import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium, devices } from "playwright";

/**
 * Мобильная приёмка демо: профиль телефона, а не узкое окно десктопа.
 *
 * Зачем отдельно от `verify.mjs`. Тот прогон ходит десктопным контекстом с
 * узким вьюпортом — тач-события, безопасные зоны и фон системных полос там
 * не воспроизводятся вовсе, и четыре бага, найденные на живом iPhone, он
 * пропустил. Здесь контекст берётся из профиля устройства
 * (`isMobile`, `hasTouch`, deviceScaleFactor), а жесты подаются настоящими
 * тач-событиями через CDP, а не эмуляцией мыши.
 *
 * Проверяется ровно то, что ломалось на устройстве:
 *   1. фон страницы и `theme-color` совпадают с фоном текущего экрана
 *      (иначе системные зоны iOS красятся серым);
 *   2. горизонтальный свайп листает ряд, вертикальный с карточки листает
 *      страницу, тап выбирает карточку; drag мышью на десктопе цел;
 *   3. пуш-баннер виден целиком и не сдвигает низ экрана — на ОБОИХ
 *      архетипах;
 *   4. композиция экрана успеха центрирована и не наезжает на кнопку на
 *      реальных ширинах и высотах iPhone.
 *
 * Запуск (сервер должен быть уже поднят):
 *   yarn preview            # в отдельном окне
 *   yarn check:mobile       # или: node tests/mobile.check.mjs --base=... --out=...
 */

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, "").split("=");
    return [key, rest.join("=")];
  }),
);

const BASE = args.base ?? "http://127.0.0.1:4319";
const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, "..");
const OUT = path.resolve(projectRoot, args.out ?? "test-results/mobile");
mkdirSync(OUT, { recursive: true });

/** Профиль телефона: тач, мобильный вьюпорт, DPR устройства. */
const PHONE = devices["iPhone 13"];

const results = [];
const record = (id, passed, detail) => {
  results.push({ id, passed, detail });
  console.log(`${passed ? "PASS" : "FAIL"}  ${id}\n      ${detail}`);
};

const browser = await chromium.launch();

async function withPhone(route, fn, viewport) {
  const context = await browser.newContext({
    ...PHONE,
    ...(viewport ? { viewport } : {}),
    reducedMotion: "no-preference",
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  const value = await fn(page, cdp);
  await context.close();
  return value;
}

/**
 * Настоящий свайп пальцем: touchStart → серия touchMove → touchEnd.
 * `Input.dispatchTouchEvent` идёт через тот же конвейер ввода, что и жест на
 * устройстве, поэтому уважает `touch-action`, `overflow` и вложенность
 * прокручиваемых контейнеров — ровно то, что и ломалось.
 */
async function swipe(page, cdp, { x, y, dx, dy, steps = 12 }) {
  const send = (type, touchPoints) =>
    cdp.send("Input.dispatchTouchEvent", { type, touchPoints });
  await send("touchStart", [{ x, y }]);
  for (let i = 1; i <= steps; i += 1) {
    await send("touchMove", [{ x: x + (dx * i) / steps, y: y + (dy * i) / steps }]);
    await page.waitForTimeout(16);
  }
  await send("touchEnd", []);
  await page.waitForTimeout(450);
}

// ═══ 1. Фон системных зон устройства ══════════════════════════════════
{
  const rows = [];
  let ok = true;
  const stages = [
    ["/flowwow", "экран подрядчика A"],
    ["/flowwow?stage=push", "пуш"],
    ["/flowwow?stage=splash", "splash банка"],
    ["/flowwow?stage=bank_success", "успех банка"],
    ["/flowwow?stage=paid", "возврат к подрядчику"],
    ["/uchi", "экран подрядчика B"],
    ["/uchi?stage=bank_payment", "оплата в банке"],
    // Заглушка корня — тоже поверхность, на которую можно попасть с телефона,
    // и она тёмная: без синхронизации вокруг неё были бы светлые полосы.
    ["/", "нейтральная заглушка"],
  ];
  for (const [route, label] of stages) {
    const r = await withPhone(route, async (page) => {
      await page.waitForTimeout(600);
      return page.evaluate(() => {
        const frame = document.querySelector('[data-testid="phone-frame"]');
        return {
          body: getComputedStyle(document.body).backgroundColor,
          canvas: getComputedStyle(document.documentElement)
            .getPropertyValue("--page-canvas")
            .trim(),
          theme: document.querySelector('meta[name="theme-color"]')?.content ?? null,
          // Заглушка и экран ошибки конфига колонку не рендерят.
          frameScrollTop: frame ? frame.scrollTop : 0,
        };
      });
    });
    // Ключевой инвариант: фон страницы = измеренный фон верхней кромки экрана
    // и он же в `theme-color`. Ахроматичный «стол» (#e6e7ea) на телефоне
    // запрещён — это и были серые полосы.
    const passed =
      r.canvas !== "" &&
      r.body === r.canvas &&
      r.theme === r.canvas &&
      !/230,\s*231,\s*234/.test(r.body) &&
      r.frameScrollTop === 0;
    if (!passed) ok = false;
    rows.push(`${label}: body=${r.body}, theme-color=${r.theme}`);
  }
  record(
    "1. Фон страницы и theme-color следуют за фоном текущего экрана",
    ok,
    rows.join(" | "),
  );
}

// ═══ 2. Тач-жесты на горизонтальных рядах ═════════════════════════════
{
  const data = await withPhone("/flowwow", async (page, cdp) => {
    const read = () =>
      page.evaluate(() => ({
        row: document.querySelector('[data-testid="choice-card-row"]').scrollLeft,
        page: document.querySelector('[data-testid="scroll-container"]').scrollTop,
      }));

    const box = await page.locator('[data-testid="choice-card-row"]').boundingBox();
    const cx = Math.round(box.x + box.width / 2);
    const cy = Math.round(box.y + box.height / 2);

    // Горизонтальный свайп по ряду — ряд едет.
    await swipe(page, cdp, { x: cx, y: cy, dx: -140, dy: 0 });
    const afterH = await read();

    // Вертикальный свайп, начатый НА КАРТОЧКЕ, — листается страница.
    const beforeV = await read();
    await swipe(page, cdp, { x: cx, y: cy, dx: 0, dy: -200 });
    const afterV = await read();

    // Тап по карточке по-прежнему выбирает её.
    const cards = await page.locator('[data-testid^="choice-card-"]').all();
    const cardBox = await cards[1].boundingBox();
    await page.touchscreen.tap(
      Math.round(cardBox.x + cardBox.width / 2),
      Math.round(cardBox.y + cardBox.height / 2),
    );
    await page.waitForTimeout(250);
    const selected = await page.evaluate(() =>
      [...document.querySelectorAll('[data-testid^="choice-card-"]')].map(
        (el) => el.dataset.selected,
      ),
    );

    // Второй горизонтальный ряд — способы оплаты.
    const payBox = await page.locator('[data-testid="payment-method-list"]').boundingBox();
    await swipe(page, cdp, {
      x: Math.round(payBox.x + payBox.width / 2),
      y: Math.round(payBox.y + payBox.height / 2),
      dx: -140,
      dy: 0,
    });
    const payLeft = await page.evaluate(
      () => document.querySelector('[data-testid="payment-method-list"]').scrollLeft,
    );

    return { afterH, beforeV, afterV, selected, payLeft };
  });

  record(
    "2. Тач: свайп листает ряд, вертикальный свайп с карточки листает страницу, тап выбирает",
    data.afterH.row > 40 &&
      data.afterV.page > data.beforeV.page + 40 &&
      data.selected[1] === "true" &&
      data.payLeft > 40,
    `ряд доставки scrollLeft=${data.afterH.row}; страница scrollTop ${data.beforeV.page}→${data.afterV.page}; ` +
      `выбор после тапа ${JSON.stringify(data.selected)}; ряд оплаты scrollLeft=${data.payLeft}`,
  );
}

// ═══ 3. Drag и колесо мыши на десктопе не сломаны ═════════════════════
{
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await page.goto(`${BASE}/flowwow`, { waitUntil: "networkidle" });
  await page.waitForTimeout(300);

  const box = await page.locator('[data-testid="choice-card-row"]').boundingBox();
  const y = Math.round(box.y + box.height / 2);
  await page.mouse.move(box.x + box.width - 40, y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i += 1) {
    await page.mouse.move(box.x + box.width - 40 - i * 15, y);
  }
  await page.mouse.up();
  await page.waitForTimeout(200);

  const dragged = await page.evaluate(
    () => document.querySelector('[data-testid="choice-card-row"]').scrollLeft,
  );
  const selected = await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid^="choice-card-"]')].map(
      (el) => el.dataset.selected,
    ),
  );

  await page.mouse.move(box.x + box.width / 2, y);
  await page.mouse.wheel(0, 200);
  await page.waitForTimeout(200);
  const afterWheel = await page.evaluate(
    () => document.querySelector('[data-testid="choice-card-row"]').scrollLeft,
  );
  await context.close();

  record(
    "3. Мышь на десктопе: drag тянет ряд, колесо крутит ряд, drag не выбирает карточку",
    dragged > 40 &&
      afterWheel >= dragged &&
      selected.filter((value) => value === "true").length <= 1,
    `после drag scrollLeft=${dragged}, после колеса ${afterWheel}, выбор ${JSON.stringify(selected)}`,
  );
}

// ═══ 4. Пуш-баннер на обоих архетипах ═════════════════════════════════
{
  const rows = [];
  let ok = true;
  for (const [label, route] of [
    ["Flowwow (архетип A)", "/flowwow?stage=push"],
    ["UCHi.RU (архетип B)", "/uchi?stage=push"],
  ]) {
    const data = await withPhone(route, async (page) => {
      const ctaSelector =
        '[data-testid="cta-sticky-panel"], [data-testid="primary-cta"]';
      const ctaTopBefore = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        return el ? Number(el.getBoundingClientRect().top.toFixed(1)) : null;
      }, ctaSelector);
      // Ждём, пока пружина выезда полностью успокоится.
      await page.waitForTimeout(1500);
      return page.evaluate((sel) => {
        const banner = document.querySelector('[data-testid="push-banner"]');
        const frame = document.querySelector('[data-testid="phone-frame"]');
        const cta = document.querySelector(sel);
        const rect = banner.getBoundingClientRect();
        return {
          top: Number(rect.top.toFixed(1)),
          bottom: Number(rect.bottom.toFixed(1)),
          frameScrollTop: frame.scrollTop,
          frameScrollH: frame.scrollHeight,
          frameClientH: frame.clientHeight,
          ctaTop: cta ? Number(cta.getBoundingClientRect().top.toFixed(1)) : null,
          ctaTopBefore: null,
        };
      }, ctaSelector).then((value) => ({ ...value, ctaTopBefore }));
    });

    const visible = data.top >= 0 && data.bottom <= data.frameClientH;
    const notScrolled =
      data.frameScrollTop === 0 && data.frameScrollH === data.frameClientH;
    const bottomStable =
      data.ctaTopBefore === null || Math.abs(data.ctaTopBefore - data.ctaTop) < 1;
    if (!(visible && notScrolled && bottomStable)) ok = false;
    rows.push(
      `${label}: баннер y ${data.top}…${data.bottom} в колонке высотой ${data.frameClientH} (виден целиком=${visible}); ` +
        `колонка не прокручена=${notScrolled} (${data.frameScrollH}/${data.frameClientH}); ` +
        `низ экрана не сдвинулся=${bottomStable} (CTA ${data.ctaTopBefore}→${data.ctaTop})`,
    );
  }
  record(
    "4. Пуш виден целиком, не сжимает страницу и не сдвигает низ — на обоих архетипах",
    ok,
    rows.join(" | "),
  );
}

// ═══ 5. Экран успеха на реальных размерах iPhone ══════════════════════
{
  // Ширины — реальные CSS-ширины устройств. Высоты — видимая область Safari,
  // которая ВСЕГДА меньше высоты устройства на высоту его панелей: именно на
  // ней композиция и разваливалась, а на «полной» 853 выглядела правильной.
  const WIDTHS = [320, 360, 390, 414, 430];
  const HEIGHTS = [568, 664, 750, 853];
  const rows = [];
  let ok = true;
  for (const width of WIDTHS) {
    for (const height of HEIGHTS) {
      const r = await withPhone(
        "/flowwow?stage=bank_success",
        (page) =>
          page.evaluate(() => {
            const rect = (sel) => {
              const el = document.querySelector(sel);
              return el ? el.getBoundingClientRect() : null;
            };
            const frame = rect('[data-testid="phone-frame"]');
            const stack = rect('[data-testid="success-stack"]');
            const receipt = rect('[data-testid="receipt-card"]');
            const avatar = rect('[data-testid="bank-avatar-success"]');
            const tile = rect('[data-testid="docs-tile"]');
            const cta = rect('[data-testid="bank-return-cta"]');
            const frameCenter = frame.x + frame.width / 2;
            const offset = (box) => Number((box.x + box.width / 2 - frameCenter).toFixed(1));
            // На низком экране декоративная плитка «Чек» снимается совсем
            // (container query в styles.css) — это ожидаемое состояние, а не
            // отсутствующий элемент.
            const tileShown = tile !== null && tile.width > 0;
            const lowest = tileShown ? tile.bottom : receipt.bottom;
            return {
              receiptOffset: offset(receipt),
              avatarOffset: offset(avatar),
              tileOffset: tileShown ? offset(tile) : 0,
              tileShown,
              // Стек обрезает содержимое своей границей, поэтому видимый низ —
              // минимум из низа последнего элемента и низа стека.
              visibleBottom: Number(Math.min(lowest, stack.bottom).toFixed(1)),
              ctaTop: Number(cta.top.toFixed(1)),
              receiptFullyVisible: receipt.bottom <= stack.bottom + 0.5,
            };
          }),
        { width, height },
      );
      const centered = [r.receiptOffset, r.avatarOffset, r.tileOffset].every(
        (value) => Math.abs(value) < 1,
      );
      const passed = centered && r.receiptFullyVisible && r.visibleBottom <= r.ctaTop + 0.5;
      if (!passed) ok = false;
      if (height === 664 || !passed) {
        rows.push(
          `${width}×${height}: смещение от центра чек ${r.receiptOffset} / аватар ${r.avatarOffset} / плитка ${r.tileOffset}` +
            `${r.tileShown ? "" : " (плитка скрыта: низкий экран)"}, ` +
            `чек виден целиком=${r.receiptFullyVisible}, видимый низ ${r.visibleBottom} ≤ кнопка ${r.ctaTop}`,
        );
      }
    }
  }
  record(
    "5. Экран успеха центрирован и не наезжает на кнопку на 320/360/390/414/430 × 568/664/750/853",
    ok,
    rows.join(" | "),
  );
}

// ═══ 6. Скриншоты в мобильном профиле ═════════════════════════════════
{
  const shots = [
    ["flowwow-row-390", "/flowwow", 390],
    ["flowwow-row-320", "/flowwow", 320],
    ["flowwow-push-390", "/flowwow?stage=push", 390],
    ["flowwow-push-320", "/flowwow?stage=push", 320],
    ["uchi-390", "/uchi", 390],
    ["uchi-320", "/uchi", 320],
    ["uchi-push-390", "/uchi?stage=push", 390],
    ["success-390", "/flowwow?stage=bank_success", 390],
    ["success-320", "/flowwow?stage=bank_success", 320],
  ];
  for (const [name, route, width] of shots) {
    await withPhone(
      route,
      async (page) => {
        await page.waitForTimeout(1500);
        await page.screenshot({ path: path.join(OUT, `${name}.png`) });
      },
      // Высота — видимая область Safari на устройстве, а не высота корпуса.
      { width, height: width === 320 ? 568 : 664 },
    );
  }
  record(
    "6. Скриншоты мобильного профиля сняты",
    true,
    `${shots.length} файлов в ${path.relative(process.cwd(), OUT)}`,
  );
}

await browser.close();

const failed = results.filter((item) => !item.passed);
writeFileSync(
  path.join(OUT, "mobile-report.json"),
  JSON.stringify({ base: BASE, device: "iPhone 13", at: new Date().toISOString(), results }, null, 2),
  "utf8",
);
console.log(`\nИтог: ${results.length - failed.length}/${results.length} проверок пройдено.`);
process.exit(failed.length > 0 ? 1 : 0);
