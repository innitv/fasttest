import { useEffect } from "react";

/**
 * Цвет системных зон устройства (строка статуса iOS, панель Safari).
 *
 * Жалоба с живого iPhone: сверху и снизу интерфейс обрамляли серые полосы.
 * Причина — фон `body`. На телефоне колонка занимает всю ширину, серый фон
 * «стола» за колонкой не виден нигде, кроме системных зон, которые iOS красит
 * как раз фоном страницы (и значением `<meta name="theme-color">`).
 *
 * Вторая итерация той же жалобы: одного цвета на обе зоны мало. Верх и низ
 * экрана почти нигде не совпадают — на `O-2` синий hero сверху и белый лист
 * снизу, на `O-3` градиент, у которого верхняя и нижняя точки разные. Поэтому
 * модуль снимает фактический цвет ОБЕИХ кромок текущего экрана прямо из
 * отрисованного DOM и раздаёт их двум разным переменным:
 *   • `--page-canvas`        — верхняя зона (её же получает `theme-color`,
 *                              которым iOS красит строку статуса);
 *   • `--page-canvas-bottom` — нижняя зона (панель Safari внизу).
 * Как из двух переменных получается двухзонная канва — см. правило `html`
 * в `styles.css`.
 *
 * Цвет именно измеряется, а не перечисляется таблицей «стадия → значение»:
 * список стадий и палитры живут в токенах, дублировать их здесь значило бы
 * завести второй источник правды, который разъедется с первым. Заодно это
 * не нарушает границу темы: модуль не знает ни про `--t-*`, ни про `--bank-*`.
 * Отсюда же и поведение splash `O-1`: экран залит одним цветом целиком, обе
 * кромки дают синий — низ остаётся синим сам, без исключения в коде.
 */

/** Кромка экрана, цвет которой снимаем. */
type Edge = "top" | "bottom";

/** Альфа цвета в любой из сериализаций computed style (`rgba()`, `rgb(… / …)`). */
function alphaOf(value: string): number {
  const slash = value.match(/\/\s*([\d.]+)(%?)\s*\)/);
  if (slash) return slash[2] === "%" ? Number(slash[1]) / 100 : Number(slash[1]);

  const args = value.match(/rgba?\(([^)]*)\)/);
  if (!args) return 1;
  const parts = args[1].split(/[,\s]+/).filter(Boolean);
  if (parts.length < 4) return 1;
  const last = parts[3];
  return last.endsWith("%") ? Number(last.slice(0, -1)) / 100 : Number(last);
}

const isOpaque = (value: string): boolean => alphaOf(value) >= 0.999;

/**
 * Непрозрачный фон элемента со стороны кромки `edge`.
 *
 * Плоская заливка одинакова для обеих кромок. Вертикальный градиент —  нет:
 * сверху его дает первый стоп, снизу последний (экран успеха `O-3` залит
 * непрерывным градиентом от синего к светло-голубому). Полупрозрачные стопы
 * пропускаются: сквозь них виден фон предка, и цвет обязан прийти оттуда,
 * а не от декоративного свечения поверх.
 */
function opaqueBackgroundOf(element: Element, edge: Edge): string | null {
  const style = getComputedStyle(element);

  const color = style.backgroundColor;
  if (color && color !== "transparent" && isOpaque(color)) return color;

  const image = style.backgroundImage;
  if (image && image !== "none") {
    const stops = (image.match(/rgba?\([^)]*\)/g) ?? []).filter(isOpaque);
    if (stops.length > 0) return edge === "top" ? stops[0] : stops[stops.length - 1];
  }

  return null;
}

/**
 * Цвет в точке кромки колонки: берём самый верхний элемент под этой точкой и
 * поднимаемся по предкам до первой непрозрачной заливки. Поиск ограничен
 * колонкой — за её пределами лежит `body`, чей фон мы как раз и вычисляем
 * (иначе получили бы замкнутый цикл).
 *
 * Отступ в 2px внутрь от кромки, а не ровно по ней: на границе `elementFromPoint`
 * может вернуть соседний бокс, а нам нужен тот, чей цвет продолжится в
 * системную зону.
 */
function edgeColor(frame: HTMLElement, edge: Edge): string | null {
  const rect = frame.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;

  const x = rect.left + rect.width / 2;
  const y = edge === "top" ? rect.top + 2 : rect.bottom - 2;

  let node = document.elementFromPoint(x, y);
  while (node instanceof HTMLElement && (frame.contains(node) || node === frame)) {
    const color = opaqueBackgroundOf(node, edge);
    if (color) return color;
    node = node.parentElement;
  }

  return opaqueBackgroundOf(frame, edge);
}

function apply(top: string, bottom: string): void {
  const root = document.documentElement;
  root.style.setProperty("--page-canvas", top);
  root.style.setProperty("--page-canvas-bottom", bottom);
  // `theme-color` синхронизирован с ВЕРХОМ: на iOS им красится строка статуса.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", top);
}

/**
 * Держит фон системных зон в согласии с текущим экраном.
 *
 * `stage` — ключ пересчёта: смена экрана меняет цвет кромок. Замер идёт дважды
 * — сразу после кадра и после того, как межэкранный переход отыграл: во время
 * выезда шита кромки ещё принадлежат уходящему экрану.
 */
export function usePageCanvas(frameRef: { current: HTMLElement | null }, stage: string): void {
  useEffect(() => {
    let cancelled = false;

    const measure = () => {
      if (cancelled) return;
      const frame = frameRef.current;
      if (!frame) return;
      const top = edgeColor(frame, "top");
      if (!top) return;
      // Низ не измерился (экран без собственной заливки снизу) — берём верх:
      // это ровно прежнее поведение одноцветной канвы, а не случайный цвет.
      apply(top, edgeColor(frame, "bottom") ?? top);
    };

    const raf = window.requestAnimationFrame(measure);
    // 380 мс — чуть дольше самого длинного межэкранного перехода (340 мс).
    const timer = window.setTimeout(measure, 380);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
  }, [frameRef, stage]);
}
