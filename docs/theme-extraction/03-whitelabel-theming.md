# Ресёрч: как индустрия решает брендирование чужого интерфейса под клиента

Дата: 2026-07-27. Ось: платёжные/чекаут-продукты, автобрендирование по домену, инженерные практики multi-tenant theming, демо/sandbox-инструменты для продаж. Tavily-first, ссылки — на документацию продукта или его собственную страницу, кроме мест, отмеченных как вторичные.

## Краткий вывод

Крупные платёжные и auth-продукты почти никогда не открывают клиенту больше 3–10 параметров темы (цвет/логотип/шрифт/форма) — и как минимум два независимых игрока (ЮKassa, Okta) прямо документируют автоподбор остальной палитры из 1–2 заданных цветов. Наши 60 полей — на порядок больше отраслевой нормы, и это стоит зафиксировать как осознанное расхождение, а не недосмотр. Конфликт «верность бренду vs читаемость» индустрия решает не отказом, а прозрачной автокоррекцией: Okta документирует переключение цвета текста кнопки на чёрный или подстройку самого primary-цвета, если контраст не проходит WCAG 1.4.3 — точное совпадение с input не гарантируется и не считается регрессией. Ближайший функциональный аналог нашей задачи целиком — жанр sales-demo-платформ (Storylane, Walnut, Navattic, Reprise, Demostack): они удаляют разработчика из процесса персонализации демо под конкретного клиента, но во всех найденных случаях "точки замены" (логотип, цвет, текст) размечаются человеком заранее как токены — ни один игрок не извлекает тему автоматически из скриншота или URL. Это значит, что «скриншот → тема» — шаг вперёд относительно того, что этот жанр продуктов делает сегодня; готового решения для копирования нет, но паттерн токенизации и разделение «капча/захват» → «редактирование» → «персонализация по ссылке» переносим напрямую.

Часть направлений проработана глубже других (см. отметки `нужна проверка` и раздел с ограничениями в конце). Данные по Frontegg и специфике SBP не найдены на уровне документации — помечено как непроработанное.

---

## 1. Платёжные и чекаут-продукты: сколько параметров дают на самом деле

**Stripe.** Два разных уровня кастомизации, которые часто путают в маркетинге:

