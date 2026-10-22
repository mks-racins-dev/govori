import sharp from 'sharp';
const out = process.argv[2];

// One layout, expressed in units of 1% of the height, adapted to each aspect ratio.
function svg(w, h, { headline = ['Минута', 'на любую тему.'], card = true } = {}) {
  const u = h / 100;
  const narrow = w / h < 2;
  const r = (narrow ? 23 : 27) * u, sw = 2.4 * u;
  const cx = narrow ? w - r - 16 * u : w * 0.70, cy = h * 0.45;
  const leftX = Math.max(w * 0.08, 8 * u);
  // Headline shrinks so its longest line ends before the ring (≈0.55em per glyph in Segoe UI semibold).
  const room = cx - r - leftX - 6 * u;
  const hs = Math.min(10.5 * u, room / (Math.max(...headline.map((l) => l.length)) * 0.55));
  const ss = Math.min(3.6 * u, hs * 0.36);
  const cardW = 36 * u, cardH = 27 * u;
  const cardX = Math.min(cx + 4 * u, w - cardW - 5 * u), cardY = cy + 9 * u;
  const font = "font-family=\"'Segoe UI', 'Inter', 'Helvetica Neue', Arial, sans-serif\"";
  const arcStart = `${cx} ${cy - r}`, arcEnd = `${cx - r} ${cy}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <radialGradient id="glow" cx="${cx / w}" cy="${cy / h}" r="0.55">
      <stop offset="0" stop-color="#1E2430"/><stop offset="1" stop-color="#111111"/>
    </radialGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="160%">
      <feDropShadow dx="0" dy="${1.2 * u}" stdDeviation="${2 * u}" flood-color="#000" flood-opacity="0.45"/>
    </filter>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#glow)"/>

  <text ${font} fill="#FFFFFF" font-weight="600" font-size="${hs}" letter-spacing="${-hs * 0.033}">
    <tspan x="${leftX}" y="${h * 0.44}">${headline[0]}</tspan>
    <tspan x="${leftX}" y="${h * 0.44 + hs * 1.15}">${headline[1]}</tspan>
  </text>
  <text ${font} fill="#8E8E93" font-size="${ss}" x="${leftX}" y="${h * 0.44 + hs * 1.15 + ss * 3}">Случайная тема · 60 секунд · разбор от ИИ</text>

  <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#2C2C2E" stroke-width="${sw}"/>
  <path d="M${arcStart} A${r} ${r} 0 1 1 ${arcEnd}" fill="none" stroke="#7D9CD3" stroke-width="${sw}" stroke-linecap="round"/>
  <g transform="translate(${cx} ${cy}) scale(${u * 0.11})">
    <rect x="-60" y="-156" width="120" height="200" rx="60" fill="#FFFFFF"/>
    <path d="M-120 -12 a120 120 0 0 0 240 0" fill="none" stroke="#FFFFFF" stroke-width="30" stroke-linecap="round"/>
    <path d="M0 108 v56 M-50 164 h100" fill="none" stroke="#FFFFFF" stroke-width="30" stroke-linecap="round"/>
  </g>

  ${card ? `<g filter="url(#shadow)">
    <rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" rx="${3.4 * u}" fill="#FFFFFF"/>
  </g>
  <text ${font} x="${cardX + 3 * u}" y="${cardY + 5.6 * u}" font-size="${1.8 * u}" font-weight="600" letter-spacing="${0.3 * u}" fill="#8E8E93">РАЗБОР</text>
  <text ${font} x="${cardX + 3 * u}" y="${cardY + 14.5 * u}" font-size="${9 * u}" font-weight="600" fill="#111111">7<tspan font-size="${3.2 * u}" fill="#C7C7CC" font-weight="500">/10</tspan></text>
  ${[['Структура', 0.8], ['По теме', 0.9], ['Плавность', 0.6]].map(([label, v], i) => {
    const y = cardY + 18.5 * u + i * 3 * u, bx = cardX + 14 * u, bw = cardW - 17 * u;
    return `<text ${font} x="${cardX + 3 * u}" y="${y + 0.7 * u}" font-size="${1.9 * u}" fill="#111111">${label}</text>
    <rect x="${bx}" y="${y - 0.4 * u}" width="${bw}" height="${0.8 * u}" rx="${0.4 * u}" fill="#F2F2F4"/>
    <rect x="${bx}" y="${y - 0.4 * u}" width="${bw * v}" height="${0.8 * u}" rx="${0.4 * u}" fill="#111111"/>`;
  }).join('')}` : ''}
</svg>`;
}

const jobs = [
  ['header-5244x2950', 5244, 2950],
  ['header-3840x1646', 3840, 1646],
  ['search-5244x2950', 5244, 2950],
  ['search-3840x2560', 3840, 2560],
  ['search-1920x1280', 1920, 1280],
];
for (const [name, w, h] of jobs) {
  await sharp(Buffer.from(svg(w, h))).png().toFile(`${out}/${name}.png`);
  console.log(name, 'ok');
}
