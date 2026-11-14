// ASO screenshot set (10 slides): one saturated blue background, big white 2–4 word headline,
// one short subtitle line, upright iPhone that bleeds off the bottom edge.
// Screens are vector recreations of the app UI (same style as mock-screens.mjs).
// Output: 1206x2622 (6.3") and 1179x2556 (6.1") into <outDir>.
//
//   node aso-screenshots.mjs <outDir>
//   (set SHARP=<path to sharp/lib/index.js> if sharp is not installed next to this file)
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const sharp = (await import(process.env.SHARP ? pathToFileURL(process.env.SHARP).href : 'sharp')).default;
const outDir = process.argv[2] ?? 'screenshots-aso';
mkdirSync(outDir, { recursive: true });

// ---------- App UI primitives (points, 402x874, rendered x3) ----------
const C = { bg: '#F2F2F4', ink: '#111111', muted: '#8E8E93', faint: '#C7C7CC', line: '#E5E5EA', accent: '#2F5BEA', soft: '#E6ECFD', warn: '#E8590C', warnSoft: '#FDEBDD', red: '#E5484D', green: '#2FA36B', white: '#FFFFFF' };
const F = "font-family=\"'Segoe UI', 'Inter', 'Helvetica Neue', Arial, sans-serif\"";
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const text = (x, y, s, size, { w = 400, fill = C.ink, anchor = 'start', ls = 0 } = {}) =>
  `<text ${F} x="${x}" y="${y}" font-size="${size}" font-weight="${w}" fill="${fill}" text-anchor="${anchor}" letter-spacing="${ls}">${esc(s)}</text>`;
const lines = (x, y, arr, size, lh, opts) => arr.map((s, i) => text(x, y + i * lh, s, size, opts)).join('');
const card = (x, y, w, h, fill = C.white, r = 28) =>
  `<rect x="${x}" y="${y + 3}" width="${w}" height="${h}" rx="${r}" fill="#000" opacity="0.04"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"/>`;
const pill = (x, y, w, h, label, { dark = true } = {}) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${dark ? C.ink : C.white}" stroke="${dark ? 'none' : C.line}"/>` +
  text(x + w / 2, y + h / 2 + 5.5, label, 16, { w: 600, fill: dark ? C.white : C.ink, anchor: 'middle' });
const badge = (cx, y, label, { fill = C.bg, color = C.ink } = {}) => {
  const w = label.length * 7.4 + 22;
  return `<rect x="${cx - w / 2}" y="${y}" width="${w}" height="20" rx="10" fill="${fill}"/>` + text(cx, y + 14, label, 10, { w: 700, fill: color, anchor: 'middle', ls: 1.8 });
};
const chip = (x, y, label, { on = false, fill, color, size = 13, h = 34 } = {}) => {
  const w = label.length * size * 0.58 + 28;
  return { w, svg: `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${fill ?? (on ? C.ink : C.white)}" stroke="${on || fill ? 'none' : C.line}"/>` +
    text(x + w / 2, y + h / 2 + size * 0.36, label, size, { w: 600, fill: color ?? (on ? C.white : C.ink), anchor: 'middle' }) };
};
const chipRow = (x0, y, labels, opts = {}, maxX = 382, gap = 8, lh = 44) => {
  let x = x0, out = '';
  for (const [i, l] of labels.entries()) {
    const o = typeof opts === 'function' ? opts(i) : opts;
    let c = chip(x, y, l, o);
    if (x + c.w > maxX) { x = x0; y += lh; c = chip(x, y, l, o); }
    out += c.svg; x += c.w + gap;
  }
  return out;
};
const mic = (cx, cy, s, color = C.white) => `<g transform="translate(${cx} ${cy}) scale(${s})">
  <rect x="-60" y="-156" width="120" height="200" rx="60" fill="${color}"/>
  <path d="M-120 -12 a120 120 0 0 0 240 0" fill="none" stroke="${color}" stroke-width="30" stroke-linecap="round"/>
  <path d="M0 108 v56 M-50 164 h100" fill="none" stroke="${color}" stroke-width="30" stroke-linecap="round"/></g>`;
