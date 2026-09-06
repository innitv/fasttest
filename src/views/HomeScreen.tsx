import { COPY } from "@demo/content/copy";

/**
 * `S-0` — домашний экран устройства: кадр ДО подрядчика.
 *
 * Зачем он в демо. Сценарий A3 Pay начинается не заходом на сайт, а
 * напоминанием о счёте: приложение присылает уведомление, и форма
 * подрядчика открывается по нему. Без этого кадра первый шаг пришлось бы
 * рассказывать словами, а показать демо обязано.
 *
 * Чей это экран. Ничей из двух: айдентика здесь системная и объявлена
 * ниже как `--os-*`. Тема подрядчика приходит ровно в одну точку — плитку
 * его приложения: она и есть его знак на чужом экране. Всё остальное —
 * обои, док, индикатор страниц — принадлежит устройству и от темы не
 * зависит.
 *
 * Чего здесь нет. Строки статуса и home indicator: их рисует настоящий
 * системный хром устройства, на котором открывают демо (то же решение, что
 * и на экранах подрядчика). Нарисованные, они встали бы вторым комплектом.
 *
 * Приложения не открываются. Демо ведёт один сценарий, и плитка, которая
 * «нажимается, но ничего не делает», обещает больше, чем демо умеет:
 * поэтому сетка — картинка (`role="img"`), а единственное действие кадра —
 * уведомление поверх него.
 */

/*
 * Материал экрана — системный, iOS: тёмные обои с переходом, squircle-плитки,
 * стеклянный док и подписи ТОЛЬКО в сетке — в доке iOS их не рисует.
 * Размеры из системной раскладки iPhone: плитка 60, радиус 22.37 % стороны
 * (squircle в приближении скруглённым квадратом), над доком — индикатор
 * страниц.
 */
const IDENTITY = {
  "--os-wallpaper-top": "#3B2E63",
  "--os-wallpaper-mid": "#23305C",
  "--os-wallpaper-bottom": "#101425",
  "--os-tile-border": "rgba(255,255,255,0.10)",
  "--os-glyph": "#FFFFFF",
  "--os-label": "#FFFFFF",
  "--os-dock": "rgba(255,255,255,0.18)",
  "--os-font": '-apple-system, "SF Pro Text", "Segoe UI", system-ui, sans-serif',
} as const;

const TILE = 60;

/*
 * Форма плитки — СУПЕРЭЛЛИПС, а не скруглённый квадрат.
 *
 * HIG (App icons → Icon shape): систему маскирует иконку формой, кривизна
 * которой совпадает со скруглениями интерфейса и корпуса устройства. Это
 * squircle, а не дуга окружности, и разница читается именно на плитках
 * 60 px: у border-radius углы поджаты, и ряд иконок сразу выглядит
 * нарисованным, а не системным.
 *
 * Контур посчитан для квадрата 60x60 (96 точек суперэллипса степени 5) и
 * вставлен константой: считать его в рантайме незачем, размер плитки один.
 */
const SQUIRCLE =
  "M60.0 30.0 L60.0 40.1 L59.9 43.3 L59.8 45.6 L59.6 47.5 L59.4 49.1 L59.1 50.4 L58.7 51.6 L58.3 52.7 L57.9 53.7 L57.3 54.6 L56.8 55.4 L56.1 56.1 L55.4 56.8 L54.6 57.3 L53.7 57.9 L52.7 58.3 L51.6 58.7 L50.4 59.1 L49.1 59.4 L47.5 59.6 L45.6 59.8 L43.3 59.9 L40.1 60.0 L30.0 60.0 L19.9 60.0 L16.7 59.9 L14.4 59.8 L12.5 59.6 L10.9 59.4 L9.6 59.1 L8.4 58.7 L7.3 58.3 L6.3 57.9 L5.4 57.3 L4.6 56.8 L3.9 56.1 L3.2 55.4 L2.7 54.6 L2.1 53.7 L1.7 52.7 L1.3 51.6 L0.9 50.4 L0.6 49.1 L0.4 47.5 L0.2 45.6 L0.1 43.3 L0.0 40.1 L0.0 30.0 L0.0 19.9 L0.1 16.7 L0.2 14.4 L0.4 12.5 L0.6 10.9 L0.9 9.6 L1.3 8.4 L1.7 7.3 L2.1 6.3 L2.7 5.4 L3.2 4.6 L3.9 3.9 L4.6 3.2 L5.4 2.7 L6.3 2.1 L7.3 1.7 L8.4 1.3 L9.6 0.9 L10.9 0.6 L12.5 0.4 L14.4 0.2 L16.7 0.1 L19.9 0.0 L30.0 0.0 L40.1 0.0 L43.3 0.1 L45.6 0.2 L47.5 0.4 L49.1 0.6 L50.4 0.9 L51.6 1.3 L52.7 1.7 L53.7 2.1 L54.6 2.7 L55.4 3.2 L56.1 3.9 L56.8 4.6 L57.3 5.4 L57.9 6.3 L58.3 7.3 L58.7 8.4 L59.1 9.6 L59.4 10.9 L59.6 12.5 L59.8 14.4 L59.9 16.7 L60.0 19.9 Z";

