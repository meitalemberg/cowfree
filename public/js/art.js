/* איורי וקטור שטוחים, בפלטת הצבעים של האפיון בלבד. לכל איור יש aria-label כטקסט חלופי. */
(function () {
  'use strict';
  const N = '#0F1B2D', T = '#14B8A6', M = '#FAFAF7', P = '#E8D9B5', A = '#F59E0B', R = '#E5484D';
  const O = `stroke="${N}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"`;
  const o = w => `stroke="${N}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
  const svg = (label, vb, inner, cls = '') =>
    `<svg class="art ${cls}" viewBox="${vb}" role="img" aria-label="${label}" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
  const txt = (x, y, s, size = 12, fill = N, extra = '') =>
    `<text x="${x}" y="${y}" text-anchor="middle" font-size="${size}" font-weight="700" fill="${fill}" ${extra}>${s}</text>`;

  /* ---------- אבני בניין ---------- */
  const hex = (cx, cy, r, fill = A) => {
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 3 * i + Math.PI / 6;
      pts.push((cx + r * Math.cos(a)).toFixed(1) + ',' + (cy + r * Math.sin(a)).toFixed(1));
    }
    return `<polygon points="${pts.join(' ')}" fill="${fill}" ${o(1.8)}/>`;
  };
  const helix = (x, y, n, c1 = T, c2 = N, w = 3) => {
    let a = `M${x} ${y}q5 -9 10 0`, b = `M${x} ${y}q5 9 10 0`, rungs = '';
    for (let i = 1; i < n; i++) { a += 't10 0'; b += 't10 0'; }
    for (let i = 0; i < n; i++) rungs += `<path d="M${x + 5 + i * 10} ${y - 3.5}v7" stroke="${N}" stroke-width="1.5" opacity=".5"/>`;
    return `${rungs}<path d="${a}" fill="none" stroke="${c1}" stroke-width="${w}" stroke-linecap="round"/><path d="${b}" fill="none" stroke="${c2}" stroke-width="${w}" stroke-linecap="round"/>`;
  };
  const cow = (x, y, s = 1) =>
    `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-8-5l-6-4 2 7zM8-5l6-4-2 7z" fill="${N}"/><path d="M-8-4c0-6 16-6 16 0v7c0 6-4 9-8 9s-8-3-8-9z" fill="${N}"/><ellipse cx="0" cy="8" rx="5" ry="3.4" fill="${P}"/></g>`;
  const yeast = (x, y, s = 1, fill = P) =>
    `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cx="0" cy="0" rx="11" ry="14" fill="${fill}" ${o(2.2)}/><ellipse cx="10" cy="-13" rx="5" ry="6" fill="${fill}" ${o(2.2)}/><circle cx="-2" cy="2" r="4" fill="${T}" opacity=".7"/></g>`;
  const tank = (x, y, s = 1, extra = '') =>
    `<g transform="translate(${x} ${y}) scale(${s})">
      <path d="M-20 34v8M20 34v8" ${o(3)}/>
      <rect x="-26" y="-36" width="52" height="72" rx="14" fill="${M}" ${O}/>
      <rect x="-26" y="-36" width="52" height="72" rx="14" fill="${N}" opacity=".14"/>
      <path d="M-8-36v-7h16v7" fill="none" ${O}/>
      <circle cx="0" cy="2" r="17" fill="${N}" ${O}/>
      <ellipse cx="-6" cy="6" rx="3.5" ry="4.5" fill="${P}"/><ellipse cx="6" cy="0" rx="3.5" ry="4.5" fill="${P}"/><ellipse cx="2" cy="11" rx="3" ry="4" fill="${P}"/><ellipse cx="-4" cy="-6" rx="3" ry="4" fill="${P}"/>
      <circle class="bub b1" cx="9" cy="10" r="2" fill="${T}"/><circle class="bub b2" cx="-10" cy="-2" r="1.6" fill="${T}"/><circle class="bub b3" cx="3" cy="-9" r="1.8" fill="${T}"/>
      ${extra}
    </g>`;
  const bottle = (x, y, s = 1, inner = '') =>
    `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-5-22h10v8l7 9v24a3 3 0 0 1-3 3H-9a3 3 0 0 1-3-3V-5l7-9z" fill="${M}" ${O}/>${inner}<rect x="-6" y="-26" width="12" height="5" rx="2" fill="${T}" ${o(2)}/></g>`;
  const arrow = (x1, y, x2, cls = '') =>
    `<path class="${cls}" d="M${x1} ${y}H${x2}" ${o(2.5)} fill="none"/><path d="M${x2 - 5} ${y - 5}l6 5-6 5" ${o(2.5)} fill="none"/>`;

  /* ---------- סמלי צוות ---------- */
  const icons = {
    microscope: ['מיקרוסקופ', `<rect x="11" y="38" width="26" height="4" rx="2" fill="${N}"/><path d="M31 38c6-4 7-11 3-17" fill="none" ${o(3)}/><rect x="19" y="7" width="9" height="19" rx="3" transform="rotate(-25 23 17)" fill="${T}" ${O}/><rect x="13" y="30" width="15" height="3.5" rx="1.7" fill="${N}"/>`],
    tube: ['מבחנה', `<g transform="rotate(20 24 24)"><path d="M18 8v26a6 6 0 0 0 12 0V8" fill="${M}" ${O}/><path d="M18 22h12v12a6 6 0 0 1-12 0z" fill="${T}"/><path d="M18 8v26a6 6 0 0 0 12 0V8" fill="none" ${O}/><path d="M15 8h18" ${o(3)}/><circle cx="24" cy="17" r="1.8" fill="${T}"/></g>`],
    dna: ['סליל DNA', `<path d="M17 12h14M19 19h10M19 29h10M17 36h14" stroke="${N}" stroke-width="2" opacity=".45" stroke-linecap="round"/><path d="M15 6c0 9 18 9 18 18S15 33 15 42" fill="none" stroke="${T}" stroke-width="3.5" stroke-linecap="round"/><path d="M33 6c0 9-18 9-18 18s18 9 18 18" fill="none" stroke="${N}" stroke-width="3.5" stroke-linecap="round"/>`],
    yeast: ['תא שמר', yeast(21, 29, 1.05)],
  };
  const icon = k => svg(icons[k][0], '0 0 48 48', icons[k][1], 'ico');

  /* ---------- אווטארים (בלי תווי פנים) ---------- */
  const avatars = {
    mom: ['אמא של נועה', T, `<circle cx="24" cy="7.5" r="4.5" fill="${N}"/><path d="M13.500 22c-1-9 4-14 10.500-14s11.500 5 10.500 14c-3-5-6-7-10.500-7s-7.500 2-10.500 7z" fill="${N}"/>`],
    noa: ['נועה', A, `<path d="M12.500 34V20c0-8 5-12 11.500-12s11.500 4 11.500 12v14c-3-3-4-8-4-13-5 0-10-2-13-6-1 6-3 13-6 19z" fill="${N}"/>`],
    dani: ['דני', P, `<path d="M14.500 19c-1-7 4-11.500 9.500-11.500s10.500 4.500 9.500 11.500c-2-3-5-5-9.500-5s-7.500 2-9.500 5z" fill="${N}"/>`],
    tamar: ['תמר', M, `<g fill="${N}"><circle cx="15" cy="15" r="5"/><circle cx="21" cy="10" r="5"/><circle cx="28" cy="10" r="5"/><circle cx="33" cy="15" r="5"/><circle cx="13.500" cy="22" r="4"/><circle cx="34.500" cy="22" r="4"/></g>`],
  };
  const avatar = k => {
    const [label, bg, hair] = avatars[k];
    return svg(label, '0 0 48 48',
      `<clipPath id="av-${k}"><circle cx="24" cy="24" r="23"/></clipPath><circle cx="24" cy="24" r="23" fill="${bg}"/><g clip-path="url(#av-${k})"><path d="M6 50c1-12 8-17 18-17s17 5 18 17z" fill="${k === 'tamar' ? T : N}" opacity="${k === 'tamar' ? 1 : .85}"/><circle cx="24" cy="21" r="9" fill="${P}" ${o(1.8)}/>${hair}</g><circle cx="24" cy="24" r="23" fill="none" ${o(1.5)}/>`, 'ava');
  };

  /* ---------- משקאות ---------- */
  const carton = inner => `<path d="M13 17l6-9h10l6 9v25a2 2 0 0 1-2 2H15a2 2 0 0 1-2-2z" fill="${M}" ${O}/><path d="M13 17h22M19 8v-3h10v3" fill="none" ${O}/>${inner}`;
  const drinks = {
    cow: ['חלב פרה', carton(cow(24, 29, 0.85))],
    lf: ['חלב ללא לקטוז', carton(cow(24, 30, 0.7)) + `<circle cx="36" cy="13" r="9.500" fill="${A}" ${o(2)}/>` + hex(36, 13, 4.5, M) + `<path d="M30 19l12-12" stroke="${R}" stroke-width="2.5" stroke-linecap="round"/>`],
    cf: ['חלב ללא פרה', bottle(24, 26, 1, `<rect x="-7" y="-2" width="14" height="19" rx="5" fill="${T}" ${o(1.8)}/><circle cx="0" cy="7" r="4" fill="${N}"/>`)],
    oat: ['משקה שיבולת שועל', `<path d="M24 44V12" ${o(2.5)} fill="none"/>` + [[16, 5], [24, 12], [32, 19]].map(([y, d]) => `<ellipse cx="${24 - 7}" cy="${y + 4}" rx="4" ry="7" transform="rotate(-30 ${24 - 7} ${y + 4})" fill="${A}" ${o(1.8)}/><ellipse cx="${24 + 7}" cy="${y + 4}" rx="4" ry="7" transform="rotate(30 ${24 + 7} ${y + 4})" fill="${A}" ${o(1.8)}/>`).join('') + `<ellipse cx="24" cy="8" rx="4" ry="6.500" fill="${A}" ${o(1.8)}/>`],
    soy: ['משקה סויה', `<path d="M10 28c0-12 10-18 20-16 8 2 10 10 6 18-5 9-18 10-24 5-2-2-2-4-2-7z" fill="${T}" ${O}/><circle cx="19" cy="27" r="4.500" fill="${P}" ${o(1.8)}/><circle cx="28" cy="22" r="4.500" fill="${P}" ${o(1.8)}/>`],
  };
  const drink = k => svg(drinks[k][0], '0 0 48 48', drinks[k][1], 'ico');

  /* ---------- שונות ---------- */
  const cup = svg('כוס קפוצ\'ינו', '0 0 64 48',
    `<path d="M48 18h5a7 7 0 0 1 0 14h-5" fill="none" stroke="${M}" stroke-width="3" stroke-linecap="round"/><path d="M12 14h36v12a16 16 0 0 1-16 16h-4a16 16 0 0 1-16-16z" fill="none" stroke="${M}" stroke-width="3" stroke-linejoin="round"/><path d="M24 26c0-4 6-4 6 0 0-4 6-4 6 0 0 4-6 8-6 8s-6-4-6-8z" fill="${M}" opacity=".9"/><path d="M22 8c-2-3 2-4 0-7M32 8c-2-3 2-4 0-7" fill="none" stroke="${M}" stroke-width="2" stroke-linecap="round" opacity=".7"/>`);
  const lock = open => svg(open ? 'מנעול פתוח' : 'מנעול סגור', '0 0 40 48',
    `<path class="shackle" d="M11 23v-9a9 9 0 0 1 18 0v9" fill="none" ${o(4)}/><rect x="5" y="21" width="30" height="23" rx="6" fill="${A}" ${O}/><circle cx="20" cy="30" r="3" fill="${N}"/><path d="M20 31v6" ${o(3)}/>`, 'lock' + (open ? ' open' : ''));
  const stop = svg('תמרור עצור', '0 0 24 24', `<polygon points="8,2 16,2 22,8 22,16 16,22 8,22 2,16 2,8" fill="${R}" stroke="${M}" stroke-width="1.5"/><rect x="6" y="10" width="12" height="4" rx="1" fill="${M}"/>`, 'stop');
  const flag = svg('דגל התחלה', '0 0 16 16', `<path d="M3 15V2" stroke="${N}" stroke-width="2" stroke-linecap="round"/><path d="M4 2h9l-3 3.500 3 3.500H4z" fill="${T}"/>`, 'flag');

  /* ---------- עמדה 1: כרטיסי תדריך ---------- */
  const chain = (x, y, flip = 1) => `<path d="M${x} ${y}c6-10 12 8 18 0s10-8 12 2-8 10-14 12-12 8-4 14" fill="none" stroke="${T}" stroke-width="4" stroke-linecap="round" transform="scale(${flip} 1)" transform-origin="${x + 14} ${y}"/>`;
  const bact = (x, y, r = 0) => `<g transform="translate(${x} ${y}) rotate(${r})"><rect x="-13" y="-8" width="26" height="16" rx="8" fill="${T}" ${o(2)}/><circle cx="-4" cy="-2" r="1.3" fill="${N}"/><circle cx="4" cy="-2" r="1.3" fill="${N}"/><path d="M-4 2q4 4 8 0" fill="none" ${o(1.6)}/></g>`;
  const antibody = (x, y, r) => `<g transform="translate(${x} ${y}) rotate(${r})"><path d="M0 22V8M0 8l-8-10M0 8l8-10" fill="none" stroke="${R}" stroke-width="4" stroke-linecap="round"/></g>`;
  const brief1 = [
    svg('כוס חלב שקופה, ובתוכה מולקולות סוכר לקטוז בצורת משושים וחלבונים בצורת שרשראות מקופלות', '0 0 320 170',
      `<path d="M104 18h112l-12 136a8 8 0 0 1-8 7h-72a8 8 0 0 1-8-7z" fill="${M}" ${O}/><path d="M107 44h106l-10 110a8 8 0 0 1-8 7h-70a8 8 0 0 1-8-7z" fill="${P}" opacity=".55"/>` +
      hex(132, 70, 9) + hex(186, 62, 9) + hex(150, 132, 9) + hex(190, 118, 9) + hex(128, 108, 9) +
      chain(146, 84) + chain(168, 100, -1) +
      `<path d="M224 62h22M96 112H74" ${o(1.8)} fill="none" stroke-dasharray="3 4"/>` + txt(274, 58, 'סוכר', 14) + txt(274, 74, '(לקטוז)', 12) + txt(46, 116, 'חלבונים', 14)),
    svg('מעי מסוגנן: מולקולות לקטוז שלמות מגיעות למעי הגס, שם חיידקים מחייכים מתסיסים אותן ונוצרות בועות גז', '0 0 320 170',
      `<path d="M14 40h110c26 0 26 44 0 44H96c-26 0-26 50 6 50h204" fill="none" stroke="${N}" stroke-width="42" stroke-linecap="round"/><path d="M14 40h110c26 0 26 44 0 44H96c-26 0-26 50 6 50" fill="none" stroke="${M}" stroke-width="36" stroke-linecap="round"/><path d="M108 134h198" fill="none" stroke="${P}" stroke-width="36" stroke-linecap="round"/>` +
      hex(40, 40, 8) + hex(84, 40, 8) + hex(120, 84, 8) + hex(150, 134, 8) +
      bact(200, 132, -8) + bact(250, 136, 10) +
      `<g fill="none" ${o(2)}><circle class="bub b1" cx="218" cy="106" r="5"/><circle class="bub b2" cx="266" cy="104" r="7"/><circle class="bub b3" cx="238" cy="94" r="4"/><circle class="bub b1" cx="290" cy="112" r="4"/></g>` +
      txt(210, 30, 'מעי דק', 13) + txt(262, 166, 'מעי גס', 13, N)),
    svg('תא של מערכת החיסון, ונוגדנים בצורת האות Y שנצמדים לחלבון חלב. לידם סימן אזהרה', '0 0 320 170',
      `<circle cx="78" cy="88" r="54" fill="${M}" ${O}/><circle cx="66" cy="94" r="22" fill="${T}" opacity=".8"/><path d="M118 54l12-8M130 96l14 2M112 128l10 10" ${o(2.5)} fill="none"/>` +
      `<g transform="translate(176 62)"><path d="M0 26c8-14 18 8 28-2s12-16 20-6 2 20-8 22-16 10-6 18" fill="none" stroke="${T}" stroke-width="6" stroke-linecap="round"/>${[[0, 26], [14, 22], [28, 24], [40, 14], [48, 20], [44, 34], [34, 42], [30, 54]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5" fill="${T}" ${o(1.6)}/>`).join('')}</g>` +
      antibody(160, 78, 100) + antibody(204, 36, 190) + antibody(238, 112, -75) +
      `<path d="M276 22l20 34h-40z" fill="${A}" ${O}/><path d="M276 34v10" ${o(3)}/><circle cx="276" cy="50" r="1.800" fill="${N}"/>` +
      txt(78, 160, 'תא חיסון', 13) + txt(204, 150, 'חלבון חלב', 13)),
    svg('מיכל תסיסה מנירוסטה עם חלון עגול, ובתוכו מיקרואורגניזמים שמפרישים חלבונים', '0 0 320 170',
      tank(160, 80, 1.7) +
      `<g fill="${T}" ${o(1.5)}><circle cx="226" cy="70" r="5"/><circle cx="246" cy="92" r="5"/><circle cx="232" cy="114" r="5"/><circle cx="262" cy="64" r="5"/></g><path d="M196 84h18" ${o(2)} fill="none" stroke-dasharray="3 4"/>` +
      txt(262, 140, 'חלבון BLG', 13) + `<g opacity=".9">${cow(56, 78, 2)}</g><path d="M26 108l60-60" stroke="${R}" stroke-width="6" stroke-linecap="round"/>` + txt(56, 140, 'בלי פרה', 13)),
  ];

  /* ---------- עמדה 2 ---------- */
  const beadCols = [T, A, R, N];
  const pipeline = svg('פס ייצור תאי: סליל DNA, ממנו עותק mRNA בצורת סרט, ריבוזום שקורא את הסרט, ושרשרת חרוזים של חומצות אמינו שיוצאת ממנו', '0 0 340 120',
    helix(8, 46, 6) + arrow(76, 46, 96) +
    `<path d="M106 46q6 -10 12 0t12 0t12 0t12 0t12 0" fill="none" stroke="${A}" stroke-width="5" stroke-linecap="round"/>` + arrow(176, 46, 196) +
    `<ellipse cx="232" cy="54" rx="26" ry="18" fill="${P}" ${O}/><ellipse cx="232" cy="32" rx="18" ry="12" fill="${P}" ${O}/><path d="M204 46h56" stroke="${A}" stroke-width="5" stroke-linecap="round"/>` +
    `<path d="M258 30c10-14 22-8 30 0s16 12 30 4" fill="none" ${o(2)}/>` + [[262, 26], [276, 21], [290, 31], [304, 38], [318, 34]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="7" fill="${beadCols[i % 4]}" ${o(1.8)}/>`).join('') +
    txt(38, 96, 'DNA', 13, N, 'direction="ltr"') + txt(136, 96, 'mRNA', 13, N, 'direction="ltr"') + txt(232, 96, 'ריבוזום', 13) + txt(296, 96, 'חלבון', 13), 'wide');

  /* ---------- עמדה 3: איורי הכרטיסים (מפתח = מזהה כרטיס, לא הסדר הנכון) ---------- */
  const stepInner = {
    copy: cow(18, 16, 1.1) + helix(6, 44, 3) + `<rect x="38" y="30" width="30" height="20" rx="4" fill="${N}"/><rect x="42" y="26" width="22" height="6" rx="2" fill="${M}" ${o(1.5)}/><rect x="40" y="48" width="26" height="20" rx="2" fill="${M}" ${o(1.5)}/>` + helix(43, 58, 2, A, N, 2.5),
    insert: helix(4, 14, 2, A, N, 3) + `<path d="M26 18c8 2 12 8 14 14" fill="none" ${o(2.5)}/><path d="M34 30l6 3 2-7" fill="none" ${o(2.5)}/>` + yeast(46, 48, 1.15) + `<path d="M4 64c8-2 12-10 20-10M12 60c2-8 0-12-4-16" fill="none" stroke="${P}" stroke-width="6" stroke-linecap="round"/><path d="M4 64c8-2 12-10 20-10M12 60c2-8 0-12-4-16" fill="none" ${o(1.2)} opacity=".5"/>`,
    grow: tank(36, 38, 0.85),
    secrete: `<ellipse cx="26" cy="38" rx="17" ry="21" fill="${P}" ${O}/><circle cx="22" cy="40" r="6" fill="${T}" opacity=".7"/><path d="M44 30l8-4M46 40h9M44 50l8 5" fill="none" ${o(2)}/><g fill="${T}" ${o(1.3)}><circle cx="57" cy="22" r="4"/><circle cx="62" cy="40" r="4"/><circle cx="57" cy="58" r="4"/><circle cx="67" cy="29" r="3"/><circle cx="67" cy="52" r="3"/></g>`,
    filter: `<path d="M22 6h28l-10 16v8h-8v-8z" fill="${M}" ${O}/><path d="M26 12h20" ${o(1.5)} stroke-dasharray="2 3"/>` + bottle(36, 52, 0.75, `<rect x="-9" y="2" width="18" height="15" fill="${T}" opacity=".6"/>`) + `<path d="M10 34c-4 6-6 9-6 12a6 6 0 0 0 12 0c0-3-2-6-6-12z" fill="${A}" ${o(1.8)}/><rect x="54" y="20" width="13" height="13" rx="2" fill="${M}" ${o(1.8)}/>` + txt(60, 58, 'Ca', 13, N, 'direction="ltr"'),
  };
  const stepLabels = {
    copy: 'פרה עם סליל DNA, ולידה עותק של הסליל שיוצא ממכונת צילום',
    insert: 'קטע DNA קטן נכנס בחץ לתא שמר ולקצה של קור פטרייה',
    grow: 'מיכל תסיסה מנירוסטה עם בועות ותאים קטנים בחלון',
    secrete: 'תא שמשחרר החוצה נקודות חלבון קטנות',
    filter: 'משפך סינון מעל בקבוק, וסביבו טיפת שמן, קוביית סוכר וסמל Ca',
  };
  const step = k => svg(stepLabels[k], '0 0 72 72', stepInner[k], 'stepart');
  const line = svg('פס הייצור המלא: העתקת הגן, הכנסה למיקרואורגניזם, ריבוי במיכל, הפרשת החלבון, סינון ובקבוק שמתמלא', '0 0 350 96',
    ['copy', 'insert', 'grow', 'secrete'].map((k, i) => `<g transform="translate(${4 + i * 70} 16) scale(.72)">${stepInner[k]}</g>` + arrow(58 + i * 70, 42, 70 + i * 70, 'flow')).join('') +
    `<g transform="translate(316 46)">${bottle(0, 0, 1.25, `<clipPath id="bfill"><path d="M-11-4l6-9h10l6 9v24h-22z"/></clipPath><rect class="fillup" x="-12" y="-14" width="24" height="36" fill="${T}" opacity=".75" clip-path="url(#bfill)"/>`)}</g>`, 'wide lineart');

  /* ---------- עמדה 4: אנימציית ג'ל ---------- */
  const gelAnim = svg('ג\'ל: טיפה נכנסת לבאר, וחלבונים בגדלים שונים רצים למטה. הקטנים מגיעים רחוק, הגדולים נשארים למעלה', '0 0 240 190',
    `<rect x="60" y="14" width="120" height="166" rx="8" fill="#DCE7EE" ${O}/><rect x="96" y="22" width="48" height="10" rx="3" fill="${N}" opacity=".35"/>
     <path class="gdrop" d="M120 0c-5 7-7 10-7 13a7 7 0 0 0 14 0c0-3-2-6-7-13z" fill="${T}"/>
     <rect class="gband g1" x="94" y="26" width="52" height="11" rx="5.500" fill="${N}"/><rect class="gband g2" x="98" y="26" width="44" height="9" rx="4.500" fill="${N}"/><rect class="gband g3" x="102" y="26" width="36" height="7" rx="3.500" fill="${N}"/><rect class="gband g4" x="106" y="26" width="28" height="6" rx="3" fill="${N}"/>
     <path d="M196 34v132M190 158l6 9 6-9" fill="none" stroke="${M}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>` +
    txt(30, 50, 'גדולים', 13, M) + txt(30, 160, 'קטנים', 13, M), 'gelanim');

  /* ---------- סיום ---------- */
  const folder = svg('תיק חקירה סגור', '0 0 200 150', `<path d="M10 34a8 8 0 0 1 8-8h52l14 14h98a8 8 0 0 1 8 8v86a8 8 0 0 1-8 8H18a8 8 0 0 1-8-8z" fill="${P}" ${O}/><path d="M10 54h180" ${o(2)} opacity=".4"/><rect x="26" y="68" width="70" height="8" rx="4" fill="${N}" opacity=".25"/><rect x="26" y="84" width="46" height="8" rx="4" fill="${N}" opacity=".25"/>`, 'folder');
  const schnitzel = svg('צלחת עם שניצל, ולידה כוס קפוצ\'ינו', '0 0 420 220',
    `<ellipse cx="150" cy="130" rx="132" ry="70" fill="${M}" ${O}/><ellipse cx="150" cy="130" rx="96" ry="48" fill="none" ${o(1.5)} opacity=".3"/>
     <path d="M78 122c-4-30 34-46 66-40 30-10 78 2 76 36-2 30-40 44-74 38-30 8-64-6-68-34z" fill="${A}" ${O}/><g fill="${N}" opacity=".35"><circle cx="112" cy="112" r="3"/><circle cx="150" cy="100" r="3"/><circle cx="186" cy="118" r="3"/><circle cx="134" cy="138" r="3"/><circle cx="170" cy="142" r="3"/><circle cx="102" cy="134" r="2.500"/><circle cx="198" cy="100" r="2.500"/></g>
     <path d="M212 158a26 26 0 0 1 48-20z" fill="${P}" ${O}/>
     <ellipse cx="346" cy="176" rx="64" ry="16" fill="${M}" ${O}/><path d="M384 112h10a16 16 0 0 1 0 32h-12" fill="none" ${o(5)}/><path d="M304 96h84v36a38 38 0 0 1-38 38h-8a38 38 0 0 1-38-38z" fill="${M}" ${O}/><ellipse cx="346" cy="97" rx="42" ry="10" fill="${P}" ${O}/><path d="M336 96c0-5 10-5 10 0 0-5 10-5 10 0 0 4-10 7-10 7s-10-3-10-7z" fill="${M}"/>
     <path d="M330 78c-4-8 4-10 0-18M350 76c-4-8 4-10 0-18" fill="none" stroke="${M}" stroke-width="3" stroke-linecap="round" opacity=".7"/>`, 'wide');

  /* ---------- אייקוני ממשק: קו אחיד, צבע לפי הטקסט ---------- */
  const I = d => `<svg class="ui" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const speaker = '<path d="M4 9.500v5h3.500L12 18V6L7.500 9.500z"/>';
  const ui = {
    check: I('<path d="M5 12.500l4.500 4.500L19 7.500"/>'),
    x: I('<path d="M6.500 6.500l11 11M17.500 6.500l-11 11"/>'),
    back: I('<path d="M5 12h14M13 6l6 6-6 6"/>'),
    next: I('<path d="M14.500 6l-6 6 6 6"/>'),
    chev: I('<path d="M6 9.500l6 6 6-6"/>'),
    soundOn: I(speaker + '<path d="M15.500 9a4 4 0 0 1 0 6M18 6.500a7.500 7.500 0 0 1 0 11"/>'),
    soundOff: I(speaker + '<path d="M16 9.500l5 5M21 9.500l-5 5"/>'),
    doc: I('<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M10 12h5M10 16h5"/>'),
    hint: I('<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3.500 7.500L12 13l8.500-5.500"/>'),
    zoom: I('<circle cx="10.500" cy="10.500" r="6"/><path d="M15 15l5 5M8 10.500h5M10.500 8v5"/>'),
    lock: I('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
    unlock: I('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.600-1.800"/>'),
    clock: I('<circle cx="12" cy="12" r="8.500"/><path d="M12 7.500V12l3 2"/>'),
    pause: I('<path d="M9 6v12M15 6v12"/>'),
    tap: I('<path d="M9 11.500V5.500a1.500 1.500 0 0 1 3 0v5l4.800 1.300a2 2 0 0 1 1.400 2.400L17.500 20h-6.500l-3.600-4.300a1.500 1.500 0 0 1 2-2.200z"/>'),
    pen: I('<path d="M4 20l1-4L16 5l3 3L8 19z"/><path d="M14 7l3 3"/>'),
    star: '<svg class="ui star" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.700 5.600 6.100.800-4.500 4.300 1.100 6.100L12 16.900l-5.400 2.900 1.100-6.100-4.500-4.300 6.100-.800z"/></svg>',
  };

  /* ---------- פתיחה: כוס הקפוצ'ינו תחת סריקה ---------- */
  const heroScan = svg('כוס קפוצ\'ינו בתוך מסגרת סריקה של מעבדה', '0 0 220 150',
    `<g fill="none" stroke="${T}" stroke-width="2.5" stroke-linecap="round"><path d="M14 34V14h20M186 14h20v20M206 116v20h-20M34 136H14v-20"/></g>
     <g stroke="${M}" stroke-opacity=".14" stroke-width="1"><path d="M14 54h192M14 96h192M68 14v122M152 14v122"/></g>
     <g fill="none" stroke="${M}" stroke-width="3.500" stroke-linecap="round" stroke-linejoin="round">
       <path d="M140 66h9a13 13 0 0 1 0 26h-9"/><path d="M76 58h64v24a30 30 0 0 1-30 30h-4a30 30 0 0 1-30-30z"/>
       <path d="M62 122h92" opacity=".6"/><path class="steam s1" d="M96 46c-4-6 4-8 0-15"/><path class="steam s2" d="M118 46c-4-6 4-8 0-15"/></g>
     <path d="M96 80c0-7 12-7 12 0 0-7 12-7 12 0 0 8-12 15-12 15s-12-7-12-15z" fill="${M}" opacity=".9"/>
     <g class="scanline"><rect x="18" y="0" width="184" height="18" fill="url(#scanfade)"/><path d="M18 18h184" stroke="${T}" stroke-width="2"/></g>
     <defs><linearGradient id="scanfade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${T}" stop-opacity="0"/><stop offset="1" stop-color="${T}" stop-opacity=".28"/></linearGradient></defs>
     <g font-family="JetBrains Mono, monospace" font-size="9" font-weight="700" fill="${T}"><text x="20" y="146" direction="ltr">SAMPLE 0418</text><text x="200" y="146" text-anchor="end" direction="ltr">SCANNING</text></g>`, 'heroscan');

  window.ART = { icon, avatar, drink, cup, lock, stop, flag, brief1, pipeline, step, line, gelAnim, folder, schnitzel, beadCols, ui, heroScan };
})();