- **Branding Settings** (аккаунт-уровень, применяется к Checkout, Payment Links, customer portal, invoices) — всего 4 поля: icon, logo, brand color, accent color. Таблица применения по поверхностям явно документирована (иконка — везде, logo — не везде, brand/accent color — по-разному для email/checkout/portal/invoice). Источник: [docs.stripe.com/get-started/account/branding](https://docs.stripe.com/get-started/account/branding).
- **Elements Appearance API** (для Payment Element / встраиваемых компонентов, уровень разработчика) — заметно шире: подтверждённый рабочий пример содержит 16 переменных (`colorPrimary`, `colorBackground`, `colorText`, `colorDanger`, `colorSuccess`, `colorWarning`, `colorTextSecondary`, `colorTextPlaceholder`, `iconCheckmarkColor`, `fontFamily`, `spacingUnit`, `borderRadius`, `gridRowSpacing`, `logoColor`, `tabLogoColor`, `blockLogoColor`) плюс открытый механизм `rules` — CSS-like селекторы для точечной подгонки отдельных компонентов без ограничения по числу свойств. Источник: [docs.stripe.com/elements/appearance-api](https://docs.stripe.com/elements/appearance-api).
- Важное расхождение маркетинга и факта: **hosted/embedded Checkout (`EmbeddedCheckoutProvider`) вообще не поддерживает Appearance API** — кастомизация там ограничена теми же 4 полями Branding Settings аккаунта; полный контроль даёт только связка Checkout Sessions API + Payment Element. Подтверждено вопросом на Stack Overflow с ответом от контекста продукта: [stackoverflow.com/questions/79524839](https://stackoverflow.com/questions/79524839).
- Connect: брендирование для connected-аккаунтов настраивается через Accounts API теми же 4 полями (branding_settings), если у аккаунта нет доступа к полному Dashboard.

**Adyen.** Два независимых механизма:

- **Hosted Checkout Themes** — создаются в Customer Area (Pay by Link → Themes): theme name, display name, лого, флаг "default". Фактически 3 содержательных поля. Источник: [docs.adyen.com/standard/integration/hosted-checkout](https://docs.adyen.com/standard/integration/hosted-checkout).
- **Drop-in / Web Components** — `styles` объект для полей карты (per-field), `brandsConfiguration` для замены иконок платёжных систем, `paymentMethodsConfiguration` для точечной настройки конкретного метода оплаты (например, цвет кнопки). Это уровень разработчика, число настроек не фиксировано — параметризация идёт по компонентам, а не единым набором токенов. Источник: [docs.adyen.com/payment-methods/cards/web-drop-in](https://docs.adyen.com/payment-methods/cards/web-drop-in), [docs.adyen.com/plugins/salesforce-commerce-cloud/composable-storefront/customization-guide](https://docs.adyen.com/plugins/salesforce-commerce-cloud/composable-storefront/customization-guide).

**Chargebee.** No-code редактор Layout Customization: несколько ролей цвета + "Advanced Colors" (с явным предупреждением про читаемость при их использовании) + типографика (шрифт, размер) + форма карточек (shape). Явно документировано ограничение: **нельзя кастомизировать checkout в зависимости от плана/товара** — тема единая на весь checkout. Источник: [chargebee.com/docs/.../checkout-layout-customization](https://www.chargebee.com/docs/billing/2.0/hosted-capabilities/checkout-layout-customization).

**Paddle.** No-code "Customize" экран: кнопки (размер, цвет текста, границы, hover), поля ввода (позиция лейблов, ограниченный список системных шрифтов с fallback-цепочкой Lato → Helvetica Neue → Helvetica → Arial → sans-serif), ссылки (размер и цвет текста), тема light/dark. Источник: [developer.paddle.com/build/checkout/brand-customize-inline-checkout](https://developer.paddle.com/build/checkout/brand-customize-inline-checkout).

**ЮKassa (Россия) — ключевой прецедент автоподбора.** Виджет явно документирует: *"To customize it, all you need is one or two colors, and the rest will be selected by the widget itself."* Обязательный параметр — `control_primary` (акцентный цвет: кнопка "Оплатить", radio/checkbox, текстовые поля); опционально можно доуточнить `background`, `text`, `border`, `control_secondary`. Итого — от 1 до 5 цветовых параметров, без настроек шрифта, радиуса или отступов. Источник: [yookassa.ru/developers/.../widget/additional-settings/design](https://yookassa.ru/developers/payment-acceptance/integration-scenarios/widget/additional-settings/design).

**Т-Банк (Россия).** Маркетинговая страница интернет-эквайринга описывает брендирование платёжной формы как: логотип компании + цвет кнопок под бренд + порядок отображения способов оплаты. Это описание с продуктовой страницы, а не из технической документации API — детального списка полей в открытых источниках не нашёл, `нужна проверка` по точному числу параметров. Источник: [tbank.ru/business/online-payments/internet-acquiring](https://www.tbank.ru/business/online-payments/internet-acquiring).

---

## 2. Автоматическое брендирование по домену

Ни один из проверенных enterprise-продуктов identity/auth **не имеет встроенной функции "ввёл домен → получил готовую тему"** — везде это ручной no-code редактор с фиксированным набором полей:

- **Auth0 Universal Login**: no-code редактор (Dashboard → Branding → Universal Login) — цвета (primary, secondary, ссылки), шрифты, лого, форма виджета (rounded/sharp), фон (цвет/картинка). Три уровня кастомизации: no-code theme → Liquid page templates (нужен custom domain) → полный CSS/HTML контроль. Источник: [auth0.com/docs/customize/login-pages/universal-login/customize-themes](https://auth0.com/docs/customize/login-pages/universal-login/customize-themes).
- Существует сторонний AI-агентский skill-пакет ("Tessl") поверх Auth0 Management API с заявленной способностью *"brand my tenant... from a website I own"* — но это надстройка сообщества над API, а не нативная функция Auth0. Отмечаю явно, чтобы не спутать с фактом продукта: [tessl.io/registry/skills/github/auth0/agent-skills/auth0-branding](https://tessl.io/registry/skills/github/auth0/agent-skills/auth0-branding).
- **Okta Sign-In Widget**: no-code — лого, фоновая картинка, favicon, primary color, secondary color (2 цвета). Источники: [developer.okta.com/docs/concepts/sign-in-widget](https://developer.okta.com/docs/concepts/sign-in-widget), [github.com/okta/okta-signin-widget](https://github.com/okta/okta-signin-widget).
- **Descope/Frontegg**: прямых страниц документации с перечнем полей кастомизации найти не удалось — попадались только маркетинговые/сравнительные страницы конкурентов. Это направление **не проработано** на уровне первоисточника, нужен отдельный заход именно в их product docs.

**Реальный паттерн индустрии — не встроенная фича, а отдельный класс Brand/Logo API**, из которого потом руками (или через собственный no-code редактор продукта) заполняются поля:

- Clearbit Logo API остановлен 8 декабря 2025 после поглощения HubSpot — `нужна проверка первоисточником` (взято из вторичного сравнительного источника, не из объявления HubSpot/Clearbit напрямую). Источник: [abstractapi.com/guides/company-enrichment/best-company-logo-apis](https://www.abstractapi.com/guides/company-enrichment/best-company-logo-apis).
- **Logo.dev** — позиционируется как прямой преемник Clearbit, только логотипы по домену; цвета — платно через отдельный Describe API.
- **Brandfetch** — logo + brand colors + fonts + метаданные через Brand API, идентификаторы: домен, тикер, ISIN, крипто-символ. Источник: [docs.brandfetch.com/logo-api/overview](https://docs.brandfetch.com/logo-api/overview), [docs.brandfetch.com/get-started](https://docs.brandfetch.com/get-started).
- **Context.dev** — ближе всего к нашей задаче: помимо logo/colors/fonts заявляет "styleguide extraction" (shadows, spacing, components) и явно нацелен на use case "dynamic theming" и "personalized onboarding". Источник вторичный (сравнительный блог, не собственная документация Context.dev) — `нужна проверка` прямым заходом в их docs.

Важно: все эти API извлекают данные **из живого DOM/CSS сайта** (парсинг computed styles, `:root` CSS custom properties) или из готовой базы залогинившихся брендов — никто из них не работает от скриншота через vision/OCR. Это прямое отличие от нашего сценария.

---

## 3. Инженерные практики multi-tenant theming: конфликт бренд vs читаемость

**Design tokens / формат.** DTCG (Design Tokens Community Group) format — трёхуровневая модель primitive → semantic → component tokens; в найденном источнике указано, что первая стабильная версия спецификации вышла в октябре 2025 — `нужна проверка`, источник маркетинговый блог, не сама спецификация DTCG. Практический приём для защиты от «клиент выбрал белый на белом»: **не выставлять наружу примитивные токены** (`blue-600`), а выставлять только уже провалидированные по контрасту семантические пары (`text-on-surface`), чтобы разработчик физически не мог дотянуться до непроверенного raw-значения. Источник: [buildmvpfast.com/blog/accessible-color-systems-design-tokens-wcag-contrast-2026](https://www.buildmvpfast.com/blog/accessible-color-systems-design-tokens-wcag-contrast-2026) (вторичный источник, содержательно правдоподобно, но не первоисточник спецификации).

**Style Dictionary.** Трансформирует единый JSON-словарь токенов в платформенные форматы (CSS variables, SCSS, iOS, Android); поддерживает multi-brand через слияние нескольких source-файлов и层 темизации (`themes.json` с global + light/dark), где бренд-цвета объявляются как алиасы (`alias.colour.brand.primary`), на которые ссылаются компонентные токены — смена бренда = правка одного алиаса. Источники: [styledictionary.com/info/tokens](https://styledictionary.com/info/tokens), практический разбор [didoo.medium.com/how-to-manage-your-design-tokens-with-style-dictionary](https://didoo.medium.com/how-to-manage-your-design-tokens-with-style-dictionary-98c795b938aa) (вторичный, но с конкретным рабочим конфигом).

**Прямой прецедент разрешения конфликта «бренд vs контраст» — Okta Sign-In Widget (документация продукта, не блог):**

- Widget определяет всю палитру состояний кнопки (`PalettePrimaryMain`, `PalettePrimaryDark`, `PalettePrimaryDarker` для hover/click) из **одного заданного Primary-цвета**.
- Widget **enforces WCAG 1.4.3**: текст кнопки должен держать контраст ≥ 4.5:1 к фону кнопки.
- 2-е поколение виджета: текст кнопки по умолчанию белый; если контраст выбранного Primary к белому < 4.5:1 — система переключает цвет текста на чёрный. Документированный числовой пример: `#6B8A16` к белому даёт 3.98:1 (провал) → переключение на чёрный текст даёт 5.27:1 (проход).
- 3-е поколение: система не просто меняет цвет текста, а **подстраивает сам Primary-цвет**, чтобы найти подходящий контраст текста — то есть точное сохранение введённого клиентом hex не гарантируется и не считается регрессией продукта.

Источник (официальная документация Okta): [help.okta.com/oie/en-us/content/topics/settings/branding-siw-color-contrast.htm](https://help.okta.com/oie/en-us/content/topics/settings/branding-siw-color-contrast.htm).

Согласующийся, хоть и менее формальный паттерн встречается многократно у независимых практиков (UX-статьи, обсуждение r/UXDesign): общее правило — **"adjust the shade, not the hue"** (варьировать светлоту/темноту, но не переопределять исходный оттенок бренда), и типовая практика — бренд даёт 1 опорный цвет, а команда дизайн-системы строит вокруг него полный accessible ramp (светлый/тёмный варианты), после чего эти уже проверенные оттенки, а не сырой ввод, попадают в токены. Источник (мнение практика, не нормативный): [reddit.com/r/UXDesign/comments/1god906](https://www.reddit.com/r/UXDesign/comments/1god906/do_you_do_accessibility_test_when_you_pick_colors) — приводится как согласующееся индустриальное наблюдение, не как источник факта.

---

## 4. Демо и песочницы для продаж — ближайший аналог целиком

Общая архитектура жанра (Storylane, Walnut, Navattic, Reprise, Demostack) раскладывается на три слоя: **(1) захват** — скриншот / видео / live HTML DOM через browser-extension / полный клон окружения; **(2) редактирование/токенизация** — человек вручную помечает элементы (текст, картинка/лого) как заменяемые токены; **(3) персонализация и доставка** — генерация персональной ссылки на прошедшего/CRM-лида с подстановкой значений токенов, аналитика по ссылке.

**Storylane** (первоисточник — собственная документация):
- 3 режима захвата: Screenshot (все планы), Video (все планы), HTML (только план Growth и выше, от $500/мес).
- Персонализация — через явно заданные вручную токены: текстовые токены (имя/компания), **image-токены** (клик на картинку → "Assign Image token"; при совпадении элемента на нескольких экранах Storylane предлагает применить токен сразу ко всем экранам — единственный найденный элемент автоматизации, но он всё равно требует, чтобы человек один раз указал, что это заменяемый логотип), токены даты/времени, автотокены из формы лида (`{{email}}, {{first_name}}, {{last_name}}, {{name}}`), персонализация через URL query-параметры.
- AI-фича "AI personalization" адаптирует контент демо под роль/индустрию по промпту — но это редактирование уже готового демо, а не извлечение бренда из скриншота.
- Цены: Free (1 демо) → Starter $40/мес (screenshot) → Growth $500/мес (HTML) → Premium $1200/мес → Enterprise (индивидуально); отдельный AI-агент RepX — отдельный платный продукт (по вторичному источнику ~$2000/мес, `нужна проверка`).
- Источники: [docs.storylane.io/editing-demos/personalizing-demos](https://docs.storylane.io/editing-demos/personalizing-demos), [docs.storylane.io/storylane-playbooks/decision-stage/live-demos](https://docs.storylane.io/storylane-playbooks/decision-stage/live-demos).

**Walnut** (первоисточник — собственная документация/сайт):
- Захватывает "live product as interactive HTML — not static screenshots or pre-recorded video", через browser extension, обновляется автоматически при изменении продукта.
- "AI Mode" — персонализация одним промптом: *"swap logos, data, messaging, and workflows to match each prospect"* — заявлено как флагманская способность 2026 года.
- На странице pricing персонализация явно выделена отдельной строкой функций: **"Prospect personalization — Personalize demos with prospect's name, brand colors, and relevant content"** — то есть это отдельная закрываемая тарифом способность, а не встроенная по умолчанию во все планы.
- Источники: [walnut.io/personalized-interactive-demos](https://www.walnut.io/personalized-interactive-demos), [walnut.io/pricing](https://www.walnut.io/pricing), [walnut.io/use-cases/personalize-your-outreach-with-interactive-demos](https://www.walnut.io/use-cases/personalize-your-outreach-with-interactive-demos).

**Reprise и Demostack — данные только из вторичных источников (сравнительные блоги конкурентов, обзорные видео), собственную документацию не открывал — оцениваю ниже как менее надёжные:**
- Reprise: guided tours + "fully cloned environments"; по утверждению конкурента (Storylane) — 1–3 месяца на настройку клонирования продукта против часов у HTML-capture инструментов. Это заявление конкурента о конкуренте, `нужна проверка`.
- Demostack: полный клон фронта и бэка продукта через browser extension; по цитате клиента с G2 — используется, чтобы "change the look and themes of what I'm showing" и "personalize for specific client needs or industries", включая смену терминологии. Цены по третичному источнику (сравнительная таблица Navattic) — $55 000–150 000/год, заметно выше HTML-capture инструментов — направление подтверждает гипотезу "полный клон = на порядок дороже и медленнее лёгкого theming-подхода", но точные цифры нужна проверка на demostack.com напрямую.
- Источники (вторичные): [storylane.io/blog/alternatives-to-walnut-reprise-demostack-and-navattic](https://www.storylane.io/blog/alternatives-to-walnut-reprise-demostack-and-navattic), [navattic.com/blog/demo-automation](https://www.navattic.com/blog/demo-automation).

**Ключевой негативный результат для всего направления 4**: ни у одного из пяти проверенных игроков не найдено функции автоматического извлечения темы/бренда из скриншота или URL клиента. Персонализация везде начинается с шаблона, где точки замены уже размечены человеком; последние AI-фичи (Storylane AI personalization, Walnut AI Mode) автоматизируют **редактирование уже размеченных токенов по текстовому промпту**, а не первичное распознавание бренда с изображения. Наша задача в этой части опережает то, что закрывает существующий рынок инструментов.

---

## Сколько параметров хватает на практике

| Продукт | Число настраиваемых параметров | Какие именно (по документации) | Автоподбор остальных значений |
|---|---|---|---|
| Stripe Checkout / Branding Settings | 4 | icon, logo, brand color, accent color | Нет |
| Stripe Elements / Payment Element (Appearance API) | ~16 переменных + открытый `rules` | colorPrimary/Background/Text/Danger/Success/Warning, colorTextSecondary/Placeholder, iconCheckmarkColor, fontFamily, spacingUnit, borderRadius, gridRowSpacing, logoColor/tabLogoColor/blockLogoColor | Нет |
| Adyen Hosted Checkout (Themes) | 3 | display name, лого, default-флаг | Нет |
| Adyen Drop-in (`styles`, `brandsConfiguration`) | по компоненту, не фиксировано | стили полей карты, иконки платёжных брендов, `paymentMethodsConfiguration` на метод | Нет |
| Chargebee Checkout | ~8–10 | цветовые роли + Advanced Colors + шрифт/размер + форма карточек | Нет |
| Paddle Checkout (no-code) | ~10 | тема light/dark, кнопки (размер/цвет/границы/hover), поля ввода (лейблы/шрифт), ссылки | Нет |
| ЮKassa Widget | 1–5 | `control_primary` (обязательный), опционально `background`/`text`/`border`/`control_secondary` | **Да** — остальные цвета из 1–2 заданных |
| Т-Банк интернет-эквайринг (виджет) | ~2–3 (по маркетинговой странице, `нужна проверка`) | логотип, цвет кнопок, порядок способов оплаты | Нет (по открытым данным) |
| Okta Sign-In Widget (no-code) | ~5 | лого, фон, favicon, primary color, secondary color | **Да** — вся палитра состояний и выбор цвета текста кнопки считаются из primary через WCAG 1.4.3 |
| Auth0 Universal Login (no-code theme) | ~6–8 | primary/secondary/link colors, шрифты, лого, форма виджета, фон | Нет |
| Storylane / Walnut / Navattic (демо) | не фиксировано — потокенно | каждый текстовый/картиночный узел размечается вручную как токен | Частично — AI-промпт правит уже размеченные токены, не извлекает их из скриншота |

---

## Что это значит для нас

1. **60 полей — это на порядок больше отраслевой практики.** Крупнейшие чекаут- и auth-продукты закрывают подавляющее большинство кейсов брендирования 3–10 параметрами (логотип, 1–2 цвета, иногда шрифт/форма). Это не повод сокращать наш конфиг демо (там оправданно шире, потому что мы показываем полноценный интерфейс, а не встроенный виджет), но повод явно выделить **подмножество из 5–10 полей, которые реально управляют узнаваемостью бренда для нетехнического наблюдателя** — по аналогии с тем, что индустрия годами считает достаточным минимумом.

2. **Автоподбор темы из 1–2 входных цветов — не гипотеза, а рабочий прецедент** (ЮKassa, Okta). Наш сценарий «скриншот → малый набор извлечённых цветов → автогенерация остальных 50+ полей» опирается на реальный паттерн. Но важно честно зафиксировать разрыв: в обоих прецедентах входные 1–2 цвета **задаёт человек явно**, а не извлекает система из изображения — самого шага «распознать цвет из скриншота» ни один проверенный продакшн-продукт не делает сам.

3. **Конфликт «верность бренду vs гарантия читаемости» индустрия решает явной, документированной автокоррекцией, а не отказом и не молчаливым нарушением контраста.** Okta — это прямое подтверждение того, что можно официально объявить: *«если входной цвет бренда не проходит контраст, система подстраивает его или переключает цвет текста — это ожидаемое поведение, а не баг»*. Стоит принять такую же явную, задокументированную для менеджера политику вместо точечных решений по каждому конфликтному кейсу.

4. **Жанр демо/sandbox-платформ — ближайший функциональный аналог целиком, но не готовое решение для копирования.** У них можно позаимствовать: разделение "захват → токенизация → персонализация по ссылке", паттерн image-токенов с автоприменением к одинаковым элементам на разных экранах (Storylane), и явное разделение ценовых тиров на "базовая генерация" и "персонализация" (Walnut) — это подсказывает, что персонализация под конкретного клиента обычно продаётся/архитектурно выделяется отдельно от самого движка демо. Автоматического извлечения темы из скриншота у них нет нигде — значит, в этой части мы не воспроизводим чужой продукт, а строим то, чего на рынке пока не видно.

5. **Полный клон окружения (Reprise, Demostack) — на порядок дороже и медленнее в развёртывании**, чем HTML/token-based подход (Storylane, Walnut, Navattic) — данные по ценам вторичные и нуждаются в проверке, но направление (клон дороже конфига) подтверждается независимо несколькими источниками. Это подтверждает выбор архитектуры демо через конфиг темы (`tenant.json` + ссылка), а не через клонирование интерфейса подрядчика.

---

## Ограничения и что осталось непроверенным

- Frontegg — не найдено первоисточника (собственной документации) со списком полей кастомизации; направление 2 по Frontegg **не проработано**.
- Descope — открыт только маркетинговый сайт, не найдена страница документации с конкретным списком branding-полей.
- СБП (Система Быстрых Платежей) и другие узкоспециализированные российские платёжные решения, кроме ЮKassa и Т-Банка, — не проверялись.
- Т-Банк: число параметров взято с маркетинговой (не технической) страницы — `нужна проверка` через документацию для разработчиков.
- Дата "DTCG стабильная версия — октябрь 2025" — взята из вторичного маркетингового блога, не с сайта спецификации DTCG — `нужна проверка`.
- Reprise и Demostack — все данные вторичные (блоги конкурентов, обзорное видео на YouTube), собственная документация/сайт не открывались напрямую — цифры по срокам внедрения и ценам требуют проверки первоисточником.
- Walnut — точные цифры годовой стоимости ($7K–18K) взяты из стороннего YouTube-обзора, не с walnut.io/pricing (там подтверждена только структура тиров и факт наличия функции "Prospect personalization", без итоговых цен).
- Context.dev как источник "styleguide extraction" (shadows, spacing, components) — взят из сравнительного блога, не с сайта context.dev напрямую — `нужна проверка`.
- Не проверялись Firebase Auth UI, Recurly Checkout (styles) в глубину полей, Auth0-конкуренты помимо Okta — открыты частично или не открыты.

---

## Источники

| Источник | URL | Дата обращения |
|---|---|---|
| Stripe — Customize appearance (Checkout) | https://docs.stripe.com/payments/checkout/customization/appearance | 2026-07-27 |
| Stripe — Elements Appearance API | https://docs.stripe.com/elements/appearance-api | 2026-07-27 |
| Stripe — Branding your Stripe account | https://docs.stripe.com/get-started/account/branding | 2026-07-27 |
| Stripe — Customize Checkout (index) | https://docs.stripe.com/payments/checkout/customization | 2026-07-27 |
| Stack Overflow — EmbeddedCheckoutProvider appearance limitation | https://stackoverflow.com/questions/79524839/why-is-there-no-appearance-customization-option-for-stripes-embeddedcheckoutpr | 2026-07-27 |
| Adyen — Hosted Checkout (Themes) | https://docs.adyen.com/standard/integration/hosted-checkout | 2026-07-27 |
| Adyen — Cards Drop-in integration | https://docs.adyen.com/payment-methods/cards/web-drop-in | 2026-07-27 |
| Adyen — Composable Storefront customization guide | https://docs.adyen.com/plugins/salesforce-commerce-cloud/composable-storefront/customization-guide | 2026-07-27 |
| Chargebee — Layout Customization | https://www.chargebee.com/docs/billing/2.0/hosted-capabilities/checkout-layout-customization | 2026-07-27 |
| Paddle — Brand inline checkout | https://developer.paddle.com/build/checkout/brand-customize-inline-checkout | 2026-07-27 |
| Paddle — Self-serve Checkout overview | https://developer.paddle.com/concepts/sell/self-serve-checkout | 2026-07-27 |
| ЮKassa — Widget: Payment form design | https://yookassa.ru/developers/payment-acceptance/integration-scenarios/widget/additional-settings/design | 2026-07-27 |
| ЮKassa — Widget basics | https://yookassa.ru/developers/payment-acceptance/integration-scenarios/widget/basics | 2026-07-27 |
| Т-Банк — интернет-эквайринг | https://www.tbank.ru/business/online-payments/internet-acquiring | 2026-07-27 |
| Auth0 — Customize Universal Login Page Themes | https://auth0.com/docs/customize/login-pages/universal-login/customize-themes | 2026-07-27 |
| Auth0 — Customize Universal Login Page Templates | https://auth0.com/docs/customize/login-pages/universal-login/customize-templates | 2026-07-27 |
| Tessl — Auth0 Branding skill (сторонний, community) | https://tessl.io/registry/skills/github/auth0/agent-skills/auth0-branding | 2026-07-27 |
| Okta — Sign-In Widget overview | https://developer.okta.com/docs/concepts/sign-in-widget | 2026-07-27 |
| Okta — okta-signin-widget GitHub (Brand config) | https://github.com/okta/okta-signin-widget | 2026-07-27 |
| Okta — Understand Sign-In Widget color customization | https://help.okta.com/oie/en-us/content/topics/settings/branding-siw-color-contrast.htm | 2026-07-27 |
| Brandfetch — Getting started | https://docs.brandfetch.com/get-started | 2026-07-27 |
| Brandfetch — Logo API overview | https://docs.brandfetch.com/logo-api/overview | 2026-07-27 |
| AbstractAPI — Post-Clearbit logo API landscape (вторичный) | https://www.abstractapi.com/guides/company-enrichment/best-company-logo-apis | 2026-07-27 |
| Context.dev vs Logo.dev vs Brandfetch comparison (вторичный) | https://www.context.dev/blog/company-logo-api-comparison | 2026-07-27 |
| Style Dictionary — Design Tokens | https://styledictionary.com/info/tokens | 2026-07-27 |
| Design tokens + Style Dictionary practical writeup (вторичный) | https://didoo.medium.com/how-to-manage-your-design-tokens-with-style-dictionary-98c795b938aa | 2026-07-27 |
| Penpot — developer's guide to design tokens and CSS variables | https://penpot.app/blog/the-developers-guide-to-design-tokens-and-css-variables | 2026-07-27 |
| Accessible color tokens WCAG (вторичный блог) | https://www.buildmvpfast.com/blog/accessible-color-systems-design-tokens-wcag-contrast-2026 | 2026-07-27 |
| r/UXDesign — accessibility test for brand colors (мнение практика) | https://www.reddit.com/r/UXDesign/comments/1god906/do_you_do_accessibility_test_when_you_pick_colors | 2026-07-27 |
| Storylane — Personalizing Demos (docs) | https://docs.storylane.io/editing-demos/personalizing-demos | 2026-07-27 |
| Storylane — Live Demos playbook (docs) | https://docs.storylane.io/storylane-playbooks/decision-stage/live-demos | 2026-07-27 |
| Storylane — Alternatives to Walnut/Reprise/Demostack/Navattic (вторичный, конкурент) | https://www.storylane.io/blog/alternatives-to-walnut-reprise-demostack-and-navattic | 2026-07-27 |
| Walnut — Personalized Interactive Demos | https://www.walnut.io/personalized-interactive-demos | 2026-07-27 |
| Walnut — Pricing | https://www.walnut.io/pricing | 2026-07-27 |
| Walnut — Personalize your outreach use case | https://www.walnut.io/use-cases/personalize-your-outreach-with-interactive-demos | 2026-07-27 |
| Navattic — Everything about demo automation (вторичный, конкурент) | https://www.navattic.com/blog/demo-automation | 2026-07-27 |
| Recurly — Hosted payment page | https://docs.recurly.com/recurly-subscriptions/docs/hosted-payment-pages | 2026-07-27 |
