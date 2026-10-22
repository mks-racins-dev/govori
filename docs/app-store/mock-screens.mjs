// Draws faithful vector recreations of the app's screens at iPhone 6.3" resolution (1206x2622),
// to be framed by screenshots.mjs. Coordinates are in points (402x874), scaled x3.
//   node mock-screens.mjs <output folder>
import sharp from 'sharp';

const out = process.argv[2];
const C = { bg: '#F2F2F4', ink: '#111111', muted: '#8E8E93', faint: '#C7C7CC', line: '#E5E5EA', accent: '#7D9CD3', white: '#FFFFFF' };
const F = "font-family=\"'Segoe UI', 'Inter', 'Helvetica Neue', Arial, sans-serif\"";

const text = (x, y, s, size, { w = 400, fill = C.ink, anchor = 'start', ls = 0 } = {}) =>
  `<text ${F} x="${x}" y="${y}" font-size="${size}" font-weight="${w}" fill="${fill}" text-anchor="${anchor}" letter-spacing="${ls}">${s}</text>`;
const lines = (x, y, arr, size, lh, opts) => arr.map((s, i) => text(x, y + i * lh, s, size, opts)).join('');
const card = (x, y, w, h, fill = C.white, r = 28) =>
  `<rect x="${x}" y="${y + 3}" width="${w}" height="${h}" rx="${r}" fill="#000" opacity="0.04"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"/>`;
const pill = (x, y, w, h, label, { dark = true } = {}) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${dark ? C.ink : C.white}" stroke="${dark ? 'none' : C.line}"/>` +
  text(x + w / 2, y + h / 2 + 5.5, label, 16, { w: 600, fill: dark ? C.white : C.ink, anchor: 'middle' });
const badge = (cx, y, label, { fill = C.fill ?? '#F2F2F4', color = C.ink } = {}) => {
  const w = label.length * 7.4 + 22;
  return `<rect x="${cx - w / 2}" y="${y}" width="${w}" height="20" rx="10" fill="${fill}"/>` +
    text(cx, y + 14, label, 10, { w: 700, fill: color, anchor: 'middle', ls: 1.8 });
};
const mic = (cx, cy, s, color = C.white) => `<g transform="translate(${cx} ${cy}) scale(${s})">
  <rect x="-60" y="-156" width="120" height="200" rx="60" fill="${color}"/>
  <path d="M-120 -12 a120 120 0 0 0 240 0" fill="none" stroke="${color}" stroke-width="30" stroke-linecap="round"/>
  <path d="M0 108 v56 M-50 164 h100" fill="none" stroke="${color}" stroke-width="30" stroke-linecap="round"/></g>`;
const bars = (cx, cy, n, h, seed, { split = 1, bw = 3, gap = 3 } = {}) => {
  let s = seed, out = '';
  const total = n * bw + (n - 1) * gap;
  for (let i = 0; i < n; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const v = Math.max(0.12, ((s >> 16) & 0xff) / 255 * (0.4 + 0.6 * Math.sin((i / n) * Math.PI)));
    const bh = Math.max(3, v * h);
    out += `<rect x="${cx - total / 2 + i * (bw + gap)}" y="${cy - bh / 2}" width="${bw}" height="${bh}" rx="${bw / 2}" fill="${i < n * split ? C.ink : C.faint}"/>`;
  }
  return out;
};
const statusBar = () => text(52, 34, '9:41', 16, { w: 600 }) +
  `<rect x="141" y="11" width="120" height="35" rx="17.5" fill="#000"/>` +
  `<g fill="${C.ink}"><rect x="306" y="27" width="3" height="5" rx="1"/><rect x="311" y="24" width="3" height="8" rx="1"/><rect x="316" y="21" width="3" height="11" rx="1"/><rect x="321" y="18" width="3" height="14" rx="1"/>
   <rect x="336" y="19" width="24" height="12" rx="3.5" fill="none" stroke="${C.ink}" stroke-width="1.2"/><rect x="338" y="21" width="18" height="8" rx="2"/></g>`;