/**
 * Общая геометрия плитки: маска-суперэллипс и тень под ней. Тень — на
 * ВНЕШНЕМ узле фильтром: clip-path обрезает и box-shadow тоже, поэтому
 * обычная тень у обрезанного узла просто не видна.
 */
const tileShape = {
  width: `${TILE}px`,
  height: `${TILE}px`,
  clipPath: `path("${SQUIRCLE}")`,
} as const;
const tileShadow = { filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.35))" } as const;

/*
 * Блик и притенение — то, что система рисует иконке сама (HIG: specular
 * highlights, Liquid Glass). Плоская заливка без них читается как наклейка,
 * а не как иконка приложения.
 */
const TILE_GLOSS =
  "linear-gradient(180deg, rgba(255,255,255,0.32) 0%, rgba(255,255,255,0.08) 38%, rgba(0,0,0,0) 62%, rgba(0,0,0,0.10) 100%)";

/**
 * Плитка сетки. Знаков реальных приложений на экране два — подрядчик и
 * банк, участники сценария; остальные обобщены до системных категорий:
 * рисовать чужие товарные знаки ради фона незачем.
 */
interface Tile {
  label: string;
  /** Путь глифа в квадрате 24×24. */
  glyph: string;
  /** Заливка плитки: у iOS это вертикальный переход, а не плоский цвет. */
  fill: string;
  /** Обводка глифа вместо заливки — как у большинства системных иконок. */
  stroke?: boolean;
}

const grad = (from: string, to: string) => `linear-gradient(180deg, ${from}, ${to})`;

