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
 * Материал экрана — системный, iOS: тёмные обои с переходом, squircle-плитки
 * 60 px с бликом и тенью, подписи 11 под ними, индикатор страниц внизу.
 * Дока нет: он держит четыре приложения, а на экране их два — пустое корыто
 * стекла выглядело бы обрубком.
 */
const IDENTITY = {
  /*
   * Обои. Замер снят с системных обоев iOS 26 «Dusk» (тёмный вариант,
   * 1290×2796) — по сетке точек: тёмный сине-фиолетовый верх справа
   * (#05021F), сиреневое поле слева (#907EBA…#AE9DD1), синие линзы в
   * середине (#646AB4…#7C80C7) и почти чёрный низ слева (#000232).
   *
   * Сам файл Apple в репозиторий не кладётся: обои — их работа. Здесь
   * ВОСПРОИЗВЕДЕНА структура кадра — две стеклянные линзы поверх
   * диагонального перехода, со светящимися кромками и тёплым бликом в
   * стыке, — потому что именно она делает экран похожим на телефон, а не
   * плоская заливка.
   */
  "--os-bg-top": "#241D4A",
  "--os-bg-deep": "#0A0722",
  "--os-bg-night": "#02001A",
  "--os-lilac": "#AE9DD1",
  "--os-lens-cool": "#7C80C7",
  "--os-lens-cool-deep": "#43478C",
  "--os-lens-dark": "#3E3176",
  "--os-lens-dark-deep": "#221A4A",
  "--os-edge": "rgba(255,255,255,0.42)",
  "--os-glyph": "#FFFFFF",
  "--os-label": "#FFFFFF",
  "--os-font": '-apple-system, "SF Pro Text", "Segoe UI", system-ui, sans-serif',
} as const;

/**
 * Слой обоев: диагональный переход, две линзы и блик.
 *
 * Линзы — круги ШИРЕ экрана, обрезанные его кромками: у системных обоев
 * они именно такие, и уменьшенные до «кружков» читаются наклейками.
 * Стекло даёт полупрозрачная заливка со светлой кромкой по окружности.
 */
function Wallpaper() {
  const lens = {
    position: "absolute",
    borderRadius: "50%",
    boxShadow: "inset 0 1px 0 0 var(--os-edge)",
  } as const;

  return (
    <div aria-hidden className="absolute inset-0" style={{ overflow: "hidden" }}>
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 60% at 12% 34%, var(--os-lilac) 0%, rgba(174,157,209,0) 62%), " +
            "radial-gradient(70% 34% at 98% 82%, rgba(164,139,222,0.85) 0%, rgba(164,139,222,0) 72%), " +
            "radial-gradient(80% 40% at 6% 98%, var(--os-bg-night) 0%, rgba(2,0,26,0) 72%), " +
            "linear-gradient(158deg, var(--os-bg-top) 0%, var(--os-bg-deep) 46%, var(--os-bg-night) 100%)",
        }}
      />

      {/* Верхняя линза: тёмная, уходит за правую кромку. */}
      <div
        style={{
          ...lens,
          left: "26%",
          top: "-26%",
          width: "132%",
          aspectRatio: "1",
          background:
            "radial-gradient(110% 90% at 30% 8%, rgba(84,70,140,0.98) 0%, rgba(62,49,118,0.96) 34%, " +
            "rgba(34,26,74,0.96) 72%, rgba(18,14,44,0.96) 100%)",
        }}
      />

      {/* Тёплый блик в стыке линз — единственное тёплое пятно кадра. */}
      <div
        className="absolute"
        style={{
          left: "44%",
          top: "40%",
          width: "34%",
          height: "16%",
          background:
            "radial-gradient(closest-side, rgba(255,226,214,0.55) 0%, rgba(255,226,214,0) 100%)",
          filter: "blur(6px)",
        }}
      />

      {/* Нижняя линза: холодная, уходит за левую и нижнюю кромки. */}
      <div
        style={{
          ...lens,
          left: "-70%",
          top: "34%",
          width: "158%",
          aspectRatio: "1",
          background:
            "radial-gradient(120% 90% at 62% 4%, rgba(190,196,236,0.95) 0%, rgba(124,128,199,0.9) 26%, " +
            "rgba(67,71,140,0.92) 58%, rgba(14,11,36,0.96) 100%)",
        }}
      />
    </div>
  );
}

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
  "linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.04) 40%, rgba(0,0,0,0) 66%, rgba(0,0,0,0.06) 100%)";

