import React from "react";
import { createRoot } from "react-dom/client";
import { MotionConfig } from "framer-motion";

import { App } from "./App";
import "./styles.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Не найден корневой элемент #root.");
}

createRoot(rootElement).render(
  <React.StrictMode>
    {/*
      reducedMotion="user" — при `prefers-reduced-motion: reduce` framer-motion
      отключает transform-анимации (выезды, слайды, tap-scale), но сохраняет
      opacity: движение убирается, экраны и контент остаются, длительность
      splash задаётся отдельным таймером и не зависит от motion.
    */}
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>
  </React.StrictMode>,
);
