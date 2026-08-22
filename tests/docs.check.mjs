import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Статическая проверка документации проекта. Сервер не нужен.
 *
 * Заведена 2026-08-21 по аудиту. Повод фактический: в `FIXES.md` оказались ДВА
 * диагноза под номером 13, причём `CLAUDE.md` ссылался на первый из них, а
 * `README.md` — на второй. Ссылка «баг 13» перестала что-либо означать, и
 * заметить это можно было только чтением всего файла.
 *
 * Нумерация диагнозов ведётся вручную и будет вестись дальше: она удобна для
 * ссылок из кода и правил. Значит её должна сторожить машина — всё, что не
 * проверяется, дрейфует.
 *
 * Проверяется два инварианта:
 *   1. номера диагнозов в `FIXES.md` уникальны и идут подряд, без пропусков;
 *   2. каждая ссылка «баг N» из `CLAUDE.md` и `README.md` ведёт на
 *      существующий номер.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");

const findings = [];

// ── 1. Номера диагнозов ──────────────────────────────────────────────
const fixes = readFileSync(path.join(root, "FIXES.md"), "utf8");
const numbers = [...fixes.matchAll(/^## Баг (\d+)/gm)].map((m) => Number(m[1]));

const seen = new Set();
const duplicates = new Set();
for (const n of numbers) {
  if (seen.has(n)) duplicates.add(n);
  seen.add(n);
}

if (duplicates.size > 0) {
  findings.push(
    `FIXES.md: номер диагноза использован дважды — ${[...duplicates].join(", ")}. ` +
      "Ссылка «баг N» из правил перестаёт быть однозначной; дай новому диагнозу " +
      "следующий свободный номер.",
  );
}

const expected = Array.from({ length: numbers.length }, (_, i) => i + 1);
const missing = expected.filter((n) => !seen.has(n));
if (missing.length > 0) {
  findings.push(
    `FIXES.md: в нумерации диагнозов пропуск — нет ${missing.join(", ")}. ` +
      "Либо диагноз удалён (тогда перенумеруй и почини ссылки), либо номер выдан с запасом.",
  );
}

// ── 2. Ссылки на диагнозы ────────────────────────────────────────────
for (const file of ["CLAUDE.md", "README.md"]) {
  const text = readFileSync(path.join(root, file), "utf8");
  const refs = [...text.matchAll(/баг[аи]? (\d+)/gi)].map((m) => Number(m[1]));
  const broken = [...new Set(refs.filter((n) => !seen.has(n)))];
  if (broken.length > 0) {
    findings.push(
      `${file}: ссылка на несуществующий диагноз — баг ${broken.join(", ")}. ` +
        `В FIXES.md есть номера 1..${Math.max(...numbers)}.`,
    );
  }
}

// ── Итог ─────────────────────────────────────────────────────────────
if (findings.length > 0) {
  console.log("docs: ПРОВАЛ");
  for (const line of findings) console.log(`  - ${line}`);
  process.exit(1);
}

console.log("docs: порядок");
console.log(`  - диагнозов в FIXES.md: ${numbers.length}, номера уникальны и идут подряд`);
console.log("  - ссылки «баг N» из CLAUDE.md и README.md ведут на существующие номера");
