import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium, devices } from "playwright";

import {
  averageColor,
  decodePng,
  formatRgb,
  parseRgb,
  sameColor,
} from "./lib/png-pixels.mjs";

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
 *   1. системные зоны БЕЛЫЕ и статические на каждом экране: `theme-color`
 *      равен `#ffffff` и никем не переписывается, канва за боксом страницы
 *      белая, серому (`#e6e7ea` — те самые полосы) взяться неоткуда;
 *   2. горизонтальный свайп листает ряд, вертикальный с карточки листает
 *      страницу, тап выбирает карточку; drag мышью на десктопе цел;
 *   3. пуш-баннер виден целиком и не сдвигает низ экрана — на ОБОИХ
 *      архетипах;
 *   4. композиция экрана успеха центрирована и не наезжает на кнопку на
 *      реальных ширинах и высотах iPhone;
 *   5. цвет зон не меняется при переходах между экранами — проход по флоу
 *      кликами, а не открытием каждой стадии по ссылке.
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

/**
 * Маршрут splash `O-1` с удлинённой стадией.
 *
 * Экран живёт 1.2 с и уходит сам, поэтому замер цвета кромок попадал ровно в
 * середину перехода на следующий экран и читал случайную фазу анимации. Тенант
 * подаётся через `?t=` (тот же приём, что в `verify.mjs`) и отличается от
 * бандла ОДНИМ полем — длительностью splash. Ни один цвет не меняется.
 */
const slowSplashTenant = JSON.parse(
  readFileSync(path.resolve(projectRoot, "tenants/flowwow-like.json"), "utf8"),
);
// 5000 — потолок схемы (`tenant.schema.ts`): больше значение конфиг отклонит,
// и вместо splash открылся бы экран ошибки конфига.
slowSplashTenant.demo.timings.splash_ms = 5000;
const SPLASH_ROUTE = `/?t=${Buffer.from(JSON.stringify(slowSplashTenant), "utf8")
  .toString("base64")
  .replace(/\+/g, "-")
  .replace(/\//g, "_")
  .replace(/=+$/, "")}&stage=splash`;

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

// ═══ 1. Системные зоны устройства: белые и статические ════════════════

/** Цвет ОТРИСОВАННОГО пикселя у кромки экрана — независимо от DOM-измерения. */
async function edgePixel(page, edge) {
  const { width, height } = page.viewportSize();
  const shot = await page.screenshot({
    clip: {
      x: Math.round(width / 2),
      y: edge === "top" ? 0 : height - 1,
      width: 1,
      height: 1,
    },
  });
  return averageColor(decodePng(shot));
}

/**
 * Цвет КАНВЫ за пределами бокса страницы — тех самых зон, которые на
 * устройстве закрыты панелями браузера. Внутри вьюпорта они не видны, поэтому
 * зонд создаёт их искусственно: колонка демо прячется, бокс `html` временно
 * ужимается до 60 % высоты. Всё, что ниже 60 %, — канва за пределами страницы,
 * то есть ровно нижняя системная зона; верх зонда — верхняя.
 *
 * Читается ОТРИСОВАННЫЙ пиксель, а не CSS-переменная: канву красит браузер по
 * своим правилам распространения фона, и проверять надо результат, а не
 * пересказ формулы из `styles.css`.
 */
async function canvasZonePixels(page) {
  await page.evaluate(() => {
    document.getElementById("root").style.display = "none";
    document.documentElement.style.height = "60vh";
  });
  await page.waitForTimeout(60);
  const top = await edgePixel(page, "top");
  const bottom = await edgePixel(page, "bottom");
  await page.evaluate(() => {
    document.getElementById("root").style.display = "";
    document.documentElement.style.height = "";
  });
  return { top, bottom };
}