const TILES: Tile[] = [
  { label: "Телефон", glyph: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1.1 1A16 16 0 0 1 4 5.1 1 1 0 0 1 5 4Z", fill: grad("#5BE36A", "#1FB53A") },
  { label: "Почта", glyph: "M3 6h18v12H3zM3 7l9 6 9-6", fill: grad("#57B9FF", "#1E7BF0"), stroke: true },
  { label: "Камера", glyph: "M4 8h3l1.5-2h7L17 8h3v11H4zM12 16a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z", fill: grad("#9AA4B2", "#5B6675"), stroke: true },
  { label: "Карты", glyph: "M9 4 3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14", fill: grad("#63D2A1", "#2A9BC9"), stroke: true },
  { label: "Календарь", glyph: "M4 6h16v14H4zM4 10h16M8 4v4M16 4v4", fill: grad("#FF6B63", "#E5342A"), stroke: true },
  { label: "Часы", glyph: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 7v5l3.5 2", fill: grad("#22242B", "#000000"), stroke: true },
  { label: "Погода", glyph: "M7.5 18h9a3.5 3.5 0 0 0 .3-7A5 5 0 0 0 7.2 12 3 3 0 0 0 7.5 18Z", fill: grad("#4EA8FF", "#1360E0") },
  { label: "Заметки", glyph: "M6 3h9l3 3v15H6zM9 9h6M9 13h6M9 17h4", fill: grad("#FFE083", "#F1B92E"), stroke: true },
  { label: "Музыка", glyph: "M9 18V7l9-2v11M9 18a2.4 2.4 0 1 1-4.8 0 2.4 2.4 0 0 1 4.8 0ZM18 16a2.4 2.4 0 1 1-4.8 0 2.4 2.4 0 0 1 4.8 0Z", fill: grad("#FC5C6B", "#E1275E") },
  { label: "Фото", glyph: "M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4", fill: grad("#FFB35C", "#FF6B6B"), stroke: true },
  { label: "Файлы", glyph: "M3 7h7l2 2h9v10H3zM3 7V5h5l2 2", fill: grad("#7FC4FF", "#3D8BE8"), stroke: true },
  { label: "Настройки", glyph: "M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4ZM12 3v2.4M12 18.6V21M3 12h2.4M18.6 12H21M5.6 5.6l1.7 1.7M16.7 16.7l1.7 1.7M18.4 5.6l-1.7 1.7M7.3 16.7l-1.7 1.7", fill: grad("#AEB5BF", "#6E7681"), stroke: true },
  { label: "Подкасты", glyph: "M12 3a4 4 0 0 0-4 4v4a4 4 0 0 0 8 0V7a4 4 0 0 0-4-4ZM5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21", fill: grad("#B06BF0", "#7A3ED8"), stroke: true },
  { label: "Кошелёк", glyph: "M4 7h16v12H4zM4 7l12-3v3M16 13h2", fill: grad("#3A4049", "#15181C"), stroke: true },
  { label: "Здоровье", glyph: "M12 20S4 14.6 4 9.8A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 20 9.8C20 14.6 12 20 12 20Z", fill: grad("#FF6A7D", "#E5344F") },
  { label: "Напоминания", glyph: "M5 6h14M5 12h14M5 18h14", fill: grad("#FFFFFF", "#E9EAEE"), stroke: true },
  { label: "Книги", glyph: "M4 5h6a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H4zM20 5h-6a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2h6z", fill: grad("#FFB347", "#F0812F"), stroke: true },
  { label: "Магазин", glyph: "M12 4 4 19h16zM8.5 15h7", fill: grad("#4FA0FF", "#1B63E8"), stroke: true },
  { label: "Почтамт", glyph: "M4 6h16v12H4zM8 10h8M8 14h5", fill: grad("#7C8894", "#4A535E"), stroke: true },
  { label: "Диктофон", glyph: "M12 4a2.5 2.5 0 0 0-2.5 2.5v5a2.5 2.5 0 0 0 5 0v-5A2.5 2.5 0 0 0 12 4ZM6.5 11.5a5.5 5.5 0 0 0 11 0M12 17v3", fill: grad("#3A4049", "#15181C"), stroke: true },
  { label: "Компас", glyph: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM14.8 9.2 10 10.6l-1.4 4.8 4.8-1.4Z", fill: grad("#E8EBEF", "#B9BFC7"), stroke: true },
  { label: "Переводчик", glyph: "M4 6h8M8 6v2c0 3-2 5-4 6M6.5 11c1.4 2 3 3.2 5 3.8M13 20l4-10 4 10M14.6 17h4.8", fill: grad("#8FD46A", "#4EA53C"), stroke: true },
  { label: "Акции", glyph: "M4 17l5-6 3.5 3L20 6M15 6h5v5", fill: grad("#22242B", "#000000"), stroke: true },
];

const DOCK: Tile[] = [
  { label: "Сообщения", glyph: "M12 4c5 0 8 3 8 6.4 0 3.4-3 6.3-8 6.3a11 11 0 0 1-2.4-.3L5 19l1.1-3.3A6.6 6.6 0 0 1 4 10.4C4 7 7 4 12 4Z", fill: grad("#5BE36A", "#1FB53A") },
  { label: "Браузер", glyph: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM15.5 8.5 13 13l-4.5 2.5L11 11Z", fill: grad("#5AC8FA", "#1E7BF0"), stroke: true },
  { label: "Маркет", glyph: "M5 8h14l-1 12H6zM9 8V6.5a3 3 0 0 1 6 0V8", fill: grad("#4FA0FF", "#1B63E8"), stroke: true },
];

interface Props {
  /** Имя приложения подрядчика на плитке. */
  appName: string;
  /** Знак подрядчика: буква или короткое слово. */
  appMark: string;
  /** Имя приложения банка — константа, приходит сверху. */
  bankName: string;
}

/** Плитка без подписи: в доке iOS подписей нет, в сетке подпись рядом. */
function Icon({ tile }: { tile: Tile }) {
  return (
    <span aria-hidden className="flex shrink-0" style={tileShadow}>
      <span
        className="relative flex items-center justify-center"
        style={{ ...tileShape, background: tile.fill }}
      >
        <span aria-hidden className="absolute inset-0" style={{ background: TILE_GLOSS }} />
        {/* Штрих 2 при глифе 30: HIG прямо предостерегает от тонких линий —
            на плитке 60 они теряются и читаются как чертёж. */}
        <svg
          width="30"
          height="30"
          viewBox="0 0 24 24"
          fill="none"
          style={{ position: "relative" }}
        >
          <path
            d={tile.glyph}
            stroke={tile.stroke ? "var(--os-glyph)" : "none"}
            fill={tile.stroke ? "none" : "var(--os-glyph)"}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </span>
  );
}

const labelStyle = {
  fontSize: "11px",
  lineHeight: 1.2,
  color: "var(--os-label)",
  textShadow: "0 1px 2px rgba(0,0,0,0.45)",
  maxWidth: "76px",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
} as const;

export function HomeScreen({ appName, appMark, bankName }: Props) {
  return (
    <div
      data-screen-root
      data-testid="home-screen"
      role="img"
      aria-label={COPY["home.a11y"]}
      className="relative flex h-full w-full flex-col"
      style={{
        ...IDENTITY,
        fontFamily: "var(--os-font)",
        background:
          "radial-gradient(120% 70% at 50% 0%, rgba(255,255,255,0.10) 0%, rgba(0,0,0,0) 60%), " +
          "linear-gradient(170deg, var(--os-wallpaper-top) 0%, var(--os-wallpaper-mid) 48%, var(--os-wallpaper-bottom) 100%)",
        paddingInline: "16px",
        // Верх отдан уведомлению: оно приходит на этот же кадр, и первый ряд
        // иконок обязан стоять НИЖЕ его нижней кромки. Иначе баннер режет
        // ряд пополам и из-под него торчат обрезанные подписи.
        paddingTop: "112px",
        paddingBottom: "12px",
      }}
    >
      <div
        className="grid flex-1 content-start"
        style={{
          gridTemplateColumns: `repeat(4, ${TILE}px)`,
          justifyContent: "space-between",
          // Шаг ряда системной раскладки: 60 плитка + 6 подпись + 22 воздух.
          rowGap: "22px",
        }}
      >
        {/* Плитка подрядчика стоит первой: уведомление придёт про неё. */}
        <span className="flex flex-col items-center" style={{ gap: "6px" }}>
          <span aria-hidden className="flex" style={tileShadow}>
            <span
              className="relative flex items-center justify-center"
              style={{
                ...tileShape,
                background: "var(--t-brand-primary)",
                color: "var(--t-brand-primary-on)",
                fontSize: "28px",
                fontWeight: 700,
              }}
            >
              <span aria-hidden className="absolute inset-0" style={{ background: TILE_GLOSS }} />
              <span style={{ position: "relative" }}>{appMark}</span>
            </span>
          </span>
          <span style={labelStyle}>{appName}</span>
        </span>

        {TILES.map((tile) => (
          <span key={tile.label} className="flex flex-col items-center" style={{ gap: "6px" }}>
            <Icon tile={tile} />
            <span style={labelStyle}>{tile.label}</span>
          </span>
        ))}
      </div>

      {/* Индикатор страниц: у домашнего экрана iOS он есть всегда, без него
          док повисает в пустоте. */}
      <div
        aria-hidden
        className="flex shrink-0 items-center justify-center"
        style={{ gap: "7px", paddingBottom: "12px" }}
      >
        {[0, 1, 2].map((dot) => (
          <span
            key={dot}
            style={{
              width: "7px",
              height: "7px",
              borderRadius: "9999px",
              background: dot === 0 ? "#FFFFFF" : "rgba(255,255,255,0.35)",
            }}
          />
        ))}
      </div>

      {/* Док. Приложение банка стоит здесь: уведомление приходит от него,
          и кадр должен объяснять, откуда оно взялось. Подписей нет — их нет
          и у дока iOS. */}
      <div
        data-testid="home-dock"
        className="flex shrink-0 items-center justify-between"
        style={{
          borderRadius: "34px",
          background: "var(--os-dock)",
          // Материал системы: размытие ПЛЮС насыщение — без saturate стекло
          // выходит серым, а не подкрашенным обоями (HIG, Materials).
          backdropFilter: "blur(28px) saturate(180%)",
          WebkitBackdropFilter: "blur(28px) saturate(180%)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.22)",
          // Док iOS: 60 иконка + 18 сверху и снизу = 96.
          padding: "18px 16px",
        }}
      >
        {DOCK.map((tile) => (
          <Icon key={tile.label} tile={tile} />
        ))}
        <span
          aria-hidden
          data-testid="home-bank-icon"
          title={bankName}
          className="flex shrink-0"
          style={tileShadow}
        >
          <span
            className="relative flex items-center justify-center"
            style={{
              ...tileShape,
              background: "var(--bank-primary)",
              color: "var(--bank-on-primary)",
              fontSize: "32px",
              fontWeight: 800,
              lineHeight: 1,
            }}
          >
            <span aria-hidden className="absolute inset-0" style={{ background: TILE_GLOSS }} />
            <span style={{ position: "relative" }}>o</span>
          </span>
        </span>
      </div>
    </div>
  );
}
