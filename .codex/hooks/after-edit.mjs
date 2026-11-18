import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const isComponent = (file) => /^src\/(views|components)\/.+\.tsx?$/.test(file);

const checks = [
  ["docs", /^((AGENTS|README|FIXES)\.md|tests\/docs\.check\.mjs)$/i],
  ["registry", /^(src\/(App\.tsx|theme\/tenant-loader\.ts|views\/LauncherView\.tsx)|tenants\/.+\.json)$/],
  ["theme-boundary", isComponent],
  ["motion", (file) => file === "src/styles.css" || isComponent(file)],
];

// Codex sends the complete apply_patch command, including paths for deletes
// and both the old and new path for moves.
const payload = await readEvent();
const patch = payload?.tool_input?.command;
if (payload?.tool_name === "apply_patch" && typeof patch === "string") {
  const cwd = typeof payload.cwd === "string" ? payload.cwd : process.cwd();
  const paths = [...patch.matchAll(/^\*\*\* (?:(?:Add|Update|Delete) File|Move to): ([^\r\n]+)/gm)]
    .map(([, file]) => path.relative(root, path.resolve(cwd, file)))
    .filter((file) => file !== ".." && !file.startsWith(`..${path.sep}`) && !path.isAbsolute(file))
    .map((file) => file.split(path.sep).join("/"));

  const failures = [];
  for (const [name, match] of checks) {
    const affected = paths.some((file) => typeof match === "function" ? match(file) : match.test(file));
    if (!affected) continue;
    const script = `tests/${name}.check.mjs`;
    const run = spawnSync(process.execPath, [script], { cwd: root, encoding: "utf8" });
    if (run.status !== 0) {
      const detail = run.error?.message ?? `${run.stdout ?? ""}${run.stderr ?? ""}`.trim();
      failures.push(`${script}\n${detail || `Завершение: ${run.signal ?? run.status}`}`);
    }
  }

  if (failures.length) {
    console.error(`Статические проверки после правки\n\n${failures.join("\n\n")}`);
    process.exitCode = 2;
  }
}

async function readEvent() {
  if (process.stdin.isTTY) return null;
  try {
    let text = "";
    process.stdin.setEncoding("utf8");
    for await (const chunk of process.stdin) text += chunk;
    return JSON.parse(text);
  } catch {
    return null;
  }
}
