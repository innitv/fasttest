import { useRef } from "react";

import { usePageCanvas } from "@demo/lib/page-canvas";

/**
 * Нейтральная заглушка корня и неизвестных путей.
 *
 * Подрядчик получает ПРЯМУЮ ссылку на свой флоу. Кто открыл корень или
 * угадываемый путь, не должен увидеть ни списка тем, ни намёка, что рядом
 * есть другое демо. Поэтому здесь — только короткий нейтральный текст, без
 * ссылок, без перечисления подрядчиков и без токенов какой-либо темы.
 */
export function StubView() {
  // Системные зоны iOS красятся фоном страницы. Заглушка тёмная, поэтому без
  // синхронизации вокруг неё остались бы светлые полосы — та же жалоба, что
  // и на экранах демо.
  const ref = useRef<HTMLDivElement>(null);
  usePageCanvas(ref, "stub");

  return (
    <div
      ref={ref}
      data-testid="stub"
      className="flex h-full w-full items-center justify-center"
      style={{
        background: "#101418",
        color: "#AEB8C7",
        fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif',
        padding: "24px",
      }}
    >
      <p
        style={{
          margin: 0,
          maxWidth: "320px",
          textAlign: "center",
          fontSize: "15px",
          lineHeight: 1.5,
        }}
      >
        Демо доступно по прямой ссылке.
      </p>
    </div>
  );
}
