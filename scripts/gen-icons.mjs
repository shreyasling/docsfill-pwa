// Generates the PNG app icons from a simple procedural "document" glyph so the
// PWA is installable without committing binary assets. Run: npm run gen:icons
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, '../public/icons');
mkdirSync(outDir, { recursive: true });

const BRAND = [37, 99, 235]; // #2563eb
const BRAND_DK = [29, 78, 216]; // #1d4ed8
const WHITE = [255, 255, 255];

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function drawIcon(size, maskable) {
  const buf = Buffer.alloc(size * size * 4);
  const radius = maskable ? 0 : size * 0.22;
  // Document geometry (smaller safe zone for maskable icons).
  const inset = maskable ? size * 0.22 : size * 0.28;
  const dw = size - inset * 2;
  const dh = dw * 1.24;
  const dx = (size - dw) / 2;
  const dy = (size - dh) / 2;
  const fold = dw * 0.32;

  const put = (i, [r, g, b], a = 255) => {
    buf[i] = r;
    buf[i + 1] = g;
    buf[i + 2] = b;
    buf[i + 3] = a;
  };

  const inRounded = (x, y) => {
    if (radius <= 0) return true;
    const rx = Math.min(x, size - 1 - x);
    const ry = Math.min(y, size - 1 - y);
    if (rx >= radius || ry >= radius) return true;
    const ddx = radius - rx;
    const ddy = radius - ry;
    return ddx * ddx + ddy * ddy <= radius * radius;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      if (!inRounded(x, y)) {
        put(i, WHITE, 0); // transparent outside rounded square
        continue;
      }
      put(i, BRAND);

      const insideDoc = x >= dx && x <= dx + dw && y >= dy && y <= dy + dh;
      if (insideDoc) {
        const u = x - (dx + dw - fold);
        const v = y - dy;
        const inCornerBox = u >= 0 && v >= 0 && v <= fold;
        if (inCornerBox && u + v > fold) {
          // cut corner -> show background (folded page look)
          put(i, BRAND);
        } else if (inCornerBox && u + v > fold - size * 0.02) {
          put(i, BRAND_DK); // fold edge
        } else {
          put(i, WHITE);
          // three "text" lines + a check bar accent
          const lineH = size * 0.035;
          const lx0 = dx + dw * 0.18;
          const lx1 = dx + dw * 0.82;
          const rows = [0.5, 0.62, 0.74].map((f) => dy + dh * f);
          for (const ry of rows) {
            if (y >= ry && y <= ry + lineH && x >= lx0 && x <= lx1) put(i, BRAND);
          }
        }
      }
    }
  }
  return buf;
}

function write(name, size, maskable) {
  const png = encodePng(size, size, drawIcon(size, maskable));
  writeFileSync(resolve(outDir, name), png);
  console.log('wrote', name, `${size}x${size}`);
}

write('icon-192.png', 192, false);
write('icon-512.png', 512, false);
write('maskable-512.png', 512, true);

// apple-touch-icon lives at public root
writeFileSync(
  resolve(__dirname, '../public/apple-touch-icon.png'),
  encodePng(180, 180, drawIcon(180, true)),
);
console.log('wrote apple-touch-icon.png 180x180');
