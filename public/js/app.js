/* אפליקציית הצוותים: מכונת מצבים של מסכים, שמירה במכשיר וסנכרון עם מסך המורה. */
(function () {
  'use strict';
  const C = window.CONTENT, ART = window.ART;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ltr = s => `<bdi dir="ltr" class="mono">${esc(s)}</bdi>`;
  const KEY = 'cowfree.v1';
  // גרסת תלמיד סטטית (GitHub Pages): בלי שרת ובלי קוד שיעור, תמיד במצב תרגול
  const SOLO = !!window.COWFREE_SOLO;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const app = $('#app'), top = $('#top'), prog = $('#progress'), layer = $('#layer');
  const sys = document.body.appendChild(Object.assign(document.createElement('div'), { id: 'sys' }));

  /* ================= מצב ================= */
  const rid = () => Array.from(crypto.getRandomValues(new Uint8Array(9)), b => b.toString(36).padStart(2, '0')).join('');
  const newStation = () => ({ solved: false, skipped: false, hints: [false, false], freeHint: false, wrong: 0, bridge: '', codeText: '', briefSeen: false, data: {} });
  const fresh = () => ({
    v: 1, teamId: rid(), code: '', prefill: '', epoch: 0, name: '', icon: '', screen: 'join', st: 1, phase: 'brief',
    timer: { startedAt: 0, pausedMs: 0, pauseStart: 0, finishedAt: 0 }, penalties: 0,
    stations: { 1: newStation(), 2: newStation(), 3: newStation(), 4: newStation() },
    verdict: { cafe: '', cafeWhy: '', mom: '', momWhy: '', menu: '', sent: false },
    vote: '', exitAnswer: '', exitSent: false, skipsApplied: 0, sound: false, chatDone: false, justUnlocked: 0,
    net: { started: false, paused: false, extraMin: 0, voteOpen: false, reveal: false, exitReleased: false },
  });
  let S = fresh();
  let online = true;
  let cleanup = null;

  function load() {
    const q = new URLSearchParams(location.search);
    const urlCode = (q.get('c') || '').replace(/\D/g, '').slice(0, 4);
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (saved && saved.v === 1 && !q.has('reset')) S = saved;
    } catch (e) { /* מצב שמור פגום: מתחילים מחדש */ }
    if (SOLO) { S.code = ''; S.prefill = ''; }
    else if (urlCode && urlCode !== S.code) { S = fresh(); S.prefill = urlCode; }
    if (q.has('reset')) history.replaceState(null, '', location.pathname);
  }
  function saveLocal() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* אחסון מלא או חסום */ } }
  let syncT = null;
  function save() { saveLocal(); clearTimeout(syncT); syncT = setTimeout(sync, 300); }

  /* ================= טיימר ================= */
  const started = () => !!S.timer.startedAt;
  function elapsedMs() {
    const t = S.timer;
    if (!t.startedAt) return 0;
    return Math.max(0, (t.finishedAt || t.pauseStart || Date.now()) - t.startedAt - t.pausedMs);
  }
  const remainingMs = () => (C.GAME_MIN + (S.net.extraMin || 0)) * 60000 - elapsedMs() - S.penalties * 60000;
  const mmss = ms => { const s = Math.floor(Math.abs(ms) / 1000); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
  function stopTimer() { if (started() && !S.timer.finishedAt) S.timer.finishedAt = S.timer.pauseStart || Date.now(); }
  function timerView() {
    if (!started()) return { text: mmss(C.GAME_MIN * 60000), cls: 'idle', label: '' };
    const r = remainingMs();
    if (r < 0) return { text: '+' + mmss(r), cls: 'over', label: 'זמן חריגה' };
    return { text: mmss(r), cls: r <= 5 * 60000 ? 'warn' : '', label: '' };
  }

  /* ================= קול ================= */
  let actx = null;
  function sfx(kind) {
    if (!S.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const now = actx.currentTime;
      const tone = (f, at, dur, type, vol) => {
        const o = actx.createOscillator(), g = actx.createGain();
        o.type = type; o.frequency.value = f;
        g.gain.setValueAtTime(vol, now + at); g.gain.exponentialRampToValueAtTime(0.001, now + at + dur);
        o.connect(g).connect(actx.destination); o.start(now + at); o.stop(now + at + dur);
      };
      if (kind === 'msg') { tone(880, 0, 0.09, 'sine', 0.12); tone(1320, 0.08, 0.14, 'sine', 0.1); }
      if (kind === 'lock') { tone(300, 0, 0.05, 'square', 0.08); tone(620, 0.07, 0.12, 'triangle', 0.12); }
      if (kind === 'err') { tone(150, 0, 0.2, 'sawtooth', 0.06); }
    } catch (e) { /* אין אודיו: ממשיכים בשקט */ }
  }
  const buzz = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { /* לא נתמך */ } };

  /* ================= עזרי ממשק ================= */
  function toast(msg) {
    $$('.toast', sys).forEach(t => t.remove());
    const el = document.createElement('div');
    el.className = 'toast'; el.setAttribute('role', 'status'); el.textContent = msg;
    sys.appendChild(el);
    setTimeout(() => el.remove(), 3600);
  }
  function modal(html, cls = '') {
    const el = document.createElement('div');
    el.className = 'modal ' + cls;
    el.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true">${html}</div>`;
    el.addEventListener('click', e => { if (e.target === el || e.target.closest('[data-close]')) el.remove(); });
    layer.appendChild(el);
    const f = $('button, [tabindex]', el); if (f) f.focus();
    return el;
  }
  function drops() {
    if (reduced) return;
    const box = $('#drops');
    box.innerHTML = Array.from({ length: 16 }, () =>
      `<i style="left:${4 + Math.random() * 92}%;animation-delay:${(Math.random() * 0.5).toFixed(2)}s;--s:${(0.7 + Math.random() * 0.7).toFixed(2)}"></i>`).join('');
    setTimeout(() => { box.innerHTML = ''; }, 1600);
  }
  const stamp = (text, cls = '') => `<div class="stamp ${cls}"><span>${esc(text)}</span></div>`;
  const chalk = inner => `<div class="chalk">${inner}</div>`;
  const menuSign = () => chalk(`<span class="chalk-new">${esc(C.menuSign[0])}</span><span class="chalk-line">${esc(C.menuSign[1])}</span>${ART.cup}`);
  const fullBridge = n => { const b = (S.stations[n].bridge || '').trim(); return n === 1 && b ? C.stations[1].bridgePrefix + ' ' + b : b; };
  const curStation = () => { for (let n = 1; n <= 4; n++) if (!S.stations[n].solved) return n; return 5; };

  /* ================= כותרת ומד התקדמות ================= */
  function renderChrome() {
    const withTop = !['join', 'chat'].includes(S.screen);
    top.hidden = !withTop;
    if (withTop) {
      top.innerHTML = `<div class="team">${S.icon ? ART.icon(S.icon) : ''}<b>${esc(S.name)}</b><span class="net" id="net" title="אין חיבור לשרת. ההתקדמות נשמרת במכשיר." ${online || !S.code ? 'hidden' : ''}>לא מקוון</span></div>
        <div class="timer" id="timer" role="timer" aria-live="off"></div>
        <button class="iconbtn" id="snd" aria-pressed="${S.sound}" aria-label="${S.sound ? 'השתקת צלילים' : 'הפעלת צלילים'}">${S.sound ? ART.ui.soundOn : ART.ui.soundOff}</button>`;
      $('#snd').onclick = () => { S.sound = !S.sound; saveLocal(); renderChrome(); sfx('lock'); };
    }
    const withProg = ['board', 'station', 'verdict', 'waiting'].includes(S.screen);
    prog.hidden = !withProg;
    if (withProg) {
      prog.innerHTML = '<ol class="track">' + [1, 2, 3, 4].map(n => {
        const d = S.stations[n].solved;
        return `<li class="pg ${d ? 'done' : ''} ${!d && n === curStation() ? 'cur' : ''}" aria-label="ראיה ${n}: ${d ? 'פוענחה' : 'עוד לא פוענחה'}"><i>${d ? ART.ui.check : n}</i><small>ראיה ${n}</small></li>`;
      }).join('') + '</ol>';
    }
    document.body.dataset.screen = S.screen;
    tick();
  }
  function tick() {
    const el = $('#timer');
    if (el) {
      const v = timerView();
      el.className = 'timer ' + v.cls;
      const html = ART.ui.clock + (v.label ? `<small>${v.label}</small>` : '') + `<span dir="ltr">${v.text}</span>`;
      if (el.dataset.h !== v.text + v.cls) { el.dataset.h = v.text + v.cls; el.innerHTML = html; }
      // פס הזמן שנותר בתחתית הכותרת
      const total = (C.GAME_MIN + (S.net.extraMin || 0)) * 60000;
      top.style.setProperty('--t', started() ? Math.max(0, Math.min(1, remainingMs() / total)).toFixed(4) : 1);
      top.style.setProperty('--tc', v.cls === 'over' ? 'var(--red)' : v.cls === 'warn' ? 'var(--amber)' : 'var(--teal)');
      top.classList.toggle('idle', !started());
    }
    const w = $('#wait-time');
    if (w) { const v = timerView(); w.textContent = (v.label ? v.label + ' ' : '') + v.text; }
    const net = $('#net'); if (net) net.hidden = online || !S.code;
    const paused = S.net.paused && started() && !S.timer.finishedAt;
    let p = $('#pause', sys);
    if (paused && !p) {
      p = document.createElement('div'); p.id = 'pause'; p.className = 'overlay'; p.setAttribute('role', 'alertdialog');
      p.innerHTML = `<div><div class="pause-ico">${ART.ui.pause}</div><h2>המשחק מושהה</h2><p>הטיימר עצר. הסתכלו על המורה.</p></div>`;
      sys.appendChild(p);
    } else if (!paused && p) p.remove();
  }

  /* ================= סנכרון ================= */
  function snapshot() {
    const solved = [1, 2, 3, 4].map(n => S.stations[n].solved);
    return {
      id: S.teamId, name: S.name, icon: S.icon, screen: S.screen,
      station: started() ? curStation() : 0, solved,
      hints: [1, 2, 3, 4].reduce((a, n) => a + S.stations[n].hints.filter(Boolean).length, 0),
      wrong: [1, 2, 3, 4].reduce((a, n) => a + S.stations[n].wrong, 0),
      elapsed: Math.round((elapsedMs() + S.penalties * 60000) / 1000),
      running: started() && !S.timer.finishedAt,
      bridges: [1, 2, 3, 4].map(fullBridge),
      verdict: S.verdict.sent ? S.verdict : { sent: false },
      vote: S.vote, exitAnswer: S.exitSent ? S.exitAnswer : '', exitSent: S.exitSent,
    };
  }
  let syncing = false;
  async function sync() {
    if (!S.code || S.screen === 'join' || syncing) return;
    syncing = true;
    try {
      const r = await fetch(`/api/session/${S.code}/sync`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ epoch: S.epoch, team: snapshot() }),
      });
      if (r.ok) { online = true; applyNet(await r.json()); } else online = r.status === 404; // 404: השיעור נמחק, ממשיכים מקומית
    } catch (e) { online = false; }
    syncing = false;
    tick();
  }
  function applyNet(d) {
    if (d.epoch !== S.epoch) { // המורה איפסה את השיעור
      const code = S.code, sound = S.sound;
      S = fresh(); S.prefill = code; S.sound = sound;
      saveLocal(); render(); toast('השיעור אופס. הצטרפו מחדש.');
      return;
    }
    const t = S.timer;
    if (d.paused && started() && !t.finishedAt && !t.pauseStart) t.pauseStart = Date.now();
    if (!d.paused && t.pauseStart) { t.pausedMs += Date.now() - t.pauseStart; t.pauseStart = 0; }
    S.net = { started: d.started, paused: d.paused, extraMin: d.extraMin, voteOpen: d.voteOpen, reveal: d.reveal, exitReleased: d.exitReleased };
    if (d.skip > S.skipsApplied) {
      S.skipsApplied = d.skip;
      const n = curStation();
      if (started() && n <= 4) {
        S.stations[n].solved = true; S.stations[n].skipped = true; S.justUnlocked = n < 4 ? n + 1 : 0;
        toast(`המורה פתחה לכם את ראיה ${n}.`);
        if (S.screen === 'station' || S.screen === 'board') { S.screen = 'board'; saveLocal(); render(); }
      }
    }
    if (d.exitReleased && !['join', 'exit', 'thanks'].includes(S.screen)) { stopTimer(); S.screen = 'exit'; saveLocal(); render(); }
    saveLocal();
    if (S.screen === 'letter') letterGate();
    voteOverlay();
  }
  function voteOverlay() {
    const want = S.net.voteOpen && !S.vote && S.screen !== 'join';
    let v = $('#vote', sys);
    if (!want) { if (v) v.remove(); return; }
    if (v) return;
    v = document.createElement('div'); v.id = 'vote'; v.className = 'overlay'; v.setAttribute('role', 'dialog');
    v.innerHTML = `<div><h2>${esc(C.vote.q)}</h2><div class="vote-btns">${C.vote.options.map(o => `<button class="btn big" data-v="${esc(o)}">${esc(o)}</button>`).join('')}</div></div>`;
    v.addEventListener('click', e => {
      const b = e.target.closest('[data-v]'); if (!b) return;
      S.vote = b.dataset.v; save(); v.remove(); toast('ההצבעה נשלחה. הסתכלו על הלוח.');
    });
    sys.appendChild(v);
  }

  /* ================= ניווט ================= */
  function go(screen, patch) {
    S.screen = screen; Object.assign(S, patch || {});
    save(); render(); window.scrollTo(0, 0);
    app.focus({ preventScroll: true });
  }
  function render() {
    if (cleanup) { cleanup(); cleanup = null; }
    layer.innerHTML = '';
    ({ join: joinScreen, chat: chatScreen, dispute: disputeScreen, letter: letterScreen, board: boardScreen, station: stationScreen, verdict: verdictScreen, waiting: waitingScreen, exit: exitScreen, thanks: thanksScreen }[S.screen] || joinScreen)();
    renderChrome();
    voteOverlay();
  }

  /* ================= 1. פתיחה ================= */
  function joinScreen() {
    app.innerHTML = `<section class="screen join">
      <div class="hero">${stamp('סודי', 'red tilt')}${ART.heroScan}<h1>הקפוצ'ינו שלא היה אמור להזיק</h1><p class="caseline"><b>תיק <bdi>0418</bdi></b>המעבדה לבטיחות מזון</p></div>
      <form class="card" id="jf" novalidate>
        <label class="field"><span>שם הצוות</span><input id="tname" maxlength="20" autocomplete="off" enterkeyhint="next" value="${esc(S.name)}" placeholder="למשל: בלשי החלבון"></label>
        <fieldset class="icons"><legend>סמל הצוות</legend><div class="iconrow">${C.icons.map(([k, label]) =>
          `<label class="iconpick"><input type="radio" name="icon" value="${k}" ${S.icon === k ? 'checked' : ''}><span>${ART.icon(k)}<small>${label}</small></span></label>`).join('')}</div></fieldset>
        ${SOLO ? '' : `<label class="field"><span>קוד שיעור <small>(4 ספרות מהלוח)</small></span><input id="tcode" class="mono" dir="ltr" inputmode="numeric" maxlength="4" autocomplete="off" value="${esc(S.prefill)}" placeholder="• • • •"></label>
        <p class="fine">בלי קוד שיעור המשחק רץ במצב תרגול, בלי מסך מורה.</p>`}
        <p class="err" id="jerr" role="alert"></p>
        <button class="btn" type="submit">נכנסים למעבדה${ART.ui.next}</button>
      </form></section>`;
    $('#jf').onsubmit = async e => {
      e.preventDefault();
      const name = $('#tname').value.trim(), icon = ($('input[name=icon]:checked') || {}).value, code = SOLO ? '' : $('#tcode').value.replace(/\D/g, '');
      const err = m => { $('#jerr').textContent = m; };
      if (name.length < 2) return err('כתבו שם צוות (לפחות 2 תווים).');
      if (!icon) return err('בחרו סמל לצוות.');
      if (code && code.length !== 4) return err('קוד שיעור הוא 4 ספרות. אפשר גם להשאיר ריק.');
      S.name = name; S.icon = icon;
      if (code) {
        try {
          const r = await fetch(`/api/session/${code}`);
          if (r.status === 404) return err('לא מצאנו שיעור עם הקוד הזה. בדקו מול הלוח.');
          const d = await r.json();
          S.code = code; S.epoch = d.epoch; S.net.started = d.started;
        } catch (ex) { return err('אין חיבור לשרת. בדקו את הרשת ונסו שוב.'); }
      } else S.code = '';
      go('chat');
    };
  }

  /* ================= 2. שיחת הוואטסאפ ================= */
  function bubble(m) {
    if (m.divider) return `<div class="wa-div"><span>${esc(m.divider)}</span></div>`;
    const meta = `<span class="meta"><bdi>${m.t}</bdi>${m.who === 'noa' ? '<i class="ticks" aria-label="נקרא">✓✓</i>' : ''}</span>`;
    return `<div class="msg ${m.who}"><div class="bub ${m.image ? 'img' : ''}"><span class="sr">${m.who === 'noa' ? 'נועה' : 'אמא'}: </span>${m.image ? menuSign() : esc(m.text)}${meta}</div></div>`;
  }
  function chatScreen() {
    app.innerHTML = `<section class="screen chat">
      <div class="wa-head">${ART.avatar('mom')}<div class="wa-who"><b>אמא</b><span id="wa-status">מחוברת</span></div><button class="wa-skip" id="wa-skip">דלגו</button></div>
      <div class="wa-body" id="wa" aria-live="polite"></div>
      <div class="wa-foot" id="wa-foot"><span class="wa-tip">${ART.ui.tap}געו במסך כדי להמשיך</span></div></section>`;
    const body = $('#wa'), foot = $('#wa-foot'), status = $('#wa-status');
    let i = 0, timer = null;
    const typingOff = () => { $$('.typing', body).forEach(x => x.remove()); status.textContent = 'מחוברת'; };
    const scroll = () => { body.scrollTop = body.scrollHeight; };
    function finish() {
      clearTimeout(timer); typingOff();
      if (!S.chatDone) { S.chatDone = true; saveLocal(); }
      foot.innerHTML = `<button class="btn" id="wa-next">מה קרה אחר כך?</button>`;
      $('#wa-next').onclick = () => go('dispute');
      $('#wa-skip').hidden = true;
    }
    function next(quiet) {
      clearTimeout(timer); typingOff();
      if (i >= C.chat.length) return finish();
      const m = C.chat[i++];
      body.insertAdjacentHTML('beforeend', bubble(m));
      if (!quiet && !m.divider) sfx('msg');
      scroll();
      if (i >= C.chat.length) return finish();
      if (!quiet) timer = setTimeout(() => {
        const n = C.chat[i];
        if (!n.divider) {
          body.insertAdjacentHTML('beforeend', `<div class="msg ${n.who} typing"><div class="bub"><span class="sr">מקלידה</span><i></i><i></i><i></i></div></div>`);
          if (n.who === 'mom') status.textContent = 'מקלידה...';
          scroll();
        }
        timer = setTimeout(() => next(), 700);
      }, 500);
    }
    const all = () => { while (i < C.chat.length) next(true); finish(); };
    body.onclick = () => { if (i < C.chat.length) next(); };
    $('#wa-skip').onclick = all;
    cleanup = () => clearTimeout(timer);
    if (S.chatDone) all(); else timer = setTimeout(() => next(), 500);
  }

  /* ================= 3. המחלוקת ================= */
  function disputeScreen() {
    const d = C.dispute;
    app.innerHTML = `<section class="screen dispute">
      <article class="card review"><header>${ART.avatar('mom')}<div><b>אמא של נועה</b><div class="stars" role="img" aria-label="כוכב אחד מתוך חמישה">${[1, 0, 0, 0, 0].map(on => on ? ART.ui.star.replace('ui star', 'ui star on') : ART.ui.star).join('')}</div></div></header><p>${esc(d.review)}</p></article>
      <article class="card review reply"><header><div class="biz" aria-hidden="true">${ART.cup}</div><div><b>תגובת בעל העסק</b><small>בית הקפה</small></div></header><p>${esc(d.reply)}</p></article>
      <h1 class="whois">מי צודק?</h1>
      <button class="btn" id="next">המשך${ART.ui.next}</button></section>`;
    $('#next').onclick = () => go('letter');
  }

  /* ================= 4. מכתב המשימה ================= */
  function letterGate() {
    const b = $('#open-case'), w = $('#gate');
    if (!b) return;
    const locked = S.code && !S.net.started;
    b.disabled = locked; w.hidden = !locked;
  }
  function letterScreen() {
    const L = C.letter;
    app.innerHTML = `<section class="screen letter">
      <div class="envelope"><div class="env-flap-open" aria-hidden="true"></div>
        <article class="paper sheet-in">${stamp('תיק חקירה מס׳ 0418', 'red tilt corner')}
          <p class="to"><b>אל:</b> צוות ${esc(S.name)}, המעבדה לבטיחות מזון</p>
          <p>${esc(L.intro)}</p>
          <ol>${L.questions.map(q => `<li>${esc(q)}</li>`).join('')}</ol>
        </article></div>
      <p class="gate" id="gate" hidden><span class="spin" aria-hidden="true"></span> מחכים לאות מהמורה…</p>
      <button class="btn" id="open-case">פתחו את התיק</button>
      <p class="fine center">הלחיצה מפעילה את הטיימר: 30 דקות.</p></section>`;
    letterGate();
    $('#open-case').onclick = () => {
      if (!started()) { S.timer.startedAt = Date.now(); if (S.net.paused) S.timer.pauseStart = Date.now(); }
      sfx('lock'); go('board');
    };
  }

  /* ================= 5. לוח הראיות ================= */
  function boardScreen() {
    const cur = curStation(), just = S.justUnlocked;
    app.innerHTML = `<section class="screen board">
      <h1>לוח הראיות</h1><p class="lead">${cur <= 4 ? 'כל ראיה נותנת קוד שפותח את הבאה.' : 'כל הראיות פוענחו. הגיע הזמן להכריע.'}</p>
      <div class="envs">${[1, 2, 3, 4].map(n => {
        const st = S.stations[n], state = st.solved ? 'solved' : n === cur ? 'open' : 'locked';
        return `<button class="env ${state} ${just === n ? 'just' : ''}" data-n="${n}" ${state === 'open' ? '' : 'aria-disabled="true"'}>
          <span class="tagnum">ראיה ${n}</span>
          <span class="env-title">${state === 'locked' ? 'נעולה' : esc(C.stations[n].title)}</span>
          ${state === 'locked' ? ART.lock(false) : ''}${just === n ? ART.lock(true) : ''}
          ${state === 'solved' ? stamp(st.skipped ? 'נפתחה' : 'פוענחה', 'teal tilt small') : ''}
          ${state === 'open' ? `<span class="env-go">פתחו את המעטפה${ART.ui.next}</span>` : ''}</button>`;
      }).join('')}</div>
      ${cur > 4 ? '<button class="btn" id="to-verdict">כתבו את פסק הדין</button>' : ''}</section>`;
    if (just) { S.justUnlocked = 0; saveLocal(); }
    $$('.env.open').forEach(b => b.onclick = () => {
      const n = +b.dataset.n, st = S.stations[n];
      go('station', { st: n, phase: n !== 3 && !st.briefSeen ? 'brief' : 'task' });
    });
    const v = $('#to-verdict'); if (v) v.onclick = () => go('verdict');
  }

  /* ================= 6. עמדות ================= */
  const STEPS = [['brief', 'תדריך'], ['task', 'משימה'], ['bridge', 'משפט גשר'], ['code', 'קוד']];
  // שלבי העמדה. cur הוא השלב הנוכחי; כל מה שלפניו מסומן כהושלם
  const stepsHtml = (n, cur) => {
    const list = STEPS.filter(([k]) => n !== 3 || k !== 'brief'), at = list.findIndex(([k]) => k === cur);
    return `<ol class="steps" id="steps" aria-label="שלבי העמדה">${list.map(([k, l], i) => `<li data-k="${k}" class="${i < at ? 'done' : i === at ? 'cur' : ''}" ${i === at ? 'aria-current="step"' : ''}>${l}</li>`).join('')}</ol>`;
  };
  const setStep = (n, cur) => { const el = $('#steps'); if (el) el.outerHTML = stepsHtml(n, cur); };
  const stHead = (n, cur) => `<div class="st-head"><button class="iconbtn back" id="back" aria-label="חזרה ללוח הראיות">${ART.ui.back}</button><div><span class="tagnum">ראיה ${n}</span><h1>${esc(C.stations[n].title)}</h1></div></div>${cur ? stepsHtml(n, cur) : ''}`;
  function stationScreen() {
    const n = S.st, st = S.stations[n];
    if (st.solved && S.phase !== 'success') return go('board');
    if (S.phase === 'success') successScreen(n);
    else if (S.phase === 'brief') briefScreen(n);
    else taskScreen(n);
    const back = $('#back'); if (back) back.onclick = () => go('board');
  }

  /* ----- תדריך ----- */
  function carousel() {
    const cards = C.stations[1].cards;
    return `<div class="carousel" tabindex="0" aria-label="כרטיסי מידע. החליקו שמאלה לכרטיס הבא">${cards.map((c, i) =>
      `<article class="card info">${ART.brief1[i]}<h2>${esc(c.h)}</h2><p>${esc(c.p)}</p></article>`).join('')}</div>
      <div class="dots">${cards.map((c, i) => `<button class="dot ${i ? '' : 'on'}" aria-label="כרטיס ${i + 1}: ${esc(c.h)}"></button>`).join('')}</div>`;
  }
  function bindCarousel(root) {
    const box = $('.carousel', root), dots = $$('.dot', root), cards = $$('.info', box);
    const current = () => {
      const mid = box.getBoundingClientRect().left + box.clientWidth / 2;
      let best = 0, dist = Infinity;
      cards.forEach((c, i) => { const r = c.getBoundingClientRect(), d = Math.abs(r.left + r.width / 2 - mid); if (d < dist) { dist = d; best = i; } });
      return best;
    };
    const to = i => cards[Math.max(0, Math.min(cards.length - 1, i))].scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', inline: 'center', block: 'nearest' });
    box.addEventListener('scroll', () => { const k = current(); dots.forEach((d, i) => d.classList.toggle('on', i === k)); }, { passive: true });
    dots.forEach((d, i) => d.onclick = () => to(i));
    box.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') to(current() + 1); if (e.key === 'ArrowRight') to(current() - 1); });
  }
  function briefScreen(n) {
    const D = C.stations[n];
    let body = '';
    if (n === 1) body = carousel();
    if (n === 2) body = `<article class="card info">${ART.pipeline}${D.brief.map(p => `<p>${esc(p)}</p>`).join('')}</article>`;
    if (n === 4) body = `<article class="card info"><div class="gelanim-wrap">${ART.gelAnim}</div>${D.brief.map(p => `<p>${esc(p)}</p>`).join('')}<p class="rule"><b>הכלל:</b> ${esc(D.rule)}</p></article>`;
    app.innerHTML = `<section class="screen station brief">${stHead(n, 'brief')}${body}<button class="btn" id="to-task">למשימה${ART.ui.next}</button></section>`;
    if (n === 1) bindCarousel(app);
    $('#to-task').onclick = () => { S.stations[n].briefSeen = true; go('station', { phase: 'task' }); };
  }

  /* ----- שלד משימה: גשר, מנעול, רמזים ----- */
  function bridgeBlock(n) {
    const D = C.stations[n], st = S.stations[n];
    return `<div class="card bridge"><h2>${ART.ui.pen}משפט גשר</h2><p class="bq">${esc(D.bridge)}</p>
      ${n === 1 ? `<p class="prefix">${esc(D.bridgePrefix)}…</p>` : ''}
      <textarea id="bridge" rows="3" maxlength="500" placeholder="כתבו כאן…" aria-label="${esc(n === 1 ? D.bridgePrefix : D.bridge)}">${esc(st.bridge)}</textarea>
      <p class="need" id="need" aria-live="polite"></p></div>`;
  }
  function lockBlock(n) {
    const D = C.stations[n];
    let field = '';
    if (n === 1) field = `<p class="codehelp">${esc(D.codeHelp)}</p><div class="pair" dir="ltr">${D.customers.map(([k, name], i) =>
      `${i ? '<b class="dash">–</b>' : ''}<label><input id="d${i}" class="code mono digit1" inputmode="numeric" maxlength="1" autocomplete="off" aria-label="מספר סימני ה-✓ בשורה של ${name}"><span dir="rtl">${ART.avatar(k)}✓ של ${name}</span></label>`).join('')}</div>`;
    if (n === 3) field = `<input id="code" class="code" maxlength="12" autocomplete="off" autocapitalize="off" placeholder="${D.codeHint}" aria-label="קוד: ${D.codeHint}">`;
    if (n === 4) field = `<div class="pair" dir="ltr"><label><input id="c1" class="code mono" inputmode="numeric" maxlength="2" autocomplete="off"><span dir="rtl">פסים בחלב פרה</span></label><b class="dash">–</b><label><input id="c2" class="code mono" inputmode="numeric" maxlength="2" autocomplete="off"><span dir="rtl">פסים בחלב ללא פרה</span></label></div>`;
    return `<div class="card codebox" id="codebox"><h2><span id="lock-ico">${ART.ui.lock}</span>מנעול הקוד</h2>${field}
      <p class="err" id="err" role="alert"></p>
      <button class="btn" id="open" disabled>${n < 4 ? 'פתחו את הראיה הבאה' : 'פענחו את הראיה האחרונה'}</button></div>
      <button class="hintbtn" id="hint">${ART.ui.hint}מעטפת רמז</button>`;
  }
  function readCode(n) {
    if (n === 1) return $$('.digit1').map(i => i.value).join('-');
    if (n === 2) return $$('.aa').map(i => i.value).join('');
    if (n === 4) return $('#c1').value + '-' + $('#c2').value;
    return $('#code').value;
  }
  function bindTask(n) {
    const st = S.stations[n], br = $('#bridge'), need = $('#need'), open = $('#open');
    const fields = n === 2 ? [] : $$('#codebox input'); // בעמדה 2 המשבצות הן גם אזור העבודה, אז רק הכפתור ננעל
    const gate = () => {
      const left = C.BRIDGE_MIN - br.value.trim().length, ok = left <= 0;
      need.innerHTML = ok ? `${ART.ui.check}המנעול פתוח להקלדה` : `${ART.ui.lock}עוד ${left} תווים כדי לפתוח את מנעול הקוד`;
      need.classList.toggle('ok', ok);
      $('#lock-ico').innerHTML = ok ? ART.ui.unlock : ART.ui.lock;
      setStep(n, ok ? 'code' : br.value.trim() ? 'bridge' : 'task');
      fields.forEach(f => { f.disabled = !ok; });
      open.disabled = !ok;
      $('#codebox').classList.toggle('gated', !ok);
    };
    br.oninput = () => { st.bridge = br.value; saveLocal(); gate(); };
    br.onblur = save;
    gate();
    const submit = () => {
      const raw = readCode(n), norm = raw.replace(/[\s\-–—־_.,]/g, '').toLowerCase();
      if (!norm || open.disabled) return;
      if (window.sha256(`${C.SALT}:${n}:${norm}`) === C.HASHES[n]) {
        st.solved = true; st.codeText = norm; S.justUnlocked = n < 4 ? n + 1 : 0;
        sfx('lock'); go('station', { phase: 'success' }); drops();
        return;
      }
      st.wrong++;
      const box = n === 2 ? $('.codons') : $('#codebox');
      box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake');
      $('#err').innerHTML = ART.ui.x + 'הראיה לא תואמת. בדקו שוב.';
      sfx('err'); buzz(80);
      if (st.wrong >= 3 && !st.hints[0]) { st.hints[0] = true; st.freeHint = true; save(); hintModal(n, true); } else save();
    };
    open.onclick = submit;
    $$('#codebox input, .aa').forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); }));
    $('#hint').onclick = () => hintModal(n);
  }
  function hintModal(n, auto) {
    const D = C.stations[n], st = S.stations[n];
    const m = modal('', 'hints');
    const card = $('.modal-card', m);
    let asking = -1;
    const draw = () => {
      card.innerHTML = `<h2>${ART.ui.hint}מעטפת רמז</h2>${auto ? '<p class="auto">שלושה ניסיונות שגויים: הרמז הראשון נפתח בלי קנס.</p>' : ''}
        ${[0, 1].map(i => st.hints[i]
          ? `<div class="hint open"><b>רמז ${i + 1}</b><p>${esc(D.hints[i])}</p></div>`
          : asking === i
            ? `<div class="hint ask"><p>פתיחת הרמז תוסיף <b>דקת קנס</b> לזמן שלכם. לפתוח?</p><div class="row"><button class="btn amber" data-yes="${i}">פתחו את הרמז</button><button class="btn ghost" data-no>ביטול</button></div></div>`
            : `<button class="hint sealed" data-ask="${i}" ${i === 1 && !st.hints[0] ? 'disabled' : ''}><b>רמז ${i + 1}</b><span>סגור · דקת קנס</span></button>`).join('')}
        <button class="btn ghost" data-close>סגירה</button>`;
    };
    card.addEventListener('click', e => {
      const a = e.target.closest('[data-ask]'), y = e.target.closest('[data-yes]');
      if (a) { asking = +a.dataset.ask; draw(); }
      else if (e.target.closest('[data-no]')) { asking = -1; draw(); }
      else if (y) { st.hints[+y.dataset.yes] = true; S.penalties++; asking = -1; auto = false; save(); tick(); draw(); }
    });
    draw();
  }

  /* ----- עמדה 1 ----- */
  const MARK = ['', ART.ui.check, ART.ui.x], MARK_LABEL = ['ריק', 'מתאים', 'לא מתאים'];
  function task1() {
    const D = C.stations[1], st = S.stations[1];
    const g = st.data.grid = st.data.grid || Array(12).fill(0);
    return `<div class="customers">${D.customers.map(([k, name, what]) => `<div class="cust">${ART.avatar(k)}<b>${name}</b><small>${what}</small></div>`).join('')}</div>
      <p class="inst">${esc(D.instruction)}</p>
      <div class="card pickwrap"><table class="pick"><thead><tr><td></td>${D.drinks.map(([k, name]) => `<th scope="col">${ART.drink(k)}<small>${name}</small></th>`).join('')}</tr></thead>
        <tbody>${D.customers.map(([k, name], r) => `<tr><th scope="row">${ART.avatar(k)}<span>${name}</span></th>${D.drinks.map(([, dn], c) => {
          const v = g[r * 4 + c];
          return `<td><button class="cell m${v}" data-i="${r * 4 + c}" aria-label="${name}, ${dn}: ${MARK_LABEL[v]}">${MARK[v]}</button></td>`;
        }).join('')}</tr>`).join('')}</tbody></table></div>
      <section class="panel howto" aria-label="איך בונים את הקוד"><h2>${ART.ui.lock}איך בונים את הקוד?</h2><ol>
        <li><span>${D.howto[0]}</span></li>
        <li><span>${D.howto[1]}<span class="eg" aria-label="דוגמה: בשורה עם שני סימני וי ושני סימני איקס הספרה היא 2"><small>לדוגמה:</small><i class="y">${ART.ui.check}</i><i class="n">${ART.ui.x}</i><i class="y">${ART.ui.check}</i><i class="n">${ART.ui.x}</i><span class="arrow">${ART.ui.next}</span><b class="digit">2</b></span></span></li>
        <li><span>${D.howto[2]}<span class="egcode" aria-hidden="true">${D.customers.map(([, name], i) => `${i ? '<b class="dash">–</b>' : ''}<span><b class="digit">?</b><em>${name}</em></span>`).join('')}</span></span></li>
      </ol></section>
      <button class="linkbtn" id="reread">${ART.ui.doc}קראו שוב את התדריך</button>`;
  }
  function bind1() {
    const st = S.stations[1], D = C.stations[1];
    $$('.pick .cell').forEach(b => b.onclick = () => {
      const i = +b.dataset.i, v = st.data.grid[i] = (st.data.grid[i] + 1) % 3;
      b.className = 'cell m' + v; b.innerHTML = MARK[v];
      b.setAttribute('aria-label', `${D.customers[i >> 2][1]}, ${D.drinks[i % 4][1]}: ${MARK_LABEL[v]}`);
      saveLocal();
    });
    $('#reread').onclick = () => { const m = modal(carousel() + '<button class="btn ghost" data-close>חזרה למשימה</button>', 'reread'); bindCarousel(m); };
    const digits = $$('.digit1');
    digits.forEach((inp, i) => {
      inp.addEventListener('input', () => { inp.value = inp.value.replace(/\D/g, '').slice(-1); if (inp.value && digits[i + 1]) digits[i + 1].focus(); });
      inp.addEventListener('keydown', e => { if (e.key === 'Backspace' && !inp.value && digits[i - 1]) digits[i - 1].focus(); });
    });
  }

  /* ----- עמדה 2 ----- */
  function codonTable() {
    const B = C.BASES;
    let h = `<div class="ctable" dir="ltr"><div class="ch corner"></div>${[...B].map((b, c) => `<div class="ch col" data-c="${c}"><span class="b b${b}">${b}</span></div>`).join('')}`;
    [...B].forEach((b1, r) => {
      h += `<div class="ch row" data-r="${r}"><span class="b b${b1}">${b1}</span></div>`;
      [...B].forEach((b2, c) => {
        h += `<div class="cc" data-r="${r}" data-c="${c}">` + [...B].map((b3, k) => {
          const a = C.AMINO[r * 16 + c * 4 + k], cod = b1 + b2 + b3;
          if (a === '*') return `<div class="cl stopc"><span>${cod}</span> Stop ${ART.stop}</div>`;
          return `<div class="cl ${cod === 'AUG' ? 'start' : ''}"><span>${cod}</span> ${C.AMINO3[a]} <b>(${a})</b>${cod === 'AUG' ? ART.flag : ''}</div>`;
        }).join('') + '</div>';
      });
    });
    return h + '</div>';
  }
  function task2() {
    const D = C.stations[2], st = S.stations[2];
    const L = st.data.letters = st.data.letters || ['', '', '', ''];
    return `<p class="inst">${esc(D.instruction)}</p>
      <div class="codons-wrap"><div class="codons" dir="ltr">${D.codons.map((cod, i) => `<div class="codon">
        <button class="tile mono" data-i="${i}" aria-label="קודון ${cod.split('').join(' ')}. געו כדי למצוא אותו בטבלה">${[...cod].map(b => `<span class="b b${b}">${b}</span>`).join('')}</button>
        ${i < 4 ? `<input class="aa mono" data-i="${i}" maxlength="1" autocomplete="off" autocapitalize="characters" value="${esc(L[i])}" aria-label="האות של קודון ${i + 1}">`
          : `<button class="aa stopbox ${st.data.stop ? 'on' : ''}" id="stopbox" aria-pressed="${!!st.data.stop}" aria-label="סמנו כאן סמל עצור">${st.data.stop ? ART.stop : ''}</button>`}
      </div>`).join('')}</div><p class="note">${esc(D.note)}</p></div>
      <p class="where" id="where" aria-live="polite"></p>`;
  }
  function bind2() {
    const D = C.stations[2], st = S.stations[2];
    const boxes = $$('input.aa');
    boxes.forEach((inp, i) => {
      inp.oninput = () => {
        inp.value = inp.value.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(-1);
        st.data.letters[i] = inp.value; saveLocal();
        if (inp.value && boxes[i + 1]) boxes[i + 1].focus();
      };
      inp.addEventListener('keydown', e => { if (e.key === 'Backspace' && !inp.value && boxes[i - 1]) boxes[i - 1].focus(); });
    });
    const sb = $('#stopbox');
    sb.onclick = () => { st.data.stop = !st.data.stop; sb.classList.toggle('on', st.data.stop); sb.innerHTML = st.data.stop ? ART.stop : ''; sb.setAttribute('aria-pressed', st.data.stop); saveLocal(); };

    /* חלונית תחתונה עם טבלת הקוד הגנטי */
    const sheet = document.createElement('div');
    sheet.className = 'sheet'; sheet.id = 'sheet';
    sheet.innerHTML = `<div class="grab" id="grab" role="button" tabindex="0" aria-expanded="false" aria-controls="sheet-body"><i></i><b>טבלת הקוד הגנטי</b><span id="grab-tip">משכו למעלה</span></div>
      <div class="sheet-body" id="sheet-body"><div class="sheet-bar"><span class="legend">שורה: אות ראשונה · עמודה: אות שנייה · בתוך המשבצת: אות שלישית</span><button class="linkbtn" id="zoom" aria-pressed="false">${ART.ui.zoom}הגדלה</button></div>
      <div class="ctable-scroll">${codonTable()}</div></div>`;
    layer.appendChild(sheet);
    const grab = $('#grab', sheet);
    let isOpen = false;
    const setOpen = v => {
      // מגלגלים כך שהקודונים ומשבצות האותיות נשארים גלויים מעל החלונית
      if (v && !isOpen) $('.codons-wrap').scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' });
      isOpen = v; sheet.classList.toggle('open', v); sheet.style.transform = ''; grab.setAttribute('aria-expanded', v); $('#grab-tip').textContent = v ? 'משכו למטה לסגירה' : 'משכו למעלה';
    };
    let drag = null;
    grab.addEventListener('pointerdown', e => { drag = { y: e.clientY, moved: false, base: isOpen ? 0 : sheet.offsetHeight - grab.offsetHeight }; grab.setPointerCapture(e.pointerId); sheet.classList.add('dragging'); });
    grab.addEventListener('pointermove', e => {
      if (!drag) return;
      const dy = e.clientY - drag.y;
      if (Math.abs(dy) > 6) drag.moved = true;
      sheet.style.transform = `translateY(${Math.max(0, Math.min(sheet.offsetHeight - grab.offsetHeight, drag.base + dy))}px)`;
    });
    const end = e => {
      if (!drag) return;
      const dy = e.clientY - drag.y, moved = drag.moved; drag = null; sheet.classList.remove('dragging');
      setOpen(moved ? (isOpen ? dy < 60 : dy < -60) : !isOpen);
    };
    grab.addEventListener('pointerup', end); grab.addEventListener('pointercancel', end);
    grab.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(!isOpen); } });
    $('#zoom', sheet).onclick = e => { const z = sheet.classList.toggle('zoom'); e.currentTarget.setAttribute('aria-pressed', z); };

    /* נגיעה בקודון: שורה, עמודה, ואז המשבצת. עוצרים לפני התשובה. */
    let timers = [];
    $$('.tile').forEach(t => t.onclick = () => {
      const cod = D.codons[+t.dataset.i], r = C.BASES.indexOf(cod[0]), c = C.BASES.indexOf(cod[1]);
      timers.forEach(clearTimeout); timers = [];
      $$('.tile').forEach(x => x.classList.toggle('sel', x === t));
      setOpen(true);
      const clear = () => $$('.hl, .hl3', sheet).forEach(x => x.classList.remove('hl', 'hl3'));
      const step = reduced ? 0 : 400;
      clear();
      $$(`[data-r="${r}"]`, sheet).forEach(x => x.classList.add('hl'));
      timers.push(setTimeout(() => { clear(); $$(`[data-c="${c}"]`, sheet).forEach(x => x.classList.add('hl')); }, step));
      timers.push(setTimeout(() => {
        clear();
        const cell = $(`.cc[data-r="${r}"][data-c="${c}"]`, sheet);
        cell.classList.add('hl3');
        cell.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
      }, step * 2));
      $('#where').innerHTML = `${ART.ui.zoom}<span>הקודון ${ltr(cod)}: שורה ${ltr(cod[0])}, עמודה ${ltr(cod[1])}. עכשיו מצאו במשבצת את השורה שמסתיימת ב-${ltr(cod[2])}.</span>`;
    });
    const prev = cleanup;
    cleanup = () => { timers.forEach(clearTimeout); if (prev) prev(); };
  }

  /* ----- עמדה 3 ----- */
  function task3() {
    const D = C.stations[3], st = S.stations[3];
    const order = st.data.order = st.data.order || D.cards.map(c => c.id);
    const by = Object.fromEntries(D.cards.map(c => [c.id, c]));
    return `<p class="inst">${esc(D.instruction)}</p>
      <ol class="sort" id="sort">${order.map(id => `<li class="scard" data-id="${id}"><span class="tagletter" aria-label="האות ${by[id].letter}">${by[id].letter}</span><p>${esc(by[id].text)}</p>${ART.step(id)}
        <button class="handle" aria-label="גררו כדי לשנות מיקום. אפשר גם במקשי החיצים למעלה ולמטה"><i></i><i></i><i></i></button></li>`).join('')}</ol>
      <div class="letters" id="letters" aria-label="האותיות לפי הסדר הנוכחי" aria-live="polite"></div>`;
  }
  function bind3() {
    const D = C.stations[3], st = S.stations[3], list = $('#sort');
    const by = Object.fromEntries(D.cards.map(c => [c.id, c]));
    const sync3 = () => {
      st.data.order = $$('.scard', list).map(li => li.dataset.id);
      $('#letters').innerHTML = st.data.order.map(id => `<span>${by[id].letter}</span>`).join('');
      saveLocal();
    };
    sync3();
    const GAP = 10;
    let drag = null;
    list.addEventListener('pointerdown', e => {
      const h = e.target.closest('.handle'); if (!h) return;
      e.preventDefault(); h.setPointerCapture(e.pointerId);
      drag = { li: h.closest('.scard'), y: e.clientY };
      drag.li.classList.add('dragging');
    });
    list.addEventListener('pointermove', e => {
      if (!drag) return;
      const li = drag.li; let dy = e.clientY - drag.y;
      const next = li.nextElementSibling, prev = li.previousElementSibling;
      // מזיזים תמיד את השכן ולא את הכרטיס הנגרר, כדי לא לאבד את לכידת המצביע
      if (next && dy > next.offsetHeight / 2 + GAP) { const s = next.offsetHeight + GAP; list.insertBefore(next, li); drag.y += s; dy -= s; }
      else if (prev && dy < -(prev.offsetHeight / 2 + GAP)) { const s = prev.offsetHeight + GAP; list.insertBefore(prev, li.nextSibling); drag.y -= s; dy += s; }
      li.style.transform = `translateY(${dy}px)`;
    });
    const drop = () => { if (!drag) return; drag.li.style.transform = ''; drag.li.classList.remove('dragging'); drag = null; buzz(15); sync3(); };
    list.addEventListener('pointerup', drop); list.addEventListener('pointercancel', drop);
    list.addEventListener('keydown', e => {
      const h = e.target.closest('.handle'); if (!h || !['ArrowUp', 'ArrowDown'].includes(e.key)) return;
      e.preventDefault();
      const li = h.closest('.scard');
      if (e.key === 'ArrowUp' && li.previousElementSibling) list.insertBefore(li, li.previousElementSibling);
      if (e.key === 'ArrowDown' && li.nextElementSibling) list.insertBefore(li.nextElementSibling, li);
      h.focus(); sync3();
    });
  }

  /* ----- עמדה 4 ----- */
  const GEL = { W: 320, H: 412, lanes: [60, 150, 240], y: l => 50 + (l - 1) * 30 };
  function gelSvg(marks, result) {
    const D = C.stations[4];
    let bands = '';
    D.lanes.forEach((lane, i) => lane.bands.forEach(l => {
      const cx = GEL.lanes[i], y = GEL.y(l), k = lane.key + '-' + l;
      const keep = result && l === 9 && i < 2;
      bands += `<g class="band ${marks && marks[k] ? 'on' : ''} ${result ? (keep ? 'keep' : 'fade') : ''}" data-k="${k}" data-l="${l}" data-lane="${i}">
        <rect class="hit" x="${cx - 42}" y="${y - 15}" width="84" height="30" fill="transparent"/>
        <rect class="ink" x="${cx - 31}" y="${y - 5.5}" width="62" height="11" rx="5.500" filter="url(#soft)"/>
        <g class="dot"><circle cx="${cx + 31}" cy="${y}" r="9"/><path d="M${cx + 27} ${y}l3 3 5-6"/></g></g>`;
    }));
    const y9 = GEL.y(9);
    const extra = result
      ? `<path class="gjoin" d="M${GEL.lanes[0] + 31} ${y9}H${GEL.lanes[1] - 31}"/><text class="blg" x="${GEL.lanes[1] + 40}" y="${y9 + 6}" direction="ltr">BLG</text>`
      : `<g class="ruler" id="ruler"><path d="M6 0H284" /><g class="knob" id="knob" tabindex="0" role="slider" aria-label="סרגל השוואה. גררו או השתמשו בחיצים למעלה ולמטה" aria-valuemin="1" aria-valuemax="12"><circle r="24" fill="transparent"/><circle r="15" class="knob-c"/><path d="M-4 -3l4 -5 4 5M-4 3l4 5 4 -5" class="knob-a"/></g></g>`;
    return `<svg class="gel ${result ? 'result' : ''}" id="gel" viewBox="0 0 ${result ? 290 : GEL.W} ${GEL.H}" role="img" aria-label="ג'ל עם שלושה מסלולים: חלב פרה, חלב ללא פרה ומשקה סויה. בכל מסלול פסים במרחקי הרצה שונים" xmlns="http://www.w3.org/2000/svg">
      <defs><filter id="soft" x="-10%" y="-40%" width="120%" height="180%"><feGaussianBlur stdDeviation="1.1"/></filter></defs>
      <rect x="6" y="6" width="278" height="${GEL.H - 12}" rx="10" class="gel-bg"/>
      ${GEL.lanes.map(cx => `<rect x="${cx - 27}" y="14" width="54" height="10" rx="3" class="well"/><path d="M${cx - 45} 30V${GEL.H - 14}M${cx + 45} 30V${GEL.H - 14}" class="guide"/>`).join('')}
      ${bands}${extra}</svg>`;
  }
  const laneHead = () => `<div class="lanehead" dir="ltr">${C.stations[4].lanes.map(l => `<div>${ART.drink(l.key)}<small dir="rtl">${l.name}</small></div>`).join('')}</div>`;
  function task4() {
    const D = C.stations[4], st = S.stations[4];
    st.data.marks = st.data.marks || {};
    return `<p class="inst">${esc(D.instruction)}</p>
      <div class="gelwrap">${laneHead()}${gelSvg(st.data.marks)}
        <div class="lanecount" dir="ltr" id="counts">${D.lanes.map(l => `<div dir="rtl" data-lane="${l.key}"></div>`).join('')}</div>
        <p class="note">${esc(D.note)}</p></div>
      <ol class="card qs">${D.questions.map(q => `<li>${esc(q)}</li>`).join('')}</ol>
      <button class="linkbtn" id="reread">${ART.ui.doc}קראו שוב את התדריך</button>`;
  }
  function bind4() {
    const D = C.stations[4], st = S.stations[4], gel = $('#gel'), ruler = $('#ruler'), knob = $('#knob');
    const counts = () => D.lanes.forEach(l => {
      $(`#counts [data-lane="${l.key}"]`).textContent = 'סימנתם: ' + l.bands.filter(b => st.data.marks[l.key + '-' + b]).length;
    });
    counts();
    $$('.band', gel).forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.k;
      if (st.data.marks[k]) delete st.data.marks[k]; else st.data.marks[k] = 1;
      b.classList.toggle('on', !!st.data.marks[k]); counts(); saveLocal();
    }));
    const setRuler = y => {
      y = Math.max(34, Math.min(GEL.H - 22, y));
      const lvl = Math.round((y - 50) / 30) + 1, snap = GEL.y(lvl);
      if (Math.abs(snap - y) < 7 && lvl >= 1 && lvl <= 12) y = snap;
      st.data.ruler = y;
      ruler.setAttribute('transform', `translate(0 ${y})`);
      knob.setAttribute('transform', 'translate(302 0)');
      knob.setAttribute('aria-valuenow', lvl);
      $$('.band', gel).forEach(b => b.classList.toggle('lit', GEL.y(+b.dataset.l) === y));
    };
    setRuler(st.data.ruler || 200);
    let dragging = false;
    knob.addEventListener('pointerdown', e => { dragging = true; knob.setPointerCapture(e.pointerId); e.preventDefault(); });
    knob.addEventListener('pointermove', e => {
      if (!dragging) return;
      const r = gel.getBoundingClientRect();
      setRuler((e.clientY - r.top) * (GEL.H / r.height));
    });
    const up = () => { if (dragging) { dragging = false; saveLocal(); } };
    knob.addEventListener('pointerup', up); knob.addEventListener('pointercancel', up);
    knob.addEventListener('keydown', e => {
      if (!['ArrowUp', 'ArrowDown'].includes(e.key)) return;
      e.preventDefault();
      const lvl = Math.round((st.data.ruler - 50) / 30) + 1 + (e.key === 'ArrowDown' ? 1 : -1);
      setRuler(GEL.y(Math.max(1, Math.min(12, lvl)))); saveLocal();
    });
    $('#reread').onclick = () => modal(`<div class="card info">${D.brief.map(p => `<p>${esc(p)}</p>`).join('')}<p class="rule"><b>הכלל:</b> ${esc(D.rule)}</p></div><button class="btn ghost" data-close>חזרה למשימה</button>`, 'reread');
  }

  function taskScreen(n) {
    const inner = [null, task1, task2, task3, task4][n]();
    app.innerHTML = `<section class="screen station task s${n}">${stHead(n, 'task')}${inner}${bridgeBlock(n)}${lockBlock(n)}</section>`;
    [null, bind1, bind2, bind3, bind4][n]();
    bindTask(n);
  }

  /* ----- הצלחה ----- */
  function successScreen(n) {
    const D = C.stations[n], st = S.stations[n];
    let anim = '';
    if (n === 2) {
      const letters = (st.codeText || '').toUpperCase().split('');
      anim = `<div class="beadbox" dir="ltr"><div class="ribo" aria-hidden="true"></div><div class="beads">${letters.map((ch, i) => `<span style="--i:${i};--c:${ART.beadCols[i % 4]}" class="${i === 3 ? 'dark' : ''}">${esc(ch)}</span>`).join('')}</div><b class="blg-tag">BLG</b></div>`;
    }
    if (n === 3) anim = `<div class="linebox">${ART.line}</div>${st.codeText ? `<p class="term">${esc(st.codeText)} מדויקת</p>` : ''}`;
    if (n === 4) anim = `<div class="gelwrap small">${laneHead()}${gelSvg(null, true)}</div>`;
    app.innerHTML = `<section class="screen station success">
      <div class="biglock">${ART.lock(false)}</div>
      ${anim}
      ${stamp(`ראיה ${n} פוענחה`, 'teal tilt land')}
      <p class="summary">${esc(D.summary)}</p>
      <button class="btn" id="cont">${n < 4 ? 'חזרה ללוח הראיות' : 'לכתיבת פסק הדין'}${ART.ui.next}</button></section>`;
    requestAnimationFrame(() => requestAnimationFrame(() => { const l = $('.biglock .lock'); if (l) l.classList.add('open'); }));
    $('#cont').onclick = () => n < 4 ? go('board', { phase: 'task' }) : go('verdict', { phase: 'task' });
  }

  /* ================= 7. פסק הדין ================= */
  function verdictScreen() {
    const V = S.verdict;
    const seg = (name, opts) => `<div class="seg" role="radiogroup">${opts.map(o => `<label><input type="radio" name="${name}" value="${o}" ${V[name] === o ? 'checked' : ''}><span>${o}</span></label>`).join('')}</div>`;
    app.innerHTML = `<section class="screen verdict">
      <h1>הראיות שלכם</h1>
      <div class="evs">${[1, 2, 3, 4].map(n => `<details class="ev"><summary><span class="tagnum">ראיה ${n}</span>${esc(C.stations[n].title)}</summary><p>${esc(fullBridge(n)) || '<i>לא נכתב משפט גשר.</i>'}</p></details>`).join('')}</div>
      <form class="paper legal" id="vf" novalidate>
        <h2>פסק הדין של צוות ${esc(S.name)}</h2>
        <fieldset><legend>1. בית הקפה</legend>${seg('cafe', C.verdict.cafe)}<label class="field"><span>כי…</span><textarea id="cafeWhy" rows="2" maxlength="400">${esc(V.cafeWhy)}</textarea></label></fieldset>
        <fieldset><legend>2. אמא של נועה</legend>${seg('mom', C.verdict.mom)}<label class="field"><span>כי…</span><textarea id="momWhy" rows="2" maxlength="400">${esc(V.momWhy)}</textarea></label></fieldset>
        <fieldset><legend>3. מה צריך לכתוב בתפריט</legend>${chalk(`<textarea id="menu" class="chalk-in" rows="3" maxlength="140" placeholder="כתבו כאן את השלט החדש…" aria-label="מה צריך לכתוב בתפריט">${esc(V.menu)}</textarea>${ART.cup}`)}</fieldset>
        <p class="err" id="verr" role="alert"></p>
        <button class="btn" type="submit">חתמו ושלחו למעבדה</button>
        <div class="signed" id="signed" hidden>${stamp('נחתם ונשלח', 'red tilt land big')}</div>
      </form></section>`;
    const f = $('#vf');
    const pull = () => {
      V.cafe = (f.querySelector('[name=cafe]:checked') || {}).value || '';
      V.mom = (f.querySelector('[name=mom]:checked') || {}).value || '';
      V.cafeWhy = $('#cafeWhy').value; V.momWhy = $('#momWhy').value; V.menu = $('#menu').value;
      saveLocal();
    };
    f.addEventListener('input', pull);
    f.onsubmit = e => {
      e.preventDefault(); pull();
      const err = m => { $('#verr').textContent = m; };
      if (!V.cafe || !V.mom) return err('בחרו הכרעה בשני הסעיפים הראשונים.');
      if (V.cafeWhy.trim().length < 5 || V.momWhy.trim().length < 5) return err('נמקו כל הכרעה במשפט קצר.');
      if (V.menu.trim().length < 5) return err('כתבו מה צריך להופיע בתפריט.');
      V.sent = true; stopTimer(); save();
      $('#signed').hidden = false; sfx('lock'); buzz(30);
      f.querySelector('[type=submit]').disabled = true;
      setTimeout(() => go('waiting'), reduced ? 300 : 1300);
    };
  }

  /* ================= 8. המתנה ================= */
  function waitingScreen() {
    app.innerHTML = `<section class="screen waiting">
      <div class="closed">${ART.folder}${stamp('נסגר', 'red tilt land big')}</div>
      <h1>התיק נשלח.</h1><p class="lead">הסתכלו על הלוח.</p>
      <p class="left">הטיימר שלכם: <b id="wait-time" dir="ltr"></b></p>
      ${S.code ? '' : '<button class="btn" id="to-exit">לכרטיס היציאה</button>'}</section>`;
    const b = $('#to-exit'); if (b) b.onclick = () => go('exit');
  }

  /* ================= 9. כרטיס יציאה ================= */
  function exitScreen() {
    app.innerHTML = `<section class="screen exit">
      <form class="card" id="ef" novalidate><span class="tagnum">כרטיס יציאה</span><h1>${esc(C.exit.q)}</h1>
        <textarea id="ea" rows="5" maxlength="800" placeholder="כתבו במילים שלכם…" aria-label="${esc(C.exit.q)}">${esc(S.exitAnswer)}</textarea>
        <p class="err" id="eerr" role="alert"></p><button class="btn" type="submit">שלחו</button></form></section>`;
    $('#ea').oninput = e => { S.exitAnswer = e.target.value; saveLocal(); };
    $('#ef').onsubmit = e => {
      e.preventDefault();
      if (S.exitAnswer.trim().length < 10) { $('#eerr').textContent = 'כתבו לפחות משפט אחד.'; return; }
      S.exitSent = true; go('thanks');
    };
  }
  function thanksScreen() {
    app.innerHTML = `<section class="screen thanks">
      <div class="wa-mini"><div class="wa-head">${ART.avatar('noa')}<div class="wa-who"><b>נועה</b><span>מחוברת</span></div></div>
        <div class="wa-body"><div class="msg mom"><div class="bub">${esc(C.exit.thanks)}<span class="meta"><bdi>16:20</bdi></span></div></div></div></div>
      <h1>התשובה נשלחה. תודה!</h1><p class="lead">התיק של צוות ${esc(S.name)} נסגר.</p>
      ${S.code ? '' : '<button class="btn ghost" id="again">משחק חדש</button>'}</section>`;
    sfx('msg');
    const a = $('#again'); if (a) a.onclick = () => { const s = S.sound; S = fresh(); S.sound = s; go('join'); };
  }

  /* ================= אתחול ================= */
  load();
  render();
  setInterval(tick, 500);
  setInterval(sync, 2500);
  sync();
  window.addEventListener('online', sync);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { tick(); sync(); } });
})();
