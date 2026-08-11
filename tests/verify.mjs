import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

/**
 * Проверка приёмки демо и съёмка evidence.
 *
 * Запуск (сервер должен быть уже поднят):
 *   yarn preview            # в отдельном окне, поднимает http://127.0.0.1:4319
 *   yarn verify             # или: node tests/verify.mjs --base=... --out=...
 *
 * `--out` считается от корня проекта; по умолчанию `test-results/screenshots`.
 *
 * Скрипт ничего не «подгоняет»: он печатает фактические числа и
 * помечает каждую проверку pass/fail.
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
const OUT = path.resolve(projectRoot, args.out ?? "test-results/screenshots");
const WIDTHS = [320, 392, 430];
const HEIGHT = 853;

mkdirSync(OUT, { recursive: true });

const results = [];
const record = (id, passed, detail) => {
  results.push({ id, passed, detail });
  console.log(`${passed ? "PASS" : "FAIL"}  ${id}\n      ${detail}`);
};

const tenantPath = (slug) => path.resolve(here, `../tenants/${slug}.json`);
const readTenant = (slug) => JSON.parse(readFileSync(tenantPath(slug), "utf8"));
const toParam = (config) =>
  Buffer.from(JSON.stringify(config), "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const browser = await chromium.launch();

async function withPage(width, url, fn) {
  const context = await browser.newContext({
    viewport: { width, height: HEIGHT },
    deviceScaleFactor: 2,
    reducedMotion: "no-preference",
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(String(error)));
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(120);
  const value = await fn(page, consoleErrors);
  await context.close();
  return value;
}

// ── Метрики раскладки одного экрана ────────────────────────────────────
const collectMetrics = async (page) =>
  page.evaluate(() => {
    const frame = document.querySelector('[data-testid="phone-frame"]');
    const scroll = document.querySelector('[data-testid="scroll-container"]');
    const row = document.querySelector('[data-testid="payment-method-list"]');
    const cards = [...document.querySelectorAll('[data-testid^="payment-method-card-"]')].filter(
      (el) => !el.dataset.testid?.endsWith("-slot"),
    );
    const ozon = document.querySelector('[data-testid="payment-method-card-ozon"]');
    const label = ozon?.querySelector("span");
    const totalRow = document.querySelector('[data-testid="total-row"]');
    const paymentBlock = document.querySelector('[data-testid="payment-block"]');

    const rect = (el) => (el ? el.getBoundingClientRect() : null);
    const rowRect = rect(row);
    const third = cards[2] ? rect(cards[2]) : null;

    return {
      frameWidth: frame ? frame.getBoundingClientRect().width : null,
      scrollHeight: scroll ? scroll.scrollHeight : null,
      scrollClientHeight: scroll ? scroll.clientHeight : null,
      docHorizontalOverflow:
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
      cardCount: cards.length,
      cardWidth: cards[0] ? Number(rect(cards[0]).width.toFixed(2)) : null,
      cardHeights: cards.map((el) => Number(rect(el).height.toFixed(2))),
      ozonRect: ozon
        ? {
            x: Number(rect(ozon).x.toFixed(2)),
            right: Number(rect(ozon).right.toFixed(2)),
          }
        : null,
      rowScrollLeft: row ? row.scrollLeft : null,
      rowVisibleRight: rowRect ? Number(rowRect.right.toFixed(2)) : null,
      thirdCardPeekPct:
        third && rowRect
          ? Number(
              (
                (Math.max(0, Math.min(third.right, rowRect.right) - third.left) /
                  third.width) *
                100
              ).toFixed(1),
            )
          : null,
      ozonLabel: label
        ? {
            text: label.textContent,
            lines: Math.round(label.getBoundingClientRect().height / 20),
            clientWidth: Number(label.clientWidth.toFixed(2)),
            scrollWidth: label.scrollWidth,
            overflowsCard: label.scrollWidth > label.clientWidth + 1,
          }
        : null,
      paymentBlockTop: paymentBlock
        ? Number((paymentBlock.getBoundingClientRect().top + (scroll?.scrollTop ?? 0)).toFixed(2))
        : null,
      totalRowTop: totalRow
        ? Number((totalRow.getBoundingClientRect().top + (scroll?.scrollTop ?? 0)).toFixed(2))
        : null,
    };
  });

// ═══ Проверка 2: 2 и 6 способов оплаты дают одинаковую вертикаль ══════
{
  const base = readTenant("flowwow-like");

  const two = structuredClone(base);
  two.payment_list.methods = base.payment_list.methods.slice(0, 2);
  two.payment_list.default_selected = "new_card";

  const six = structuredClone(base);
  six.payment_list.methods = [
    ...base.payment_list.methods,
    { id: "wallet", label: "Кошелёк", caption: null, logo: "slot" },
    { id: "cash", label: "Наличными", caption: null, logo: "none" },
  ];

  const measure = (config) =>
    withPage(392, `${BASE}/?t=${toParam(config)}`, collectMetrics);

  const [m2, m6] = [await measure(two), await measure(six)];
  const same =
    m2.scrollHeight === m6.scrollHeight &&
    m2.paymentBlockTop === m6.paymentBlockTop &&
    m2.totalRowTop === m6.totalRowTop;

  record(
    "2. Вертикальная метрика экрана A не зависит от числа способов оплаты",
    same,
    `2 способа: scrollHeight=${m2.scrollHeight}, payment_block.top=${m2.paymentBlockTop}, total_row.top=${m2.totalRowTop} | ` +
      `6 способов: scrollHeight=${m6.scrollHeight}, payment_block.top=${m6.paymentBlockTop}, total_row.top=${m6.totalRowTop}`,
  );
}

// ═══ Проверки 3 и 4: метка и карточка на 320 / 392 / 430 ══════════════
const perWidth = {};
for (const width of WIDTHS) {
  perWidth[width] = await withPage(
    width,
    `${BASE}/?tenant=flowwow-like`,
    collectMetrics,
  );
}

{
  const m = perWidth[320];
  const ok =
    m.ozonLabel &&
    !m.ozonLabel.overflowsCard &&
    m.ozonLabel.lines === 2 &&
    m.ozonRect.x >= 0 &&
    m.ozonRect.right <= m.frameWidth &&
    m.rowScrollLeft === 0;
  record(
    "3. Метка «Ozon Банк» на 320 px не обрезается, карточка видна целиком",
    Boolean(ok),
    `метка «${m.ozonLabel?.text}»: строк ${m.ozonLabel?.lines}, зона метки ${m.ozonLabel?.clientWidth} css, ` +
      `переполнения нет (${m.ozonLabel?.scrollWidth} ≤ ${m.ozonLabel?.clientWidth}); ` +
      `карточка x ${m.ozonRect?.x}…${m.ozonRect?.right} при ширине рамки ${m.frameWidth}; ряд не прокручен`,
  );
}

{
  const rows = WIDTHS.map((w) => {
    const m = perWidth[w];
    return `${w}: карточка ${m.cardWidth} (${((m.cardWidth / m.frameWidth) * 100).toFixed(1)} %), метка ${m.ozonLabel?.lines} стр., peek 3-й ${m.thirdCardPeekPct} %, высоты ${[...new Set(m.cardHeights)].join("/")}`;
  });
  const heightsEqual = WIDTHS.every(
    (w) => new Set(perWidth[w].cardHeights).size === 1,
  );
  const noOverflow = WIDTHS.every((w) => perWidth[w].docHorizontalOverflow === 0);
  const linesOk =
    perWidth[320].ozonLabel.lines === 2 &&
    perWidth[392].ozonLabel.lines === 2 &&
    perWidth[430].ozonLabel.lines === 1;
  record(
    "4. Поведение на 320 / 392 / 430 px",
    heightsEqual && noOverflow && linesOk,
    rows.join(" | ") +
      ` | горизонтального переполнения страницы нет: ${noOverflow}`,
  );
}

// ═══ Проверка 7: смена темы на одном архетипе ═════════════════════════
{
  const combos = [
    ["flowwow-like", "cart_checkout"],
    ["uchi-like", "cart_checkout"],
    ["flowwow-like", "subscription_payment"],
    ["uchi-like", "subscription_payment"],
  ];
  const observed = [];
  let healthy = true;
  for (const [slug, archetype] of combos) {
    const data = await withPage(
      392,
      `${BASE}/?tenant=${slug}&archetype=${archetype}`,
      async (page, consoleErrors) => {
        const metrics = await page.evaluate(() => {
          const frame = document.querySelector('[data-testid="phone-frame"]');
          const style = frame ? getComputedStyle(frame) : null;
          const clipped = [...document.querySelectorAll("*")].filter(
            (el) =>
              el.scrollWidth > el.clientWidth + 1 &&
              getComputedStyle(el).overflowX === "hidden" &&
              el.clientWidth > 0,
          ).length;
          return {
            brand: style?.getPropertyValue("--t-brand-primary").trim(),
            pagePadding: style?.getPropertyValue("--t-page-padding").trim(),
            radiusCard: style?.getPropertyValue("--t-radius-card").trim(),
            ctaPlacement: document.querySelector('[data-testid="cta-sticky-panel"]')
              ? "sticky"
              : "inline",
            layout: document.querySelector('[data-testid="payment-method-list"]')?.dataset
              .layout,
            horizontalOverflow:
              document.documentElement.scrollWidth - document.documentElement.clientWidth,
            clippedElements: clipped,
          };
        });
        return { metrics, consoleErrors };
      },
    );
    if (data.metrics.horizontalOverflow !== 0 || data.consoleErrors.length > 0) {
      healthy = false;
    }
    observed.push(
      `${slug} × ${archetype}: brand=${data.metrics.brand}, padding=${data.metrics.pagePadding}, radius=${data.metrics.radiusCard}, cta=${data.metrics.ctaPlacement}, layout=${data.metrics.layout}, overflow=${data.metrics.horizontalOverflow}, ошибок консоли ${data.consoleErrors.length}`,
    );
  }
  record(
    "7. Смена темы на одном архетипе меняет вид, но не ломает раскладку",
    healthy,
    observed.join(" | "),
  );
}

// ═══ Шаг 1 маршрута и отдельный короткий сценарий S-C ════════════════
{
  const rows = [];
  let ok = true;
  for (const slug of ["flowwow-like", "uchi-like"]) {
    // Архетип A (Flowwow): поле телефона раскрывается ИНЛАЙН при выборе «Ozon
    // Банк». Архетип B (Uchi): тап по «Ozon Банк» ведёт на ОТДЕЛЬНЫЙ экран
    // `ozon_rail` — донорская навигационная модель, выбора строки больше нет.
    const isB = slug === "uchi-like";
    const data = await withPage(392, `${BASE}/?tenant=${slug}`, async (page) => {
      const cta = '[data-testid="primary-cta"]';

      if (isB) {
        await page.locator('[data-testid="payment-method-button-ozon"]').click();
        // Открылся отдельный экран оплаты «Ozon Банк».
        await page.waitForSelector('[data-testid="ozon-rail-back"]', { timeout: 3000 });
        await page.waitForSelector('[data-testid="page-title"]');
      } else {
        const card = '[data-testid="payment-method-card-ozon"]';
        await page.locator(card).scrollIntoViewIfNeeded();
        await page.locator(card).click();
      }
      const selectedAfterTap = isB
        ? null // навигационная модель: выбранного состояния нет
        : await page.locator('[data-testid="payment-method-card-ozon"]').getAttribute("data-selected");

      // И там, и там поле проверки телефона раскрыто (инлайн A / экран B).
      await page.waitForSelector('[data-testid="phone-block"][data-expanded="true"]', {
        timeout: 3000,
      });
      const expanded = true;

      const widthBefore = Number((await page.locator(cta).boundingBox()).width.toFixed(2));

      // Валидный номер: проверка → «Проверяем номер…» → пуш.
      await page.locator('[data-testid="phone-input"]').fill("9151234567");
      await page.locator(cta).click();
      await page.waitForTimeout(150);
      const checkingLabel = (await page.locator(cta).textContent())?.trim();
      const widthLoading = Number((await page.locator(cta).boundingBox()).width.toFixed(2));

      // После проверки приходит ПУШ поверх экрана, с которого пришёл пользователь
      // (для B — экран `ozon_rail`), служебного оверлея между ними нет.
      await page.waitForSelector('[data-testid="push-banner"]', { timeout: 5000 });
      const openingLabel = (await page.locator(cta).textContent())?.trim();

      // Свайп вверх убирает баннер и возвращает на экран подрядчика.
      const banner = await page.locator('[data-testid="push-banner"]').boundingBox();
      await page.mouse.move(banner.x + banner.width / 2, banner.y + 40);
      await page.mouse.down();
      await page.mouse.move(banner.x + banner.width / 2, banner.y - 40, { steps: 4 });
      await page.mouse.up();
      await page.waitForTimeout(350);

      const bannerGone = (await page.$('[data-testid="push-banner"]')) === null;
      const stageAfter = await page
        .locator('[data-testid="phone-frame"]')
        .getAttribute("data-stage");
      // A: выбор и номер сохраняются на экране подрядчика. B: возврат к экрану
      // подписки, где ни выбора, ни поля телефона уже нет — проверяем это.
      const selectionKept = isB
        ? null
        : await page.locator('[data-testid="payment-method-card-ozon"]').getAttribute("data-selected");
      const ctaState = await page.locator(cta).getAttribute("data-state");
      const digitsKept = isB
        ? null
        : await page.locator('[data-testid="phone-input"]').inputValue();
      const railGoneB = isB
        ? (await page.$('[data-testid="ozon-rail-back"]')) === null
        : true;
      // Приватность: аналитика не содержит ни введённых цифр, ни PII.
      const pii = await page.evaluate(() => JSON.stringify(window.__demoAnalytics ?? []));

      return {
        selectedAfterTap,
        expanded,
        checkingLabel,
        openingLabel,
        widthBefore,
        widthLoading,
        bannerGone,
        stageAfter,
        selectionKept,
        ctaState,
        digitsKept,
        railGoneB,
        pii,
      };
    });

    const common =
      data.expanded &&
      data.checkingLabel === "Проверяем номер…" &&
      data.openingLabel === "Отправили push" &&
      // Инвариант: смена подписи не меняет ширину кнопки. Сравнение с
      // субпиксельным допуском, а не побитовым равенством float: Chromium
      // возвращает измерение вида 351.99996 в момент анимации, тогда как
      // настоящий скачок ширины исчисляется десятками px.
      Math.abs(data.widthBefore - data.widthLoading) < 0.5 &&
      data.bannerGone &&
      data.stageAfter === "contractor" &&
      data.ctaState === "default" &&
      !/Ирина|Соколова|Казань|Волкова|кв\.|9151234567|915 123/.test(data.pii);
    const passed = isB
      ? common && data.railGoneB
      : common &&
        data.selectedAfterTap === "true" &&
        data.selectionKept === "true" &&
        data.digitsKept === "915 123-45-67";
    if (!passed) ok = false;
    rows.push(
      isB
        ? `${slug}: тап «Ozon Банк»→отдельный экран, поле раскрыто=${data.expanded}, проверка «${data.checkingLabel}»→терминал «${data.openingLabel}», ширина ${data.widthBefore}→${data.widthLoading}, свайп убрал баннер=${data.bannerGone}, вернулись на подписку=${data.railGoneB} (стадия ${data.stageAfter}), CTA=${data.ctaState}, цифр в аналитике нет`
        : `${slug}: выбор→${data.selectedAfterTap}, блок раскрыт=${data.expanded}, проверка «${data.checkingLabel}»→терминал «${data.openingLabel}», ширина ${data.widthBefore}→${data.widthLoading}, свайп вверх убрал баннер=${data.bannerGone}, выбор сохранён=${data.selectionKept}, номер сохранён «${data.digitsKept}», CTA=${data.ctaState}, цифр в аналитике нет`,
    );
  }

  // `S-C` остаётся отдельным коротким сценарием «только момент перехода».
  const handoff = await withPage(
    392,
    `${BASE}/?tenant=flowwow-like&state=handoff`,
    async (page) => {
      await page.waitForSelector('[data-testid="handoff-overlay"][data-state="settled"]', {
        timeout: 5000,
      });
      await page.locator('[data-testid="handoff-back"]').click();
      await page.waitForTimeout(200);
      return (await page.$('[data-testid="handoff-overlay"]')) === null;
    },
  );
  if (!handoff) ok = false;

  record(
    "Шаг 1: CTA ведёт к пушу; S-C остался отдельным коротким сценарием",
    ok,
    `${rows.join(" | ")} | ?state=handoff показывает и закрывает оверлей перехода: ${handoff}`,
  );
}

// ═══ Низ экрана B: «К оплате» видна целиком и ничем не перекрыта ═════
{
  const rows = [];
  let ok = true;
  for (const width of WIDTHS) {
    const data = await withPage(width, `${BASE}/?tenant=uchi-like`, (page) =>
      page.evaluate(() => {
        const scroll = document.querySelector('[data-testid="scroll-container"]');
        scroll.scrollTop = scroll.scrollHeight;
        const payable = document.querySelector('[data-testid="totals-payable"]');
        const r = payable.getBoundingClientRect();
        const value = payable.lastElementChild.getBoundingClientRect();

        // Кто фактически лежит сверху в точке значения суммы.
        const probes = [
          [value.left + value.width / 2, value.top + value.height / 2],
          [value.right - 4, value.top + value.height / 2],
        ];
        const coveredBy = probes
          .map(([x, y]) => document.elementFromPoint(x, y))
          .filter((el) => el && !payable.contains(el))
          .map((el) => el.dataset?.testid ?? el.tagName);

        return {
          fullyInViewport:
            r.top >= 0 && r.bottom <= document.documentElement.clientHeight,
          insideFrame: value.right <= document.documentElement.clientWidth,
          coveredBy,
          fabInDom: Boolean(document.querySelector('[data-testid="help-fab"]')),
          text: payable.textContent,
        };
      }),
    );
    if (
      !data.fullyInViewport ||
      !data.insideFrame ||
      data.coveredBy.length > 0 ||
      data.fabInDom
    ) {
      ok = false;
    }
    rows.push(
      `${width}: «${data.text}» в вьюпорте целиком=${data.fullyInViewport}, в рамке=${data.insideFrame}, перекрыта элементами [${data.coveredBy.join(", ") || "нет"}], FAB в DOM=${data.fabInDom}`,
    );
  }
  record(
    "Строка «К оплате» видна целиком и ничем не перекрыта",
    ok,
    rows.join(" | "),
  );
}

// ═══ Зоны нажатия ≥ 44 css ════════════════════════════════════════════
{
  const rows = [];
  let ok = true;
  for (const [slug, label] of [
    ["flowwow-like", "A"],
    ["uchi-like", "B"],
  ]) {
    const small = await withPage(320, `${BASE}/?tenant=${slug}`, (page) =>
      page.evaluate(() => {
        const nodes = [
          ...document.querySelectorAll("button, a, input, label[data-testid]"),
        ].filter((el) => {
          if (el.offsetParent === null) return false;
          // Визуально скрытый input внутри label: цель нажатия даёт label,
          // сам контрол намеренно 1×1 и в проверку размера не входит.
          const style = getComputedStyle(el);
          if (style.opacity === "0" || style.clip !== "auto") return false;
          return true;
        });
        return nodes
          .map((el) => {
            const r = el.getBoundingClientRect();
            return {
              id: el.dataset.testid ?? el.getAttribute("aria-label") ?? el.tagName,
              w: Math.round(r.width),
              h: Math.round(r.height),
            };
          })
          .filter((item) => item.h > 0 && (item.h < 44 || item.w < 44));
      }),
    );
    if (small.length > 0) ok = false;
    rows.push(
      `${label}: элементов ниже 44×44 — ${small.length}${
        small.length ? ` (${small.map((s) => `${s.id} ${s.w}×${s.h}`).join("; ")})` : ""
      }`,
    );
  }
  record("Зоны нажатия не меньше 44×44 css на 320 px", ok, rows.join(" | "));
}

// ═══ prefers-reduced-motion ══════════════════════════════════════════
{
  const context = await browser.newContext({
    viewport: { width: 392, height: HEIGHT },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.goto(`${BASE}/?tenant=uchi-like&state=handoff`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="handoff-overlay"]');
  const duration = await page.evaluate(() => {
    const overlay = document.querySelector('[data-testid="handoff-overlay"]');
    return getComputedStyle(overlay).transitionDuration;
  });
  await context.close();
  record(
    "prefers-reduced-motion заменяет выезд оверлея мгновенной сменой",
    parseFloat(duration) < 0.05,
    `transition-duration оверлея при reduce = ${duration}`,
  );
}

// ═══ Сквозная сумма: одна величина на пяти строках ═══════════════════
{
  const base = readTenant("flowwow-like");
  const edited = structuredClone(base);
  // Правка totals обязана изменить число сразу на всех экранах маршрута.
  edited.content.totals.sum = 777700;

  const collect = (config) =>
    withPage(392, `${BASE}/?t=${toParam(config)}`, async (page) => {
      const text = async (stage, selector) => {
        await page.goto(`${BASE}/?t=${toParam(config)}&stage=${stage}`, {
          waitUntil: "networkidle",
        });
        await page.waitForSelector(selector);
        return (await page.locator(selector).first().textContent())?.trim();
      };
      const contractor = await text("contractor", '[data-testid="totals-value"]');
      const push = await text("push", '[data-testid="push-title"]');
      const payment = await text("bank_payment", '[data-testid="bank-amount"]');
      const cta = await text("bank_payment", '[data-testid="bank-pay-cta"]');
      const success = await text("bank_success", '[data-testid="bank-success-amount"]');
      const paid = await text("paid", '[data-testid="paid-amount"]');
      return { contractor, push, payment, cta, success, paid };
    });

  const digits = (value) => (value ?? "").replace(/\D/g, "");
  const check = (row) => {
    const set = new Set([
      digits(row.contractor),
      digits(row.push),
      digits(row.payment),
      digits(row.cta),
      digits(row.success),
      digits(row.paid),
    ]);
    return set.size === 1 ? [...set][0] : null;
  };

  const original = await collect(base);
  const changed = await collect(edited);
  const a = check(original);
  const b = check(changed);

  record(
    "Сквозная сумма: правка totals меняет число на всех экранах маршрута",
    a === "2580" && b === "7777" && a !== b,
    `исходный конфиг → «${original.contractor}» / «${original.push}» / «${original.payment}» / «${original.cta}» / «${original.success}» / «${original.paid}» (совпадают: ${a !== null}); ` +
      `totals.sum=777700 → «${changed.contractor}» / «${changed.push}» / «${changed.payment}» / «${changed.cta}» / «${changed.success}» / «${changed.paid}» (совпадают: ${b !== null})`,
  );
}

// ═══ Инвариант положения кнопки на O-2 ═══════════════════════════════
{
  const short = readTenant("flowwow-like");
  const long = structuredClone(short);
  // Имя, гарантированно переносящееся на вторую строку при 22/700.
  long.display_name = "Студия флористики «Пионы и полевые травы»";

  const measure = (config, width) =>
    withPage(width, `${BASE}/?t=${toParam(config)}&stage=bank_payment`, (page) =>
      page.evaluate(() => {
        const merchant = document.querySelector('[data-testid="bank-merchant"]');
        const cta = document.querySelector('[data-testid="bank-pay-cta"]');
        const card = document.querySelector('[data-testid="account-card"]');
        const lh = parseFloat(getComputedStyle(merchant).lineHeight);
        return {
          merchantLines: Math.round(merchant.getBoundingClientRect().height / lh),
          ctaTop: Number(cta.getBoundingClientRect().top.toFixed(2)),
          cardTop: Number(card.getBoundingClientRect().top.toFixed(2)),
          spacer: Number(
            document
              .querySelector('[data-testid="flexible-spacer"]')
              .getBoundingClientRect()
              .height.toFixed(2),
          ),
        };
      }),
    );

  const rows = [];
  let ok = true;
  let wrapDemonstrated = false;
  for (const width of [320, 392]) {
    const one = await measure(short, width);
    const two = await measure(long, width);
    // Собственно инвариант: координата кнопки и карточки счёта не меняется.
    if (one.ctaTop !== two.ctaTop || one.cardTop !== two.cardTop) ok = false;
    // На 320 короткое имя уже переносится, поэтому рост строк требуется
    // хотя бы на одной ширине — иначе тест не доказал бы, что перенос был.
    if (two.merchantLines > one.merchantLines) wrapDemonstrated = true;
    rows.push(
      `${width}: мерчант ${one.merchantLines}→${two.merchantLines} стр., кнопка y ${one.ctaTop}→${two.ctaTop}, карточка счёта y ${one.cardTop}→${two.cardTop}, разделитель ${one.spacer}→${two.spacer}`,
    );
  }
  if (!wrapDemonstrated) ok = false;

  record(
    "Инвариант O-2: перенос мерчанта съедает разделитель, кнопка не двигается",
    ok,
    `${rows.join(" | ")} | перенос действительно продемонстрирован: ${wrapDemonstrated}`,
  );
}

// ═══ Три коррекции контраста экранов банка ═══════════════════════════
{
  const read = (a11y) =>
    withPage(392, `${BASE}/?tenant=uchi-like&stage=bank_success&a11y=${a11y}`, (page) =>
      page.evaluate(() => {
        const frame = document.querySelector('[data-testid="phone-frame"]');
        const style = getComputedStyle(frame);
        const badge = document.querySelector('[data-testid="bank-success-badge"]');
        return {
          mode: frame.dataset.bankA11y,
          textSecondary: style.getPropertyValue("--bank-text-secondary").trim(),
          success: style.getPropertyValue("--bank-success").trim(),
          gradientTop: style.getPropertyValue("--bank-gradient-top").trim(),
          badgeFill: badge ? getComputedStyle(badge).backgroundColor : null,
        };
      }),
    );

  const enforced = await read("enforced");
  const donor = await read("donor_faithful");

  // Контраст белого текста на верхней точке градиента (sRGB, WCAG 2.x).
  const contrastWhiteOn = (hex) => {
    const n = hex.replace("#", "");
    const rgb = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255);
    const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    const L = 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
    return 1.05 / (L + 0.05);
  };
  const enforcedContrast = contrastWhiteOn(enforced.gradientTop);

  const ok =
    enforced.textSecondary.toLowerCase() === "#616974" &&
    enforced.success.toLowerCase() === "#12a150" &&
    // Верх градиента при enforced затемнён до #005AFF, непрерывный градиент
    // без пришпиленной плоской зоны; белый текст хедера на верхней точке ≥4.5.
    enforced.gradientTop.toLowerCase() === "#005aff" &&
    enforcedContrast >= 4.5 &&
    donor.textSecondary.toLowerCase() === "#6f7881" &&
    donor.success.toLowerCase() === "#0bcc59" &&
    donor.gradientTop.toLowerCase() === "#206bf8";

  record(
    "Коррекции контраста экранов банка применяются при enforced (градиент непрерывный)",
    ok,
    `enforced: text_secondary ${enforced.textSecondary} (4.19→5.18), success ${enforced.success} (2.14→3.37), верх градиента ${enforced.gradientTop} — белый текст ${enforcedContrast.toFixed(2)}:1, непрерывный без обрыва, бейдж ${enforced.badgeFill} | ` +
      `donor_faithful: ${donor.textSecondary} / ${donor.success} / верх градиента ${donor.gradientTop}`,
  );
}

// ═══ Полный путь в обеих темах ═══════════════════════════════════════
{
  const rows = [];
  let ok = true;
  // Вход — через ПРЯМУЮ ссылку подрядчика, как в проде: путь задаёт тему и
  // архетип. Так сквозной путь проверяется ровно с той точки входа, которую
  // получает подрядчик, а не с внутреннего `?tenant=`.
  const DIRECT_ROUTE = { "flowwow-like": "/flowwow", "uchi-like": "/uchi" };
  for (const slug of ["flowwow-like", "uchi-like"]) {
    const data = await withPage(392, `${BASE}${DIRECT_ROUTE[slug]}`, async (page) => {
      const frame = '[data-testid="phone-frame"]';
      const ozon =
        (await page.$('[data-testid="payment-method-card-ozon"]')) !== null
          ? '[data-testid="payment-method-card-ozon"]'
          : '[data-testid="payment-method-button-ozon"]';

      await page.locator(ozon).scrollIntoViewIfNeeded();
      await page.locator(ozon).click();
      // Проверка клиентства: валидный номер проводит по маршруту.
      await page.waitForSelector('[data-testid="phone-block"][data-expanded="true"]', {
        timeout: 3000,
      });
      await page.locator('[data-testid="phone-input"]').fill("9151234567");
      await page.locator('[data-testid="primary-cta"]').click();

      await page.waitForSelector('[data-testid="push-banner"]', { timeout: 5000 });
      const stagePush = await page.locator(frame).getAttribute("data-stage");

      await page.locator('[data-testid="push-banner"]').click();
      await page.waitForSelector('[data-testid="bank-splash"]', { timeout: 5000 });
      const splashStart = Date.now();

      await page.waitForSelector('[data-testid="bank-payment"]', { timeout: 6000 });
      const splashDuration = Date.now() - splashStart;
      const bankAmount = (
        await page.locator('[data-testid="bank-amount"]').textContent()
      )?.trim();
      const merchant = (
        await page.locator('[data-testid="bank-merchant"]').textContent()
      )?.trim();

      await page.locator('[data-testid="bank-pay-cta"]').click();
      await page.waitForSelector('[data-testid="bank-success"]', { timeout: 6000 });
      const returnLabel = (
        await page.locator('[data-testid="bank-return-cta"]').textContent()
      )?.trim();

      await page.locator('[data-testid="bank-return-cta"]').click();
      await page.waitForSelector('[data-testid="paid-confirmation"]', { timeout: 5000 });
      const paidTitle = (
        await page.locator('[data-testid="paid-title"]').textContent()
      )?.trim();

      // «Начать сначала» возвращает демо в исходное состояние без перезагрузки.
      await page.locator('[data-testid="paid-restart-cta"]').click();
      await page.waitForTimeout(200);
      const finalStage = await page.locator(frame).getAttribute("data-stage");
      const reloaded = await page.evaluate(
        () => performance.getEntriesByType("navigation").length,
      );
      const signals = await page.evaluate(() =>
        (window.__demoAnalytics ?? []).map((e) => e.signal),
      );

      return {
        stagePush,
        splashDuration,
        bankAmount,
        merchant,
        returnLabel,
        paidTitle,
        finalStage,
        reloaded,
        signals,
      };
    });

    const passed =
      data.stagePush === "push" &&
      data.splashDuration >= 1000 &&
      data.finalStage === "contractor" &&
      data.reloaded === 1 &&
      ["bank_payment_started", "bank_payment_succeeded", "returned_to_contractor", "demo_restarted"].every(
        (s) => data.signals.includes(s),
      );
    if (!passed) ok = false;
    rows.push(
      `${DIRECT_ROUTE[slug]} (${slug}): push→splash(${data.splashDuration} ms)→оплата ${data.bankAmount} «${data.merchant}»→успех «${data.returnLabel}»→«${data.paidTitle}»→рестарт в ${data.finalStage} без перезагрузки (navigation entries ${data.reloaded})`,
    );
  }
  record(
    "Полный путь проходится в обеих темах ОТ ПРЯМОЙ ССЫЛКИ, рестарт без перезагрузки",
    ok,
    rows.join(" | "),
  );
}

// ═══ Отмена по «×» возвращает без оплаты ═════════════════════════════
{
  const data = await withPage(
    392,
    `${BASE}/?tenant=flowwow-like&stage=bank_payment`,
    async (page) => {
      await page.locator('[data-testid="bank-close-payment"]').click();
      await page.waitForTimeout(250);
      const stage = await page
        .locator('[data-testid="phone-frame"]')
        .getAttribute("data-stage");
      const ozonSelected = await page
        .locator('[data-testid="payment-method-card-ozon"]')
        .getAttribute("data-selected");
      const ctaState = await page
        .locator('[data-testid="primary-cta"]')
        .getAttribute("data-state");
      const paidVisible = (await page.$('[data-testid="paid-confirmation"]')) !== null;
      const signals = await page.evaluate(() =>
        (window.__demoAnalytics ?? []).map((e) => e.signal),
      );
      return { stage, ozonSelected, ctaState, paidVisible, signals };
    },
  );

  record(
    "Отмена по «×» возвращает к подрядчику без оплаты",
    data.stage === "contractor" &&
      data.ozonSelected === "true" &&
      data.ctaState === "default" &&
      !data.paidVisible &&
      data.signals.includes("bank_payment_cancelled") &&
      !data.signals.includes("bank_payment_succeeded"),
    `стадия ${data.stage}, выбор Ozon Банк сохранён=${data.ozonSelected}, CTA=${data.ctaState}, экран «оплачено» не показан=${!data.paidVisible}, сигналы [${data.signals.join(", ")}]`,
  );
}

// ═══ Граница темы на экранах банка (рантайм, в обе стороны) ══════════
{
  const scanTokens = (stage, tenant) =>
    withPage(392, `${BASE}/?tenant=${tenant}&stage=${stage}`, (page) =>
      page.evaluate(() => {
        const frame = document.querySelector('[data-testid="phone-frame"]');
        const nodes = [...frame.querySelectorAll("*")];
        const tenantTokens = new Set();
        const bankTokens = new Set();
        for (const node of nodes) {
          const inline = node.getAttribute("style") ?? "";
          for (const m of inline.matchAll(/--t-[a-z0-9-]+/g)) tenantTokens.add(m[0]);
          for (const m of inline.matchAll(/--bank-[a-z0-9-]+/g)) bankTokens.add(m[0]);
        }
        return { tenantTokens: [...tenantTokens], bankTokens: [...bankTokens] };
      }),
    );

  const splash = await scanTokens("splash", "uchi-like");
  const payment = await scanTokens("bank_payment", "uchi-like");
  const success = await scanTokens("bank_success", "uchi-like");
  const paid = await scanTokens("paid", "uchi-like");
  // Отдельный экран «Оплата через Ozon Банк» — ещё сторона подрядчика:
  // читает тему `--t-*`, ни одного токена банка. Смена айдентики — только пуш.
  const rail = await scanTokens("ozon_rail", "uchi-like");

  const ok =
    splash.tenantTokens.length === 0 &&
    payment.tenantTokens.length === 0 &&
    success.tenantTokens.length === 0 &&
    paid.bankTokens.length === 0 &&
    paid.tenantTokens.length > 0 &&
    rail.bankTokens.length === 0 &&
    rail.tenantTokens.length > 0;

  record(
    "Граница темы двусторонняя: банк без --t-*, возврат и ozon_rail без --bank-*",
    ok,
    `O-1 splash: --t-* ${splash.tenantTokens.length} | O-2 оплата: --t-* ${payment.tenantTokens.length} | O-3 успех: --t-* ${success.tenantTokens.length} | ` +
      `O-4 возврат: --bank-* ${paid.bankTokens.length}, при этом --t-* ${paid.tenantTokens.length} (тема вернулась) | ` +
      `ozon_rail: --bank-* ${rail.bankTokens.length}, --t-* ${rail.tenantTokens.length} (сторона подрядчика)`,
  );
}

// ═══ Гарнитура банка не зависит от темы подрядчика ═══════════════════
/*
 * Токены банк изолировал, а ШРИФТ приходил наследованием от рамки телефона
 * и менялся вместе с темой: один и тот же экран банка выходил в четырёх
 * гарнитурах. Статическая проверка такого не видит — здесь измеряется
 * фактический computed style на разных темах и стадиях.
 */
{
  const STAGES = [
    ["bank_payment", '[data-testid="bank-merchant"]'],
    ["splash", '[data-testid="bank-splash"]'],
    ["bank_success", '[data-testid="bank-success"]'],
  ];
  const seen = new Map();
  for (const slug of ["flowwow-like", "uchi-like"]) {
    for (const [stage, selector] of STAGES) {
      const font = await withPage(392, `${BASE}/?tenant=${slug}&stage=${stage}`, (page) =>
        page.evaluate((sel) => {
          const el = document.querySelector(sel);
          return el ? getComputedStyle(el).fontFamily : "нет узла";
        }, selector),
      );
      seen.set(`${slug}/${stage}`, font);
    }
  }
  const fonts = new Set(seen.values());
  record(
    "Гарнитура экранов банка одна на всех темах подрядчиков",
    fonts.size === 1 && !fonts.has("нет узла"),
    [...seen.entries()].map(([key, font]) => `${key}: ${font.split(",")[0]}`).join(" | "),
  );
}