const bars = (cx, cy, n, h, seed, { split = 1, bw = 3, gap = 3, color = C.ink } = {}) => {
  let s = seed, out = '';
  const total = n * bw + (n - 1) * gap;
  for (let i = 0; i < n; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const v = Math.max(0.12, ((s >> 16) & 0xff) / 255 * (0.4 + 0.6 * Math.sin((i / n) * Math.PI)));
    const bh = Math.max(3, v * h);
    out += `<rect x="${cx - total / 2 + i * (bw + gap)}" y="${cy - bh / 2}" width="${bw}" height="${bh}" rx="${bw / 2}" fill="${i < n * split ? color : C.faint}"/>`;
  }
  return out;
};
const statusBar = () => text(52, 34, '9:41', 16, { w: 600 }) +
  `<rect x="141" y="11" width="120" height="35" rx="17.5" fill="#000"/>` +
  `<g fill="${C.ink}"><rect x="306" y="27" width="3" height="5" rx="1"/><rect x="311" y="24" width="3" height="8" rx="1"/><rect x="316" y="21" width="3" height="11" rx="1"/><rect x="321" y="18" width="3" height="14" rx="1"/>
   <rect x="336" y="19" width="24" height="12" rx="3.5" fill="none" stroke="${C.ink}" stroke-width="1.2"/><rect x="338" y="21" width="18" height="8" rx="2"/></g>`;
