import React from "react";
import { createRoot } from "react-dom/client";
import { domAnimation, LazyMotion, MotionConfig } from "framer-motion";

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
      {/*
        Возможности движения грузятся отдельным куском, а не целой
        библиотекой: демо использует анимации, exit-переходы и tap-жест —
        это `domAnimation`; drag и layout-анимаций в нём нет. `strict`
        запрещает `motion.*` и тем самым не даёт вернуть полный пакет
        случайной правкой: узлы объявляются через `m.*`.
      */}
      <LazyMotion features={domAnimation} strict>
        <App />
      </LazyMotion>
    </MotionConfig>
  </React.StrictMode>,
);
