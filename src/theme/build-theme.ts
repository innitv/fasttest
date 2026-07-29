import { buildBankPayload, type BankPayload } from "./bank-payload";
import {
  contrastRatio,
  ensureReadableOn,
  hexToOklch,
  inkPair,
  isDarkColor,
  pickOnColor,
  surfaceTonalStop,
  withLightness,
} from "./color";
import {
  FORBIDDEN_OZON_SPELLINGS,
  OZON_LABEL,
  OZON_METHOD_ID,
  tenantSchema,
  type TenantConfig,
} from "./tenant.schema";

/**
 * Сборка темы из `tenant.json`.
 *
 * Коды `E_*` — ошибки сборки: конфиг отклоняется целиком, экран не рендерится.
 * Коды `W_*` — предупреждения: пишутся в лог и в диагностический список,
 * но не блокируют. Молчаливых фолбэков нет ни в одном случае.
 */

export type DiagnosticSeverity = "error" | "warning" | "info";

export interface Diagnostic {
  code: string;
  severity: DiagnosticSeverity;
  message: string;
  detail?: string;
}

export class TenantConfigError extends Error {
  readonly diagnostics: Diagnostic[];

  constructor(diagnostics: Diagnostic[]) {
    super(diagnostics.map((d) => `${d.code}: ${d.message}`).join("\n"));
    this.name = "TenantConfigError";
    this.diagnostics = diagnostics;
  }
}

export interface BuiltTheme {
  tenant: TenantConfig;
  /** CSS-переменные слоя `--t-*`. Единственный способ доставить тему в UI. */
  vars: Record<string, string>;
  diagnostics: Diagnostic[];
  /** Индекс «Ozon Банк» в списке способов оплаты (0-based). */
  ozonIndex: number;
  /**
   * Данные для экранов банка. Ни одного цвета, радиуса и отступа —
   * экраны банка получают payload и не получают theme.
   */
  bankPayload: BankPayload;
}

const FONT_STACKS: Record<TenantConfig["typography"]["family"], string> = {
  system:
    '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif',
  rounded:
    '"SF Pro Rounded", ui-rounded, "Nunito", "Rubik", "Segoe UI Variable", system-ui, sans-serif',
  grotesk:
    '"Inter", "Helvetica Neue", "Segoe UI", system-ui, sans-serif',
};

function radiusToCss(value: number | "pill"): string {
  return value === "pill" ? "9999px" : `${value}px`;
}

function radiusToNumber(value: number | "pill"): number {
  return value === "pill" ? 999 : value;
}

function formatContrast(value: number): string {
  return `${value.toFixed(2)}:1`;
}

