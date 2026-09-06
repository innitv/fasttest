import { BankWordmark } from "@demo/components/bank/BankWordmark";
import {
  AvatarBadge,
  BankPrimaryButton,
  CloseCircleButton,
} from "@demo/components/bank/bank-primitives";
import { BANK_COPY, COPY } from "@demo/content/copy";
import type { BankPayload } from "@demo/theme/bank-payload";

const ICON_PROPS = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** Ряд действий банка под чеком: четыре статичные плитки, как у донора. */
const TILES = [
  { label: COPY["bank.tile_repeat"], icon: <svg {...ICON_PROPS}><path d="M20 11a8 8 0 1 1-2.3-5.6M20 3v5h-5" /></svg> },
  { label: COPY["bank.docs_tile"], icon: <svg {...ICON_PROPS}><path d="M6 3.5h8.5L19 8v12.5H6V3.5Z" /><path d="M9 12h7M9 16h5" /></svg> },
  { label: COPY["bank.tile_template"], icon: <svg {...ICON_PROPS}><path d="m12 4 2.4 5 5.6.7-4 3.9 1 5.4-5-2.7-5 2.7 1-5.4-4-3.9 5.6-.7L12 4Z" /></svg> },
  { label: COPY["bank.tile_autopay"], icon: <svg {...ICON_PROPS}><path d="M4 6.5h16v14H4v-14ZM8 3v5M16 3v5M4 11h16" /></svg> },
];

interface Props {
  payload: BankPayload;
  onReturn: () => void;
}

/**
 * `O-3` — успешная оплата.
 *
 * Кадр, который наблюдатель будет скриншотить, поэтому демо-пометка стоит
 * ВНУТРИ чека: снаружи она в кадрирование не попадёт.
 *
 * Смысл успеха несут три канала: слово «Успешно», знак «−» перед суммой
 * и только потом зелёный бейдж.
 *
 * Крестик здесь ведёт туда же, куда кнопка: платёж совершён, отмены на
 * этом шаге не существует.
 */
