#!/usr/bin/env node
/**
 * Хук PostToolUse: мгновенные проверки после правки файлов, которые они сторожат.
 *
 * Обе проверки статические и занимают около 0.1 с, но забываются: за прошлую
 * сессию `check:docs` и `check:registry` запускались по памяти, а цена
 * пропуска — битая ссылка на диагноз или тема без маршрута, уехавшая в прод
 * при полностью зелёной приёмке (`FIXES.md`, баг 14).
 *
 * Что запускается и когда:
 *   CLAUDE.md, README.md, FIXES.md            → tests/docs.check.mjs
 *   src/App.tsx, tenants/*.json,
 *   src/theme/tenant-loader.ts                → tests/registry.check.mjs
 *
 * Правка любого другого файла — тишина и код 0: хук обязан быть незаметным,
 * пока сторожить нечего.
 *
 * Падение проверки возвращается модели кодом 2 вместе с её собственным
 * выводом: он называет конкретный номер диагноза или маршрут, и разбирать
 * нужно именно его, а не факт падения.
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Пара «что тронули → чем это проверяется». Порядок значения не имеет. */
const RULES = [
  {
    check: "tests/docs.check.mjs",
    label: "нумерация диагнозов и ссылки на них",
    matches: (rel) => ["claude.md", "readme.md", "fixes.md"].includes(rel.toLowerCase()),
  },
  {
    check: "tests/registry.check.mjs",
    label: "тема ↔ маршрут ↔ архетип",
    matches: (rel) =>
      rel === "src/App.tsx" ||
      rel === "src/theme/tenant-loader.ts" ||
      (rel.startsWith("tenants/") && rel.endsWith(".json")),
  },
];

const payload = await readStdin();
if (!payload) process.exit(0);

let filePath = "";
try {
  const input = JSON.parse(payload);
  filePath = input?.tool_response?.filePath ?? input?.tool_input?.file_path ?? "";
} catch {
  // Неразобранный ввод — не повод мешать работе: хук молчит и уходит.
  process.exit(0);
}
if (!filePath) process.exit(0);

// Путь приходит абсолютным; сравнивать удобнее относительным от корня проекта.
const rel = path.relative(projectRoot, path.resolve(filePath)).split(path.sep).join("/");
if (rel.startsWith("..")) process.exit(0);

const failures = [];
for (const rule of RULES) {
  if (!rule.matches(rel)) continue;
  const run = spawnSync(process.execPath, [rule.check], {
    cwd: projectRoot,
    encoding: "utf8",
  });
  if (run.status !== 0) {
    failures.push(`${rule.check} (${rule.label}):\n${run.stdout ?? ""}${run.stderr ?? ""}`.trim());
  }
}

if (failures.length > 0) {
  console.error(`Проверка после правки ${rel} упала:\n\n${failures.join("\n\n")}`);
  process.exit(2);
}
process.exit(0);

function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    if (process.stdin.isTTY) return resolve("");
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", () => resolve(""));
  });
}
