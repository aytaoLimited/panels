'use strict';
// 06-posts-pager.js: the posts view, one post at a time (like TikTok / Reels / Shorts).
// Frame shape follows the panel on the grid: 1x1 square, 2x1 landscape 16:9, 1x2 portrait 9:16.

const rlUp = document.getElementById('rlUp'), rlDown = document.getElementById('rlDown'), rlCount = document.getElementById('rlCount'), rlFilter = document.getElementById('rlFilter'), rlNav = document.getElementById('rlNav');
const rl = { list: [], idx: 0, slides: new Map(), dragY: 0, drag: null, moved: false, suppress: false, locked: false, lastStep: 0, lastWheel: 0, lastAbs: 0, acc: 0 };
const RL_RATIO = { single: 1, h: 16 / 9, v: 9 / 16 };
const RL_LABEL = { single: '1×1 · square', h: '2×1 · landscape', v: '1×2 · portrait' };
const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
// Fit the frame to its aspect ratio inside the view, leaving room for the nav rail.
function rlSize(el) {
  const p = el._p, f = el.firstChild, padT = state.postsTag ? 56 : 0;
  el.style.paddingTop = padT + 'px';
  const W = postsView.clientWidth - 150, H = postsView.clientHeight - 40 - padT, r = RL_RATIO[p.shape] || 1;
  const h = Math.max(120, Math.min(H, W / r));
  f.style.height = h + 'px'; f.style.width = (h * r) + 'px';
}
function rlPlaceOne(i, el) { el.style.transform = 'translateY(calc(' + ((i - rl.idx) * 100) + '% + ' + rl.dragY + 'px))'; }
function rlPlace() { rl.slides.forEach((el, i) => rlPlaceOne(i, el)); }
function rlSettle() { rl.dragY = 0; rl.slides.forEach((el) => el.classList.remove('drag')); rlPlace(); }
function rlBuild(p) {
  const el = mk('div', 'rl-slide drag'); el._p = p;
  const f = mk('div', 'rl-frame'); f.style.background = p.color;
  const rgb = hexToRgb(p.color);
  if ((0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) > 170) f.classList.add('light');
  const sh = shapeOf(p);
  f.appendChild(mk('div', 'rl-title', p.name || 'panel'));
  f.appendChild(mk('div', 'rl-badge', RL_LABEL[p.shape] || RL_LABEL.single));
  f.appendChild(mk('div', 'rl-shade'));
  const cap = mk('div', 'rl-cap');
  const user = mk('div', 'rl-user'); const av = mk('div', 'rl-av'); av.style.background = p.color;
  user.appendChild(av); user.appendChild(mk('span', null, (p.name || 'panel') + (p === state.user ? ' (you)' : '')));
  cap.appendChild(user);
  cap.appendChild(mk('div', 'rl-meta', '[' + p.col + ', ' + p.row + '] · ' + sh.w + '×' + sh.h));
  const tags = mk('div', 'rl-tags');
  for (const t of (p.tags || [])) {
    const tg = mk('span', 'rl-tag' + (state.followedTags.has(t) ? ' followed' : ''));
    const tn = mk('span', null, '#' + t); tn.title = 'Filter the feed by #' + t;
    tn.addEventListener('click', () => { state.postsTag = t; searchInput.value = '#' + t; searchBox.classList.add('has-query'); renderPosts(); });
    const fl = mk('span', 'rl-follow', state.followedTags.has(t) ? '✓' : '+');
    fl.addEventListener('click', (ev) => { ev.stopPropagation(); toggleFollow(t); tg.classList.toggle('followed', state.followedTags.has(t)); fl.textContent = state.followedTags.has(t) ? '✓' : '+'; });
    tg.appendChild(tn); tg.appendChild(fl); tags.appendChild(tg);
  }
  cap.appendChild(tags); f.appendChild(cap);
  const rail = mk('div', 'rl-rail');
  const likeWrap = mk('div', 'rl-act'), likeBtn = mk('button'), likeN = mk('span');
  const paint = () => { const on = likedPosts.has(p.id); likeBtn.classList.toggle('on', on); likeBtn.textContent = on ? '♥' : '♡'; likeN.textContent = likeBase(p) + (on ? 1 : 0); };
  likeBtn.title = 'Like';
  likeBtn.addEventListener('click', () => { if (likedPosts.has(p.id)) likedPosts.delete(p.id); else likedPosts.add(p.id); paint(); });
  likeWrap.appendChild(likeBtn); likeWrap.appendChild(likeN); paint();
  const cmWrap = mk('div', 'rl-act'), cmBtn = mk('button', null, '💬'); cmBtn.title = 'Open comments';
  cmBtn.addEventListener('click', () => focusOnPanel(p)); cmWrap.appendChild(cmBtn); cmWrap.appendChild(mk('span', null, (commentsByPanel.get(p.id) || []).length));
  const fdWrap = mk('div', 'rl-act'), fdBtn = mk('button', null, '◎'); fdBtn.title = 'Find on the grid';
  fdBtn.addEventListener('click', () => { switchView('map'); flyToPanel(p); }); fdWrap.appendChild(fdBtn); fdWrap.appendChild(mk('span', null, 'Find'));
  rail.appendChild(likeWrap); rail.appendChild(cmWrap); rail.appendChild(fdWrap); f.appendChild(rail);
  [cap, rail].forEach((n) => { n.addEventListener('click', (ev) => ev.stopPropagation()); n.addEventListener('dblclick', (ev) => ev.stopPropagation()); });
  // Single click opens the focus view; double-click likes with a heart pop.
  let openTimer = null;
  f.addEventListener('click', () => { clearTimeout(openTimer); openTimer = setTimeout(() => focusOnPanel(p), 260); });
  f.addEventListener('dblclick', (ev) => {
    clearTimeout(openTimer);
    if (!likedPosts.has(p.id)) { likedPosts.add(p.id); paint(); }
    const r = f.getBoundingClientRect(), h = mk('div', 'rl-heart', '♥');
    h.style.left = (ev.clientX - r.left) + 'px'; h.style.top = (ev.clientY - r.top) + 'px';
    f.appendChild(h); setTimeout(() => h.remove(), 800);
  });
  el.appendChild(f);
  return el;
}
// Only the current post and its two neighbours exist in the DOM.
function rlEnsure() {
  for (const [i, el] of [...rl.slides]) if (Math.abs(i - rl.idx) > 1) { el.remove(); rl.slides.delete(i); }
  for (let i = rl.idx - 1; i <= rl.idx + 1; i++) {
    if (i < 0 || i >= rl.list.length || rl.slides.has(i)) continue;
    const el = rlBuild(rl.list[i]);
    rl.slides.set(i, el); postsFeed.appendChild(el);
    rlSize(el); rlPlaceOne(i, el); void el.offsetWidth; el.classList.remove('drag');
  }
}
function rlUI() {
  const n = rl.list.length;
  rlCount.textContent = n ? (rl.idx + 1) + ' / ' + n : '';
  rlUp.disabled = rl.idx <= 0; rlDown.disabled = rl.idx >= n - 1;
  rlNav.style.display = n ? '' : 'none';
  rlFilter.style.display = state.postsTag ? 'flex' : 'none';
  if (state.postsTag) {
    rlFilter.innerHTML = '<span>Filtering by <b>#' + escapeHtml(state.postsTag) + '</b> · ' + n + ' post' + (n === 1 ? '' : 's') + '</span>';
    const x = mk('button', 'pv-clear', '×'); x.title = 'Show all panels';
    x.addEventListener('click', () => { state.postsTag = null; searchInput.value = ''; searchBox.classList.remove('has-query'); renderPosts(); });
    rlFilter.appendChild(x);
  }
}
function rlGo(n) {
  n = Math.max(0, Math.min(rl.list.length - 1, n));
  if (n === rl.idx) { rlSettle(); return; }
  rl.idx = n; rl.dragY = 0; rl.lastStep = performance.now();
  rlEnsure(); rl.slides.forEach((el) => el.classList.remove('drag')); rlPlace(); rlUI();
}
function renderPosts() {
  rl.list = postsSorted(); rl.idx = 0; rl.dragY = 0;
  rl.slides.forEach((el) => el.remove()); rl.slides.clear();
  postsEmpty.style.display = rl.list.length ? 'none' : '';
  rlEnsure(); rlUI();
}
rlUp.addEventListener('click', () => rlGo(rl.idx - 1));
rlDown.addEventListener('click', () => rlGo(rl.idx + 1));
// Wheel: one notch = one post. A lock stops trackpad momentum from skipping posts.
postsView.addEventListener('wheel', (e) => {
  e.preventDefault();
  const now = performance.now();
  const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * postsView.clientHeight : e.deltaY;
  const abs = Math.abs(dy), gap = now - rl.lastWheel, prev = rl.lastAbs;
  rl.lastWheel = now; rl.lastAbs = abs;
  if (gap > 120) rl.acc = 0;
  if (rl.locked) {
    const fresh = gap > 120 || abs > prev * 1.3 + 4 || (abs >= 50 && abs >= prev);
    if (now - rl.lastStep > 220 && fresh) { rl.locked = false; rl.acc = 0; } else return;
  }
  rl.acc += dy;
  if (Math.abs(rl.acc) < 8) return;
  const dir = rl.acc > 0 ? 1 : -1;
  rl.acc = 0; rl.locked = true; rl.lastStep = now;
  rlGo(rl.idx + dir);
}, { passive: false });
// Drag / swipe: the slides follow the pointer, then snap on distance or velocity.
postsView.addEventListener('pointerdown', (e) => {
  if (e.button > 0 || e.target.closest('button, .rl-tag, #rlNav, #rlFilter')) return;
  rl.drag = { y: e.clientY, t: performance.now() }; rl.moved = false;
});
window.addEventListener('pointermove', (e) => {
  if (!rl.drag) return;
  let dy = e.clientY - rl.drag.y;
  if (!rl.moved && Math.abs(dy) < 6) return;
  rl.moved = true;
  if ((rl.idx === 0 && dy > 0) || (rl.idx === rl.list.length - 1 && dy < 0)) dy *= 0.3;
  rl.dragY = dy;
  rl.slides.forEach((el) => el.classList.add('drag')); rlPlace();
});
function rlEndDrag(e) {
  if (!rl.drag) return;
  const d = rl.drag; rl.drag = null;
  if (!rl.moved) return;
  rl.suppress = true; setTimeout(() => { rl.suppress = false; }, 60);
  const dy = e.clientY - d.y, v = dy / Math.max(1, performance.now() - d.t), H = postsView.clientHeight;
  if (dy < -H * 0.15 || v < -0.5) rlGo(rl.idx + 1);
  else if (dy > H * 0.15 || v > 0.5) rlGo(rl.idx - 1);
  else rlSettle();
}
window.addEventListener('pointerup', rlEndDrag);
window.addEventListener('pointercancel', rlEndDrag);
postsView.addEventListener('click', (e) => { if (rl.suppress) { e.stopPropagation(); e.preventDefault(); } }, true);
window.addEventListener('keydown', (e) => {
  if (state.view !== 'posts' || overlayOpen() || e.ctrlKey || e.metaKey || e.altKey) return;
  const a = document.activeElement;
  if (a && a.tagName === 'INPUT') return;
  const k = e.key; let d = 0;
  if (k === 'ArrowDown' || k === 'PageDown' || k === 'j' || k === ' ') d = 1;
  else if (k === 'ArrowUp' || k === 'PageUp' || k === 'k') d = -1;
  if (!d) return;
  e.preventDefault();
  if (performance.now() - rl.lastStep < 120) return;
  rlGo(rl.idx + d);
});
window.addEventListener('resize', () => rl.slides.forEach((el) => rlSize(el)));
