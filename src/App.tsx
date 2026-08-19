import { useEffect, useMemo } from "react";

import { logDiagnostics } from "@demo/theme/build-theme";
import { loadTenant, TenantLoadError, type LoadFailure } from "@demo/theme/tenant-loader";
import { tenantSchema, type TenantConfig } from "@demo/theme/tenant.schema";
import { ConfigErrorView } from "@demo/views/ConfigErrorView";
import { LauncherView } from "@demo/views/LauncherView";
import { StubView } from "@demo/views/StubView";
import { ScreenHost } from "@demo/views/ScreenHost";
import { parseStage, type DemoStage } from "@demo/views/demo-flow";
import { FORCED_STATES, type ForcedState } from "@demo/views/screen-props";

/**
 * Лёгкий роутер. Никакой презентации: только разбор адреса, загрузка темы
 * и выбор поверхности — экран, ошибка конфига или нейтральная заглушка.
 *
 * Адресация — по пути. Каждому подрядчику отдаётся ПРЯМАЯ ссылка на его
 * флоу; лаунчера со списком тем в проде нет, чтобы один подрядчик не узнал
 * о другом. Путь задаёт тему и архетип, query может уточнить состояние
 * (`?stage=`, `?state=`, `?a11y=`).
 */

/** Прямые ссылки подрядчиков: путь → тема + архетип. */
const PATH_ROUTES: Record<string, { tenant: string; archetype: TenantConfig["archetype"] }> = {
  "/flowwow": { tenant: "flowwow-like", archetype: "cart_checkout" },
  "/uchi": { tenant: "uchi-like", archetype: "subscription_payment" },
  "/voroh": { tenant: "voroh", archetype: "ticket_checkout" },
  "/voroh-light": { tenant: "voroh-light", archetype: "ticket_checkout" },
  "/monochrome": { tenant: "monochrome", archetype: "store_checkout" },
  "/padlhub": { tenant: "padlhub", archetype: "plan_sheet" },
  "/yes-atlas": { tenant: "yes-atlas", archetype: "plan_sheet" },
  "/rml": { tenant: "rml", archetype: "order_steps" },
  "/hval": { tenant: "hval", archetype: "slot_delivery" },
  "/bombbar": { tenant: "bombbar", archetype: "bonus_checkout" },
  "/mybox": { tenant: "mybox", archetype: "pickup_checkout" },
};

/** Лаунчер — только для локальной отладки, по неугадываемому пути и только в dev. */
const LAUNCHER_PATH = "/__launcher";

export function App() {
  const search = typeof window === "undefined" ? "" : window.location.search;
  const pathname = typeof window === "undefined" ? "/" : window.location.pathname;

  const route = useMemo(() => resolveRoute(pathname, search), [pathname, search]);

  // Диагностика печатается вне рендера: каждая коррекция обязана быть
  // записана ровно один раз, а не по разу на проход рендера.
  useEffect(() => {
    if (route.kind === "screen") {
      logDiagnostics(route.theme.tenant.tenant_id, route.theme.diagnostics);
    } else if (route.kind === "error") {
      logDiagnostics(route.failure.slug ?? "unknown", route.failure.diagnostics);
    }
  }, [route]);

  /*
   * Гарнитуры донора. `@font-face` обязан жить в документе, а не на элементе
   * -контейнере темы: правило описывает шрифт для всей страницы и на инлайн
   * -стилях не выражается вовсе. Узел снимается при смене темы — иначе
   * описания разных подрядчиков копились бы в head одной сессии.
   */
  const fontFaceCss = route.kind === "screen" ? route.theme.fontFaceCss : null;
  useEffect(() => {
    if (!fontFaceCss) return;
    const node = document.createElement("style");
    node.dataset.tenantFonts = "";
    node.textContent = fontFaceCss;
    document.head.appendChild(node);
    return () => {
      node.remove();
    };
  }, [fontFaceCss]);

  if (route.kind === "launcher") {
    // Вторая, compile-time защита поверх маршрутизации: `import.meta.env.DEV`
    // сворачивается при сборке, поэтому в прод-бандл разметка лаунчера со
    // списком тем не попадает вовсе, а не просто становится недостижимой.
    return import.meta.env.DEV ? <LauncherView /> : <StubView />;
  }
  if (route.kind === "stub") return <StubView />;
  if (route.kind === "error") {
    return (
      <ConfigErrorView
        diagnostics={route.failure.diagnostics}
        source={route.failure.source}
        slug={route.failure.slug}
      />
    );
  }

  return (
    <ScreenHost
      theme={route.theme}
      forcedState={route.forcedState}
      showHandoff={route.showHandoff}
      initialStage={route.initialStage}
    />
  );
}

