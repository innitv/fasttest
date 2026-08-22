/*
 * Снятие страницы донора: обход целиком, измерение вместо глазомера.
 *
 * ЭТОТ ФАЙЛ — ИСТОЧНИК ПРАВДЫ И ОДНОВРЕМЕННО СНИППЕТ. Его можно
 * скормить Playwright (`yarn donor:snap`), а можно вставить целиком в консоль
 * браузера владельца — второе нужно чаще, чем кажется: у половины доноров
 * чекаут не отдаётся гостю, и живая сессия есть только в его Chrome.
 *
 * ── Зачем файл вместо скрипта «по случаю» ─────────────────────────────
 *
 * Тем заведено 13, и каждый раз скрипт снятия писался заново и удалялся по
 * правилу об уборке. Вместе с ним каждый раз терялись уроки, купленные
 * переделками:
 *   - контент донора бывает в shadow DOM (Tripster) — обход `document.body`
 *     видит пустую страницу, и её принимают за неотрисованную;
 *   - мерить надо КОНТЕЙНЕРЫ, а не текстовые узлы: вид держат рамки и
 *     карточки, а обход по тексту их не видит;
 *   - гарнитуру снимать с узлов ЗОНЫ, а не с `body`, и отдельно для
 *     кириллицы и латиницы — они приходят из разных шрифтов стека;
 *   - веса нужны фактические: браузер молча синтезирует полужирный из
 *     Regular, и «шрифт подключён» об этом не говорит;
 *   - сходство проверяется накопленной координатой низа, а не зазорами:
 *     совпадение всех зазоров ничего не доказывает (диагнозы 10-12, 16).
 *
 * ── Как пользоваться в консоли ────────────────────────────────────────
 *
 *   donorProbe()                       // сводка: профиль страницы и шрифты
 *   donorProbe({ mode: "full" })       // все узлы с метриками
 *   donorProbe({ mode: "full", chunk: 0 })  // тот же дамп кусками по 1200 симв.
 *   donorProbe({ selector: "main" })   // поддерево вместо всей страницы
 *
 * Канал `claude-in-chrome` режет вывод примерно на 1200 символах и блокирует
 * ответ с query-строками — отсюда `chunk` и обрезка `?…` у ссылок на ассеты.
 */