/**
 * Что именно проверяется на каждом экране.
 *
 * Решение 2026-07-25: обе системные зоны белые везде. Двухзонность на Safari
 * недостижима (`FIXES.md`), поэтому единственный рычаг — статический
 * `<meta name="theme-color">` в `index.html`. Отсюда три требования, и все три
 * должны выполняться НА КАЖДОМ экране, включая синие экраны банка:
 *   • тег ровно один и равен `#ffffff` — то есть его никто не переписал;
 *   • канва за боксом страницы белая сверху и снизу;
 *   • от снятого механизма не осталось следов: ни переменных `--page-canvas*`,
 *     ни признака режима `data-theme-color`. Иначе «работает» могло бы
 *     держаться на живом остатке старого кода.
 */
const WHITE = [255, 255, 255];
const DESK_GREY = [230, 231, 234];

{
  const rows = [];
  let ok = true;
  // Третье поле — какой экран ОБЯЗАН быть на странице. Без него отклонённый
  // конфиг или опечатка в адресе дают «согласованный» экран ошибки и
  // проверка проходит, не проверив ничего.
  const stages = [
    ["/flowwow", "подрядчик A (Flowwow)", "contractor"],
    ["/uchi", "подрядчик B (UCHi.RU)", "contractor"],
    ["/uchi?stage=ozon_rail", "экран оплаты через Ozon Банк (B)", "ozon_rail"],
    ["/flowwow?stage=push", "пуш", "push"],
    [SPLASH_ROUTE, "O-1 splash", "splash"],
    ["/flowwow?stage=bank_payment", "O-2 оплата в банке", "bank_payment"],
    ["/flowwow?stage=bank_success", "O-3 успех", "bank_success"],
    ["/flowwow?stage=paid", "O-4 заказ оплачен (A)", "paid"],
    ["/uchi?stage=paid", "O-4 подписка оплачена (B)", "paid"],
    // Заглушка корня — тоже поверхность, на которую можно попасть с телефона,
    // и она тёмная: без синхронизации вокруг неё были бы светлые полосы.
    ["/", "нейтральная заглушка", "stub"],
  ];
  for (const [route, label, expectedStage] of stages) {
    const r = await withPhone(route, async (page) => {
      await page.waitForTimeout(600);
      const dom = await page.evaluate(() => {
        const frame = document.querySelector('[data-testid="phone-frame"]');
        const style = getComputedStyle(document.documentElement);
        const tags = [...document.querySelectorAll('meta[name="theme-color"]')];
        return {
          themeCount: tags.length,
          theme: tags[0]?.content ?? null,
          htmlBackground: style.backgroundColor,
          // Следы снятого механизма: пусто — значит их действительно нет.
          leftovers: [
            style.getPropertyValue("--page-canvas").trim(),
            style.getPropertyValue("--page-canvas-bottom").trim(),
            document.documentElement.dataset.themeColor ?? "",
          ].filter(Boolean),
          // Заглушка и экран ошибки конфига колонку не рендерят.
          frameScrollTop: frame ? frame.scrollTop : 0,
          stage:
            frame?.dataset.stage ??
            (document.querySelector('[data-testid="stub"]') ? "stub" : "config-error"),
        };
      });
      const zone = await canvasZonePixels(page);
      return { ...dom, zone };
    });

    const htmlBg = parseRgb(r.htmlBackground);
    const passed =
      r.stage === expectedStage &&
      r.themeCount === 1 &&
      r.theme === "#ffffff" &&
      r.leftovers.length === 0 &&
      sameColor(htmlBg, WHITE, 0) &&
      // Отрисованная канва обеих зон белая — и, в частности, не серый «стол».
      sameColor(r.zone.top, WHITE, 1) &&
      sameColor(r.zone.bottom, WHITE, 1) &&
      !sameColor(r.zone.top, DESK_GREY, 1) &&
      !sameColor(r.zone.bottom, DESK_GREY, 1) &&
      r.frameScrollTop === 0;
    if (!passed) ok = false;
    rows.push(
      `${label}: тег ${r.theme} ×${r.themeCount}, зона верх ${formatRgb(r.zone.top)} / низ ${formatRgb(r.zone.bottom)}, ` +
        `фон html ${r.htmlBackground}` +
        (r.leftovers.length > 0 ? `, ОСТАТКИ СНЯТОГО МЕХАНИЗМА: ${r.leftovers.join(", ")}` : "") +
        (r.stage === expectedStage ? "" : ` — ОТКРЫЛСЯ НЕ ТОТ ЭКРАН: ${r.stage}`),
    );
  }
  record(
    "1. Обе системные зоны белые на каждом экране, тег theme-color = #ffffff и не переписан",
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
    ["bank-payment-390", "/flowwow?stage=bank_payment", 390],
    ["paid-390", "/flowwow?stage=paid", 390],
    ["splash-390", SPLASH_ROUTE, 390],
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

  /*
   * Отдельная серия «системные зоны видно». Обычный скриншот показывает только
   * содержимое вьюпорта: зоны, которые на устройстве закрыты панелями Safari,
   * в кадр не попадают в принципе. Поэтому колонка демо ужимается до 86 %, и
   * вокруг неё проступает канва — теперь белая на всех экранах. Это
   * иллюстрация к числам проверки 1, а не отдельная проверка; на синих
   * `zones-splash` и `zones-bank-payment` видно принятую цену решения —
   * белую полосу над синим экраном.
   */
  const zoneShots = [
    ["zones-splash-390", SPLASH_ROUTE],
    ["zones-bank-payment-390", "/flowwow?stage=bank_payment"],
    ["zones-success-390", "/flowwow?stage=bank_success"],
    ["zones-paid-390", "/flowwow?stage=paid"],
  ];
  for (const [name, route] of zoneShots) {
    await withPhone(
      route,
      async (page) => {
        await page.waitForTimeout(1500);
        await page.evaluate(() => {
          const root = document.getElementById("root");
          root.style.transform = "scale(0.86)";
          root.style.transformOrigin = "center";
        });
        await page.waitForTimeout(120);
        await page.screenshot({ path: path.join(OUT, `${name}.png`) });
      },
      { width: 390, height: 664 },
    );
  }

  record(
    "6. Скриншоты мобильного профиля сняты",
    true,
    `${shots.length + zoneShots.length} файлов в ${path.relative(process.cwd(), OUT)} ` +
      `(из них ${zoneShots.length} — с видимыми системными зонами)`,
  );
}

// ═══ 7. Цвет зон не меняется при переходах между экранами ═════════════
/*
 * Проверка 1 открывает каждую стадию по своей ссылке — так виден результат, но
 * не видно момента перехода. А переписывал тег прежний механизм именно на
 * смене экрана. Поэтому здесь тот же флоу проходится КЛИКАМИ, с замером на
 * каждой стадии: тег обязан остаться единственным и белым от корзины до
 * «Заказ оплачен», следов снятого механизма не должно появиться ни на одной
 * стадии.
 *
 * Третий проход — по адресу со снятым диагностическим параметром `?tc=off`
 * (им проверялась гипотеза двухзонности, см. `FIXES.md`). Он обязан вести
 * себя ровно как обычный: разбирать `tc` больше некому, и остаться
 * полурабочим он не может.
 */
{
  /** Снимок состояния системных зон на текущем экране. */
  const probe = (page) =>
    page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      const tags = [...document.querySelectorAll('meta[name="theme-color"]')];
      return {
        metaCount: tags.length,
        metaContent: tags[0]?.content ?? null,
        leftovers: [
          style.getPropertyValue("--page-canvas").trim(),
          style.getPropertyValue("--page-canvas-bottom").trim(),
          document.documentElement.dataset.themeColor ?? "",
        ].filter(Boolean),
        stage:
          document.querySelector('[data-testid="phone-frame"]')?.dataset.stage ??
          (document.querySelector('[data-testid="stub"]') ? "stub" : "config-error"),
      };
    });

  /**
   * Сквозной сценарий кликами, с замером на каждой стадии.
   *
   * Внутри флоу переходов по URL нет: стадии меняются состоянием React, адрес
   * не трогается никем. Значит каждая смена экрана — это перерисовка, на
   * которой прежний код и переписывал тег; замер идёт после каждой.
   */
  async function walkFlow(page, archetype) {
    const seen = [];
    const step = async (label, settleMs = 500) => {
      await page.waitForTimeout(settleMs);
      seen.push({ label, ...(await probe(page)) });
    };

    await step("contractor");

    const ozon =
      archetype === "cart_checkout"
        ? '[data-testid="payment-method-card-ozon"]'
        : '[data-testid="payment-method-button-ozon"]';
    await page.locator(ozon).click();
    await page.waitForSelector('[data-testid="phone-block"][data-expanded="true"]', {
      timeout: 5000,
    });
    // У архетипа B проверка телефона живёт на отдельном экране — он тоже стадия.
    if (archetype === "subscription_payment") await step("ozon_rail");

    await page.locator('[data-testid="phone-input"]').fill("9151234567");
    await page.locator('[data-testid="primary-cta"]').click();
    await page.waitForSelector('[data-testid="push-banner"]', { timeout: 6000 });
    await step("push");

    await page.locator('[data-testid="push-banner"]').click();
    await page.waitForSelector('[data-testid="bank-splash"]', { timeout: 5000 });
    // Splash живёт 1.2 с и уходит сам: замер короткий, чтобы попасть в него.
    await step("splash", 250);

    await page.waitForSelector('[data-testid="bank-payment"]', { timeout: 8000 });
    await step("bank_payment");

    await page.locator('[data-testid="bank-pay-cta"]').click();
    await page.waitForSelector('[data-testid="bank-success"]', { timeout: 8000 });
    await step("bank_success");

    await page.locator('[data-testid="bank-return-cta"]').click();
    await page.waitForSelector('[data-testid="paid-confirmation"]', { timeout: 5000 });
    await step("paid");

    return seen;
  }

  const walks = [
    ["A (Flowwow)", await withPhone("/flowwow", (page) => walkFlow(page, "cart_checkout"))],
    ["B (UCHi.RU)", await withPhone("/uchi", (page) => walkFlow(page, "subscription_payment"))],
    [
      "A со снятым `?tc=off`",
      await withPhone("/flowwow?tc=off", (page) => walkFlow(page, "cart_checkout")),
    ],
  ];

  const stayedWhite = (walk) =>
    walk.length >= 6 &&
    walk.every(
      (row) =>
        row.metaCount === 1 && row.metaContent === "#ffffff" && row.leftovers.length === 0,
    );

  const ok = walks.every(([, walk]) => stayedWhite(walk));
  record(
    "7. theme-color остаётся #ffffff на всех стадиях при проходе кликами; `?tc=off` ничего не меняет",
    ok,
    walks
      .map(([label, walk]) => {
        const bad = walk.filter(
          (row) =>
            row.metaCount !== 1 || row.metaContent !== "#ffffff" || row.leftovers.length > 0,
        );
        return (
          `${label}: ${walk.map((row) => row.label).join("→")} — ` +
          (bad.length === 0
            ? `тег #ffffff на всех ${walk.length}`
            : `СБОЙ на ${bad
                .map((row) => `${row.label} (${row.metaContent} ×${row.metaCount}${
                  row.leftovers.length > 0 ? `, остатки: ${row.leftovers.join(", ")}` : ""
                })`)
                .join(", ")}`)
        );
      })
      .join(" | "),
  );
}