type Route =
  | { kind: "launcher" }
  | { kind: "stub" }
  | { kind: "error"; failure: LoadFailure }
  | {
      kind: "screen";
      theme: ReturnType<typeof loadTenant>["theme"];
      forcedState: ForcedState;
      showHandoff: boolean;
      initialStage: DemoStage | null;
    };

/** Нормализуем путь: убираем хвостовой слэш (кроме корня), нижний регистр. */
function normalizePath(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, "");
  return (trimmed === "" ? "/" : trimmed).toLowerCase();
}

function resolveRoute(pathname: string, search: string): Route {
  const path = normalizePath(pathname);

  // Лаунчер доступен только в dev по служебному пути; в проде — заглушка.
  if (path === LAUNCHER_PATH) {
    return import.meta.env.DEV ? { kind: "launcher" } : { kind: "stub" };
  }

  // Прямая ссылка подрядчика: путь задаёт тему и архетип, query уточняет состояние.
  const pathRoute = PATH_ROUTES[path];
  if (pathRoute) {
    return resolveScreen(buildContentSearch(pathRoute, search));
  }

  // Корень сохраняет обратную совместимость с прямыми `?t=`/`?tenant=` ссылками
  // и приёмочным прогоном: интент в query открывает экран, пустой корень — заглушку.
  if (path === "/") {
    const params = new URLSearchParams(search);
    const hasTenantIntent =
      params.has("t") ||
      params.has("tenant") ||
      params.has("archetype") ||
      params.has("stage");
    if (hasTenantIntent) return resolveScreen(search);
  }

  // Ни известный путь, ни корень с интентом — нейтральная заглушка (в т.ч. любой
  // неизвестный путь: не белый экран и без намёка на другие демо).
  return { kind: "stub" };
}

/**
 * Собирает эффективный query для прямой ссылки: тема и архетип берутся из пути
 * и перекрывают query, `?t=` игнорируется (путь — единственный источник темы),
 * остальные уточнения состояния сохраняются.
 */
function buildContentSearch(
  route: { tenant: string; archetype: TenantConfig["archetype"] },
  search: string,
): string {
  const params = new URLSearchParams(search);
  params.set("tenant", route.tenant);
  params.set("archetype", route.archetype);
  params.delete("t");
  return `?${params.toString()}`;
}

function resolveScreen(search: string): Route {
  const params = new URLSearchParams(search);

  const stateParam = params.get("state");
  const showHandoff = stateParam === "handoff";
  const forcedState = (FORCED_STATES as readonly string[]).includes(stateParam ?? "")
    ? (stateParam as ForcedState)
    : null;
  const initialStage = parseStage(params.get("stage"));

  try {
    const loaded = loadTenant(search, {
      archetype: parseArchetype(params.get("archetype")),
      a11yMode: parseA11yMode(params.get("a11y")),
    });
    return {
      kind: "screen",
      theme: loaded.theme,
      forcedState,
      showHandoff,
      initialStage,
    };
  } catch (error) {
    if (error instanceof TenantLoadError) {
      return { kind: "error", failure: error.failure };
    }
    throw error;
  }
}

/*
 * Список архетипов берётся ИЗ СХЕМЫ, а не переписывается здесь руками.
 *
 * Второй список расходился молча: `?archetype=` отбрасывал архетипы,
 * добавленные позже, и путь терял управление видом экрана — спасал только
 * совпадающий `archetype` внутри конфига темы. Производный список делает
 * расхождение невозможным, а не маловероятным.
 */
const ARCHETYPES: readonly TenantConfig["archetype"][] =
  tenantSchema.shape.archetype.options;

function parseArchetype(value: string | null): TenantConfig["archetype"] | null {
  // Перебор по списку, а не сравнение с двумя именами: прежняя запись молча
  // отбрасывала архетипы, добавленные позже, и путь терял управление видом
  // экрана — спасал только совпадающий archetype внутри конфига темы.
  return ARCHETYPES.includes(value as TenantConfig["archetype"])
    ? (value as TenantConfig["archetype"])
    : null;
}

function parseA11yMode(value: string | null): TenantConfig["a11y_mode"] | null {
  return value === "enforced" || value === "donor_faithful" ? value : null;
}
