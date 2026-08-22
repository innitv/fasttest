import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Статическая проверка реестра тем. Сервер не нужен.
 *
 * Заведение темы требует пяти записей, и четыре из них сторожит компилятор:
 * значение в `archetype` схемы, экран в `CONTRACTOR_SCREENS`, раскладка оплаты
 * в `layoutByArchetype`, строки банка в `ARCHETYPE_DEFAULTS` — `Record` по enum
 * не даст пропустить ни одну.
 *
 * Пятая — маршрут в `PATH_ROUTES` (`src/App.tsx`) — не сторожилась ничем.
 * Тема без маршрута существует, проходит сборку, отдаётся по `?tenant=` и при
 * этом НЕДОСТУПНА по своей ссылке: подрядчику отправлять нечего. Заметить это
 * можно было только открыв ссылку руками. Аудит 2026-08-21, находка P2-2.
 *
 * Проверяется четыре инварианта:
 *   1. у каждой темы из `tenants/*.json` есть маршрут;
 *   2. каждый маршрут ссылается на существующий файл темы;
 *   3. архетип в маршруте совпадает с архетипом в самой теме — маршрут
 *      дублирует это поле, и рассинхрон здесь тише всего: ссылка работает, но
 *      отдаёт чужую раскладку;
 *   4. каждая тема зарегистрирована в `BUNDLED_TENANTS`, иначе `?tenant=` её
 *      не найдёт.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");

const findings = [];

// ── Источники ────────────────────────────────────────────────────────
const themeFiles = readdirSync(path.join(root, "tenants"))
  .filter((name) => name.endsWith(".json"))
  .map((name) => name.replace(/\.json$/, ""));

const appSource = readFileSync(path.join(root, "src", "App.tsx"), "utf8");
const routes = [
  ...appSource.matchAll(
    /"(\/[a-z0-9-]+)":\s*\{\s*tenant:\s*"([a-z0-9-]+)",\s*archetype:\s*"([a-z_]+)"/g,
  ),
].map(([, route, tenant, archetype]) => ({ route, tenant, archetype }));

const loaderSource = readFileSync(path.join(root, "src", "theme", "tenant-loader.ts"), "utf8");
const bundledBlock = loaderSource.slice(
  loaderSource.indexOf("BUNDLED_TENANTS"),
  loaderSource.indexOf("DEFAULT_TENANT_SLUG"),
);
// Ключ пишется двумя способами: `"voroh-light": vorohLight` и краткой формой `mybox`.
const bundled = new Set([
  ...[...bundledBlock.matchAll(/"([a-z0-9-]+)":/g)].map((m) => m[1]),
  ...[...bundledBlock.matchAll(/^\s{2}([a-z][a-z0-9]*),\s*$/gm)].map((m) => m[1]),
]);

// ── 1. Тема без маршрута ─────────────────────────────────────────────
const routedTenants = new Set(routes.map((r) => r.tenant));
const withoutRoute = themeFiles.filter((slug) => !routedTenants.has(slug));
if (withoutRoute.length > 0) {
  findings.push(
    `тема есть, а ссылки на неё нет — ${withoutRoute.join(", ")}. ` +
      "Заведи маршрут в PATH_ROUTES (src/App.tsx): без него подрядчику нечего отправить.",
  );
}

// ── 2. Маршрут на несуществующую тему ────────────────────────────────
const missingTheme = routes.filter((r) => !themeFiles.includes(r.tenant));
if (missingTheme.length > 0) {
  findings.push(
    `маршрут ведёт на несуществующую тему — ${missingTheme
      .map((r) => `${r.route} → ${r.tenant}`)
      .join(", ")}.`,
  );
}

// ── 3. Архетип маршрута против архетипа темы ─────────────────────────
for (const r of routes) {
  if (!themeFiles.includes(r.tenant)) continue;
  const theme = JSON.parse(readFileSync(path.join(root, "tenants", `${r.tenant}.json`), "utf8"));
  if (theme.archetype !== r.archetype) {
    findings.push(
      `${r.route}: маршрут объявляет архетип '${r.archetype}', а тема '${r.tenant}' — ` +
        `'${theme.archetype}'. Ссылка откроется и покажет чужую раскладку.`,
    );
  }
}

// ── 4. Тема вне BUNDLED_TENANTS ──────────────────────────────────────
const notBundled = themeFiles.filter((slug) => !bundled.has(slug));
if (notBundled.length > 0) {
  findings.push(
    `тема не зарегистрирована в BUNDLED_TENANTS — ${notBundled.join(", ")}. ` +
      "Параметр ?tenant= её не найдёт.",
  );
}

// ── Итог ─────────────────────────────────────────────────────────────
if (findings.length > 0) {
  console.log("registry: ПРОВАЛ");
  for (const line of findings) console.log(`  - ${line}`);
  process.exit(1);
}

console.log("registry: порядок");
console.log(`  - тем: ${themeFiles.length}, у каждой свой маршрут и запись в BUNDLED_TENANTS`);
console.log(`  - маршрутов: ${routes.length}, архетип каждого совпадает с архетипом темы`);