/** Валидация, не выразимая схемой: коды из `design-brief.md` → Правила валидации. */
function validateSemantics(tenant: TenantConfig): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  // ── E_RADIUS_ORDER ─────────────────────────────────────────────────
  const field = tenant.radius.field;
  const control = radiusToNumber(tenant.radius.control);
  const card = tenant.radius.card;
  if (!tenant.radius.allow_inversion && !(field <= control && control <= card)) {
    diagnostics.push({
      code: "E_RADIUS_ORDER",
      severity: "error",
      message: "Нарушен порядок радиусов field ≤ control ≤ card",
      detail: `field=${field}, control=${control}, card=${card}. Снимается только явным radius.allow_inversion=true.`,
    });
  }

  // ── E_HEADER_LOGO ──────────────────────────────────────────────────
  if (tenant.header.style === "centered_logo") {
    const logo = tenant.brand.logo;
    const hasText = logo.kind === "text" && Boolean(logo.text?.trim());
    const hasSlot = logo.kind === "slot" && Boolean(logo.slot_ratio?.trim());
    if (!hasText && !hasSlot) {
      diagnostics.push({
        code: "E_HEADER_LOGO",
        severity: "error",
        message: 'header.style="centered_logo" требует заданного brand.logo',
        detail: "kind=text → нужен brand.logo.text; kind=slot → нужен brand.logo.slot_ratio.",
      });
    }
  }

  // ── E_METHOD_COUNT ─────────────────────────────────────────────────
  const methods = tenant.payment_list.methods;
  if (methods.length < 2 || methods.length > 8) {
    diagnostics.push({
      code: "E_METHOD_COUNT",
      severity: "error",
      message: `В payment_list.methods ${methods.length} элементов, допустимо 2–8`,
    });
  }

  const duplicateIds = methods
    .map((m) => m.id)
    .filter((id, index, all) => all.indexOf(id) !== index);
  if (duplicateIds.length > 0) {
    diagnostics.push({
      code: "E_METHOD_DUPLICATE",
      severity: "error",
      message: `Дублирующиеся id способов оплаты: ${[...new Set(duplicateIds)].join(", ")}`,
    });
  }

  // ── E_OZON_MISSING ─────────────────────────────────────────────────
  const ozonIndex = methods.findIndex((m) => m.id === OZON_METHOD_ID);
  if (ozonIndex === -1) {
    diagnostics.push({
      code: "E_OZON_MISSING",
      severity: "error",
      message: 'В payment_list.methods нет элемента с id="ozon"',
      detail: "Демо без точки вставки бессмысленно.",
    });
  }

  // ── E_OZON_LABEL ───────────────────────────────────────────────────
  const labelsToCheck: Array<{ where: string; value: string }> = [
    { where: "ozon.label", value: tenant.ozon.label },
  ];
  if (ozonIndex !== -1) {
    labelsToCheck.push({
      where: `payment_list.methods[${ozonIndex}].label`,
      value: methods[ozonIndex].label,
    });
  }
  for (const { where, value } of labelsToCheck) {
    if (value !== OZON_LABEL) {
      const looksLikeForbidden = FORBIDDEN_OZON_SPELLINGS.includes(value);
      diagnostics.push({
        code: "E_OZON_LABEL",
        severity: "error",
        message: `${where} = «${value}», допустимо только «${OZON_LABEL}»`,
        detail: looksLikeForbidden
          ? "Это одно из явно запрещённых написаний бренда."
          : "Написание бренда зафиксировано пользователем и не является параметром.",
      });
    }
  }

  // ── W_OZON_POSITION (расширение контракта) ─────────────────────────
  if (ozonIndex !== -1 && ozonIndex + 1 !== tenant.ozon.position) {
    diagnostics.push({
      code: "W_OZON_POSITION",
      severity: "warning",
      message: `Ozon Банк стоит на позиции ${ozonIndex + 1}, а ozon.position=${tenant.ozon.position}`,
      detail:
        "Позиция 1 — единственная, гарантирующая полную видимость карточки на 320 px в горизонтальном ряду.",
    });
  }

  // ── E_PHONE_DEMO_NUMBER ────────────────────────────────────────────
  // Демо-номер, не проходящий проверку формата (ровно 10 цифр), никогда не
  // дойдёт до ветки «не клиент»: проверка запускается только при 10 цифрах.
  const demoNumber = tenant.ozon.phone_gate.not_client_number.replace(/\D/g, "");
  if (demoNumber.length !== 10) {
    diagnostics.push({
      code: "E_PHONE_DEMO_NUMBER",
      severity: "error",
      message: `ozon.phone_gate.not_client_number содержит ${demoNumber.length} цифр, требуется ровно 10`,
      detail: "Демо-номер короче или длиннее 10 цифр не пройдёт проверку формата и никогда не покажет ветку «не клиент».",
    });
  }

  // ── W_PHONE_GATE_DISABLED ──────────────────────────────────────────
  if (!tenant.ozon.phone_gate.enabled) {
    diagnostics.push({
      code: "W_PHONE_GATE_DISABLED",
      severity: "warning",
      message: "ozon.phone_gate.enabled=false — ветка «не клиент» недоступна",
      detail: "Маршрут возвращается к прежнему: нажатие → пауза push_delay_ms → пуш.",
    });
  }

  // ── W_OZON_PRESELECTED ─────────────────────────────────────────────
  if (tenant.payment_list.default_selected === OZON_METHOD_ID) {
    diagnostics.push({
      code: "W_OZON_PRESELECTED",
      severity: "warning",
      message: 'default_selected указывает на "ozon"',
      detail: "Демо теряет наблюдаемое действие выбора — ради него оно и делается.",
    });
  }

  if (
    tenant.payment_list.default_selected !== null &&
    !methods.some((m) => m.id === tenant.payment_list.default_selected)
  ) {
    diagnostics.push({
      code: "E_DEFAULT_SELECTED",
      severity: "error",
      message: `default_selected="${tenant.payment_list.default_selected}" отсутствует в methods`,
    });
  }

  // ── W_SHADOW_ON_FLAT_DONOR ─────────────────────────────────────────
  if (tenant.elevation.model === "shadow") {
    diagnostics.push({
      code: "W_SHADOW_ON_FLAT_DONOR",
      severity: "warning",
      message: 'elevation.model="shadow" — оба калибровочных донора теней не используют',
      detail: "Тень поверх плоского донора — самый быстрый способ получить generic-шаблон.",
    });
  }
  if (tenant.elevation.model !== "shadow" && tenant.elevation.shadow !== null) {
    diagnostics.push({
      code: "E_SHADOW_WITHOUT_MODEL",
      severity: "error",
      message: 'elevation.shadow задан, но elevation.model не равен "shadow"',
    });
  }
  if (
    tenant.elevation.selected_border_width <
    tenant.elevation.border_width * 1.5
  ) {
    diagnostics.push({
      code: "W_SELECTED_BORDER",
      severity: "warning",
      message: "selected_border_width < border_width × 1.5 — состояние выбора плохо воспринимается",
    });
  }

  // ── Архетип против раскладки ───────────────────────────────────────
  const expectedLayout =
    tenant.archetype === "cart_checkout" ? "horizontal_cards" : tenant.archetype === "store_checkout" ? "radio_rows" : "vertical_buttons";
  if (tenant.payment_list.layout !== expectedLayout) {
    diagnostics.push({
      code: "W_LAYOUT_ARCHETYPE",
      severity: "warning",
      message: `Архетип ${tenant.archetype} обычно использует layout="${expectedLayout}", задан "${tenant.payment_list.layout}"`,
      detail: "Раскладка списка оплаты — структурно-визуальная ось 21; смена допустима, но она меняет узнаваемость.",
    });
  }

  return diagnostics;
}