// ═══ 8. Появление пуша не двигает прокрутку ═══════════════════════════
/**
 * Регресс, ради которого проверка существует.
 *
 * Пуш приходил ДВУМЯ рывками: сначала страница уезжала вверх, потом
 * возвращалась вниз к полю. Первый рывок давало пересоздание экрана
 * (`push` был отдельной стадией `AnimatePresence`, и подложка монтировалась
 * заново с `scrollTop = 0`), второй — безусловная доводка блока телефона до
 * видимости, отрабатывавшая на свежем маунте как на «только что раскрылось».
 *
 * Отсюда два независимых утверждения, и оба обязаны держаться:
 *   - узел скролл-контейнера ТОТ ЖЕ (экран не пересобран);
 *   - `scrollTop` до нажатия «Оплатить» и после появления пуша совпадают
 *     до пикселя — включая случай, когда пользователь сам отмотал страницу
 *     в произвольное место.
 *
 * Заодно проверяется, что доводка не потеряна там, где нужна (Q6): после
 * раскрытия поле видно целиком НАД sticky-панелью, а не под ней.
 */
{
  const rows = [];
  let ok = true;

  for (const [label, route, archetype] of [
    ["Flowwow (архетип A)", "/flowwow", "cart_checkout"],
    ["UCHi.RU (архетип B)", "/uchi", "subscription_payment"],
  ]) {
    const data = await withPhone(route, async (page) => {
      /** Метит узел контейнера, чтобы поймать его подмену. */
      const probe = () =>
        page.evaluate(() => {
          const el = document.querySelector('[data-testid="scroll-container"]');
          if (!el) return null;
          if (!el.dataset.probeId) el.dataset.probeId = String(Date.now() % 1e6);
          return {
            id: el.dataset.probeId,
            top: Math.round(el.scrollTop),
            max: Math.round(el.scrollHeight - el.clientHeight),
          };
        });

      const ozon =
        archetype === "cart_checkout"
          ? '[data-testid="payment-method-card-ozon"]'
          : '[data-testid="payment-method-button-ozon"]';
      await page.locator(ozon).click();
      await page.waitForSelector('[data-testid="phone-block"][data-expanded="true"]', {
        timeout: 5000,
      });
      // Ждём анимацию высоты (200 мс) + отложенную доводку (210 мс) + плавную прокрутку.
      await page.waitForTimeout(1200);

      // Q6: поле обязано быть видно целиком над панелью CTA. Нижняя кромка
      // контейнера перекрыта панелью ровно на его `padding-bottom`.
      const fieldVisible = await page.evaluate(() => {
        const field = document.querySelector('[data-testid="phone-field"]');
        const port = document.querySelector('[data-testid="scroll-container"]');
        if (!field || !port) return null;
        const box = field.getBoundingClientRect();
        const view = port.getBoundingClientRect();
        const inset = Number.parseFloat(getComputedStyle(port).paddingBottom) || 0;
        return {
          ok: box.top >= view.top - 0.5 && box.bottom <= view.bottom - inset + 0.5,
          gapBottom: Number((view.bottom - inset - box.bottom).toFixed(1)),
        };
      });

      await page.locator('[data-testid="phone-input"]').fill("9151234567");
      await page.waitForTimeout(200);

      const probes = [];
      /** Один прогон: отмотать в `top` (если можно), нажать «Оплатить», сверить. */
      const runFrom = async (wanted) => {
        if (wanted !== null) {
          await page.evaluate((value) => {
            const el = document.querySelector('[data-testid="scroll-container"]');
            el.scrollTop = value;
          }, wanted);
          await page.waitForTimeout(200);
        }
        const before = await probe();
        await page.locator('[data-testid="primary-cta"]').click();
        await page.waitForSelector('[data-testid="push-banner"]', { timeout: 6000 });
        // Пружина выезда + любая запоздалая доводка успевают отработать.
        await page.waitForTimeout(1500);
        const after = await probe();
        probes.push({ before, after });
        // Свайп вверх убирает баннер и возвращает на экран подрядчика.
        await page.evaluate(() => {
          document.querySelector('[data-testid="push-banner"]')?.focus();
        });
        await page.keyboard.press("Escape");
        await page.waitForTimeout(500);
      };

      // Прогон 1 — с той позиции, куда страницу привела доводка при раскрытии.
      await runFrom(null);

      // Прогон 2 — из произвольного места, куда пользователь отмотал сам.
      // Только архетип A: там дисмисс возвращает на тот же экран с сохранённым
      // выбором и номером, и контейнер действительно прокручиваемый. У B после
      // дисмисса экран подписки без выбора — повторить нажатие не с чего.
      if (archetype === "cart_checkout") {
        const { max } = await probe();
        if (max > 40) await runFrom(Math.round(max / 3));
      }

      return { fieldVisible, probes, archetype };
    });

    const stable = data.probes.every(
      (p) => p.before && p.after && p.before.id === p.after.id && p.before.top === p.after.top,
    );
    const visible = data.fieldVisible?.ok === true;
    if (!(stable && visible)) ok = false;

    rows.push(
      `${label}: ` +
        data.probes
          .map(
            (p) =>
              `scrollTop ${p.before?.top}→${p.after?.top} (узел ${
                p.before?.id === p.after?.id ? "тот же" : "ПОДМЕНЁН"
              }, макс ${p.before?.max})`,
          )
          .join("; ") +
        `; поле видно над панелью=${visible} (запас снизу ${data.fieldVisible?.gapBottom}px)`,
    );
  }

  record(
    "8. Появление пуша не меняет scrollTop и не пересобирает экран; поле остаётся видно над панелью",
    ok,
    rows.join(" | "),
  );
}