(function () {
  const PROPS = [
    "display", "position", "fontFamily", "fontSize", "fontWeight", "lineHeight",
    "letterSpacing", "color", "backgroundColor", "backgroundImage", "borderRadius",
    "borderTopWidth", "borderColor", "paddingTop", "paddingRight", "paddingBottom",
    "paddingLeft", "marginTop", "marginBottom", "gap", "boxShadow", "textTransform",
  ];

  const CYRILLIC = /[А-Яа-яЁё]/;
  const LATIN = /[A-Za-z]/;

  /** Обход включает shadowRoot: иначе микрофронтенд выглядит пустой страницей. */
  function collect(root, out) {
    const walk = (node) => {
      if (!(node instanceof Element)) return;
      out.push(node);
      if (node.shadowRoot) for (const child of node.shadowRoot.children) walk(child);
      for (const child of node.children) walk(child);
    };
    if (root instanceof Element) walk(root);
    else for (const child of root.children) walk(child);
    return out;
  }

  /** Какой ФАКТИЧЕСКИ шрифт рисует эту строку: первый из стека, покрывающий её. */
  function actualFamily(stack, size, weight, sample) {
    if (!sample) return null;
    for (const raw of String(stack).split(",")) {
      const family = raw.trim().replace(/^["']|["']$/g, "");
      try {
        if (document.fonts.check(`${weight} ${size}px "${family}"`, sample)) return family;
      } catch {
        /* Семейство с недопустимым для check именем — пропускаем, а не падаем. */
      }
    }
    return null;
  }

  function metrics(node) {
    const box = node.getBoundingClientRect();
    if (box.width < 1 || box.height < 1) return null;
    const cs = getComputedStyle(node);
    if (cs.visibility === "hidden" || cs.display === "none") return null;

    const own = [...node.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join(" ")
      .slice(0, 80);

    const style = {};
    for (const p of PROPS) {
      const v = cs[p];
      if (v && v !== "none" && v !== "normal" && v !== "0px" && v !== "rgba(0, 0, 0, 0)") style[p] = v;
    }
    if (style.backgroundImage) style.backgroundImage = style.backgroundImage.split("?")[0];

    const size = parseFloat(cs.fontSize) || 16;
    const fonts = {};
    if (own) {
      if (CYRILLIC.test(own)) fonts.cyrillic = actualFamily(cs.fontFamily, size, cs.fontWeight, own.match(/[А-Яа-яЁё][^]{0,10}/)[0]);
      if (LATIN.test(own)) fonts.latin = actualFamily(cs.fontFamily, size, cs.fontWeight, own.match(/[A-Za-z][^]{0,10}/)[0]);
    }

    return {
      tag: node.tagName.toLowerCase(),
      id: node.id || undefined,
      cls: (node.getAttribute("class") || "").split(/\s+/).filter(Boolean).slice(0, 2).join(" ") || undefined,
      x: Math.round(box.x),
      y: Math.round(box.y + window.scrollY),
      w: Math.round(box.width),
      h: Math.round(box.height),
      bottom: Math.round(box.bottom + window.scrollY),
      text: own || undefined,
      fonts: Object.keys(fonts).length ? fonts : undefined,
      style,
      shadow: node.getRootNode() instanceof ShadowRoot || undefined,
    };
  }

  function loadedFaces() {
    const faces = [];
    document.fonts.forEach((f) => {
      if (f.status === "loaded") faces.push(`${f.family} ${String(f.weight).trim()} ${f.style}`);
    });
    return [...new Set(faces)].sort();
  }

  /**
   * Веса, которые страница ПРОСИТ у своих узлов. Расхождение с загруженными —
   * это и есть синтетический жир, который не видно ни в одной проверке
   * «шрифт подключён».
   */
  function requestedWeights(nodes) {
    const asked = new Set();
    for (const node of nodes) {
      const text = [...node.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!text) continue;
      const cs = getComputedStyle(node);
      asked.add(`${cs.fontFamily.split(",")[0].replace(/["']/g, "").trim()} ${cs.fontWeight}`);
    }
    return [...asked].sort();
  }

  /** Профиль страницы: секции верхнего уровня с высотами и накопленным низом. */
  function outline(nodes) {
    return nodes
      .map(metrics)
      .filter(Boolean)
      .filter((m) => m.w >= 200 && m.h >= 24)
      .filter((m, i, all) => !all.some((o, j) => j !== i && o.y <= m.y && o.bottom >= m.bottom && o.h < m.h * 1.02 && j < i))
      .slice(0, 60)
      .map((m) => `${m.y}→${m.bottom} h${m.h} ${m.tag}${m.cls ? "." + m.cls.split(" ")[0] : ""} ${m.text ? "«" + m.text.slice(0, 28) + "»" : ""}`.trim());
  }

  window.donorProbe = function donorProbe(options) {
    const opts = options || {};
    const root = opts.selector ? document.querySelector(opts.selector) : document.body;
    if (!root) return `узел ${opts.selector} не найден`;

    const nodes = collect(root, []);
    const shadowHosts = nodes.filter((n) => n.shadowRoot).length;

    if (opts.mode !== "full") {
      const summary = {
        url: location.href.split("?")[0],
        viewport: `${innerWidth}×${innerHeight}`,
        узлов: nodes.length,
        shadowHosts,
        высотаСтраницы: Math.round(document.documentElement.scrollHeight),
        загруженныеНачертания: loadedFaces(),
        запрошенныеВеса: requestedWeights(nodes).slice(0, 24),
        профиль: outline(nodes),
      };
      return JSON.stringify(summary, null, 1);
    }

    const full = JSON.stringify(nodes.map(metrics).filter(Boolean));
    if (typeof opts.chunk !== "number") return full;
    const size = opts.chunkSize || 1200;
    const total = Math.ceil(full.length / size);
    return `[${opts.chunk + 1}/${total}] ${full.slice(opts.chunk * size, (opts.chunk + 1) * size)}`;
  };

  return typeof donorProbeAutorun === "undefined" ? "donorProbe() готов" : window.donorProbe();
})();
