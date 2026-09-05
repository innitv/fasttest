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
    rollupOptions: {
      output: {
        /*
         * Вендоры — отдельными чанками, чтобы правка демо не сбрасывала их
         * кеш у подрядчика: React и Motion между релизами не меняются.
         *
         * Экраны здесь НЕ перечисляются намеренно: они приезжают по
         * требованию через `lazy()` в `ScreenHost`, и любое правило,
         * собирающее `src/views/` в общий чанк, отменяет это разделение —
         * первая же попытка так и сделала.
         */
        manualChunks(id) {
          if (id.includes("node_modules/framer-motion")) return "motion";
          if (id.includes("node_modules/react")) return "react";
        },
      },
    },
  },
});