/** Подпись под плиткой: 11 px, белым, с тенью — иначе теряется на обоях. */
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

interface Props {
  /** Имя приложения подрядчика на плитке. */
  appName: string;
  /** Знак подрядчика: буква. Запасной вариант к `appIcon`. */
  appMark: string;
  /** Знак приложения картинкой — тот же файл, что в уведомлении о счёте. */
  appIcon?: string | null;
  /** Имя приложения банка — константа, приходит сверху. */
  bankName: string;
}

/**
 * Плитка приложения: маска-суперэллипс, знак и подпись под ним.
 *
 * Приложений на экране ровно два — участники сценария (решение владельца
 * 2026-09-06). Раньше вокруг них стояли два десятка выдуманных плиток
 * «Погода», «Заметки», «Компас»: они не про демо, рисуются нами, и потому
 * читаются самоделкой рядом с настоящими знаками. Пустое место честнее.
 */
function AppTile({
  label,
  icon,
  mark,
  fill,
  ink,
  testId,
}: {
  label: string;
  icon?: string | null;
  mark?: string;
  fill?: string;
  ink?: string;
  testId?: string;
}) {
  return (
    <span className="flex flex-col items-center" style={{ gap: "5px", width: `${TILE}px` }}>
      <span aria-hidden data-testid={testId} className="flex" style={tileShadow}>
        <span
          className="relative flex items-center justify-center"
          style={{
            ...tileShape,
            background: fill ?? "transparent",
            color: ink,
            fontSize: "28px",
            fontWeight: 700,
          }}
        >
          {icon ? (
            <img
              alt=""
              src={icon}
              className="absolute inset-0"
              style={{ width: "100%", height: "100%", display: "block" }}
            />
          ) : (
            <span style={{ position: "relative" }}>{mark}</span>
          )}
          <span aria-hidden className="absolute inset-0" style={{ background: TILE_GLOSS }} />
        </span>
      </span>
      <span style={labelStyle}>{label}</span>
    </span>
  );
}

export function HomeScreen({ appName, appMark, appIcon, bankName }: Props) {
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
        background: "var(--os-bg-deep)",
        /*
         * Поля и шаг — системной раскладки iPhone: колонка иконок 60 при
         * шаге 90, то есть 27 до кромки экрана. Первый ряд стоит ниже
         * уведомления: оно приходит на этот же кадр и иначе режет ряд
         * пополам.
         */
        paddingInline: "27px",
        paddingTop: "124px",
        paddingBottom: "12px",
      }}
    >
      <Wallpaper />

      <div
        className="relative grid flex-1 content-start"
        style={{ gridTemplateColumns: `repeat(4, ${TILE}px)`, columnGap: "30px", rowGap: "22px" }}
      >
        <AppTile
          label={appName}
          icon={appIcon}
          mark={appMark}
          fill="var(--t-brand-primary)"
          ink="var(--t-brand-primary-on)"
        />
        <AppTile label={bankName} icon="/bank/app-icon.svg" testId="home-bank-icon" />
      </div>

      {/* Индикатор страниц: у домашнего экрана iOS он есть всегда. */}
      <div
        aria-hidden
        className="relative flex shrink-0 items-center justify-center"
        style={{ gap: "7px", paddingBottom: "20px" }}
      >
        {[0, 1].map((dot) => (
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
    </div>
  );
}
