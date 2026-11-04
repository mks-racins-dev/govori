// Bold App Store header artwork: headline on the left, three tilted iPhones on the right.
// Output: header-5244x2950.png and header-3840x1646.png
//
// Usage (needs sharp):
//   node mock-screens.mjs raw
//   node header-bold.mjs raw .
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const [inDir, outDir] = process.argv.slice(2);
const files = readdirSync(inDir).filter((f) => /\.(png|jpe?g)$/i.test(f)).sort();
const font = "font-family=\"'Segoe UI Black', 'Segoe UI', 'Inter', 'Helvetica Neue', Arial, sans-serif\"";

async function phone(file, screenW) {
  const bezel = Math.round(screenW * 0.035), r = Math.round(screenW * 0.13);
  const { data, info } = await sharp(file).resize({ width: screenW }).png().toBuffer({ resolveWithObject: true });
  const sh = info.height, pw = screenW + bezel * 2, ph = sh + bezel * 2;
  const mask = Buffer.from(`<svg width="${screenW}" height="${sh}"><rect width="${screenW}" height="${sh}" rx="${r - bezel}" fill="#fff"/></svg>`);
  const screen = await sharp(data).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
  const iw = screenW * 0.3, ih = screenW * 0.085;
  const body = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${pw}" height="${ph}">
    <rect width="${pw}" height="${ph}" rx="${r}" fill="#1C1C1E"/>
    <rect x="3" y="3" width="${pw - 6}" height="${ph - 6}" rx="${r - 3}" fill="#0A0A0A"/></svg>`);
  const island = Buffer.from(`<svg width="${pw}" height="${ph}"><rect x="${(pw - iw) / 2}" y="${bezel + screenW * 0.03}" width="${iw}" height="${ih}" rx="${ih / 2}" fill="#000"/></svg>`);
  return sharp(body).composite([{ input: screen, left: bezel, top: bezel }, { input: island }]).png().toBuffer();
}

// Place an image on the canvas, cropping whatever falls outside it.
async function place(buf, left, top, W, H) {
  const m = await sharp(buf).metadata();
  const cl = Math.max(0, -left), ct = Math.max(0, -top);
  const w = Math.min(m.width - cl, W - Math.max(0, left)), h = Math.min(m.height - ct, H - Math.max(0, top));
  return { input: await sharp(buf).extract({ left: cl, top: ct, width: w, height: h }).toBuffer(), left: Math.max(0, left), top: Math.max(0, top) };
}

async function render(W, H) {
  const u = H / 100;
  const wide = W / H > 2;
  const hs = (wide ? 17 : 15) * u;
  const leftX = (wide ? 7 : 6) * u * (W / H) / 1.78;
  const bg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9DB8EC"/><stop offset="1" stop-color="#4E70BC"/></linearGradient>
      <filter id="s"><feDropShadow dx="0" dy="${0.5 * u}" stdDeviation="${0.7 * u}" flood-color="#000" flood-opacity="0.18"/></filter>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#g)"/>
    <circle cx="${W * 0.72}" cy="${H * 0.5}" r="${60 * u}" fill="#fff" opacity="0.10"/>
    <circle cx="${W * 0.05}" cy="${H * 1.05}" r="${45 * u}" fill="#fff" opacity="0.07"/>
    <g filter="url(#s)" ${font} fill="#fff">
      <text x="${leftX}" y="${H * 0.42}" font-weight="900" font-size="${hs}" letter-spacing="${-hs * 0.03}">Говори!</text>
      <text x="${leftX}" y="${H * 0.42 + hs * 0.75}" font-weight="700" font-size="${hs * 0.42}">Минута речи</text>
      <text x="${leftX}" y="${H * 0.42 + hs * 0.75 + hs * 0.5}" font-weight="700" font-size="${hs * 0.42}">и честный разбор</text>
    </g>
  </svg>`);

  // Three phones fanned out on the right; middle one in front.
  const screenW = Math.round(H * (wide ? 0.36 : 0.3));
  const centre = W * (wide ? 0.7 : 0.68);
  const spread = screenW * 0.95;
  const layout = [
    { file: files[2], dx: -spread, dy: 0.2, a: -10 },
    { file: files[4], dx: spread, dy: 0.2, a: 10 },
    { file: files[0], dx: 0, dy: 0.1, a: 0 },
  ];
  const layers = [];
  for (const p of layout) {
    const flat = await phone(join(inDir, p.file), screenW);
    const fm = await sharp(flat).metadata();
    const pad = Math.round(6 * u), cw = fm.width + pad * 2, ch = fm.height + pad * 2;
    const rot = (buf) => sharp(buf).rotate(p.a, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    const img = await rot(await sharp({ create: { width: cw, height: ch, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: flat, left: pad, top: pad }]).png().toBuffer());
    const shadow = await rot(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${cw}" height="${ch}">
      <filter id="b"><feGaussianBlur stdDeviation="${2 * u}"/></filter>
      <rect x="${pad}" y="${pad}" width="${fm.width}" height="${fm.height}" rx="${screenW * 0.13}" fill="#000" opacity="0.35" filter="url(#b)"/></svg>`));
    const m = await sharp(img).metadata();
    const left = Math.round(centre + p.dx - m.width / 2), top = Math.round(H * p.dy) - pad;
    layers.push(await place(shadow, left, top + Math.round(1.5 * u), W, H), await place(img, left, top, W, H));
  }
  return sharp(bg).composite(layers).png();
}

for (const [W, H] of [[5244, 2950], [3840, 1646]]) {
  await (await render(W, H)).toFile(join(outDir, `header-${W}x${H}.png`));
  console.log(`header-${W}x${H}.png`);
}