// ═══ 9. Поля не заставляют iOS зумить страницу ══════════════════════
/*
 * Safari на iOS принудительно масштабирует страницу при фокусе на поле с
 * кеглем меньше 16px, и делает это криво: экран уезжает, зум приходится
 * разводить пальцами обратно. Виновата платформа, но лечится только на
 * нашей стороне. Проверяются ВСЕ темы: у мелких (тело 13-14px у
 * MONOCHROME, ВОРОХ, ПАДЛ ХАБ) под правило попадали и поле формы, и ввод
 * номера телефона.
 */
{
  /*
   * Третий элемент — сколько полей на маршруте ОЖИДАЕТСЯ увидеть: `true`
   * (есть) или `false` (у темы полей нет по устройству). Проверяется в обе
   * стороны, и это не педантизм: фильтр «кегль < 16» на пустом наборе даёт
   * пустой результат, поэтому маршрут, где поле не раскрылось, рапортовал
   * «все поля ≥ 16px», не посмотрев ни одного. Так и было у `/padlhub` —
   * запись в списке была, проверки не было.
   */
  const ROUTES = [
    ["/flowwow", "ozon", true],
    ["/voroh", "ozon", true],
    // Внесены 2026-08-21 после того, как сверка с PATH_ROUTES показала их
    // отсутствие. Ожидания сняты замером в профиле 390×844, а не выведены из
    // схемы: у `/voroh-light` те же пять полей, что у `/voroh`, у `/uchi` —
    // поле телефона после выбора «Ozon Банк», у `/yes-atlas` полей нет вовсе.
    ["/voroh-light", "ozon", true],
    ["/uchi", "ozon", true],
    ["/yes-atlas", null, false],
    ["/monochrome", "ozon", true],
    // У ПАДЛ ХАБа проверки клиентства нет вовсе (`ozon.phone_gate` не задан),
    // и полей на экране не появляется ни в одном состоянии. Маршрут оставлен
    // в списке с ожиданием «полей нет»: если поле здесь заведётся, проверка
    // об этом скажет, а не промолчит.
    ["/padlhub", null, false],
    // У RML способы оплаты живут в шторке, а не на экране: у донора выбора
    // оплаты нет вовсе. Кликать по строке метода до её открытия нечем,
    // поэтому состояние задаётся адресом.
    ["/rml?state=phone_expanded", null, true],
    // У «Хваловских вод» способы оплаты спрятаны в выпадающий список, и
    // строка «Ozon Банк» появляется только после его открытия — проще
    // задать состояние адресом, как у RML.
    ["/hval?state=phone_expanded", null, true],
    // У Bombbar под правило попадает не только телефон: в карточке
    // комментария стоит textarea, и её кегль задаётся отдельно от полей.
    ["/bombbar", "ozon", true],
    // У MYBOX выбор оплаты двухшаговый: строка открывает нижнюю шторку, и
    // «Ozon Банк» выбирается уже в ней. Кликать по строке метода до этого
    // нечем — состояние задаётся адресом, как у RML и «Хваловских вод».
    // Под правило кегля здесь попадает и textarea комментария.
    ["/mybox?state=phone_expanded", null, true],
    // У EWA чекаут двухшаговый: на экране доставки полей ввода нет вовсе
    // (город у донора — статичная строка), поле телефона живёт на его
    // СТРАНИЦЕ ОПЛАТЫ. Поэтому маршрут задаёт и стадию, и состояние: без
    // `stage=ozon_rail` проверка нашла бы ноль полей и прошла вхолостую.
    ["/ewa?stage=ozon_rail&state=phone_expanded", null, true],
    // У Tripster полей на экране нет вовсе: заказ уже создан, и единственное
    // поле демо — проверка клиентства — появляется внутри карты оплаты после
    // выбора «Ozon Банк» в шторке. Шторка открывается кнопкой, поэтому
    // состояние задаётся адресом, как у RML, «Хваловских вод» и MYBOX.
    ["/tripster?state=phone_expanded", null, true],
  ];
  const rows = [];
  let ok = true;

  /*
   * 🔴 Перечень выше не обходит темы сам: маршрут, не внесённый в него, зелен,
   * потому что не проверялся. На 2026-08-21 так выпали ТРИ темы из тринадцати —
   * `/uchi` (одно поле), `/voroh-light` (пять полей, ровно как у `/voroh`,
   * который в списке) и `/yes-atlas` (полей нет, но и записи об этом нет).
   * Дефекта в них не было; не было сторожа.
   *
   * Поэтому список сверяется с источником правды — `PATH_ROUTES` в `App.tsx`.
   * Не выводится из него, а сверяется: ожидание «есть поля или нет» остаётся
   * осознанным решением человека, но забыть тему нельзя. Импортировать
   * константу нечем — тест на `.mjs`, а `App.tsx` компилируется TypeScript,
   * поэтому пути читаются разбором исходника.
   */
  const appSource = readFileSync(path.join(here, "..", "src", "App.tsx"), "utf8");
  const shipped = [...appSource.matchAll(/"(\/[a-z0-9-]+)":\s*\{\s*tenant:/g)].map((m) => m[1]);
  const covered = new Set(ROUTES.map(([route]) => route.split("?")[0]));
  const uncovered = shipped.filter((route) => !covered.has(route));

  if (uncovered.length > 0) {
    ok = false;
    rows.push(
      `НЕ В СПИСКЕ: ${uncovered.join(", ")} — тема заведена в PATH_ROUTES, но кегль её полей ` +
        "никто не проверяет; внеси маршрут с ожиданием (true/false)",
    );
  }

  for (const [route, expandOzon, expectFields] of ROUTES) {
    const context = await browser.newContext({ ...PHONE });
    const page = await context.newPage();
    await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
    if (expandOzon) {
      for (const selector of [
        `[data-testid="payment-method-row-${expandOzon}"]`,
        `[data-testid="payment-method-button-${expandOzon}"]`,
        `[data-testid="payment-method-card-${expandOzon}"]`,
      ]) {
        const node = page.locator(selector);
        if (await node.count()) {
          await node.first().click();
          break;
        }
      }
      await page.waitForTimeout(250);
    }
    const fields = await page.evaluate(() =>
      [...document.querySelectorAll("input, textarea, select")]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 8 && r.height > 8;
        })
        .map((el) => ({
          id: el.dataset.testid ?? el.getAttribute("name") ?? el.type,
          size: Math.round(parseFloat(getComputedStyle(el).fontSize) * 100) / 100,
        })),
    );
    const small = fields.filter((item) => item.size < 16);
    await context.close();

    // Расхождение с ожиданием — провал в ОБЕ стороны: маршрут без полей там,
    // где они заявлены, ничего не проверил; поле там, где их не ждали, —
    // признак, что список устарел.
    const countMismatch = expectFields !== (fields.length > 0);
    if (countMismatch || small.length > 0) ok = false;
    rows.push(
      `${route}: ${
        countMismatch
          ? expectFields
            ? "ПОЛЕЙ НЕТ — проверять нечего, состояние в адресе не раскрыло поле"
            : `появились поля (${fields.length} шт.), хотя маршрут заявлен без них`
          : small.length === 0
            ? expectFields
              ? `все поля ≥ 16px (${fields.length} шт.)`
              : "полей нет — как и заявлено"
            : small.map((s) => `${s.id}=${s.size}px`).join(", ")
      }`,
    );
  }

  record(
    "9. Кегль полей ввода ≥ 16px на каждом маршруте, и поля там действительно есть",
    ok,
    rows.join(" | "),
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
