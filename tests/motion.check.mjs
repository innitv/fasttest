import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Статическая проверка правила «движение — общий слой».
 *
 * Правило записано в `CLAUDE.md` и `README.md` (шаг 10): длительности, кривые
 * и параметры пружин живут в ДВУХ местах — шкала `--k-motion-*` / `--k-ease-ios`
 * в `src/styles.css` и спеки в `src/views/stage-motion.ts`. Компонент их
 * читает, но не задаёт.
 *
 * Запуск: yarn check:motion  (или node tests/motion.check.mjs [--root=<путь>])
 *
 * ── Почему проверка, а не дисциплина ──────────────────────────────────
 *
 * Правило нарушалось четыре раза, и ни одно нарушение не поймала ни одна из
 * пяти существующих проверок:
 *   - `duration: 0.18` и `spring 380/34` в `OrderStepsScreen` и
 *     `PlanSheetScreen` — один и тот же лист ехал в разных экранах
 *     по-разному;
 *   - три числа по месту в `PushBanner`;
 *   - `height ${expanded ? 200 : 160}ms` в `PhoneGateBlock`;
 *   - `whileTap` без спеки — движение шло дефолтной пружиной Motion.
 * Три из четырёх нашлись только потому, что владелец посмотрел на экран.
 *
 * ── Что именно ищется ─────────────────────────────────────────────────
 *
 * 1. Литеральная длительность в CSS-переходе: `transition: "... 200ms ..."`.
 *    Разрешено только через переменную шкалы (`var(--k-motion-*)`).
 * 2. Кривая `cubic-bezier(...)`, написанная по месту: она обязана приходить
 *    из `--k-ease-ios`.
 * 3. Параметры пружины (`stiffness`, `damping`, `mass`, `bounce`,
 *    `visualDuration`) и `type: "spring"` вне общего слоя.
 * 4. Инлайновая спека Motion `transition={{ ... }}` — даже верная по числам,
 *    она объявляет движение в компоненте.
 *
 * НЕ ищется: ключевые слова кривых (`ease-out`, `ease-in-out`) — они
 * задают форму отклика контрола рядом с переменной длительности и в шкалу
 * не выносились; и `duration: 0` — это «мгновенно», отсутствие движения.
 *
 * ── Негативный контроль ───────────────────────────────────────────────
 *
 * Прогон на ревизии до правок (`git archive 9728f48 src | tar -x -C <tmp>`,
 * затем `node tests/motion.check.mjs --root=<tmp>/src`) даёт 15 нарушений в
 * четырёх файлах и код возврата 1: пружины шторок в `OrderStepsScreen` и
 * `PlanSheetScreen`, пружина и её числа в `PushBanner`, шаблонная
 * длительность в `PhoneGateBlock`. Фактический вывод — в коммите, которым
 * проверка заведена.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, "..");

const rootArg = process.argv.find((a) => a.startsWith("--root="));
const ROOT = rootArg ? path.resolve(rootArg.slice("--root=".length)) : path.resolve(projectRoot, "src");

/** Файлы, которые ЗАДАЮТ движение. Всё остальное его только читает. */
const MOTION_LAYER = ["views/stage-motion.ts", "styles.css"];

const RULES = [
  {
    id: "литеральная длительность в переходе",
    // `transition: "transform 200ms ..."` / `transition: `height ${x}ms``
    re: /transition:\s*[`"'][^`"']*?(?<!--k-motion-[a-z]{1,10}\))\b\d+m?s\b/g,
    hint: "длительность берётся из var(--k-motion-fast|medium|overlay)",
  },
  {
    id: "литеральная длительность в шаблонной строке",
    re: /\$\{[^}]*\}m?s\b/g,
    hint: "длительность берётся из var(--k-motion-*), а не считается по месту",
  },
  {
    id: "кривая по месту",
    re: /cubic-bezier\(/g,
    hint: "кривая приходит из var(--k-ease-ios) или IOS_EASE",
  },
  {
    id: "параметры пружины по месту",
    re: /\b(stiffness|visualDuration)\s*:|\bdamping\s*:|\bmass\s*:|type:\s*["']spring["']/g,
    hint: "пружина объявляется в stage-motion.ts (PUSH_BANNER_*_SPEC)",
  },
  {
    id: "инлайновая спека Motion",
    re: /transition=\{\{/g,
    hint: "transition={SPEC} из stage-motion.ts вместо объекта по месту",
  },
];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(tsx?|css)$/.test(name)) out.push(full);
  }
  return out;
}

/** Строки комментариев не проверяются: в них правило объясняют, а не нарушают. */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + " ".repeat(Math.max(0, m.length - p1.length)));
}

const violations = [];
for (const file of walk(ROOT)) {
  const rel = path.relative(ROOT, file).split(path.sep).join("/");
  if (MOTION_LAYER.includes(rel)) continue;
  const source = stripComments(readFileSync(file, "utf8"));
  for (const rule of RULES) {
    rule.re.lastIndex = 0;
    let m;
    while ((m = rule.re.exec(source)) !== null) {
      const line = source.slice(0, m.index).split("\n").length;
      violations.push({ rel, line, rule: rule.id, hint: rule.hint, text: m[0].trim().slice(0, 60) });
    }
  }
}

console.log("motion: движение — общий слой");
console.log(`  - проверено файлов: ${walk(ROOT).length - MOTION_LAYER.length}, слой движения: ${MOTION_LAYER.join(", ")}`);

if (violations.length === 0) {
  console.log("  - длительностей, кривых и пружин по месту нет");
  process.exit(0);
}

console.log(`\nНАРУШЕНИЙ: ${violations.length}`);
for (const v of violations) {
  console.log(`  ${v.rel}:${v.line} — ${v.rule}`);
  console.log(`      «${v.text}» → ${v.hint}`);
}
process.exit(1);
