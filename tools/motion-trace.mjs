import { chromium } from "playwright";

/**
 * Профиль ЖИВОГО движения: сколько пути пройдено к каждому моменту времени.
 *
 * Это ИНСТРУМЕНТ, а не проверка: он ничего не утверждает и всегда возвращает 0.
 * Нужен там, где вопрос звучит как «правильно ли оно открывается» — глазами на
 * это не отвечают, а приёмка сторожит инварианты кода, а не ощущение темпа.
 *
 * Запуск:
 *   yarn motion:trace --route=tripster --open='[data-testid="primary-cta"]'
 *   yarn motion:trace --route='flowwow?stage=push' --open='[data-testid="push-banner"]'
 *   yarn motion:trace --route=uchi --open=... --ms=1200 --width=390
 *
 * ── Почему замер, а не глазомер ───────────────────────────────────────
 *
 * 2026-08-22 шкала демо шла 0.22-0.34 с — в 1.5-2 раза быстрее системных
 * пресетов iOS (0.5 с). Владелец увидел это раньше любого замера, но
 * ИСПРАВИТЬ на глаз не вышло бы: первая попытка (пружина Motion с
 * `visualDuration`) выглядела «в темпе», а на деле проходила 90% пути за
 * 240 мс и доводила остаток ещё 300 — рывок с подползанием. Отличить это от
 * ровного хода можно только профилем.
 *
 * ── Что печатает ──────────────────────────────────────────────────────
 *
 * Для каждого движущегося слоя: пройденную долю пути по времени, момент
 * достижения 90 / 95 / 99 % и полной остановки, а также непрозрачность
 * слоёв — рассинхрон затемнения и листа виден именно в ней.
 *
 * ── Ограничение, которое нельзя обойти ────────────────────────────────
 *
 * Движок — Chromium, не WebKit, и эталона системного листа iOS здесь нет:
 * инструмент отвечает «как идёт НАШЕ движение», а не «так же ли, как в iOS».
 * Сверка с системой требует записи экрана с устройства.
 */

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const BASE = arg("base", "http://127.0.0.1:4319");
/*
 * Маршрут можно передавать со слэшем и без него.
 *
 * Git Bash (MSYS) подменяет аргумент, начинающийся со слэша, на путь Windows:
 * `--route=/tripster` приезжает как `C:/Program Files/tripster`. Поэтому
 * ведущий слэш добавляется здесь, а подмену ловим и объясняем, а не молча
 * идём по битому URL.
 */
const routeRaw = arg("route", "tripster");
if (/^[A-Za-z]:[\/]/.test(routeRaw)) {
  console.error(
    `Маршрут приехал как путь Windows: ${routeRaw}
` +
      "Это Git Bash подменил аргумент со слэшем. Передай без слэша " +
      "(--route=tripster) или запусти с MSYS_NO_PATHCONV=1.",
  );
  process.exit(2);
}
const ROUTE = routeRaw.startsWith("/") ? routeRaw : `/${routeRaw}`;
const OPEN = arg("open", '[data-testid="primary-cta"]');
const MS = Number(arg("ms", "1000"));
const WIDTH = Number(arg("width", "390"));
const HEIGHT = Number(arg("height", "844"));

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: WIDTH, height: HEIGHT },
  // Профиль снимается с ВКЛЮЧЁННЫМ движением: под reduce его нет вовсе, и
  // встроенный браузер отдаёт именно reduce — отсюда пустые замеры вживую.
  reducedMotion: "no-preference",
});
const page = await context.newPage();
await page.goto(`${BASE}${ROUTE}`, { waitUntil: "networkidle" });
await page.waitForTimeout(400);

await page.click(OPEN);
const frames = await page.evaluate(async (ms) => {
  const moving = () =>
    [...document.querySelectorAll("*")].filter((n) => {
      const cs = getComputedStyle(n);
      if (cs.transform === "none" && cs.opacity === "1") return false;
      const m = new DOMMatrixReadOnly(cs.transform);
      return Math.abs(m.m41) > 1 || Math.abs(m.m42) > 1 || Number(cs.opacity) < 1;
    });

  const out = [];
  const t0 = performance.now();
  while (performance.now() - t0 < ms) {
    const t = Math.round(performance.now() - t0);
    const layers = moving().map((n) => {
      const cs = getComputedStyle(n);
      const m = new DOMMatrixReadOnly(cs.transform);
      return {
        id: n.dataset.testid || n.getAttribute("role") || n.tagName.toLowerCase(),
        x: Math.round(m.m41),
        y: Math.round(m.m42),
        opacity: Number(cs.opacity),
      };
    });
    out.push({ t, layers });
    await new Promise((r) => requestAnimationFrame(r));
  }
  return out;
}, MS);

await browser.close();

// Слои сводятся по идентификатору: у каждого свой путь и свой момент остановки.
const byId = new Map();
for (const frame of frames) {
  for (const layer of frame.layers) {
    if (!byId.has(layer.id)) byId.set(layer.id, []);
    byId.get(layer.id).push({ t: frame.t, ...layer });
  }
}

console.log(`\nПрофиль движения: ${ROUTE}, клик по ${OPEN}, окно ${MS} мс, ${WIDTH}×${HEIGHT}\n`);

for (const [id, samples] of byId) {
  const peak = Math.max(...samples.map((s) => Math.max(Math.abs(s.x), Math.abs(s.y))));
  const minOpacity = Math.min(...samples.map((s) => s.opacity));
  if (peak < 2 && minOpacity > 0.99) continue;

  console.log(`  ${id}`);
  if (peak >= 2) {
    // Момент, когда пройдена доля пути от стартового смещения к нулю.
    const at = (share) => {
      const hit = samples.find((s) => s.t > 0 && Math.max(Math.abs(s.x), Math.abs(s.y)) <= peak * (1 - share));
      return hit ? `${hit.t} мс` : "не дошло";
    };
    console.log(`    путь ${peak} px: 50% — ${at(0.5)}, 90% — ${at(0.9)}, 95% — ${at(0.95)}, 99% — ${at(0.99)}, до пикселя — ${at(1 - 1 / peak)}`);
    const marks = samples.filter((s) => s.t <= 500 && s.t % 60 < 20).slice(0, 9);
    console.log(`    ${marks.map((s) => `${s.t}:${Math.round((1 - Math.max(Math.abs(s.x), Math.abs(s.y)) / peak) * 100)}%`).join("  ")}`);
  }
  if (minOpacity < 0.99) {
    const full = samples.find((s) => s.opacity > 0.99);
    console.log(`    прозрачность: минимум ${minOpacity.toFixed(2)}, полная непрозрачность — ${full ? `${full.t} мс` : "не достигнута"}`);
  }
}
console.log();