interface DerivedColors {
  vars: Record<string, string>;
  diagnostics: Diagnostic[];
}

function deriveColors(tenant: TenantConfig): DerivedColors {
  const diagnostics: Diagnostic[] = [];
  const vars: Record<string, string> = {};
  const enforced = tenant.a11y_mode === "enforced";
  const { primary, on_primary } = tenant.brand;
  const textPrimary = tenant.surface.text_primary;

  /*
   * ── Полярность поверхности ────────────────────────────────────────
   *
   * Единственный источник знания о том, светлая тема или тёмная. В конфиге
   * режима нет: подрядчик присылает цвета, а не режим. Все производные
   * ниже (тональная подложка, отключённое состояние, нажатие, подложка
   * формы) спрашивают полярность у фона, а не предполагают белый лист.
   */
  const surfaceIsDark = isDarkColor(tenant.surface.background);
  /*
   * Пара чернил темы. Тёмное чернило ищется по теме: `text_primary`, если он
   * тёмный, иначе фон или карточка, если тёмные они. Так на тёмной теме
   * (где `text_primary` белый) остаётся настоящий второй кандидат.
   */
  const inks = inkPair(textPrimary, tenant.surface.background, tenant.surface.card);

  // ── CTA: заливка и цвет содержимого ────────────────────────────────
  let ctaFill = primary;
  let ctaOn: string;

  if (on_primary !== "auto") {
    ctaOn = on_primary;
    const ratio = contrastRatio(ctaFill, ctaOn);
    if (ratio < 4.5) {
      diagnostics.push({
        code: enforced ? "E_CONTRAST_BRAND" : "W_CTA_CONTRAST",
        severity: enforced ? "error" : "warning",
        message: `brand.on_primary задан явно и даёт ${formatContrast(ratio)} на brand.primary`,
        detail: enforced
          ? 'Явный on_primary отключает автоподбор. Уберите его или поставьте "auto".'
          : "a11y_mode=donor_faithful: значение донора сохранено.",
      });
    }
  } else if (enforced) {
    const picked = pickOnColor(primary, inks, 4.5);
    if (picked.failed) {
      diagnostics.push({
        code: "E_CONTRAST_BRAND",
        severity: "error",
        message: `Ни один допустимый on-color не даёт 4.5:1 на brand.primary ${primary}`,
        detail: `Лучшее достигнутое значение — ${formatContrast(picked.contrast)} после 6 шагов коррекции светлоты.`,
      });
    }
    ctaFill = picked.fill;
    ctaOn = picked.on;
    if (picked.steps > 0) {
      diagnostics.push({
        code: "I_BRAND_FILL_SHIFTED",
        severity: "info",
        message: `Заливка CTA сдвинута по светлоте: ${primary} → ${picked.fill} (${picked.steps} шаг(ов))`,
        detail: `Достигнут контраст ${formatContrast(picked.contrast)}. Исходный brand.primary сохранён для акцентов и обводок.`,
      });
    } else if (picked.on !== inks.light) {
      diagnostics.push({
        code: "I_ON_COLOR_DARK",
        severity: "info",
        message: `Цвет текста на CTA — ${picked.on}, контраст ${formatContrast(picked.contrast)}`,
        detail: "Белый на этой заливке порог не проходит (шаг 1 правила автоподбора отклонён).",
      });
    }
  } else {
    // donor_faithful: сохраняем донорское поведение — белый текст.
    ctaOn = "#FFFFFF";
    const ratio = contrastRatio(ctaFill, ctaOn);
    if (ratio < 4.5) {
      diagnostics.push({
        code: "W_CTA_CONTRAST",
        severity: "warning",
        message: `Белый текст на ${ctaFill} даёт ${formatContrast(ratio)} при пороге 4.5:1`,
        detail: "a11y_mode=donor_faithful: значение донора сохранено намеренно.",
      });
    }
  }

  vars["--t-brand-primary"] = primary;
  vars["--t-brand-fill"] = ctaFill;
  vars["--t-brand-on"] = ctaOn;

  // Символ поверх НЕсдвинутого brand.primary: залитый radio-маркер, галка
  // выбора. Порог нетекстового индикатора — 3:1 (WCAG 2.2 SC 1.4.11).
  const markerOn = pickOnColor(primary, inks, 3);
  vars["--t-brand-primary-on"] = enforced ? markerOn.on : "#FFFFFF";
  if (contrastRatio(primary, "#FFFFFF") < 3) {
    // Заливка маркера — это сам brand.primary, сдвиг заливки сюда не
    // применяется. Значит, при `markerOn.failed` перекраска не помогла, и
    // сообщать об исправлении нельзя: диагностика описывает факт, а не намерение.
    const resolved = enforced && !markerOn.failed;
    diagnostics.push({
      code: resolved
        ? "I_MARKER_CONTRAST_FIXED"
        : enforced
          ? "W_MARKER_CONTRAST_UNRESOLVED"
          : "W_MARKER_CONTRAST",
      severity: resolved ? "info" : "warning",
      message: `Белая галка на brand.primary ${primary} даёт ${formatContrast(contrastRatio(primary, "#FFFFFF"))} при пороге 3:1`,
      detail: resolved
        ? `Маркер перекрашен в ${markerOn.on} (${formatContrast(markerOn.contrast)}).`
        : enforced
          ? `Ни одно чернило не даёт 3:1 на этой заливке: лучшее — ${markerOn.on} с ${formatContrast(markerOn.contrast)}. Маркер оставлен, коррекция НЕ применена.`
          : "a11y_mode=donor_faithful: значение донора сохранено.",
    });
  }

  // ── Тональная шкала ────────────────────────────────────────────────
  /*
   * Нажатие: на светлой поверхности бренд темнеет, на тёмной — светлеет.
   * Безусловное затемнение на тёмной теме двигало кнопку В СТОРОНУ фона,
   * то есть гасило отклик ровно там, где он должен усиливаться.
   */
  const base = hexToOklch(primary);
  vars["--t-brand-pressed"] = withLightness(
    primary,
    base.l + (surfaceIsDark ? 0.08 : -0.08),
  );

  /*
   * Мягкая подложка бренда и выключенное состояние.
   *
   * Оба значения у донора ИЗМЕРИМЫ, поэтому конфиг может задать их явно
   * (`brand.tonal`, `brand.disabled`). Формула — дефолт для доноров, у
   * которых значение не снято: бренд подтягивается к светлоте поверхности,
   * а не к фиксированной «почти белой» светлоте. Стоп берётся от того конца
   * тональной шкалы, где стоит поверхность.
   */
  const tonalFill =
    tenant.brand.tonal ?? withLightness(primary, surfaceTonalStop(1, surfaceIsDark));
  vars["--t-brand-tonal"] = tonalFill;
  vars["--t-brand-border-selected"] = withLightness(primary, 0.6);
  vars["--t-brand-disabled"] =
    tenant.brand.disabled ?? withLightness(primary, surfaceTonalStop(2, surfaceIsDark));

  /*
   * Содержимое тональной подложки.
   *
   * Пока подложка всегда была светлой, текст выбранной строки мог брать
   * `--t-text-primary` вслепую. С измеренным значением донора это ломается
   * в обе стороны: белый текст тёмной темы на светлой подложке `#E9EBF1` и
   * тёмный текст светлой темы на тёмной подложке `#021231` одинаково
   * нечитаемы. Поэтому у подложки есть собственная пара токенов.
   */
  const tonalText = pickOnColor(tonalFill, inks, 4.5);
  vars["--t-brand-tonal-on"] = tonalText.on;
  if (tonalText.failed) {
    diagnostics.push({
      code: "W_TONAL_TEXT_CONTRAST",
      severity: "warning",
      message: `Текст на тональной подложке ${tonalFill} даёт ${formatContrast(tonalText.contrast)} при пороге 4.5:1`,
      detail: `Лучшее из двух чернил (${inks.light} / ${inks.dark}) — ${tonalText.on}. Коррекция НЕ применена: заливка задана явно либо выведена из бренда.`,
    });
  }

  // Галка на тональной подложке. Донорское поведение — бренд-цвет; если он
  // не берёт 3:1 (SC 1.4.11), при `enforced` галка получает цвет текста.
  const tonalMarkerRatio = contrastRatio(primary, tonalFill);
  const tonalMarkerFallbackRatio = contrastRatio(tonalText.on, tonalFill);
  // Перекрашиваем только если замена ДЕЙСТВИТЕЛЬНО берёт порог: иначе это
  // смена цвета без исправления, о которой нельзя отчитаться как об исправлении.
  const tonalMarkerCorrected =
    enforced && tonalMarkerRatio < 3 && tonalMarkerFallbackRatio >= 3;
  vars["--t-brand-tonal-marker"] = tonalMarkerCorrected ? tonalText.on : primary;
  if (tonalMarkerRatio < 3) {
    diagnostics.push({
      code: tonalMarkerCorrected
        ? "I_TONAL_MARKER_FIXED"
        : enforced
          ? "W_TONAL_MARKER_UNRESOLVED"
          : "W_TONAL_MARKER_CONTRAST",
      severity: tonalMarkerCorrected ? "info" : "warning",
      message: `Галка brand.primary ${primary} на тональной подложке ${tonalFill} даёт ${formatContrast(tonalMarkerRatio)} при пороге 3:1`,
      detail: tonalMarkerCorrected
        ? `Галка перекрашена в ${tonalText.on} (${formatContrast(tonalMarkerFallbackRatio)}).`
        : enforced
          ? `Замена на ${tonalText.on} даёт лишь ${formatContrast(tonalMarkerFallbackRatio)} — коррекция НЕ применена, галка осталась брендовой. Обводка выбранной строки остаётся вторым каналом состояния.`
          : "a11y_mode=donor_faithful: значение донора сохранено. Обводка выбранной строки остаётся вторым каналом состояния.",
    });
  }

  // ── Обводка фокуса контролов (поле телефона и форма карты) ─────────
  // Порог нетекстового индикатора 3:1. При `enforced` доводим до 4.5,
  // воспроизводя стоп brand.70: у темы B донорский `brand.primary` #FF6170
  // на фоне страницы даёт 2.75:1 и не проходит SC 1.4.11 (решение Q5 —
  // применить коррекцию, касается и уже собранной формы карты). У темы A
  // #370A29 на #F6F6F6 = 16.96, коррекция не срабатывает.
  const focusRing = enforced
    ? ensureReadableOn(primary, tenant.surface.background, 4.5)
    : {
        color: primary,
        contrast: contrastRatio(primary, tenant.surface.background),
        corrected: false,
        failed: false,
      };
  vars["--t-focus-ring"] = focusRing.color;
  // Направление коррекции задаёт фон, поэтому и слово в сообщении тоже:
  // на тёмной поверхности цвет ОСВЕТЛЯЕТСЯ, и писать «затемнена» — врать.
  const shiftWord = surfaceIsDark ? "осветлена" : "затемнена";
  const shiftWordM = surfaceIsDark ? "осветлён" : "затемнён";
  if (focusRing.corrected) {
    diagnostics.push({
      code: "I_FOCUS_RING_FIXED",
      severity: "info",
      message: `Обводка фокуса контролов ${shiftWord}: ${primary} → ${focusRing.color}`,
      detail: `Донорское значение давало ${formatContrast(contrastRatio(primary, tenant.surface.background))} на фоне ${tenant.surface.background}; после коррекции — ${formatContrast(focusRing.contrast)} (порог 1.4.11 — 3:1).`,
    });
  }

  // ── Бренд как цвет текста на фоне страницы (скидка, старые цены) ───
  const brandOnBackground = enforced
    ? ensureReadableOn(primary, tenant.surface.background, 4.5)
    : { color: primary, contrast: contrastRatio(primary, tenant.surface.background), corrected: false, failed: false };
  vars["--t-brand-text-on-bg"] = brandOnBackground.color;
  if (brandOnBackground.corrected) {
    diagnostics.push({
      code: "I_DISCOUNT_CONTRAST_FIXED",
      severity: "info",
      message: `Цвет скидки и зачёркнутых цен ${shiftWordM}: ${primary} → ${brandOnBackground.color}`,
      detail: `Донорское значение давало ${formatContrast(contrastRatio(primary, tenant.surface.background))} на фоне ${tenant.surface.background}; после коррекции — ${formatContrast(brandOnBackground.contrast)}.`,
    });
  } else if (!enforced && brandOnBackground.contrast < 4.5) {
    diagnostics.push({
      code: "W_DISCOUNT_CONTRAST",
      severity: "warning",
      message: `Скидка и зачёркнутые цены: ${formatContrast(brandOnBackground.contrast)} при пороге 4.5:1`,
      detail: "Зачёркивание и знак «−» остаются вторым каналом смысла.",
    });
  }

  // ── Вторичный текст ────────────────────────────────────────────────
  const secondaryOnBg = enforced
    ? ensureReadableOn(tenant.surface.text_secondary, tenant.surface.background, 4.5)
    : { color: tenant.surface.text_secondary, contrast: contrastRatio(tenant.surface.text_secondary, tenant.surface.background), corrected: false, failed: false };
  const secondaryOnCard = enforced
    ? ensureReadableOn(secondaryOnBg.color, tenant.surface.card, 4.5)
    : { color: tenant.surface.text_secondary, contrast: contrastRatio(tenant.surface.text_secondary, tenant.surface.card), corrected: false, failed: false };

  vars["--t-text-secondary"] = secondaryOnCard.color;
  const rawSecondaryWorst = Math.min(
    contrastRatio(tenant.surface.text_secondary, tenant.surface.background),
    contrastRatio(tenant.surface.text_secondary, tenant.surface.card),
  );
  if (rawSecondaryWorst < 4.5) {
    diagnostics.push({
      code: "W_SECONDARY_CONTRAST",
      severity: enforced ? "info" : "warning",
      message: `surface.text_secondary ${tenant.surface.text_secondary} даёт ${formatContrast(rawSecondaryWorst)} на фоне или карточке`,
      detail: enforced
        ? `a11y_mode=enforced: скорректирован до ${secondaryOnCard.color} (${formatContrast(Math.min(contrastRatio(secondaryOnCard.color, tenant.surface.background), contrastRatio(secondaryOnCard.color, tenant.surface.card)))}).`
        : "a11y_mode=donor_faithful: значение донора сохранено.",
    });
  }

  // ── Акцент: порог нетекстового индикатора (3:1) ────────────────────
  const nonTextRoles: Array<{ key: string; color: string | null; label: string }> = [
    { key: "accent", color: tenant.brand.accent, label: "brand.accent" },
  ];
  for (const role of nonTextRoles) {
    if (!role.color) continue;
    vars[`--t-${role.key}`] = role.color;
    /*
     * Заливка роли — сам донорский цвет: сдвиг заливки, который умеет
     * `pickOnColor`, сюда НЕ применяется (акцент нужен точным). Значит,
     * исправление засчитывается только если порог взят на исходной заливке,
     * то есть при `steps === 0 && !failed`. Иначе символ остаётся прежним, и
     * сообщать об исправлении нельзя.
     */
    const picked = pickOnColor(role.color, inks, 3);
    const resolved = !picked.failed && picked.steps === 0;
    const glyph = enforced && resolved ? picked.on : "#FFFFFF";
    vars[`--t-${role.key}-on`] = glyph;
    const donorRatio = contrastRatio(role.color, "#FFFFFF");
    if (donorRatio < 3) {
      const corrected = enforced && resolved;
      diagnostics.push({
        code: corrected
          ? "I_GLYPH_CONTRAST_FIXED"
          : enforced
            ? "W_GLYPH_CONTRAST_UNRESOLVED"
            : "W_GLYPH_CONTRAST",
        severity: corrected ? "info" : "warning",
        message: `Белый символ на ${role.label} ${role.color} даёт ${formatContrast(donorRatio)} при пороге 3:1`,
        detail: corrected
          ? `Символ перекрашен в ${glyph} (${formatContrast(contrastRatio(role.color, glyph))}).`
          : enforced
            ? `Ни одно чернило (${inks.light} / ${inks.dark}) не даёт 3:1 на этой заливке: лучшее — ${formatContrast(picked.contrast)}. Символ оставлен белым, коррекция НЕ применена.`
            : "a11y_mode=donor_faithful: значение донора сохранено.",
      });
    }
  }

  // ── Вторичная цветовая пара (лавандовый аккордеон донора B) ────────
  if (tenant.brand.secondary) {
    vars["--t-secondary-fill"] = tenant.brand.secondary.fill;
    const pairRatio = contrastRatio(
      tenant.brand.secondary.text,
      tenant.brand.secondary.fill,
    );
    const fixed =
      enforced && pairRatio < 4.5
        ? ensureReadableOn(tenant.brand.secondary.text, tenant.brand.secondary.fill, 4.5)
        : { color: tenant.brand.secondary.text, contrast: pairRatio, corrected: false, failed: false };
    vars["--t-secondary-text"] = fixed.color;
    if (pairRatio < 4.5) {
      diagnostics.push({
        code: enforced ? "I_SECONDARY_PAIR_FIXED" : "W_SECONDARY_PAIR",
        severity: enforced ? "info" : "warning",
        message: `Вторичная пара даёт ${formatContrast(pairRatio)} при пороге 4.5:1`,
      });
    }
  }

  // ── Поверхности ────────────────────────────────────────────────────
  vars["--t-surface-background"] = tenant.surface.background;
  vars["--t-surface-card"] = tenant.surface.card;
  vars["--t-surface-border"] = tenant.surface.border;
  vars["--t-surface-divider"] = tenant.surface.divider;
  vars["--t-text-primary"] = tenant.surface.text_primary;
  vars["--t-surface-danger"] = tenant.surface.danger;
  vars["--t-surface-field-error"] = tenant.surface.field_error;

  // `surface.form` выводится из бренда ТОЛЬКО при явном "auto".
  // Дефолт null: подложки нет. Насильственный вывод из brand.primary —
  // анти-паттерн R5 (у донора B подложка серо-голубая при коралловом бренде).
  if (tenant.surface.form === "auto") {
    // Тот же стоп, что у тональной подложки: на светлой поверхности бренд
    // осветляется, на тёмной затемняется. Фиксированная «почти белая»
    // светлота дала бы светлое пятно посреди тёмного экрана.
    vars["--t-surface-form"] = withLightness(primary, surfaceTonalStop(1, surfaceIsDark));
    diagnostics.push({
      code: "I_FORM_SURFACE_DERIVED",
      severity: "info",
      message: 'surface.form="auto": подложка формы выведена из brand.primary',
      detail: "Проверьте, что это действительно верно для донора — у Uchi.ru подложка по тону с брендом не связана.",
    });
  } else if (tenant.surface.form) {
    vars["--t-surface-form"] = tenant.surface.form;
  } else {
    vars["--t-surface-form"] = tenant.surface.card;
  }

  const fieldErrorOnForm = contrastRatio(
    tenant.surface.field_error,
    vars["--t-surface-form"],
  );
  if (fieldErrorOnForm < 3) {
    diagnostics.push({
      code: "W_FIELD_ERROR_CONTRAST",
      severity: "warning",
      message: `Обводка ошибки даёт ${formatContrast(fieldErrorOnForm)} на подложке формы при пороге 3:1`,
      detail: "Текст сообщения под полем остаётся вторым каналом.",
    });
  }

  return { vars, diagnostics };
}