const back = (y = 62) => `<circle cx="40" cy="${y + 20}" r="20" fill="${C.white}"/><path d="M43 ${y + 13} l-7 7 7 7" fill="none" stroke="${C.ink}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
const screen = (body) => `<svg xmlns="http://www.w3.org/2000/svg" width="1206" height="2622"><g transform="scale(3)">
  <rect width="402" height="874" fill="${C.bg}"/>${statusBar()}${body}
  <rect x="134" y="860" width="134" height="5" rx="2.5" fill="${C.ink}"/></g></svg>`;

const screens = {
  // 1. Topic
  topic: screen(`${back()}
    ${card(20, 190, 362, 430)}
    <path d="M48 190 h306 a28 28 0 0 1 28 28 v132 h-362 v-132 a28 28 0 0 1 28 -28z" fill="${C.ink}"/>
    ${mic(201, 280, 0.28)}
    ${badge(201, 380, 'ЮМОР')}
    ${lines(201, 438, ['Если бы вы стали', 'президентом', 'на один час'], 26, 33, { w: 600, anchor: 'middle', ls: -0.6 })}
    <rect x="44" y="548" width="314" height="2" fill="${C.line}"/><rect x="44" y="548" width="126" height="2" fill="${C.ink}"/>
    ${text(201, 580, 'Запись начнётся через 6', 13, { fill: C.muted, anchor: 'middle' })}
    ${text(201, 660, '⇄  Другая тема · 2', 14, { w: 500, fill: C.muted, anchor: 'middle' })}
    ${pill(20, 780, 362, 54, 'Начать запись')}`),

  // 2. Recording
  record: screen(`
    <circle cx="146" cy="112" r="4" fill="#E5484D"/>${text(158, 116, 'ГОВОРИТЕ!', 11, { w: 600, ls: 1.6 })}
    ${lines(201, 156, ['Если бы вы стали президентом', 'на один час'], 24, 30, { w: 600, anchor: 'middle', ls: -0.6 })}
    <circle cx="201" cy="380" r="128" fill="none" stroke="${C.line}" stroke-width="3"/>
    <circle cx="201" cy="380" r="128" fill="none" stroke="${C.ink}" stroke-width="3" stroke-linecap="round"
      stroke-dasharray="804" stroke-dashoffset="${804 * 0.7}" transform="rotate(-90 201 380)"/>
    ${text(201, 400, '00:42', 56, { w: 500, anchor: 'middle', ls: -2 })}
    ${bars(201, 590, 32, 72, 7, { split: 1 })}
    ${pill(20, 760, 362, 54, 'Закончить')}`),

  // 3. Result
  result: screen(`${back()}${text(201, 88, 'Разбор', 18, { w: 600, anchor: 'middle' })}
    <circle cx="362" cy="82" r="10" fill="none"/>
    ${card(20, 118, 362, 330)}
    ${badge(201, 146, 'ЖИЗНЬ')}
    ${lines(201, 200, ['Самый важный урок, который', 'вы получили в детстве'], 22, 28, { w: 600, anchor: 'middle', ls: -0.5 })}
    ${text(201, 252, '22 октября', 13, { fill: C.muted, anchor: 'middle' })}
    ${text(196, 336, '7', 72, { w: 600, anchor: 'end', ls: -3 })}${text(200, 336, '/10', 20, { w: 500, fill: C.faint })}
    ${lines(201, 376, ['Цельная история с понятным выводом.', 'Мешают паразиты в начале и в финале.'], 14, 21, { fill: C.muted, anchor: 'middle' })}
    ${card(20, 464, 362, 92)}
    <circle cx="68" cy="510" r="24" fill="${C.ink}"/><path d="M63 499 v22 l17 -11z" fill="#fff"/>
    ${bars(222, 502, 34, 34, 3, { split: 0.35, bw: 2.5, gap: 2.5 })}
    ${text(108, 538, '00:12', 12, { w: 500, fill: C.muted })}${text(356, 538, '00:35', 12, { w: 500, fill: C.muted, anchor: 'end' })}
    ${card(20, 572, 362, 210)}
    ${[['Структура', 8], ['По теме', 9], ['Словарь', 6], ['Плавность', 6], ['Темп', 8]].map(([l, v], i) => {
      const y = 610 + i * 36;
      return text(44, y + 5, l, 13) + `<rect x="130" y="${y - 2}" width="200" height="4" rx="2" fill="${C.bg}"/><rect x="130" y="${y - 2}" width="${v * 20}" height="4" rx="2" fill="${C.ink}"/>` + text(356, y + 5, String(v), 14, { w: 600, anchor: 'end' });
    }).join('')}`),

  // 4. Feedback
  feedback: screen(`${back()}${text(201, 88, 'Разбор', 18, { w: 600, anchor: 'middle' })}
    ${card(20, 118, 362, 252)}
    ${text(44, 150, 'ЧТО ПОЛУЧИЛОСЬ', 11, { w: 600, fill: C.muted, ls: 1.6 })}
    ${[['Сразу назвали главную мысль —', '«доводить дело до конца».'], ['История про корабль и фразу', 'отца хорошо запоминается.'], ['Темп 120 слов в минуту —', 'спокойно и понятно.']].map((t, i) =>
      `<circle cx="56" cy="${178 + i * 62}" r="12" fill="${C.bg}"/>` + text(56, 183 + i * 62, '+', 13, { w: 600, anchor: 'middle' }) + lines(78, 183 + i * 62, t, 15, 21)).join('')}
    ${card(20, 386, 362, 186)}
    ${text(44, 418, 'ЧТО УЛУЧШИТЬ', 11, { w: 600, fill: C.muted, ls: 1.6 })}
    ${[['«Ну» в начале и «короче» в финале', 'ослабляют впечатление.'], ['Добавьте 2–3 детали: что было', 'трудно и что вы чувствовали.']].map((t, i) =>
      `<circle cx="56" cy="${446 + i * 62}" r="12" fill="${C.bg}"/>` + text(56, 451 + i * 62, '–', 13, { w: 600, anchor: 'middle' }) + lines(78, 451 + i * 62, t, 15, 21)).join('')}
    ${card(20, 588, 362, 214)}
    ${text(44, 620, 'РАСШИФРОВКА', 11, { w: 600, fill: C.muted, ls: 1.6 })}
    <text ${F} font-size="15" fill="#3A3A3C">
      <tspan x="44" y="650"><tspan fill="${C.accent}" font-weight="600">Ну</tspan>, самый важный урок, который я</tspan>
      <tspan x="44" y="672">получил в детстве, это, <tspan fill="${C.accent}" font-weight="600">как бы</tspan>, умение</tspan>
      <tspan x="44" y="694">доводить дело до конца. Когда мне</tspan>
      <tspan x="44" y="716">было десять лет… <tspan fill="${C.accent}" font-weight="600">Вот</tspan>.</tspan>
    </text>
    ${(() => {
      let x = 44;
      return ['ну · 1', 'как бы · 1', 'вот · 1', 'короче · 1'].map((l) => {
        const w = l.length * 6.6 + 20, chip = `<rect x="${x}" y="742" width="${w}" height="28" rx="14" fill="#E8EEF9"/>` + text(x + w / 2, 761, l, 13, { w: 500, fill: C.accent, anchor: 'middle' });
        x += w + 8;
        return chip;
      }).join('');
    })()}`),

  // 5. History
  history: screen(`${text(20, 112, 'История', 34, { w: 600, ls: -1 })}
    ${['Все', 'Жизнь', 'Юмор', 'Философия'].map((l, i) => {
      const x = 20 + [0, 58, 132, 206][i], w = l.length * 8 + 28, on = i === 0;
      return `<rect x="${x}" y="134" width="${w}" height="34" rx="17" fill="${on ? C.ink : C.white}" stroke="${on ? 'none' : C.line}"/>` + text(x + w / 2, 156, l, 13, { w: 500, fill: on ? C.white : C.ink, anchor: 'middle' });
    }).join('')}
    ${card(20, 188, 362, 492)}
    ${[['ЖИЗНЬ', 'Самый важный урок, который вы', 'получили в детстве', '22 октября · 00:58', 7],
       ['ЮМОР', 'Если бы вы стали президентом', 'на один час', '21 октября · 01:00', 8],
       ['ФИЛОСОФИЯ', 'Можно ли научиться быть', 'смелым', '20 октября · 00:51', 6],
       ['БИЗНЕС', 'Как продать ручку за минуту', '', '19 октября · 01:00', 9],
       ['ТЕХНОЛОГИИ', 'Смартфон: друг или враг', '', '18 октября · 00:47', 7]].map(([c, a, b, m, s], i) => {
      const y = 214 + [0, 100, 200, 300, 380][i];
      return text(44, y + 10, c, 11, { w: 600, fill: C.muted, ls: 1.6 }) + text(44, y + 34, a, 15, { w: 500 }) +
        (b ? text(44, y + 55, b, 15, { w: 500 }) : '') + text(44, y + (b ? 76 : 56), m, 13, { fill: C.muted }) +
        `<circle cx="336" cy="${y + 38}" r="22" fill="none" stroke="${C.ink}" stroke-width="1.5"/>` + text(336, y + 45, String(s), 18, { w: 600, anchor: 'middle' }) +
        (i < 4 ? `<rect x="44" y="${y + (b ? 92 : 72)}" width="314" height="0.6" fill="${C.line}"/>` : '');
    }).join('')}
    <rect x="0" y="770" width="402" height="104" fill="${C.bg}"/><rect x="0" y="770" width="402" height="0.6" fill="${C.line}"/>
    ${[['Сегодня', 50], ['Темы', 125], ['История', 277], ['Профиль', 352]].map(([l, x]) =>
      `<circle cx="${x}" cy="796" r="9" fill="none" stroke="${l === 'История' ? C.ink : C.muted}" stroke-width="1.6"/>` +
      text(x, 824, l, 11, { w: l === 'История' ? 600 : 400, fill: l === 'История' ? C.ink : C.muted, anchor: 'middle' })).join('')}
    <circle cx="201" cy="806" r="28" fill="${C.ink}"/><path d="M201 794 v24 M189 806 h24" stroke="#fff" stroke-width="2" stroke-linecap="round"/>`),
};

for (const [i, [name, svg]] of Object.entries(screens).entries()) {
  await sharp(Buffer.from(svg)).png().toFile(`${out}/${i + 1}-${name}.png`);
  console.log(`${i + 1}-${name}.png`);
}
