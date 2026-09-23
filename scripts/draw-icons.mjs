import { Buffer } from "node:buffer";
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const iconsDir = resolve(dirname(fileURLToPath(import.meta.url)), "../icons");

const background = [49, 36, 31, 255];
const opening = [24, 17, 15, 255];
const stone = [236, 224, 208, 255];
const ember = [214, 122, 72, 255];

const arch = { x: 0.5, y: 0.47, radius: 0.17 };
const left = 0.33;
const right = 0.67;
const baseY = 0.72;
const stroke = 0.058;
const shelf = { left: 0.27, right: 0.73, y: 0.76 };

function crc32(buffer) {
  let crc = ~0;
  for (let index = 0; index < buffer.length; index += 1) {
    crc ^= buffer[index];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type), data]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, checksum]);
}

function encodePng(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    rgba.copy(raw, row + 1, y * size * 4, (y + 1) * size * 4);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function distToSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const length = abx * abx + aby * aby;
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / length));
  return Math.hypot(px - (ax + abx * t), py - (ay + aby * t));
}

function insideRoundedRect(x, y) {
  const leftEdge = 0.05;
  const topEdge = 0.05;
  const size = 0.9;
  const radius = 0.2;
  const nearestX = Math.min(Math.max(x, leftEdge + radius), leftEdge + size - radius);
  const nearestY = Math.min(Math.max(y, topEdge + radius), topEdge + size - radius);
  return (x - nearestX) ** 2 + (y - nearestY) ** 2 <= radius ** 2;
}

function colorAt(x, y) {
  if (!insideRoundedRect(x, y)) return [0, 0, 0, 0];
  const dx = x - arch.x;
  const dy = y - arch.y;
  const distance = Math.hypot(dx, dy);
  const inArch = dy <= 0 && distance < arch.radius - stroke * 0.28;
  const inBody = x > left + stroke * 0.28 && x < right - stroke * 0.28 && y >= arch.y && y < baseY - stroke * 0.15;
  let color = inArch || inBody ? opening : background;
  const archDistance = dy <= 0 ? Math.abs(distance - arch.radius) : Math.min(
    Math.hypot(x - (arch.x - arch.radius), y - arch.y),
    Math.hypot(x - (arch.x + arch.radius), y - arch.y),
  );
  const strokeDistance = Math.min(
    archDistance,
    distToSegment(x, y, left, arch.y, left, baseY),
    distToSegment(x, y, right, arch.y, right, baseY),
    distToSegment(x, y, left, baseY, right, baseY),
    distToSegment(x, y, shelf.left, shelf.y, shelf.right, shelf.y),
  );
  if (strokeDistance <= stroke / 2) color = stone;
  const emberX = (x - 0.5) / 0.065;
  const emberY = (y - 0.63) / 0.042;
  if (emberX * emberX + emberY * emberY <= 1) color = ember;
  return color;
}

function render(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const samples = 4;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let red = 0;
      let green = 0;
      let blue = 0;
      let alpha = 0;
      for (let sampleY = 0; sampleY < samples; sampleY += 1) {
        for (let sampleX = 0; sampleX < samples; sampleX += 1) {
          const color = colorAt((x + (sampleX + 0.5) / samples) / size, (y + (sampleY + 0.5) / samples) / size);
          red += color[0];
          green += color[1];
          blue += color[2];
          alpha += color[3];
        }
      }
      const count = samples * samples;
      const pixel = (y * size + x) * 4;
      rgba[pixel] = Math.round(red / count);
      rgba[pixel + 1] = Math.round(green / count);
      rgba[pixel + 2] = Math.round(blue / count);
      rgba[pixel + 3] = Math.round(alpha / count);
    }
  }
  return encodePng(size, rgba);
}

mkdirSync(iconsDir, { recursive: true });
for (const size of [16, 32, 48, 128]) {
  writeFileSync(resolve(iconsDir, `icon${size}.png`), render(size));
}