export function buildTheme(raw: unknown): BuiltTheme {
  const parsed = tenantSchema.safeParse(raw);
  if (!parsed.success) {
    throw new TenantConfigError(
      parsed.error.issues.map((issue) => ({
        code: "E_SCHEMA",
        severity: "error" as const,
        message: issue.message,
        detail: issue.path.length > 0 ? `Поле: ${issue.path.join(".")}` : undefined,
      })),
    );
  }

  const tenant = parsed.data;
  const semantic = validateSemantics(tenant);
  const colors = deriveColors(tenant);
  const bank = buildBankPayload(tenant);
  const diagnostics = [...semantic, ...colors.diagnostics, ...bank.diagnostics];

  const errors = diagnostics.filter((d) => d.severity === "error");
  if (errors.length > 0) {
    throw new TenantConfigError(diagnostics);
  }

  const vars: Record<string, string> = { ...colors.vars };

  // ── Возвышение ─────────────────────────────────────────────────────
  vars["--t-border-width"] = `${tenant.elevation.border_width}px`;
  vars["--t-selected-border-width"] = `${tenant.elevation.selected_border_width}px`;
  vars["--t-shadow"] =
    tenant.elevation.model === "shadow" && tenant.elevation.shadow
      ? `0 ${tenant.elevation.shadow.y}px ${tenant.elevation.shadow.blur}px rgba(0,0,0,${tenant.elevation.shadow.alpha})`
      : "none";

  // ── Форма ──────────────────────────────────────────────────────────
  vars["--t-radius-card"] = radiusToCss(tenant.radius.card);
  vars["--t-radius-control"] = radiusToCss(tenant.radius.control);
  vars["--t-radius-field"] = radiusToCss(tenant.radius.field);
  vars["--t-radius-chip"] = radiusToCss(tenant.radius.chip);

  // ── Плотность ──────────────────────────────────────────────────────
  vars["--t-page-padding"] = `${tenant.density.page_padding}px`;
  vars["--t-block-gap"] = `${tenant.density.block_gap}px`;
  vars["--t-row-height"] = `${tenant.density.row_height}px`;
  vars["--t-control-height"] = `${tenant.density.control_height}px`;
  vars["--t-method-button-height"] = `${
    tenant.density.method_button_height ?? tenant.density.control_height
  }px`;
  vars["--t-section-gap"] = `${tenant.density.section_gap}px`;

  // ── Ширины компонентов: доля рамки телефона, не пиксели ────────────
  vars["--t-choice-card-w"] = `${tenant.component_width.choice_card_pct}cqw`;
  vars["--t-payment-card-w"] = `${tenant.component_width.payment_card_pct}cqw`;

  // ── Типографика ────────────────────────────────────────────────────
  vars["--t-font-family"] = FONT_STACKS[tenant.typography.family];
  vars["--t-font-body"] = `${tenant.typography.body}px`;
  vars["--t-font-h1"] = `${tenant.typography.h1}px`;
  vars["--t-font-section-title"] = `${tenant.typography.section_title}px`;
  vars["--t-font-caption"] = `${tenant.typography.caption}px`;
  vars["--t-label-weight"] = String(tenant.typography.label_weight);
  vars["--t-title-weight"] = String(tenant.typography.title_weight);
  vars["--t-cta-font-size"] = `${tenant.cta.font_size}px`;
  vars["--t-cta-font-weight"] = String(tenant.cta.font_weight);

  return {
    tenant,
    vars,
    diagnostics,
    ozonIndex: tenant.payment_list.methods.findIndex((m) => m.id === OZON_METHOD_ID),
    bankPayload: bank.payload,
  };
}

/** Печать диагностики в консоль: каждая коррекция обязана быть записана. */
export function logDiagnostics(tenantId: string, diagnostics: Diagnostic[]): void {
  for (const item of diagnostics) {
    const line = `[tenant:${tenantId}] ${item.code} — ${item.message}${
      item.detail ? `\n    ${item.detail}` : ""
    }`;
    if (item.severity === "error") console.error(line);
    else if (item.severity === "warning") console.warn(line);
    else console.info(line);
  }
}
