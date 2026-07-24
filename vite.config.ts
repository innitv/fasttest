import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const projectDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: projectDir,
  // Абсолютный base: прямые пути `/uchi`, `/flowwow` и любой неизвестный путь
  // грузят одни и те же ассеты `/assets/*`, а не относительно сегмента пути.
  base: "/",
  // SPA history-fallback: `/uchi` и `/flowwow` на dev- и preview-сервере
  // отдают index.html, роутинг разбирается на клиенте (см. App.tsx).
  appType: "spa",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // Алиас исходников. Совпадает с `paths` в tsconfig.json — менять
      // только парой, иначе typecheck и сборка разъедутся.
      "@demo": path.resolve(projectDir, "./src"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
