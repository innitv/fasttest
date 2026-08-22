import { inflateSync } from "node:zlib";

/**
 * Чтение отдельных пикселей из PNG-скриншота Playwright — без зависимостей.
 *
 * Зачем вообще пиксели. Требование «системные зоны белые, серому взяться
 * неоткуда» проверяется по отрисованному кадру, а не по CSS: канву за боксом
 * страницы браузер красит по своим правилам распространения фона, и чтение
 * объявленных свойств пересказало бы намерение вместо результата. Пиксель
 * кадра — независимый источник: он показывает, что реально увидел бы глаз.
 * Используется проверкой 1 в `mobile.check.mjs`.
 *
 * Поддержан ровно тот формат, который отдаёт Playwright: 8 бит на канал,
 * RGB или RGBA, без чересстрочности.
 */

const SIGNATURE = "89504e470d0a1a0a";

export function decodePng(buffer) {
  if (buffer.subarray(0, 8).toString("hex") !== SIGNATURE) {
    throw new Error("PNG: неверная сигнатура файла");
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const chunks = [];

  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      if (data[12] !== 0) throw new Error("PNG: чересстрочный формат не поддержан");
    } else if (type === "IDAT") {
      chunks.push(data);
    } else if (type === "IEND") {
      break;
    }

    offset += 12 + length;
  }

  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) {
    throw new Error(`PNG: не поддержан формат bitDepth=${bitDepth}, colorType=${colorType}`);
  }

  const channels = colorType === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(chunks));
  const stride = width * channels;
  const pixels = Buffer.alloc(height * stride);

  // Расфильтровка построчно (PNG spec §9): каждая строка несёт код фильтра,
  // ссылающийся на левый пиксель (a), верхний (b) и верхне-левый (c).
  let pos = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[pos];
    pos += 1;
    const line = raw.subarray(pos, pos + stride);
    pos += stride;

    const current = pixels.subarray(y * stride, (y + 1) * stride);
    const previous = y > 0 ? pixels.subarray((y - 1) * stride, y * stride) : null;

    for (let i = 0; i < stride; i += 1) {
      const a = i >= channels ? current[i - channels] : 0;
      const b = previous ? previous[i] : 0;
      const c = i >= channels && previous ? previous[i - channels] : 0;
      const x = line[i];
      let value;

      switch (filter) {
        case 0:
          value = x;
          break;
        case 1:
          value = x + a;
          break;
        case 2:
          value = x + b;
          break;
        case 3:
          value = x + ((a + b) >> 1);
          break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          value = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          break;
        }
        default:
          throw new Error(`PNG: неизвестный код фильтра ${filter}`);
      }

      current[i] = value & 0xff;
    }
  }

  return { width, height, channels, pixels };
}

/** Цвет пикселя как [r, g, b]. Координаты — в пикселях изображения. */
export function pixelAt(png, x, y) {
  const index = y * png.width * png.channels + x * png.channels;
  return [png.pixels[index], png.pixels[index + 1], png.pixels[index + 2]];
}

/** Средний цвет всего изображения — устойчив к субпиксельному сглаживанию. */
export function averageColor(png) {
  const total = [0, 0, 0];
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const [r, g, b] = pixelAt(png, x, y);
      total[0] += r;
      total[1] += g;
      total[2] += b;
    }
  }
  const count = png.width * png.height;
  return total.map((sum) => Math.round(sum / count));
}

/** Любая сериализация CSS-цвета из computed style → [r, g, b]. */
export function parseRgb(value) {
  const match = String(value).match(/rgba?\(([^)]*)\)/);
  if (!match) return null;
  const parts = match[1]
    .replace("/", " ")
    .split(/[,\s]+/)
    .filter(Boolean)
    .map(Number);
  if (parts.length < 3 || parts.slice(0, 3).some(Number.isNaN)) return null;
  return parts.slice(0, 3);
}

/** Совпадение цветов с допуском по каналу (сглаживание, шаг градиента). */
export function sameColor(left, right, tolerance = 6) {
  if (!left || !right) return false;
  return left.every((value, index) => Math.abs(value - right[index]) <= tolerance);
}

export const formatRgb = (color) => (color ? `rgb(${color.join(", ")})` : "—");
