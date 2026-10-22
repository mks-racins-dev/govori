// Frames raw iPhone screenshots into App Store screenshots with a caption on top.
// Output: 1206x2622 (iPhone with Dynamic Island, 6.3").
//
// Usage (needs sharp, see promo.mjs):
//   node screenshots.mjs <folder with 1.png 2.png ...> <output folder>
// Captions are matched by file order; edit CAPTIONS below.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const W = 1206, H = 2622;
const CAPTIONS = [
  ['Случайная тема', 'и одна минута, чтобы высказаться'],
  ['Говорите', 'таймер подскажет, сколько осталось'],
  ['Честный разбор', 'оценка, сильные стороны и советы'],
  ['Без «ну» и «как бы»', 'слова-паразиты видно прямо в тексте'],
  ['Вся история', 'переслушайте себя и услышьте прогресс'],
];

const [inDir, outDir] = process.argv.slice(2);
const files = readdirSync(inDir).filter((f) => /\.(png|jpe?g)$/i.test(f)).sort();

const phoneW = 900;                       // screenshot width inside the frame
const radius = 64, top = 560;
const font = "font-family=\"'Segoe UI', 'Inter', 'Helvetica Neue', Arial, sans-serif\"";

for (const [i, file] of files.entries()) {
  const [title, sub] = CAPTIONS[i] ?? ['Говори!', ''];
  const { data, info } = await sharp(join(inDir, file)).resize({ width: phoneW }).png().toBuffer({ resolveWithObject: true });
  const shotH = info.height;

  // Round the screenshot corners.
  const mask = Buffer.from(`<svg width="${phoneW}" height="${shotH}"><rect width="${phoneW}" height="${shotH}" rx="${radius}" fill="#fff"/></svg>`);
  const rounded = await sharp(data).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();

  const left = (W - phoneW) / 2;
  const bg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect width="${W}" height="${H}" fill="#F2F2F4"/>
    <text ${font} x="${W / 2}" y="250" text-anchor="middle" font-size="96" font-weight="600" letter-spacing="-2" fill="#111111">${title}</text>
    <text ${font} x="${W / 2}" y="350" text-anchor="middle" font-size="46" fill="#8E8E93">${sub}</text>
    <rect x="${left - 14}" y="${top - 14}" width="${phoneW + 28}" height="${shotH + 28}" rx="${radius + 14}" fill="#111111"/>
  </svg>`);

  const name = `screenshot-${i + 1}-${W}x${H}.png`;
  await sharp(bg).composite([{ input: rounded, left, top }]).png().toFile(join(outDir, name));
  console.log(name);
}
