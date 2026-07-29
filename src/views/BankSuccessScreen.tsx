import { BankWordmark } from "@demo/components/bank/BankWordmark";
import {
  AvatarBadge,
  BankPrimaryButton,
  CloseCircleButton,
  StaticChip,
} from "@demo/components/bank/bank-primitives";
import { BANK_COPY, COPY } from "@demo/content/copy";
import type { BankPayload } from "@demo/theme/bank-payload";

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
        background:
          "linear-gradient(180deg, var(--bank-gradient-top) 0, #1163f6 64px, #3d82e8 150px, #7eb5de 42%, #74a9ed 62%, #8cb0fe 100%)",
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
        style={{
          top: "var(--bank-header-h)",
          bottom: "calc(111px + env(safe-area-inset-bottom, 0px))",
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
        <div
          aria-hidden="true"
          style={{ flex: "0 1 135px", minHeight: "12px" }}
        />

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
          className="flex shrink-0 flex-col items-center"
          style={{
            marginTop: "-37px",
            // Ширина задаётся явно, поля — `auto`: чек центрируется сам, при
            // любой ширине колонки и независимо от того, что делает
            // выравнивание родителя. Симметричные боковые поля донора (27)
            // сохранены.
            width: "calc(100% - 2 * var(--bank-receipt-side-margin))",
            marginInline: "auto",
            paddingTop: "55px",
            paddingBottom: "20px",
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
            style={{ marginTop: "6px", fontSize: "26px", fontWeight: 700 }}
          >
            {BANK_COPY.successAmount(payload.amount)}
          </span>

          {/* Линия отрыва по оси вырезов */}
          <span
            aria-hidden="true"
            style={{
              alignSelf: "stretch",
              marginTop: "20px",
              marginBottom: "18px",
              height: "1px",
              backgroundImage:
                "repeating-linear-gradient(90deg, color-mix(in srgb, var(--bank-text-secondary) 40%, transparent) 0 4px, transparent 4px 8px)",
            }}
          />

          {/* Чип категории: карандаш донора снят, редактирования нет */}
          <StaticChip fontSize="15px" testId="bank-category-chip">
            {payload.paymentCategory}
          </StaticChip>

          <span
            style={{
              marginTop: "16px",
              fontSize: "14px",
              fontWeight: 400,
              color: "var(--bank-text-secondary)",
              textAlign: "center",
            }}
          >
            {payload.merchant}
          </span>
          <span style={{ marginTop: "8px", fontSize: "17px", fontWeight: 700 }}>
            {COPY["bank.paid_via"]}
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

        {/* ── Зона 7: плитка «Чек». Статична, aria-hidden ─────────── */}
        <div
          data-testid="docs-tile"
          aria-hidden="true"
          className="flex flex-col items-center justify-center"
          style={{
            // Растёт в остатке между чеком и кнопкой (на высоком экране
            // центрируется ровно как раньше) и не сжимается ниже собственной
            // высоты: раньше `flex-1` без минимума выдавливал её на кнопку.
            flex: "1 1 auto",
            minHeight: "calc(var(--bank-docs-tile) + 30px)",
            paddingBlock: "8px",
          }}
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
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <path
                d="M6 3.5h8.5L19 8v12.5H6V3.5Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
              <path
                d="M9 11h7M9 15h5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <span style={{ marginTop: "8px", fontSize: "13px", fontWeight: 400 }}>
            {COPY["bank.docs_tile"]}
          </span>
        </div>
      </div>

      {/* ── Зона 8: кнопка возврата. Нижний резерв — обычный отступ
          страницы + настоящий safe-area устройства. ────────────────── */}
      <div
        className="absolute inset-x-0 bottom-0"
        style={{
          paddingInline: "var(--bank-page-padding)",
          paddingBottom: "calc(28px + env(safe-area-inset-bottom, 0px))",
        }}
      >
        <BankPrimaryButton
          label={payload.returnLabel}
          loadingLabel={payload.returnLabel}
          loading={false}
          onClick={onReturn}
          testId="bank-return-cta"
          height="55px"
        />
      </div>
    </div>
  );
}
