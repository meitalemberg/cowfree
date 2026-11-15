/* מסך המורה: פתיחת שיעור, לוח צוותים חי, פקדים, קיר תשובות ומסכי הטוויסט. */
(function () {
  'use strict';
  const C = window.CONTENT, ART = window.ART;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const root = $('#t'), over = $('#over');
  const TK = 'cowfree.teacher', IMG = 'cowfree.label', MK = 'cowfree.marks';
  const STUCK_MS = 7 * 60000;

  /* רשימת רכיבים לדוגמה לשקף 2. החליפו ברשימה מהתווית האמיתית שלכם. */
  const INGREDIENTS = ['מים', 'חלבון חלב מתסיסה (בטא-לקטוגלובולין)', 'שמן צמחי', 'סוכר', 'סיבים תזונתיים', 'סידן פוספט', 'מלח', 'מווסת חומציות', 'מייצב', 'חומר מתחלב', 'חומרי טעם וריח', 'ויטמין D', 'ויטמין B12'];

  let T = null, st = null, tab = 'lobby', joinBase = location.origin, lastJson = '', twistOpen = false, slide = 1;
  try { T = JSON.parse(localStorage.getItem(TK) || 'null'); } catch (e) { T = null; }

  const mmss = s => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  async function api(path, body) {
    const r = await fetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined);
    if (!r.ok) throw Object.assign(new Error('http'), { status: r.status });
    return r.json();
  }
  const ctl = (action, extra) => api(`/api/session/${T.code}/control`, Object.assign({ key: T.key, action }, extra)).then(poll).catch(() => flash('הפעולה לא נשלחה. בדקו את החיבור לשרת.'));
  function flash(msg) {
    $$('.toast').forEach(x => x.remove());
    const el = document.body.appendChild(Object.assign(document.createElement('div'), { className: 'toast', textContent: msg }));
    setTimeout(() => el.remove(), 3500);
  }

  /* ================= פתיחה ================= */
  function landing() {
    root.innerHTML = `<section class="landing"><div class="stamp red tilt">מסך מורה</div><p class="kicker">המעבדה לבטיחות מזון</p>
      <h1>תיק חקירה מס׳ <bdi>0418</bdi></h1><p class="sub">הקפוצ'ינו שלא היה אמור להזיק · חדר בריחה של 30 דקות</p>
      <button class="btn" id="new">שיעור חדש</button>
      <p class="fine">נוצר קוד כניסה בן 4 ספרות וקוד QR להקרנה. נשמרים רק שמות צוותים ותשובות.</p></section>`;
    $('#new').onclick = async () => {
      try {
        const d = await api('/api/session', {});
        T = { code: d.code, key: d.key }; localStorage.setItem(TK, JSON.stringify(T));
        tab = 'lobby'; shell(); poll();
      } catch (e) { flash('לא הצלחנו לפתוח שיעור. השרת רץ?'); }
    };
  }

  /* ================= שלד ================= */
  function shell() {
    root.innerHTML = `<header class="tbar">
        <div class="brand"><b>תיק <bdi>0418</bdi></b><span>מסך מורה</span></div>
        <div class="codechip">קוד שיעור <b class="mono" dir="ltr">${esc(T.code)}</b></div>
        <div class="chip" id="status"></div>
        <div class="ctrl">
          <button class="tb primary" id="b-start"></button>
          <button class="tb" id="b-1" title="מוסיף דקה לכל הצוותים">+1 דק׳</button>
          <button class="tb" id="b-5" title="מוסיף 5 דקות לכל הצוותים">+5 דק׳</button>
          <button class="tb" id="b-twist">מסכי הטוויסט</button>
          <button class="tb" id="b-exit"></button>
          <button class="tb" id="b-csv">ייצוא CSV</button>
          <button class="tb danger" id="b-reset">איפוס שיעור</button>
        </div></header>
      <nav class="tabs" role="tablist">${[['lobby', 'כניסה'], ['board', 'לוח צוותים'], ['wall', 'קיר תשובות']].map(([k, l]) => `<button role="tab" data-tab="${k}">${l}<span class="count" data-count="${k}"></span></button>`).join('')}
        <button class="tb small ghosty" id="b-close">סגירת השיעור</button></nav>
      <main id="tmain"></main>`;
    $$('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; lastJson = ''; paint(); });
    $('#b-start').onclick = () => ctl(!st || !st.started ? 'start' : st.paused ? 'resume' : 'pause');
    $('#b-1').onclick = () => ctl('addMin', { value: 1 });
    $('#b-5').onclick = () => ctl('addMin', { value: 5 });
    $('#b-twist').onclick = openTwist;
    $('#b-exit').onclick = () => {
      if (!st) return;
      if (!st.exitReleased && !confirm('לשחרר את כרטיס היציאה? כל הטלפונים יעברו אליו, גם של צוותים שלא סיימו.')) return;
      ctl('exit', { value: !st.exitReleased });
    };
    $('#b-csv').onclick = csv;
    $('#b-reset').onclick = () => { if (confirm('לאפס את השיעור? כל הצוותים והתשובות יימחקו. כדאי לייצא CSV קודם.')) ctl('reset'); };
    $('#b-close').onclick = () => { if (confirm('לסגור את השיעור במחשב הזה ולחזור למסך הפתיחה? הקוד הנוכחי לא יהיה זמין יותר מכאן.')) { localStorage.removeItem(TK); T = null; st = null; landing(); } };
  }

  /* ================= משיכת מצב ================= */
  async function poll() {
    if (!T) return;
    try {
      st = await api(`/api/session/${T.code}/state?key=${encodeURIComponent(T.key)}`);
      paint();
    } catch (e) {
      if (e.status === 404 || e.status === 403) { localStorage.removeItem(TK); T = null; st = null; landing(); flash('השיעור הקודם כבר לא קיים. פתחו שיעור חדש.'); }
      else { const s = $('#status'); if (s) { s.textContent = 'אין חיבור לשרת'; s.className = 'chip bad'; } }
    }
  }
  const teams = () => (st ? st.teams : []).slice().sort((a, b) => a.joinedAt - b.joinedAt);
  function teamStatus(t) {
    if (t.exitSent) return 'כרטיס יציאה ✓';
    if (t.screen === 'exit') return 'כרטיס יציאה';
    if (t.verdict && t.verdict.sent) return 'סיים · ממתין';
    if (t.station === 5) return 'פסק דין';
    if (t.station >= 1) return 'עמדה ' + t.station;
    return { chat: 'שיחת הוואטסאפ', dispute: 'המחלוקת', letter: 'מכתב המשימה' }[t.screen] || 'פתיחה';
  }
  const isStuck = t => st.started && !st.paused && t.running && t.station >= 1 && t.station <= 4 && st.now - t.stationSince > STUCK_MS;

  function paint() {
    if (!st || !$('#tmain')) return;
    const list = teams();
    const s = $('#status');
    s.textContent = !st.started ? 'ממתין להתחלה' : st.paused ? 'מושהה' : 'המשחק רץ';
    s.className = 'chip ' + (!st.started ? '' : st.paused ? 'warn' : 'good');
    $('#b-start').textContent = !st.started ? '▶ התחילו משחק' : st.paused ? '▶ המשך' : '❚❚ השהיה';
    $('#b-exit').textContent = st.exitReleased ? 'כרטיס היציאה שוחרר ✓' : 'שחרור כרטיס יציאה';
    $('#b-exit').classList.toggle('on', st.exitReleased);
    $('#b-1').title = $('#b-5').title = `נוספו עד עכשיו ${st.extraMin} דקות`;
    $$('[data-tab]').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === tab));
    $('[data-count="lobby"]').textContent = list.length ? ' ' + list.length : '';
    const stuck = list.filter(isStuck).length;
    $('[data-count="board"]').textContent = stuck ? ' ⚠' + stuck : '';
    $('[data-count="wall"]').textContent = list.filter(t => t.verdict.sent).length ? ' ' + list.filter(t => t.verdict.sent).length : '';

    const main = $('#tmain');
    if (tab === 'lobby') {
      if (!$('#qr')) { main.innerHTML = lobbyHtml(); drawQr(); }
      $('#joined').innerHTML = list.length
        ? list.map(t => `<span class="tchip">${ART.icon(t.icon in { microscope: 1, tube: 1, dna: 1, yeast: 1 } ? t.icon : 'tube')}${esc(t.name)}</span>`).join('')
        : '<span class="empty">עוד אין צוותים. מחכים לסריקה הראשונה…</span>';
    } else {
      // מציירים מחדש רק כשהנתונים השתנו, כדי לא לשבור בחירת טקסט וגלילה
      const json = JSON.stringify([tab, list.map(t => Object.assign({}, t, { lastSeen: st.now - t.lastSeen > 12000, stuck: isStuck(t) })), st.started, st.paused]);
      if (json !== lastJson) { lastJson = json; main.innerHTML = tab === 'board' ? boardHtml(list) : wallHtml(list); bindMain(); }
    }
    if (twistOpen) paintVote();
  }

  /* ================= כניסה ================= */
  const joinUrl = () => `${joinBase}/?c=${T.code}`;
  function lobbyHtml() {
    const local = /^(localhost|127\.|\[::1\])/.test(location.hostname) && joinBase === location.origin;
    return `<section class="lobby"><div class="qrcard"><div id="qr" role="img" aria-label="קוד QR לכניסה למשחק"></div></div>
      <div class="lobbyside"><p class="kicker">סרקו או הקלידו</p><p class="joinurl" dir="ltr">${esc(joinUrl().replace(/^https?:\/\//, ''))}</p>
        <p class="bigcode">קוד שיעור <b class="mono" dir="ltr">${esc(T.code)}</b></p>
        ${local ? '<p class="warnbox">המסך נפתח מ-localhost, ולא נמצאה כתובת ברשת המקומית. טלפונים לא יוכלו לסרוק את הקוד הזה. ודאו שהמחשב מחובר ל-Wi-Fi ורעננו.</p>' : ''}
        <h2>צוותים שהצטרפו</h2><div id="joined" class="joined"></div>
        <p class="fine">טלפון אחד לצוות. כשכולם במכתב המשימה, לחצו "התחילו משחק" למעלה.</p></div></section>`;
  }
  function drawQr() {
    try {
      const qr = window.qrcode(0, 'M'); qr.addData(joinUrl()); qr.make();
      $('#qr').innerHTML = qr.createSvgTag({ cellSize: 8, margin: 2, scalable: true });
    } catch (e) { $('#qr').innerHTML = '<p class="warnbox">לא ניתן ליצור קוד QR. השתמשו בכתובת ובקוד השיעור.</p>'; }
  }

  /* ================= לוח צוותים ================= */
  function boardHtml(list) {
    if (!list.length) return '<p class="empty big">עוד אין צוותים. עברו ללשונית "כניסה" והקרינו את קוד ה-QR.</p>';
    return `<table class="teams"><thead><tr><th>צוות</th><th>איפה עכשיו</th><th>ראיות</th><th>זמן</th><th>רמזים</th><th>קודים שגויים</th><th></th></tr></thead><tbody>
      ${list.map(t => {
        const stuck = isStuck(t), gone = st.now - t.lastSeen > 12000;
        return `<tr class="${stuck ? 'stuck' : ''} ${gone ? 'gone' : ''}">
          <th scope="row"><span class="tname">${ART.icon(t.icon in { microscope: 1, tube: 1, dna: 1, yeast: 1 } ? t.icon : 'tube')}${esc(t.name)}</span>${gone ? '<small class="badge">מנותק</small>' : ''}</th>
          <td>${teamStatus(t)}${stuck ? ` <small class="badge amber">⚠ תקוע ${Math.floor((st.now - t.stationSince) / 60000)} דק׳</small>` : ''}</td>
          <td><span class="pips">${[0, 1, 2, 3].map(i => `<i class="${t.solved[i] ? 'done' : ''}">${t.solved[i] ? '✓' : i + 1}</i>`).join('')}</span></td>
          <td class="mono" dir="ltr">${t.station ? mmss(t.elapsed) : '–'}</td><td class="num">${t.hints}</td><td class="num">${t.wrong}</td>
          <td>${t.running && t.station >= 1 && t.station <= 4 ? `<button class="tb small" data-skip="${esc(t.id)}" data-name="${esc(t.name)}" data-st="${t.station}">דלגו על עמדה ${t.station}</button>` : ''}</td></tr>`;
      }).join('')}</tbody></table>
      <p class="fine">הזמן כולל דקות קנס על רמזים. צוות שנמצא יותר מ-7 דקות באותה עמדה מסומן בענבר.</p>`;
  }

  /* ================= קיר תשובות ================= */
  function wallHtml(list) {
    if (!list.length) return '<p class="empty big">התשובות יופיעו כאן כשצוותים יתחילו לכתוב.</p>';
    return `<div class="wall">${list.map(t => {
      const v = t.verdict;
      return `<article class="wcard"><h2>${ART.icon(t.icon in { microscope: 1, tube: 1, dna: 1, yeast: 1 } ? t.icon : 'tube')}${esc(t.name)}</h2>
        <h3>משפטי גשר</h3><ol class="bridges">${[0, 1, 2, 3].map(i => `<li>${t.bridges[i] ? esc(t.bridges[i]) : '<i class="empty">עוד לא נכתב</i>'}</li>`).join('')}</ol>
        <h3>פסק הדין</h3>${v.sent ? `<div class="vmini"><p><b>בית הקפה ${esc(v.cafe)}</b>, כי ${esc(v.cafeWhy)}</p><p><b>אמא של נועה ${esc(v.mom)}</b>, כי ${esc(v.momWhy)}</p><p><b>בתפריט:</b> ${esc(v.menu)}</p></div>
          <button class="tb small" data-show="${esc(t.id)}">הצגה במסך מלא</button>` : '<p><i class="empty">עוד לא נשלח</i></p>'}
        ${t.exitSent ? `<h3>כרטיס יציאה</h3><p>${esc(t.exitAnswer)}</p>` : ''}</article>`;
    }).join('')}</div>`;
  }
  function bindMain() {
    $$('[data-skip]').forEach(b => b.onclick = () => { if (confirm(`לפתוח לצוות "${b.dataset.name}" את עמדה ${b.dataset.st} בלי קוד?`)) ctl('skip', { teamId: b.dataset.skip }); });
    $$('[data-show]').forEach(b => b.onclick = () => showVerdict(b.dataset.show));
  }
  function showVerdict(id) {
    const t = st.teams.find(x => x.id === id); if (!t) return;
    const v = t.verdict;
    over.innerHTML = `<div class="full" role="dialog" aria-modal="true"><button class="x" data-x aria-label="סגירה">✕</button>
      <article class="paper legalfull"><h1>פסק הדין של צוות ${esc(t.name)}</h1>
        <section><h2>1. בית הקפה <mark>${esc(v.cafe)}</mark></h2><p>כי ${esc(v.cafeWhy)}</p></section>
        <section><h2>2. אמא של נועה <mark>${esc(v.mom)}</mark></h2><p>כי ${esc(v.momWhy)}</p></section>
        <section><h2>3. מה צריך לכתוב בתפריט</h2><div class="chalk"><span class="chalk-line">${esc(v.menu)}</span>${ART.cup}</div></section>
        <div class="stamp tilt big">נחתם</div></article></div>`;
    $('[data-x]', over).onclick = () => { over.innerHTML = ''; };
  }

  /* ================= מסכי הטוויסט ================= */
  function miniGel() {
    const lanes = C.stations[4].lanes.slice(0, 2);
    return `<svg viewBox="0 0 150 150" class="minigel" role="img" aria-label="תזכורת מהג'ל: שישה פסים בחלב פרה, פס אחד בחלב ללא פרה"><rect x="2" y="2" width="146" height="146" rx="8" fill="#DCE7EE"/>
      ${lanes.map((l, i) => l.bands.map(b => `<rect x="${18 + i * 64}" y="${8 + b * 11}" width="50" height="7" rx="3.5" fill="${b === 9 ? '#0B6E63' : '#14305C'}" opacity="${b === 9 ? 1 : .8}"/>`).join('')).join('')}</svg>`;
  }
  function twistHtml() {
    const img = localStorage.getItem(IMG);
    return `<div class="twist" role="dialog" aria-modal="true" aria-label="מסכי הטוויסט">
      <div class="tw-top"><span class="kicker">טוויסט <bdi id="tw-n"></bdi> / 3</span><button class="x" id="tw-x" aria-label="סגירת מסכי הטוויסט">✕</button></div>
      <section class="slide" data-s="1"><h1>רגע, איך זה אפשרי?</h1>
        <div class="labelbox" id="labelbox">${img ? `<img src="${img}" alt="תמונת התווית של המוצר"><div class="mark" data-m="0"><i></i></div><div class="mark" data-m="1"><i></i></div>` : '<div class="noimg"><p>כאן תופיע תמונת התווית.</p><p class="fine">צלמו את התווית האמיתית והעלו אותה. התמונה נשמרת רק בדפדפן הזה.</p></div>'}</div>
        <div class="twowords"><mark>טבעוני</mark><span>וגם</span><mark>מכיל אלרגן חלב</mark></div>
        <div class="tw-tools"><label class="tb small">העלאת תמונת תווית<input type="file" id="up" accept="image/*" hidden></label>${img ? '<button class="tb small" id="rm">הסרת התמונה</button><span class="fine">גררו את מלבני המרקר אל שתי המילים. את הגודל משנים מהפינה.</span>' : ''}</div></section>
      <section class="slide" data-s="2"><h1>רכיב אחד מול תריסר</h1>
        <div class="cols" dir="ltr"><div class="col" dir="rtl"><h2>${ART.drink('cow')}חלב פרה</h2><ul><li>חלב</li></ul><p class="colnote">רכיב אחד</p></div>
          <div class="col" dir="rtl"><h2>${ART.drink('cf')}חלב ללא פרה</h2><div class="scrollwin"><ul class="scrolling">${INGREDIENTS.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div><p class="colnote">${INGREDIENTS.length} רכיבים</p></div></div>
        <div class="blgline">${miniGel()}<div><p class="big"><bdi>BLG</bdi> הוא רק כ-10% מחלבוני חלב הפרה</p><p>זוכרים את הג'ל? <b class="mono" dir="ltr">6 – 1</b></p></div></div></section>
      <section class="slide" data-s="3"><h1>חידת יוסי</h1>
        <div class="yossi">${ART.schnitzel}<div><p class="big">האם זה חלב?</p><p class="q2">מה קובע: מה המולקולה, או מאיפה היא הגיעה?</p></div></div>
        <div class="votebars" id="votebars"></div>
        <div class="tw-tools"><button class="tb primary" id="reveal">חשיפת התשובה</button><span class="fine" id="votecount"></span></div>
        <p class="answer" id="answer" hidden>${esc(C.vote.answer)}</p></section>
      <div class="tw-nav"><button class="tb" id="tw-prev">→ הקודם</button><span class="tw-dots">${[1, 2, 3].map(i => `<i data-d="${i}"></i>`).join('')}</span><button class="tb primary" id="tw-next">הבא ←</button></div></div>`;
  }
  function openTwist() {
    twistOpen = true;
    slide = st && st.twist.slide ? st.twist.slide : 1;
    over.innerHTML = twistHtml();
    bindTwist(); showSlide();
  }
  function closeTwist() { twistOpen = false; over.innerHTML = ''; document.removeEventListener('keydown', twistKeys); ctl('twist', { slide: 0 }); }
  function twistKeys(e) {
    if (e.target.matches('input, textarea')) return;
    if (e.key === 'ArrowLeft' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); go(slide + 1); }
    if (e.key === 'ArrowRight' || e.key === 'PageUp') { e.preventDefault(); go(slide - 1); }
    if (e.key === 'Escape') closeTwist();
  }
  function go(n) { slide = Math.max(1, Math.min(3, n)); showSlide(); }
  function showSlide() {
    $$('.slide', over).forEach(s => s.classList.toggle('on', +s.dataset.s === slide));
    $$('[data-d]', over).forEach(d => d.classList.toggle('on', +d.dataset.d === slide));
    $('#tw-n').textContent = slide;
    $('#tw-prev').disabled = slide === 1; $('#tw-next').disabled = slide === 3;
    ctl('twist', { slide }); // בשקף 3 השרת פותח את ההצבעה בטלפונים
    paintVote();
  }
  function paintVote() {
    const box = $('#votebars'); if (!box || !st) return;
    const votes = C.vote.options.map(o => st.teams.filter(t => t.vote === o).length), total = votes[0] + votes[1];
    box.innerHTML = C.vote.options.map((o, i) => `<div class="vbar"><b>${esc(o)}</b><div class="track"><div class="fill f${i}" style="width:${total ? Math.round(votes[i] / total * 100) : 0}%"></div></div><span class="mono" dir="ltr">${votes[i]}</span></div>`).join('');
    $('#votecount').textContent = `הצביעו ${total} מתוך ${st.teams.length} צוותים`;
    $('#answer').hidden = !st.twist.reveal;
    $('#reveal').textContent = st.twist.reveal ? 'הסתרת התשובה' : 'חשיפת התשובה';
  }
  function bindTwist() {
    $('#tw-x').onclick = closeTwist;
    $('#tw-prev').onclick = () => go(slide - 1);
    $('#tw-next').onclick = () => go(slide + 1);
    $('#reveal').onclick = () => ctl('reveal', { value: !st.twist.reveal });
    document.addEventListener('keydown', twistKeys);
    $('#up').onchange = e => {
      const f = e.target.files[0]; if (!f) return;
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, 1400 / Math.max(img.width, img.height));
        const cv = Object.assign(document.createElement('canvas'), { width: Math.round(img.width * k), height: Math.round(img.height * k) });
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        try { localStorage.setItem(IMG, cv.toDataURL('image/jpeg', 0.85)); } catch (ex) { flash('התמונה גדולה מדי לשמירה. נסו תמונה קטנה יותר.'); }
        URL.revokeObjectURL(img.src);
        document.removeEventListener('keydown', twistKeys);
        over.innerHTML = twistHtml(); bindTwist(); showSlide();
      };
      img.onerror = () => flash('לא הצלחנו לקרוא את הקובץ. בחרו קובץ תמונה.');
      img.src = URL.createObjectURL(f);
    };
    const rm = $('#rm');
    if (rm) rm.onclick = () => { localStorage.removeItem(IMG); document.removeEventListener('keydown', twistKeys); over.innerHTML = twistHtml(); bindTwist(); showSlide(); };
    bindMarks();
  }
  function bindMarks() {
    const box = $('#labelbox'), marks = $$('.mark', box);
    if (!marks.length) return;
    let pos;
    try { pos = JSON.parse(localStorage.getItem(MK)); } catch (e) { pos = null; }
    if (!Array.isArray(pos) || pos.length !== 2) pos = [{ x: 12, y: 20, w: 26, h: 10 }, { x: 52, y: 60, w: 36, h: 10 }];
    const apply = () => marks.forEach((m, i) => Object.assign(m.style, { left: pos[i].x + '%', top: pos[i].y + '%', width: pos[i].w + '%', height: pos[i].h + '%' }));
    apply();
    marks.forEach((m, i) => {
      let d = null;
      m.addEventListener('pointerdown', e => {
        const r = box.getBoundingClientRect();
        d = { resize: e.target.tagName === 'I', sx: e.clientX, sy: e.clientY, o: Object.assign({}, pos[i]), w: r.width, h: r.height };
        m.setPointerCapture(e.pointerId); e.preventDefault();
      });
      m.addEventListener('pointermove', e => {
        if (!d) return;
        const dx = (e.clientX - d.sx) / d.w * 100, dy = (e.clientY - d.sy) / d.h * 100, p = pos[i];
        if (d.resize) { p.w = Math.max(5, Math.min(100 - p.x, d.o.w + dx)); p.h = Math.max(3, Math.min(100 - p.y, d.o.h + dy)); }
        else { p.x = Math.max(0, Math.min(100 - p.w, d.o.x + dx)); p.y = Math.max(0, Math.min(100 - p.h, d.o.y + dy)); }
        apply();
      });
      const up = () => { if (d) { d = null; localStorage.setItem(MK, JSON.stringify(pos)); } };
      m.addEventListener('pointerup', up); m.addEventListener('pointercancel', up);
    });
  }

  /* ================= CSV ================= */
  function csv() {
    if (!st) return;
    const head = ['צוות', 'סמל', 'מצב', 'ראיות שפוענחו', 'זמן (שניות, כולל קנסות)', 'רמזים', 'קודים שגויים', 'גשר 1', 'גשר 2', 'גשר 3', 'גשר 4', 'בית הקפה', 'בית הקפה: כי', 'אמא של נועה', 'אמא: כי', 'מה לכתוב בתפריט', 'הצבעה', 'כרטיס יציאה'];
    const rows = teams().map(t => [t.name, t.icon, teamStatus(t), t.solved.filter(Boolean).length, t.elapsed, t.hints, t.wrong, ...[0, 1, 2, 3].map(i => t.bridges[i] || ''), t.verdict.cafe, t.verdict.cafeWhy, t.verdict.mom, t.verdict.momWhy, t.verdict.menu, t.vote, t.exitAnswer]);
    // גרש בתחילת תא שמתחיל ב-= + - @ מונע מאקסל לפרש תשובת תלמיד כנוסחה
    const cell = v => { let s = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
    const blob = new Blob(['﻿' + [head, ...rows].map(r => r.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `cowfree-${T.code}-${new Date().toISOString().slice(0, 10)}.csv` });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  /* ================= אתחול ================= */
  (async () => {
    try {
      const info = await api('/api/info');
      if (/^(localhost|127\.)/.test(location.hostname) && info.lan && info.lan[0]) joinBase = info.lan[0];
    } catch (e) { /* נשארים עם הכתובת הנוכחית */ }
    if (T) { shell(); poll(); } else landing();
    setInterval(poll, 2000);
  })();
})();