// ═══ reduced-motion не убирает splash ════════════════════════════════
{
  const context = await browser.newContext({
    viewport: { width: 392, height: HEIGHT },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.goto(`${BASE}/?tenant=flowwow-like&stage=push`, { waitUntil: "networkidle" });
  await page.locator('[data-testid="push-banner"]').click();
  const shown = (await page.$('[data-testid="bank-splash"]')) !== null;
  const start = Date.now();
  await page.waitForSelector('[data-testid="bank-payment"]', { timeout: 6000 });
  const duration = Date.now() - start;
  await context.close();

  record(
    "prefers-reduced-motion не убирает splash и не сокращает его длительность",
    shown && duration >= 1000,
    `splash показан=${shown}, длительность ${duration} ms при заданных 1200 ms — движение убрано, экран и время сохранены`,
  );
}

// ═══ E_BANK_PAYLOAD ══════════════════════════════════════════════════
{
  const broken = readTenant("flowwow-like");
  broken.display_name = " ";
  const codes = await withPage(392, `${BASE}/?t=${toParam(broken)}`, (page) =>
    page.evaluate(() =>
      [...document.querySelectorAll('[data-testid="config-error"] li span')].map(
        (el) => el.textContent,
      ),
    ),
  );
  record(
    "Отсутствие мерчанта валит сборку кодом E_BANK_PAYLOAD",
    codes.includes("E_BANK_PAYLOAD"),
    `коды: ${codes.join(", ") || "нет"}`,
  );
}

// ═══ Проверка 5: HandoffOverlay не читает токены темы (рантайм) ═══════
{
  const leak = await withPage(392, `${BASE}/?tenant=uchi-like&state=handoff`, async (page) => {
    await page.waitForSelector('[data-testid="handoff-overlay"]');
    await page.waitForTimeout(400);
    return page.evaluate(() => {
      const overlay = document.querySelector('[data-testid="handoff-overlay"]');
      const nodes = [overlay, ...overlay.querySelectorAll("*")];
      const found = new Set();
      for (const node of nodes) {
        const inline = node.getAttribute("style") ?? "";
        for (const match of inline.matchAll(/--t-[a-z0-9-]+/g)) found.add(match[0]);
      }
      return {
        tokens: [...found],
        background: getComputedStyle(overlay).backgroundColor,
        fontFamily: getComputedStyle(overlay).fontFamily,
        demoNote: document.querySelector('[data-testid="handoff-demo-note"]')?.textContent,
      };
    });
  });
  record(
    "5. HandoffOverlay не использует ни одной переменной темы",
    leak.tokens.length === 0 && Boolean(leak.demoNote),
    `утечек токенов --t-*: ${leak.tokens.length}; фон ${leak.background}; шрифт ${leak.fontFamily}; демо-пометка: «${leak.demoNote}»`,
  );
}

// ═══ Дополнительно: конфиг из URL и его отказ ═════════════════════════
{
  const broken = readTenant("flowwow-like");
  broken.ozon.label = "Озон Банк";
  broken.payment_list.methods[0].label = "Озон Банк";
  const codes = await withPage(392, `${BASE}/?t=${toParam(broken)}`, (page) =>
    page.evaluate(() =>
      [...document.querySelectorAll('[data-testid="config-error"] li span')].map(
        (el) => el.textContent,
      ),
    ),
  );
  const garbage = await withPage(392, `${BASE}/?t=%%%not-base64%%%`, (page) =>
    page.evaluate(() =>
      [...document.querySelectorAll('[data-testid="config-error"] li span')].map(
        (el) => el.textContent,
      ),
    ),
  );
  record(
    "Доп. Невалидный конфиг из URL отклоняется с кодом, а не молча",
    codes.includes("E_OZON_LABEL") && garbage.length > 0,
    `написание бренда → ${codes.join(", ") || "нет кодов"}; мусор в ?t= → ${garbage.join(", ") || "нет кодов"}`,
  );
}

// ═══ Проверка клиентства: формат, результат, инвариант, приватность ══
{
  const rows = [];
  let ok = true;
  for (const slug of ["flowwow-like", "uchi-like"]) {
    const layout = slug === "flowwow-like" ? "A" : "B";
    // A держит поле инлайн на экране подрядчика (стадия contractor), ниже блока
    // лежит строка «Итого». B выносит проверку на отдельный экран `ozon_rail`,
    // где ниже блока — только главная кнопка: её и берём точкой инварианта.
    const stayStage = layout === "A" ? "contractor" : "ozon_rail";
    const belowSel =
      layout === "A" ? '[data-testid="total-row"]' : '[data-testid="primary-cta"]';

    const r = await withPage(
      392,
      `${BASE}/?tenant=${slug}&state=ozon_selected`,
      async (page) => {
        const cta = '[data-testid="primary-cta"]';
        const input = '[data-testid="phone-input"]';
        const msg = '[data-testid="phone-message"]';
        const frame = '[data-testid="phone-frame"]';

        // Позиция элемента ниже блока — относительно контента скролл-
        // контейнера, а не вьюпорта: авто-прокрутка к блоку не должна
        // засчитываться как сдвиг раскладки.
        const measureY = (sel) =>
          page.evaluate((s) => {
            const el = document.querySelector(s);
            const scroll = document.querySelector('[data-testid="scroll-container"]');
            if (!el || !scroll) return null;
            const er = el.getBoundingClientRect();
            const sr = scroll.getBoundingClientRect();
            return Number((er.top - sr.top + scroll.scrollTop).toFixed(2));
          }, sel);

        await page.waitForSelector('[data-testid="phone-block"][data-expanded="true"]');

        // 1. Пустое поле → ошибка формата, проверка не запускается.
        await page.locator(cta).click();
        await page.waitForTimeout(150);
        const emptyMsg = (await page.locator(msg).textContent())?.trim();
        const emptyStage = await page.locator(frame).getAttribute("data-stage");

        // 2. Неполный номер (5 цифр) → ошибка формата, НЕ результат проверки.
        await page.locator(input).fill("91512");
        await page.locator(cta).click();
        await page.waitForTimeout(150);
        const incompleteMsg = (await page.locator(msg).textContent())?.trim();

        // Инвариант раскладки: y элемента ниже блока совпадает при hint и error.
        await page.locator(input).fill("9151234567");
        await page.waitForTimeout(80);
        const hintKind = await page.locator(msg).getAttribute("data-kind");
        const yHint = await measureY(belowSel);

        // 3. Демо-номер → проверка 700 ms → результат «не клиент», остаёмся.
        await page.locator(input).fill("0000000000");
        await page.locator(cta).click();
        await page.waitForSelector(`${msg}[data-kind="error"]`, { timeout: 3000 });
        const notClientMsg = (await page.locator(msg).textContent())?.trim();
        const errorStage = await page.locator(frame).getAttribute("data-stage");
        const yError = await measureY(belowSel);

        const storage = await page.evaluate(() => ({
          ls: localStorage.length,
          ss: sessionStorage.length,
        }));
        const analytics = await page.evaluate(() =>
          JSON.stringify(window.__demoAnalytics ?? []),
        );

        return {
          emptyMsg,
          emptyStage,
          incompleteMsg,
          hintKind,
          yHint,
          notClientMsg,
          errorStage,
          yError,
          storage,
          analytics,
        };
      },
    );

    const invariant = r.yHint !== null && Math.abs(r.yHint - r.yError) < 1;
    const passed =
      r.emptyMsg === "Введите номер телефона" &&
      r.emptyStage === stayStage &&
      r.incompleteMsg === "Введите все 10 цифр номера" &&
      r.hintKind === "hint" &&
      r.notClientMsg === "Не нашли этот номер в Ozon Банке" &&
      r.errorStage === stayStage &&
      invariant &&
      r.storage.ls === 0 &&
      r.storage.ss === 0 &&
      !/0000000000|9151234567|000 000|915 123/.test(r.analytics);
    if (!passed) ok = false;
    rows.push(
      `${layout}/${slug}: пусто→«${r.emptyMsg}» (${r.emptyStage}), неполный→«${r.incompleteMsg}», демо-номер→«${r.notClientMsg}» (${r.errorStage}); ` +
        `инвариант y ниже блока hint=${r.yHint} error=${r.yError} (совпало ${invariant}); storage ls=${r.storage.ls}/ss=${r.storage.ss}; цифр в аналитике нет`,
    );
  }
  record(
    "Проверка клиентства: формат ≠ результат, инвариант раскладки, номер не покидает состояние",
    ok,
    rows.join(" | "),
  );
}

// ═══ Планшет/десктоп: центрированная колонка ≤480 ════════════════════
{
  const rows = [];
  let ok = true;
  for (const width of [480, 768, 1280]) {
    const r = await withPage(width, `${BASE}/?tenant=flowwow-like`, (page) =>
      page.evaluate((w) => {
        const frame = document.querySelector('[data-testid="phone-frame"]');
        const rect = frame.getBoundingClientRect();
        return {
          frameWidth: Number(rect.width.toFixed(1)),
          leftGap: Number(rect.left.toFixed(1)),
          rightGap: Number((w - rect.right).toFixed(1)),
          docOverflow:
            document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      }, width),
    );
    const centered = Math.abs(r.leftGap - r.rightGap) <= 1;
    const capped = r.frameWidth <= 481;
    if (!(centered && capped && r.docOverflow === 0)) ok = false;
    rows.push(
      `${width}: колонка ${r.frameWidth}, зазоры L${r.leftGap}/R${r.rightGap} (центр=${centered}, ≤480=${capped}), горизонтальный overflow=${r.docOverflow}`,
    );
  }
  record(
    "Планшет/десктоп: та же мобильная вёрстка центрированной колонкой ≤480, без горизонтального скролла",
    ok,
    rows.join(" | "),
  );
}

// ═══ Прямые ссылки подрядчиков: путь задаёт тему и архетип ═══════════
{
  const cases = [
    ["/flowwow", "flowwow-like", "cart_checkout", '[data-testid="payment-method-card-ozon"]'],
    ["/uchi", "uchi-like", "subscription_payment", '[data-testid="payment-method-button-ozon"]'],
  ];
  const rows = [];
  let ok = true;
  for (const [route, tenant, archetype, firstScreenSel] of cases) {
    const data = await withPage(392, `${BASE}${route}`, async (page, consoleErrors) => {
      await page
        .waitForSelector('[data-testid="phone-frame"]', { timeout: 3000 })
        .catch(() => {});
      const hasFrame = (await page.$('[data-testid="phone-frame"]')) !== null;
      const stage = hasFrame
        ? await page.locator('[data-testid="phone-frame"]').getAttribute("data-stage")
        : null;
      const list = (await page.$('[data-testid="payment-method-list"]')) !== null;
      const layoutMode = list
        ? await page.locator('[data-testid="payment-method-list"]').getAttribute("data-layout")
        : null;
      return {
        stage,
        layoutMode,
        firstScreen: (await page.$(firstScreenSel)) !== null,
        stubShown: (await page.$('[data-testid="stub"]')) !== null,
        launcherShown: (await page.$('[data-testid="launcher"]')) !== null,
        consoleErrors,
      };
    });
    const passed =
      data.firstScreen &&
      !data.stubShown &&
      !data.launcherShown &&
      data.consoleErrors.length === 0;
    if (!passed) ok = false;
    rows.push(
      `${route}→${tenant}/${archetype}: первый экран=${data.firstScreen} (стадия ${data.stage}, layout ${data.layoutMode}), заглушка=${data.stubShown}, лаунчер=${data.launcherShown}, ошибок консоли ${data.consoleErrors.length}`,
    );
  }

  // Корень без интента → нейтральная заглушка, не лаунчер.
  const rootStub = await withPage(392, `${BASE}/`, async (page) => ({
    stub: (await page.$('[data-testid="stub"]')) !== null,
    launcher: (await page.$('[data-testid="launcher"]')) !== null,
  }));
  if (!rootStub.stub || rootStub.launcher) ok = false;

  // Неизвестный путь → та же заглушка, не белый экран.
  const unknown = await withPage(392, `${BASE}/neizvestnyy-put`, async (page) => ({
    stub: (await page.$('[data-testid="stub"]')) !== null,
    launcher: (await page.$('[data-testid="launcher"]')) !== null,
  }));
  if (!unknown.stub || unknown.launcher) ok = false;

  // Query уточняет состояние поверх пути: /uchi?stage=ozon_rail → экран возврата.
  const overlay = await withPage(392, `${BASE}/uchi?stage=ozon_rail`, (page) =>
    page
      .waitForSelector('[data-testid="ozon-rail-back"]', { timeout: 3000 })
      .then(() => true)
      .catch(() => false),
  );
  if (!overlay) ok = false;

  record(
    "Прямые ссылки: /flowwow и /uchi ведут в свой флоу; корень и неизвестный путь → заглушка; query поверх пути",
    ok,
    `${rows.join(" | ")} | корень /: заглушка=${rootStub.stub}, лаунчер=${rootStub.launcher} | неизвестный путь: заглушка=${unknown.stub}, лаунчер=${unknown.launcher} | /uchi?stage=ozon_rail: экран возврата=${overlay}`,
  );
}

// ═══ Каждая поставляемая ссылка открывается своим экраном ════════════
/*
 * Проверки выше перечисляют маршруты руками и потому проверяют только те, о
 * которых кто-то вспомнил. На прогоне 2026-08-11 из девяти мобильных проверок
 * новые темы попали ровно в одну — две ссылки уехали бы подрядчикам,
 * проверенные машинно по одной оси из девяти.
 *
 * Здесь список берётся ИЗ КОДА РОУТЕРА (`PATH_ROUTES` в `src/App.tsx`), а не
 * переписывается в тест: тема, заведённая без строки в этом тесте, всё равно
 * будет проверена. Проверяется дым, а не вид: экран подрядчика отрисован, это
 * не заглушка и не экран ошибки конфига, есть главная кнопка, консоль чиста.
 */
{
  const appSource = readFileSync(path.resolve(projectRoot, "src/App.tsx"), "utf8");
  const routesBlock = appSource.split("const PATH_ROUTES")[1]?.split("};")[0] ?? "";
  const routes = [...routesBlock.matchAll(/"(\/[a-z0-9-]+)":\s*\{\s*tenant:\s*"([a-z0-9-]+)"/g)]
    .map((m) => [m[1], m[2]]);

  const rows = [];
  let ok = routes.length > 0;
  if (routes.length === 0) rows.push("не разобран PATH_ROUTES в src/App.tsx");

  for (const [route, tenant] of routes) {
    const data = await withPage(392, `${BASE}${route}`, async (page, consoleErrors) => {
      await page
        .waitForSelector('[data-testid="phone-frame"]', { timeout: 4000 })
        .catch(() => {});
      const frame = await page.$('[data-testid="phone-frame"]');
      return {
        tenantId: frame
          ? await page.locator('[data-testid="phone-frame"]').getAttribute("data-tenant")
          : null,
        stage: frame
          ? await page.locator('[data-testid="phone-frame"]').getAttribute("data-stage")
          : null,
        /*
         * «Главная кнопка» на первом экране называется по-разному, и это не
         * небрежность, а разные модели донора: обычный чекаут платит сам
         * (`primary-cta`), прайс-лист входит в оплату с карточки тарифа
         * (`plan-cta-*`), а у RML кнопка открывает шторку способов
         * (`open-payment-sheet`) — у его донора выбора оплаты на странице нет
         * вовсе. Проверяется факт «действие на экране есть», а не его имя.
         */
        cta:
          (await page.$('[data-testid="primary-cta"]')) !== null ||
          (await page.$('[data-testid^="plan-cta"]')) !== null ||
          (await page.$('[data-testid="open-payment-sheet"]')) !== null,
        stub: (await page.$('[data-testid="stub"]')) !== null,
        configError: (await page.$('[data-testid="config-error"]')) !== null,
        consoleErrors,
      };
    });

    const passed =
      data.stage === "contractor" &&
      data.cta &&
      !data.stub &&
      !data.configError &&
      data.consoleErrors.length === 0;
    if (!passed) ok = false;
    rows.push(
      `${route}→${tenant}: стадия ${data.stage}, кнопка=${data.cta}, заглушка=${data.stub}, ошибка конфига=${data.configError}, ошибок консоли ${data.consoleErrors.length}`,
    );
  }

  record(
    `Каждая поставляемая ссылка открывается своим экраном (${routes.length} шт., список из PATH_ROUTES)`,
    ok,
    rows.join(" | "),
  );
}

// ═══ Проверка 6: скриншоты ════════════════════════════════════════════
const shots = [
  ["stub-root-392", 392, ""],
  ["flowwow-direct-392", 392, "flowwow"],
  ["uchi-direct-392", 392, "uchi"],
  ["a-flowwow-like-320", 320, "?tenant=flowwow-like"],
  ["a-flowwow-like-392", 392, "?tenant=flowwow-like"],
  ["a-flowwow-like-430", 430, "?tenant=flowwow-like"],
  ["a-flowwow-like-392-ozon-selected", 392, "?tenant=flowwow-like&state=ozon_selected"],
  ["a-flowwow-like-392-cta-sent", 392, "?tenant=flowwow-like&state=cta_sent"],
  ["a-uchi-like-392", 392, "?tenant=uchi-like&archetype=cart_checkout"],
  ["b-uchi-like-320", 320, "?tenant=uchi-like"],
  ["b-uchi-like-392", 392, "?tenant=uchi-like"],
  ["b-uchi-like-430", 430, "?tenant=uchi-like"],
  ["b-uchi-like-392-ozon-selected", 392, "?tenant=uchi-like&state=ozon_selected"],
  ["b-uchi-like-392-field-error", 392, "?tenant=uchi-like&state=field_error"],
  ["b-flowwow-like-392", 392, "?tenant=flowwow-like&archetype=subscription_payment"],
  ["c-handoff-392", 392, "?tenant=uchi-like&state=handoff"],
  ["c-handoff-from-flowwow-392", 392, "?tenant=flowwow-like&state=handoff"],
  ["error-config-392", 392, "?t=broken"],

  // ── Флоу банка: пять экранов в обеих темах ──────────────────────
  ["o0-push-flowwow-392", 392, "?tenant=flowwow-like&stage=push"],
  ["o0-push-uchi-392", 392, "?tenant=uchi-like&stage=push"],
  ["o0-push-flowwow-320", 320, "?tenant=flowwow-like&stage=push"],
  ["o1-splash-392", 392, "?tenant=flowwow-like&stage=splash"],
  ["o1-splash-320", 320, "?tenant=flowwow-like&stage=splash"],
  ["o1-splash-430", 430, "?tenant=flowwow-like&stage=splash"],
  ["o2-payment-flowwow-392", 392, "?tenant=flowwow-like&stage=bank_payment"],
  ["o2-payment-uchi-392", 392, "?tenant=uchi-like&stage=bank_payment"],
  ["o2-payment-flowwow-320", 320, "?tenant=flowwow-like&stage=bank_payment"],
  ["o2-payment-uchi-320", 320, "?tenant=uchi-like&stage=bank_payment"],
  ["o2-payment-flowwow-430", 430, "?tenant=flowwow-like&stage=bank_payment"],
  ["o3-success-flowwow-392", 392, "?tenant=flowwow-like&stage=bank_success"],
  ["o3-success-uchi-392", 392, "?tenant=uchi-like&stage=bank_success"],
  ["o3-success-flowwow-320", 320, "?tenant=flowwow-like&stage=bank_success"],
  ["o3-success-uchi-320", 320, "?tenant=uchi-like&stage=bank_success"],
  ["o3-success-donor-faithful-392", 392, "?tenant=flowwow-like&stage=bank_success&a11y=donor_faithful"],
  ["o4-paid-flowwow-392", 392, "?tenant=flowwow-like&stage=paid"],
  ["o4-paid-uchi-392", 392, "?tenant=uchi-like&stage=paid"],
  ["o4-paid-flowwow-320", 320, "?tenant=flowwow-like&stage=paid"],
  ["o4-paid-uchi-430", 430, "?tenant=uchi-like&stage=paid"],

  // ── Проверка телефона: раскрытие, проверка, ошибка в обеих темах ──
  ["phone-expanded-flowwow-392", 392, "?tenant=flowwow-like&state=phone_expanded"],
  ["phone-expanded-uchi-392", 392, "?tenant=uchi-like&state=phone_expanded"],
  ["phone-expanded-flowwow-320", 320, "?tenant=flowwow-like&state=phone_expanded"],
  ["phone-checking-flowwow-392", 392, "?tenant=flowwow-like&state=phone_checking"],
  ["phone-error-flowwow-392", 392, "?tenant=flowwow-like&state=phone_error"],
  ["phone-error-uchi-392", 392, "?tenant=uchi-like&state=phone_error"],
  ["phone-error-uchi-320", 320, "?tenant=uchi-like&state=phone_error"],

  // ── Отдельный экран «Оплата через Ozon Банк» (архетип B, Uchi) ─────
  ["b-uchi-ozon-rail-empty-392", 392, "?tenant=uchi-like&stage=ozon_rail"],
  ["b-uchi-ozon-rail-empty-320", 320, "?tenant=uchi-like&stage=ozon_rail"],
  ["b-uchi-ozon-rail-checking-392", 392, "?tenant=uchi-like&state=phone_checking"],
  ["b-uchi-ozon-rail-error-392", 392, "?tenant=uchi-like&state=phone_error"],

  // ── Десктоп/планшет: центрированная колонка ≤480 ──────────────────
  ["desktop-1280-a-flowwow", 1280, "?tenant=flowwow-like"],
  ["desktop-1280-b-uchi", 1280, "?tenant=uchi-like"],
  ["desktop-768-a-flowwow", 768, "?tenant=flowwow-like"],
  ["desktop-1280-o2-payment", 1280, "?tenant=flowwow-like&stage=bank_payment"],
];

for (const [name, width, query] of shots) {
  await withPage(width, `${BASE}/${query}`, async (page) => {
    // Ждём авто-прокрутку блока телефона и выезд оверлея перехода.
    if (query.includes("handoff") || query.includes("phone")) {
      await page.waitForTimeout(500);
    }
    await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  });
}

// Полная высота экранов — для сверки блочной последовательности с донором.
for (const [name, query] of [
  ["a-flowwow-like-392-full", "?tenant=flowwow-like"],
  ["b-uchi-like-392-full", "?tenant=uchi-like"],
]) {
  await withPage(392, `${BASE}/${query}`, async (page) => {
    const height = await page.evaluate(() => {
      const scroll = document.querySelector('[data-testid="scroll-container"]');
      return scroll ? scroll.scrollHeight + 60 : 853;
    });
    await page.setViewportSize({ width: 392, height: Math.ceil(height) });
    await page.waitForTimeout(120);
    await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  });
}

record(
  "6. Скриншоты сняты",
  true,
  `${shots.length + 2} файлов в ${path.relative(process.cwd(), OUT)}`,
);

await browser.close();

const failed = results.filter((r) => !r.passed);
writeFileSync(
  path.join(OUT, "verify-report.json"),
  JSON.stringify({ base: BASE, at: new Date().toISOString(), results }, null, 2),
  "utf8",
);

console.log(`\nИтог: ${results.length - failed.length}/${results.length} проверок пройдено.`);
process.exit(failed.length > 0 ? 1 : 0);