export function BankSuccessScreen({ payload, onReturn }: Props) {
  return (
    <div
      data-testid="bank-success"
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{
        // Непрерывный градиент на весь экран, без обрыва (правка O-3).
        // Верхняя точка — токен --bank-gradient-top: #206BF8 (donor_faithful)
        // или #005AFF (enforced). Верхние стопы заданы в px, чтобы контраст
        // белого текста хедера в 74px-полосе был детерминирован независимо от
        // высоты экрана: enforced держит ≥4.9:1 (5.38 у верха → 4.91 на y=74).
        // Прежняя плоская пришпиленная зона (обрыв) убрана. Средние/нижние
        // стопы — измеренные цвета донора `ozon-03-success.jpg`.
        /*
          Свечение за чеком — отдельный слой ПОВЕРХ градиента, снят с живого
          экрана банка 2026-09-05: `radial-gradient(50% 50%, #C7F9B8 0%,
          .8 на 30%, прозрачно к краю)` размером 600×600 при вьюпорте 425,
          то есть диаметр ≈ 1.4 ширины экрана, центр примерно на 40% высоты.
          Салатовый здесь не цвет мерчанта, а цвет УСПЕХА: он один и тот же
          на всех платежах — иначе банк читал бы тему подрядчика, чего
          граница демо не допускает.
        */
        background:
          "radial-gradient(circle 275px at 50% 40%, rgba(199, 249, 184, 0.85) 0%, rgba(199, 249, 184, 0.55) 30%, rgba(199, 249, 184, 0) 100%), linear-gradient(180deg, var(--bank-gradient-top) 0, #1163f6 64px, #3d82e8 150px, #7eb5de 42%, #74a9ed 62%, #8cb0fe 100%)",
        color: "var(--bank-on-primary)",
        fontFamily: "var(--bank-font)",
      }}
    >
      <span aria-live="assertive" className="sr-only">
        {BANK_COPY.liveSuccess(payload.amount)}
      </span>

      {/* ── Зона 3: шапка банка. Высота = --bank-header-h (нативная iOS,
          web-adjusted), контент центрирован по вертикали — как на хедере
          подрядчика и на O-2. Центральный заголовок «Ozon Банк» рисуется
          фирменным начертанием-логотипом `BankWordmark` (правка O-3): тот же
          слот, что на splash O-1 и в хедере O-2 (`variant="micro"`), — во всех
          хедерах банка и на splash логотип единообразно фирменный, а не
          наборный. Белый (`--bank-on-primary`) на синем градиенте, как на
          доноре и на O-2. Accessible name «Ozon Банк» несёт sr-only-метка
          внутри слота, графика `aria-hidden`. ──── */}
      <div
        data-testid="success-header"
        className="absolute inset-x-0 top-0"
        style={{ height: "var(--bank-header-h)" }}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <BankWordmark variant="micro" color="var(--bank-on-primary)" />
        </div>
        <div
          className="absolute top-1/2"
          style={{
            // Правое поле 16 до края видимого круга ⌀30; зона нажатия 44
            // центрируется вокруг него и заходит внутрь поля.
            right: "calc(var(--bank-page-padding) - (var(--k-tap-min) - var(--bank-close-d-small)) / 2)",
            transform: "translateY(-50%)",
            width: "var(--k-tap-min)",
            height: "var(--k-tap-min)",
          }}
        >
          <CloseCircleButton
            label={COPY["a11y.close"]}
            onClick={onReturn}
            diameter="var(--bank-close-d-small)"
            testId="bank-close-success"
          />
        </div>
      </div>

      {/*
        Зоны 4–7. Раньше блок был пришпилен абсолютными 209 сверху и 111 снизу
        — числа, снятые на макете высотой 853. На реальном iPhone видимая
        область Safari ≈ 660–700, и композиция разваливалась: чек не помещался
        в отведённые 533, плитка «Чек» выдавливалась вниз и наезжала на кнопку
        возврата (замер: чек кончался на y=566, кнопка начиналась на y=581).

        Теперь вертикаль набирается ГИБКИМИ звеньями, а не константами:
          • верхний разделитель — базис 135 (то же 74 + 135 = 209 на высоком
            экране), сжимается до 12 на низком;
          • аватар и чек — `shrink-0`, они не деформируются никогда;
          • плитка «Чек» — растёт в остатке и имеет собственный минимум.
        На экране ≥ ~790 раскладка попиксельно прежняя, ниже — сжимается
        сверху, а не наезжает снизу. В крайнем случае (очень низкий экран)
        блок прокручивается, но не пересекается с кнопкой.
      */}
      <div
        data-testid="success-stack"
        className="no-scrollbar absolute inset-x-0 flex flex-col overflow-y-auto"
        /*
         * Прокручиваемая область обязана быть достижима с клавиатуры: внутри
         * чека нет ни одного фокусируемого элемента, поэтому без `tabIndex`
         * до её содержимого нельзя долистать ничем, кроме мыши или пальца
         * (axe: `scrollable-region-focusable`). Всплыло, когда баннер про
         * условия подписки сделал стопку выше экрана.
         */
        tabIndex={0}
        style={{
          top: "var(--bank-header-h)",
          bottom: "calc(var(--bank-button-h) + 28px + env(safe-area-inset-bottom, 0px))",
          /*
            Группа «аватар + чек + плитка» центрируется ЦЕЛИКОМ, а между её
            частями стоят фиксированные донорские отступы. До правки верхний
            разделитель прижимал чек к шапке, а плитка растягивалась в
            остатке — на высоком экране это разносило их по краям: тело чека
            вверху, плитка где-то внизу. `safe` не даёт срезать верх группы,
            когда она выше области.
          */
          justifyContent: "flex-start",
          // Ось X зафиксирована явно: пара `overflow-y: auto` + `overflow-x:
          // visible` невозможна, ось X вычислилась бы в `auto`, и блок стал бы
          // ещё одним горизонтальным скролл-контейнером (на iOS такие
          // перехватывают жест — см. `.h-scroll` в styles.css).
          overflowX: "hidden",
          // Контейнер запроса по ВЫСОТЕ: высота блока задана парой top/bottom,
          // поэтому по ней можно принимать решения. Единственное решение —
          // прятать декоративную плитку «Чек», когда её негде показать
          // целиком (правило в styles.css). Срезанная плитка читалась бы как
          // сломанная вёрстка, а её отсутствие — как её отсутствие.
          containerType: "size",
          containerName: "success",
        }}
      >
        {/*
          Пустоты сверху и снизу в донорской пропорции 1.32 : 1 (замер живого
          экрана: над аватаром 393, под рядом действий 298). Центрирование
          давало 0.93 — группа стояла выше донорской и оставляла под собой
          больше воздуха, чем над собой.
        */}
        <div aria-hidden="true" style={{ flex: "1.32 1 0", minHeight: "8px" }} />

        <div className="relative flex shrink-0 justify-center" style={{ zIndex: 1 }}>
          <AvatarBadge
            size="var(--bank-avatar-success)"
            radius="var(--bank-radius-avatar)"
            withBadge
            ring
            testId="bank-avatar-success"
          />
        </div>

        <div
          data-testid="receipt-card"
          className="relative flex shrink-0 flex-col items-center"
          style={{
            // Аватар выступает над чеком на 36 (замер донора: чек 429,
            // аватар 393 при высоте 82) — отсюда подъём на 82 − 36.
            marginTop: "-46px",
            // Ширина задаётся явно, поля — `auto`: чек центрируется сам, при
            // любой ширине колонки и независимо от того, что делает
            // выравнивание родителя. Симметричные боковые поля донора (27)
            // сохранены.
            width: "calc(100% - 2 * var(--bank-receipt-side-margin))",
            marginInline: "auto",
            // Отступы внутри чека сняты с живого экрана 2026-09-05:
            // «Успешно» на 57 от верха карточки, получатель — на 24 от низа.
            paddingTop: "57px",
            paddingBottom: "24px",
            paddingInline: "16px",
            borderRadius: "var(--bank-radius-receipt)",
            background: "var(--bank-surface)",
            color: "var(--bank-text-primary)",
            // Вырезы-перфорация: настоящие дыры маской, сквозь них виден
            // градиент, а не подкрашенный кружок.
            WebkitMaskImage:
              "radial-gradient(circle 14.5px at 0 var(--bank-receipt-notch-y), transparent 14.5px, #000 15px), radial-gradient(circle 14.5px at 100% var(--bank-receipt-notch-y), transparent 14.5px, #000 15px)",
            maskImage:
              "radial-gradient(circle 14.5px at 0 var(--bank-receipt-notch-y), transparent 14.5px, #000 15px), radial-gradient(circle 14.5px at 100% var(--bank-receipt-notch-y), transparent 14.5px, #000 15px)",
            WebkitMaskComposite: "source-in",
            maskComposite: "intersect",
          }}
        >
          <span
            data-testid="bank-success-title"
            style={{ fontSize: "20px", fontWeight: 700 }}
          >
            {COPY["bank.success_title"]}
          </span>
          <span
            data-testid="bank-success-amount"
            style={{ marginTop: "0px", fontSize: "24px", fontWeight: 700 }}
          >
            {BANK_COPY.successAmount(payload.amount)}
          </span>

          {/* Линия отрыва по оси вырезов */}
          <span aria-hidden="true" style={{ height: "33px" }} />

          <span
            aria-hidden="true"
            style={{
              /*
                Линия отрыва привязана к тому же числу, что и вырезы по краям
                (`--bank-receipt-notch-y`), и потому не может от них уехать:
                до этого она стояла в потоке и разошлась с вырезами на 13 px,
                как только поменялись отступы внутри чека. В потоке остаётся
                распорка той же высоты — разрыв между суммой и реквизитом
                сохраняется (у донора 32).
              */
              position: "absolute",
              left: "16px",
              right: "16px",
              top: "calc(var(--bank-receipt-notch-y) - 0.5px)",
              height: "1px",
              /*
                Точки, а не штрихи: у чека в самом банке линия отрыва — мелкий
                плотный пунктир, штрих 4 через 4 читается грубее и делает
                карточку похожей на форму с разделителем, а не на чек.
              */
              backgroundImage:
                "repeating-linear-gradient(90deg, color-mix(in srgb, var(--bank-text-secondary) 45%, transparent) 0 1.5px, transparent 1.5px 4px)",
            }}
          />

          {/*
            Нижняя половина чека повторяет чек банка: сверху РЕКВИЗИТ платежа
            серым (что оплачено), под ним ЖИРНЫМ — получатель. Чипа категории
            и строки «Оплата через Ozon Банк» здесь нет намеренно: первый
            добавляет служебную строку, которой в чеке нет, вторая — тавтология
            (вы и так в банке), и обе оттягивают внимание от получателя.
          */}
          <span
            data-testid="bank-success-detail"
            style={{
              fontSize: "14px",
              fontWeight: 400,
              color: "var(--bank-text-secondary)",
              textAlign: "center",
            }}
          >
            {payload.summaryDetail}
          </span>
          <span
            data-testid="bank-success-merchant"
            style={{
              marginTop: "8px",
              fontSize: "16px",
              fontWeight: 600,
              textAlign: "center",
            }}
          >
            {payload.merchant}
          </span>
          <span
            data-testid="bank-demo-note-success"
            style={{
              marginTop: "10px",
              fontSize: "12px",
              fontWeight: 400,
              color: "var(--bank-text-secondary)",
              textAlign: "center",
            }}
          >
            {COPY["bank.demo_note"]}
          </span>
        </div>

        {/*
          ── Зона 7: ряд действий. Статичен, aria-hidden ───────────────
          У банка под чеком РЯД из четырёх плиток, а не одна: замер живого
          экрана 2026-09-05 — иконка 44×44 с радиусом 12, контейнер 68,
          шаг 76 (то есть зазор 8), подпись 12/400 через 8 от иконки, ряд
          центрирован. Одинокая плитка посреди пустого поля читалась как
          недорисованный экран.

          В демо все четыре ничего не делают — это оформление чека, поэтому
          ряд целиком скрыт от скринридера.
        */}
        <div
          data-testid="docs-tile"
          aria-hidden="true"
          className="flex shrink-0 items-start justify-center"
          /*
            Зазор до чека — 24.
            🔴 Не 84: между чеком (низ 660) и рядом (верх 744) у донора лежит
            баннер-подсказка 660→720, и разность координат — это его высота
            плюс зазор, а не зазор. Баннера у нас нет, а дырка от него
            оставалась.
          */
          style={{ marginTop: "24px", gap: "8px" }}
        >
          {TILES.map((tile) => (
            <span
              key={tile.label}
              className="flex flex-col items-center"
              style={{ width: "68px" }}
            >
              <span
                className="flex items-center justify-center"
                style={{
                  width: "var(--bank-docs-tile)",
                  height: "var(--bank-docs-tile)",
                  borderRadius: "var(--bank-radius-tile)",
                  background: "var(--bank-surface)",
                  color: "var(--bank-primary)",
                }}
              >
                {tile.icon}
              </span>
              <span
                style={{
                  marginTop: "8px",
                  fontSize: "12px",
                  fontWeight: 400,
                  textAlign: "center",
                }}
              >
                {tile.label}
              </span>
            </span>
          ))}
        </div>

        <div aria-hidden="true" style={{ flex: "1 1 0", minHeight: "8px" }} />
      </div>

      {/* ── Зона 8: кнопка возврата. Нижний резерв — обычный отступ
          страницы + настоящий safe-area устройства. ────────────────── */}
      <div
        className="absolute inset-x-0 bottom-0"
        style={{
          paddingInline: "var(--bank-page-padding)",
          // Под кнопкой у донора 16 (замер живого экрана 2026-09-05),
          // а не 28: она стоит у самой кромки, а не висит над ней.
          paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
        }}
      >
        <BankPrimaryButton
          label={payload.returnLabel}
          loadingLabel={payload.returnLabel}
          loading={false}
          onClick={onReturn}
          testId="bank-return-cta"
          // Высота из общего токена: у донора обе кнопки банка одинаковы (48).
          height="var(--bank-button-h)"
        />
      </div>
    </div>
  );
}
