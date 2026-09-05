import { buildTheme, TenantConfigError, type BuiltTheme, type Diagnostic } from "./build-theme";
import type { TenantConfig } from "./tenant.schema";

/**
 * Загрузка конфига тенанта.
 *
 * Два источника, приоритет у URL:
 *   1. `?t=<base64 конфига>` — демо уезжает подрядчику ссылкой без деплоя;
 *   2. `?tenant=<slug>` — одна из поставляемых калибровочных тем.
 *
 * Некорректный конфиг в URL — внятная ошибка на экране. Ни белого экрана,
 * ни молчаливого отката к дефолту.
 *
 * Тема из URL разбирается синхронно, поставляемая приезжает отдельным
 * чанком: она нужна ровно одна, а лежало в бандле четырнадцать.
 */

/*
 * Тема грузится ПО ТРЕБОВАНИЮ, а не все четырнадцать разом.
 *
 * Подрядчик открывает свою ссылку и получает одну тему; статический импорт
 * вёз в общем чанке все — 83 КБ JSON, которые растут с каждой новой темой и
 * которые он никогда не увидит. Ключи остаются ЛИТЕРАЛАМИ намеренно:
 * `check:registry` читает этот список разбором исходника, и glob-выражение
 * оставило бы его без имён.
 */
export const BUNDLED_TENANTS: Record<string, () => Promise<{ default: unknown }>> = {
  "flowwow-like": () => import("../../tenants/flowwow-like.json"),
  "uchi-like": () => import("../../tenants/uchi-like.json"),
  "padlhub": () => import("../../tenants/padlhub.json"),
  "voroh": () => import("../../tenants/voroh.json"),
  "yes-atlas": () => import("../../tenants/yes-atlas.json"),
  "voroh-light": () => import("../../tenants/voroh-light.json"),
  "monochrome": () => import("../../tenants/monochrome.json"),
  "rml": () => import("../../tenants/rml.json"),
  "hval": () => import("../../tenants/hval.json"),
  "bombbar": () => import("../../tenants/bombbar.json"),
  "mybox": () => import("../../tenants/mybox.json"),
  "tripster": () => import("../../tenants/tripster.json"),
  "ewa": () => import("../../tenants/ewa.json"),
  "yandex-plus": () => import("../../tenants/yandex-plus.json"),
};

export const DEFAULT_TENANT_SLUG = "flowwow-like";

export interface LoadedTenant {
  theme: BuiltTheme;
  source: "url" | "bundled";
  slug: string;
}

export interface LoadFailure {
  diagnostics: Diagnostic[];
  source: "url" | "bundled";
  slug: string | null;
}

export class TenantLoadError extends Error {
  readonly failure: LoadFailure;

  constructor(failure: LoadFailure) {
    super(failure.diagnostics.map((d) => `${d.code}: ${d.message}`).join("\n"));
    this.name = "TenantLoadError";
    this.failure = failure;
  }
}

/** base64 → строка, устойчиво к кириллице. */
export function decodeBase64Utf8(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "=",
  );
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Строка → base64url. Используется, чтобы собрать ссылку на кастомный конфиг. */
export function encodeBase64Utf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function buildTenantUrl(config: unknown, origin = ""): string {
  return `${origin}?t=${encodeBase64Utf8(JSON.stringify(config))}`;
}

function parseUrlConfig(raw: string): unknown {
  let json: string;
  try {
    json = decodeBase64Utf8(raw);
  } catch {
    throw new TenantLoadError({
      source: "url",
      slug: null,
      diagnostics: [
        {
          code: "E_URL_BASE64",
          severity: "error",
          message: "Параметр ?t= не является корректной base64-строкой",
          detail: "Ожидается base64 (или base64url) от JSON-конфига тенанта.",
        },
      ],
    });
  }

  try {
    return JSON.parse(json) as unknown;
  } catch (error) {
    throw new TenantLoadError({
      source: "url",
      slug: null,
      diagnostics: [
        {
          code: "E_URL_JSON",
          severity: "error",
          message: "Конфиг из ?t= не является корректным JSON",
          detail: error instanceof Error ? error.message : undefined,
        },
      ],
    });
  }
}

export interface LoadOptions {
  /** Принудительная смена архетипа: нужна, чтобы проверить тему на чужой раскладке. */
  archetype?: TenantConfig["archetype"] | null;
  a11yMode?: TenantConfig["a11y_mode"] | null;
}

function applyOverrides(raw: unknown, options: LoadOptions): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const copy = { ...(raw as Record<string, unknown>) };
  if (options.archetype) copy.archetype = options.archetype;
  if (options.a11yMode) copy.a11y_mode = options.a11yMode;
  return copy;
}

export async function loadTenant(
  search: string,
  options: LoadOptions = {},
): Promise<LoadedTenant> {
  const params = new URLSearchParams(search);
  const urlConfig = params.get("t");

  if (urlConfig) {
    const raw = applyOverrides(parseUrlConfig(urlConfig), options);
    try {
      const theme = buildTheme(raw);
      return { theme, source: "url", slug: theme.tenant.tenant_id };
    } catch (error) {
      if (error instanceof TenantConfigError) {
        throw new TenantLoadError({
          source: "url",
          slug: null,
          diagnostics: error.diagnostics,
        });
      }
      throw error;
    }
  }

  const slug = params.get("tenant") ?? DEFAULT_TENANT_SLUG;
  const load = BUNDLED_TENANTS[slug];
  if (!load) {
    throw new TenantLoadError({
      source: "bundled",
      slug,
      diagnostics: [
        {
          code: "E_TENANT_NOT_FOUND",
          severity: "error",
          message: `Тема «${slug}» не поставляется с демо`,
          detail: `Доступны: ${Object.keys(BUNDLED_TENANTS).join(", ")}. Свою тему можно передать через ?t=<base64>.`,
        },
      ],
    });
  }

  const bundled = (await load()).default;

  try {
    const theme = buildTheme(applyOverrides(bundled, options));
    return { theme, source: "bundled", slug };
  } catch (error) {
    if (error instanceof TenantConfigError) {
      throw new TenantLoadError({
        source: "bundled",
        slug,
        diagnostics: error.diagnostics,
      });
    }
    throw error;
  }
}