const back = (y = 62) => `<circle cx="40" cy="${y + 20}" r="20" fill="${C.white}"/><path d="M43 ${y + 13} l-7 7 7 7" fill="none" stroke="${C.ink}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
const header = (title) => back() + text(201, 88, title, 18, { w: 600, anchor: 'middle' });
const label = (x, y, s) => text(x, y, s, 11, { w: 600, fill: C.muted, ls: 1.6 });
const tabBar = (active) => `<rect x="0" y="770" width="402" height="104" fill="${C.bg}"/><rect x="0" y="770" width="402" height="0.6" fill="${C.line}"/>
  ${[['Сегодня', 50], ['Темы', 125], ['История', 277], ['Профиль', 352]].map(([l, x]) =>
    `<circle cx="${x}" cy="796" r="9" fill="none" stroke="${l === active ? C.ink : C.muted}" stroke-width="1.6"/>` +
    text(x, 824, l, 11, { w: l === active ? 600 : 400, fill: l === active ? C.ink : C.muted, anchor: 'middle' })).join('')}
  <circle cx="201" cy="806" r="28" fill="${C.ink}"/><path d="M201 794 v24 M189 806 h24" stroke="#fff" stroke-width="2" stroke-linecap="round"/>`;
const screen = (body) => `<svg xmlns="http://www.w3.org/2000/svg" width="1206" height="2622"><g transform="scale(3)">
  <rect width="402" height="874" fill="${C.bg}"/>${statusBar()}${body}
  <rect x="134" y="860" width="134" height="5" rx="2.5" fill="${C.ink}"/></g></svg>`;
const scale = (x, y, w, l, v, { size = 13, th = 4 } = {}) =>
  text(x, y + 5, l, size) + `<rect x="${x + 86}" y="${y - th / 2}" width="${w}" height="${th}" rx="${th / 2}" fill="${C.bg}"/>` +
  `<rect x="${x + 86}" y="${y - th / 2}" width="${(w * v) / 10}" height="${th}" rx="${th / 2}" fill="${C.ink}"/>` + text(x + 86 + w + 26, y + 5, String(v), size + 1, { w: 600, anchor: 'end' });
const plusMinus = (y0, items, sign, step = 66) => items.map((t, i) => {
  const y = y0 + i * step;
  return `<circle cx="56" cy="${y}" r="12" fill="${sign === '+' ? '#E3F4EA' : C.warnSoft}"/>` +
    text(56, y + 5, sign, 14, { w: 700, anchor: 'middle', fill: sign === '+' ? C.green : C.warn }) + lines(78, y + 5, t, 15, 21);
}).join('');
// Transcript line with highlighted fillers: segments like ['обычный текст', '*ну*', ...]
const hl = (x, y, segs, size = 16) => `<text ${F} x="${x}" y="${y}" font-size="${size}" fill="#3A3A3C">` +
  segs.map((t) => t.startsWith('*') ? `<tspan font-weight="700" fill="${C.warn}" text-decoration="underline">${esc(t.slice(1, -1))}</tspan>` : esc(t)).join('') + '</text>';

const screens = [
  // 1. Result with a big 8/10
  screen(`${header('Разбор')}
    ${card(20, 118, 362, 400)}
    ${badge(201, 146, 'ЮМОР')}
    ${lines(201, 200, ['Если бы вы стали президентом', 'на один час'], 22, 28, { w: 600, anchor: 'middle', ls: -0.5 })}
    ${text(201, 252, 'Сегодня · 01:00', 13, { fill: C.muted, anchor: 'middle' })}
    ${text(206, 392, '8', 128, { w: 700, anchor: 'end', ls: -4 })}${text(210, 392, '/10', 30, { w: 500, fill: C.faint })}
    ${lines(201, 446, ['Чёткая структура и живой пример.', 'Почти без пауз и слов-паразитов.'], 15, 22, { fill: C.muted, anchor: 'middle' })}
    ${card(20, 534, 362, 236)}
    ${[['Структура', 8], ['По теме', 9], ['Словарь', 7], ['Плавность', 8], ['Темп', 8]].map(([l, v], i) => scale(44, 576 + i * 40, 200, l, v)).join('')}`),

  // 2. Five criteria
  screen(`${header('Оценка')}
    ${card(20, 118, 362, 110)}
    ${text(44, 166, '8', 52, { w: 700, ls: -2 })}${text(78, 166, '/10', 18, { w: 500, fill: C.faint })}
    ${text(130, 152, 'Общая оценка', 15, { w: 600 })}${text(130, 176, 'Готово за 15 секунд', 13, { fill: C.muted })}
    <circle cx="350" cy="160" r="6" fill="${C.green}"/>
    ${card(20, 244, 362, 520)}
    ${[['Структура', 8, 'Вступление, мысль, вывод'], ['По теме', 9, 'Ни разу не ушли в сторону'], ['Словарь', 7, 'Есть повторы «очень», «сделать»'], ['Плавность', 8, '3 паузы длиннее 2 секунд'], ['Темп', 8, '128 слов в минуту — комфортно']]
      .map(([l, v, d], i) => { const y = 290 + i * 98; return text(44, y, l, 18, { w: 600 }) + text(358, y, `${v}/10`, 18, { w: 700, anchor: 'end' }) +
        `<rect x="44" y="${y + 16}" width="314" height="10" rx="5" fill="${C.bg}"/><rect x="44" y="${y + 16}" width="${31.4 * v}" height="10" rx="5" fill="${C.accent}"/>` +
        text(44, y + 50, d, 13, { fill: C.muted }); }).join('')}`),

  // 3. Transcript with fillers
  screen(`${header('Расшифровка')}
    ${card(20, 118, 362, 150)}
    ${label(44, 152, 'СЛОВА-ПАРАЗИТЫ')}
    ${text(44, 212, 'ну', 44, { w: 700, fill: C.warn })}${text(100, 212, '×7', 44, { w: 700 })}
    ${text(44, 244, 'чаще всего в начале фраз', 13, { fill: C.muted })}
    ${chipRow(214, 176, ['как бы ×3', 'типа ×2', 'вот ×2'], { fill: C.warnSoft, color: C.warn, size: 12, h: 28 }, 380, 6, 34)}
    ${card(20, 284, 362, 486)}
    ${label(44, 318, 'ВАША РЕЧЬ')}
    ${[['*Ну*, если бы я стал президентом'], ['на час, я бы, *как бы*, первым делом'], ['отменил пробки. *Ну* то есть сделал'], ['все светофоры зелёными. *Типа* для'], ['всех сразу. *Ну* а потом… *вот*,'], ['я бы выступил с речью. *Ну*, короткой,'], ['минут на пять. *Как бы* без бумажки.'], ['*Ну* и, *типа*, сказал бы людям'], ['спасибо. *Ну* правда, *как бы*,'], ['*Ну*, за час много не успеешь. *Вот*.']]
      .map((segs, i) => hl(44, 356 + i * 38, segs.join('').split(/(\*[^*]+\*)/).filter(Boolean))).join('')}`),

  // 4. Topic
  screen(`${back()}
    ${card(20, 150, 362, 480)}
    <path d="M48 150 h306 a28 28 0 0 1 28 28 v132 h-362 v-132 a28 28 0 0 1 28 -28z" fill="${C.ink}"/>
    ${mic(201, 240, 0.28)}
    ${badge(201, 340, 'БИЗНЕС')}
    ${lines(201, 400, ['Продай картошку', 'как люксовый', 'товар'], 30, 38, { w: 700, anchor: 'middle', ls: -0.8 })}
    <rect x="44" y="540" width="314" height="3" rx="1.5" fill="${C.line}"/><rect x="44" y="540" width="94" height="3" rx="1.5" fill="${C.ink}"/>
    ${text(201, 580, 'Запись начнётся через 7', 14, { w: 500, fill: C.muted, anchor: 'middle' })}
    ${card(20, 650, 174, 96)}${card(208, 650, 174, 96)}
    ${text(107, 694, '0:10', 28, { w: 700, anchor: 'middle' })}${text(107, 722, 'подумать', 13, { fill: C.muted, anchor: 'middle' })}
    ${text(295, 694, '1:00', 28, { w: 700, anchor: 'middle' })}${text(295, 722, 'говорить', 13, { fill: C.muted, anchor: 'middle' })}
    ${pill(20, 776, 362, 54, 'Начать запись')}`),

  // 5. Recording
  screen(`
    <circle cx="146" cy="112" r="4" fill="${C.red}"/>${text(158, 116, 'ГОВОРИТЕ!', 11, { w: 600, ls: 1.6 })}
    ${lines(201, 156, ['Продай картошку', 'как люксовый товар'], 24, 30, { w: 600, anchor: 'middle', ls: -0.6 })}
    <circle cx="201" cy="390" r="132" fill="none" stroke="${C.line}" stroke-width="4"/>
    <circle cx="201" cy="390" r="132" fill="none" stroke="${C.ink}" stroke-width="4" stroke-linecap="round"
      stroke-dasharray="829" stroke-dashoffset="${829 * 0.3}" transform="rotate(-90 201 390)"/>
    ${text(201, 412, '00:42', 62, { w: 600, anchor: 'middle', ls: -2 })}
    ${bars(201, 610, 40, 96, 7, { bw: 3.5, gap: 3.5 })}
    ${pill(20, 760, 362, 54, 'Закончить')}`),

  // 6. Strengths / to improve
  screen(`${header('Разбор')}
    ${card(20, 118, 362, 300)}
    ${label(44, 152, 'СИЛЬНЫЕ СТОРОНЫ')}
    ${plusMinus(186, [['Сильный старт: «Это не картошка —', 'это золото с вашей грядки».'], ['Понятная выгода: «вкус, который', 'вы запомните с детства».'], ['Уверенный финал с призывом', '«попробуйте сегодня».'], ['Ровный темп без длинных пауз.']], '+', 60)}
    ${card(20, 434, 362, 260)}
    ${label(44, 468, 'ЧТО ПОДТЯНУТЬ')}
    ${plusMinus(502, [['«Ну» ×4 в первые 15 секунд —', 'начните сразу с главной мысли.'], ['«Очень вкусная» повторяется 3 раза.', 'Замените: «нежная», «сливочная».'], ['Не хватает цены и аргумента,', 'почему она оправдана.']], '–', 64)}
    ${pill(20, 760, 362, 54, 'Попробовать ещё раз')}`),

  // 7. History with growth
  screen(`${text(20, 112, 'История', 34, { w: 600, ls: -1 })}
    ${card(20, 134, 362, 220)}
    ${label(44, 168, 'ВАШ ПРОГРЕСС')}${text(358, 168, '+4 за месяц', 13, { w: 600, fill: C.green, anchor: 'end' })}
    ${(() => { const pts = [5, 6, 7, 9].map((v, i) => [70 + i * 88, 330 - v * 16]);
      return `<polyline points="${pts.map((p) => p.join(',')).join(' ')}" fill="none" stroke="${C.accent}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>` +
        pts.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="16" fill="${i === 3 ? C.accent : C.white}" stroke="${C.accent}" stroke-width="3"/>` +
          text(x, y + 6, String([5, 6, 7, 9][i]), 16, { w: 700, anchor: 'middle', fill: i === 3 ? C.white : C.ink })).join('') +
        ['1 нед', '2 нед', '3 нед', '4 нед'].map((l, i) => text(70 + i * 88, 342, l, 11, { fill: C.muted, anchor: 'middle' })).join(''); })()}
    ${card(20, 370, 362, 390)}
    ${[['БИЗНЕС', 'Продай картошку как люксовый товар', 'Сегодня · 01:00', 9], ['ЮМОР', 'Если бы вы стали президентом на час', '7 дней назад · 01:00', 7], ['ЖИЗНЬ', 'Самый важный урок из детства', '14 дней назад · 00:52', 6], ['ФИЛОСОФИЯ', 'Можно ли научиться быть смелым', '21 день назад · 00:41', 5]]
      .map(([c, t, m, s], i) => { const y = 396 + i * 92; return label(44, y + 10, c) + text(44, y + 34, t.length > 30 ? t.slice(0, 29) + '…' : t, 15, { w: 500 }) +
        text(44, y + 56, m, 13, { fill: C.muted }) + `<circle cx="20" cy="0" r="0"/>` +
        `<circle cx="340" cy="${y + 30}" r="22" fill="${i === 0 ? C.accent : 'none'}" stroke="${i === 0 ? 'none' : C.ink}" stroke-width="1.5"/>` +
        text(340, y + 37, String(s), 18, { w: 700, anchor: 'middle', fill: i === 0 ? C.white : C.ink }) +
        `<circle cx="300" cy="${y + 30}" r="12" fill="${C.bg}"/><path d="M297 ${y + 24} v12 l9 -6z" fill="${C.ink}"/>` +
        (i < 3 ? `<rect x="44" y="${y + 74}" width="314" height="0.6" fill="${C.line}"/>` : ''); }).join('')}
    ${tabBar('История')}`),

  // 8. Interview topic + result
  screen(`${header('Разбор')}
    ${card(20, 118, 362, 330)}
    ${badge(201, 146, 'КАРЬЕРА')}
    ${lines(201, 200, ['Почему вас стоит взять', 'на эту работу?'], 22, 28, { w: 600, anchor: 'middle', ls: -0.5 })}
    ${text(201, 252, 'Сегодня · 01:00', 13, { fill: C.muted, anchor: 'middle' })}
    ${text(204, 352, '8', 90, { w: 700, anchor: 'end', ls: -3 })}${text(208, 352, '/10', 24, { w: 500, fill: C.faint })}
    ${lines(201, 400, ['Убедительно и по делу.', 'Добавьте один яркий пример.'], 14, 21, { fill: C.muted, anchor: 'middle' })}
    ${card(20, 464, 362, 206)}
    ${label(44, 498, 'СИЛЬНЫЕ СТОРОНЫ')}
    ${plusMinus(532, [['Цифры вместо общих слов: «вырастил', 'продажи на 30% за полгода».'], ['Чёткий план: «первые 90 дней', 'я потрачу на…»']], '+', 64)}
    ${card(20, 686, 362, 70)}
    ${label(44, 716, 'ПОХОЖИЕ ТЕМЫ')}${text(44, 740, 'Защита проекта · Экзамен · Созвон с клиентом', 13, { w: 500 })}`),

  // 9. Topics with category filters
  screen(`${text(20, 112, 'Темы', 34, { w: 600, ls: -1 })}
    ${chipRow(20, 134, ['Все', 'Жизнь', 'Бизнес', 'Технологии', 'Философия', 'Юмор'], (i) => ({ on: i === 0 }))}
    ${[['ЖИЗНЬ', 'Что бы вы сказали себе 10 лет назад'], ['БИЗНЕС', 'Продай картошку как люксовый товар'], ['ТЕХНОЛОГИИ', 'Заменит ли ИИ учителей'], ['ФИЛОСОФИЯ', 'Можно ли купить счастье'], ['ЮМОР', 'Если бы кот стал вашим начальником']]
      .map(([c, t], i) => { const y = 234 + i * 104; return card(20, y, 362, 92, C.white, 22) + label(44, y + 32, c) + text(44, y + 62, t, 16, { w: 600 }) +
        `<path d="M352 ${y + 40} l7 7 -7 7" fill="none" stroke="${C.muted}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`; }).join('')}
    ${tabBar('Темы')}`),

  // 10. Privacy / settings
  screen(`${text(20, 112, 'Профиль', 34, { w: 600, ls: -1 })}
    ${card(20, 134, 362, 230)}
    <circle cx="201" cy="208" r="44" fill="${C.soft}"/>
    <g transform="translate(201 208)" fill="none" stroke="${C.accent}" stroke-width="4" stroke-linecap="round">
      <path d="M-12 -6 v-8 a12 12 0 0 1 24 0 v8"/><rect x="-18" y="-6" width="36" height="28" rx="6" fill="${C.accent}" stroke="none"/></g>
    <circle cx="201" cy="214" r="3.5" fill="#fff"/><rect x="199.5" y="214" width="3" height="8" rx="1.5" fill="#fff"/>
    ${text(201, 286, 'Ваши записи — только ваши', 18, { w: 600, anchor: 'middle' })}
    ${lines(201, 312, ['Никто, кроме вас, их не слушает.', 'Мы не продаём и не передаём данные.'], 13, 19, { fill: C.muted, anchor: 'middle' })}
    ${card(20, 380, 362, 230)}
    ${[['Без рекламы'], ['Без трекинга и слежки'], ['Сохранять записи на устройстве']].map(([l], i) => { const y = 380 + i * 76;
      return text(44, y + 44, l, 16, { w: 500 }) + `<rect x="306" y="${y + 24}" width="52" height="30" rx="15" fill="${C.green}"/><circle cx="343" cy="${y + 39}" r="12" fill="#fff"/>` +
        (i < 2 ? `<rect x="44" y="${y + 76}" width="314" height="0.6" fill="${C.line}"/>` : ''); }).join('')}
    ${card(20, 626, 362, 64)}
    ${text(201, 664, 'Удалить все записи', 16, { w: 600, fill: C.red, anchor: 'middle' })}
    ${text(201, 718, 'Удаление в один тап — навсегда', 13, { fill: C.muted, anchor: 'middle' })}
    ${tabBar('Профиль')}`),
];

// ---------- Framing ----------
const SLIDES = [
  ['Говори уверенно', '5 минут в день, и речь без «ээ» и пауз'],
  ['ИИ разберёт твою речь', 'Оценка по 5 критериям за 15 секунд'],
  ['Без «ну» и «как бы»', 'Слова-паразиты подсвечены прямо в тексте'],
  ['Тема за секунду', '10 секунд подумать, 60 секунд говорить'],
  ['Как на настоящем выступлении', 'Без сценария и шпаргалок'],
  ['Что получилось, а что нет', 'Конкретно, с цитатами из твоей речи'],
  ['Слышишь свой прогресс', 'Переслушай себя через неделю'],
  ['Готовься к собеседованию', 'И к защите проекта, экзамену, созвону'],
  ['Темы на любой вкус', 'Жизнь, бизнес, технологии, философия, юмор'],
  ['Только твои записи', 'Без рекламы и слежки. Удаление в один тап'],
];
const BG1 = '#2F5BEA', BG2 = '#1B3DBF';
const SIZES = [[1206, 2622], [1179, 2556]];
const FB = "font-family=\"'Segoe UI Black', 'Segoe UI', 'Inter', Arial, sans-serif\"";
const FS = "font-family=\"'Segoe UI Semibold', 'Segoe UI', 'Inter', Arial, sans-serif\"";

// Split into one line, or two lines balanced by length.
const wrap = (s, n) => {
  if (s.length <= n) return [s];
  const w = s.split(' ');
  let best = null;
  for (let k = 1; k < w.length; k++) {
    const a = w.slice(0, k).join(' '), b = w.slice(k).join(' '), m = Math.max(a.length, b.length);
    if (!best || m < best[0]) best = [m, [a, b]];
  }
  return best[1];
};

async function phone(buf, screenW) {
  const bezel = Math.round(screenW * 0.035), r = Math.round(screenW * 0.13);
  const { data, info } = await sharp(buf).resize({ width: screenW }).png().toBuffer({ resolveWithObject: true });
  const sh = info.height, pw = screenW + bezel * 2, ph = sh + bezel * 2;
  const mask = Buffer.from(`<svg width="${screenW}" height="${sh}"><rect width="${screenW}" height="${sh}" rx="${r - bezel}" fill="#fff"/></svg>`);
  const scr = await sharp(data).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
  const body = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${pw}" height="${ph}">
    <rect width="${pw}" height="${ph}" rx="${r}" fill="#1C1C1E"/><rect x="3" y="3" width="${pw - 6}" height="${ph - 6}" rx="${r - 3}" fill="#0A0A0A"/></svg>`);
  return sharp(body).composite([{ input: scr, left: bezel, top: bezel }]).png().toBuffer();
}

for (const [i, [title, sub]] of SLIDES.entries()) {
  const raw = await sharp(Buffer.from(screens[i])).png().toBuffer();
  for (const [W, H] of SIZES) {
    const u = W / 100;
    const tl = wrap(title, 12), sl = wrap(sub, 34);
    const hs = Math.min(12.5 * u, (88 * u) / (Math.max(...tl.map((l) => l.length)) * 0.6));
    const ss = Math.min(5.2 * u, (90 * u) / (Math.max(...sl.map((l) => l.length)) * 0.55));
    const y0 = H * 0.075 + hs * 0.9;
    const subY = y0 + (tl.length - 1) * hs * 1.05 + ss * 1.9;
    const textBottom = subY + (sl.length - 1) * ss * 1.3;
    // Slide 1 gets a larger phone so the score reads in search results.
    const big = i === 0;
    const pw = Math.round(W * (big ? 0.94 : 0.8));
    let ph = await phone(raw, pw - Math.round(pw * 0.07));
    const meta = await sharp(ph).metadata();
    const top = Math.round(textBottom + 6 * u - (big ? 0 : 0));
    const cropH = Math.min(meta.height, H - top);
    ph = await sharp(ph).extract({ left: 0, top: 0, width: meta.width, height: cropH }).toBuffer();
    const left = Math.round((W - meta.width) / 2);

    const bg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
      <defs><linearGradient id="g" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" stop-color="${BG1}"/><stop offset="1" stop-color="${BG2}"/></linearGradient></defs>
      <rect width="${W}" height="${H}" fill="url(#g)"/>
      <circle cx="${W * 0.98}" cy="${H * 0.04}" r="${38 * u}" fill="#fff" opacity="0.07"/>
      <circle cx="${W * 0.0}" cy="${H * 0.7}" r="${50 * u}" fill="#fff" opacity="0.05"/>
      <g ${FB} font-weight="900" font-size="${hs}" letter-spacing="${-hs * 0.02}" fill="#fff" text-anchor="middle">
        ${tl.map((l, k) => `<text x="${W / 2}" y="${y0 + k * hs * 1.05}">${esc(l)}</text>`).join('')}
      </g>
      <g ${FS} font-weight="600" font-size="${ss}" fill="#fff" fill-opacity="0.88" text-anchor="middle">
        ${sl.map((l, k) => `<text x="${W / 2}" y="${subY + k * ss * 1.3}">${esc(l)}</text>`).join('')}
      </g></svg>`);
    const shadow = await sharp(ph).ensureAlpha().linear([0, 0, 0, 0.4], [0, 0, 0, 0]).blur(3 * u).png().toBuffer();
    const name = `aso-${String(i + 1).padStart(2, '0')}-${W}x${H}.png`;
    await sharp(bg).composite([
      { input: shadow, left, top: top + Math.round(1.5 * u) },
      { input: ph, left, top },
    ]).png().toFile(join(outDir, name));
    console.log(name);
  }
}
