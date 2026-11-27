'use strict';
// 03-camera-move.js: recentre, move your panel (click / arrow keys / hop and swap), pan, hover card, zoom, keyboard, settings.

let followAnim = null;
function recenterOnUser(animate = true) {
  const sh = shapeOf(state.user);
  const target = { col: state.user.col + (sh.w - 1) / 2, row: state.user.row + (sh.h - 1) / 2 };
  if (!animate) { state.camera.col = target.col; state.camera.row = target.row; state.followUser = true; draw(); return; }
  followAnim = { from: { col: state.camera.col, row: state.camera.row }, to: target, start: performance.now(), dur: 420, relock: true };
  requestAnimationFrame(tickFollow);
}
function tickFollow(now) {
  if (!followAnim) return;
  const t = Math.min(1, (now - followAnim.start) / followAnim.dur);
  const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  state.camera.col = followAnim.from.col + (followAnim.to.col - followAnim.from.col) * e;
  state.camera.row = followAnim.from.row + (followAnim.to.row - followAnim.from.row) * e;
  if (followAnim.fromZoom != null) {
    state.camera.zoom = followAnim.fromZoom + (followAnim.toZoom - followAnim.fromZoom) * e;
    updateZoomLabel();
  }
  draw();
  if (t < 1) requestAnimationFrame(tickFollow);
  else { if (followAnim.relock) state.followUser = true; followAnim = null; }
}
// Click an empty square: your panel moves there if its shape fits.
function moveUserTo(col, row) {
  const u = state.user;
  if (u.col === col && u.row === row) return false;
  if (!fitsAt(col, row, u.shape, u)) { toast('no room for your panel there'); return false; }
  u.col = col; u.row = row;
  rebuildOccupancy(); invalidateTagCache(); updatePosReadout(); draw();
  toast('moved to [' + col + ', ' + row + ']');
  return true;
}
// Blocked one step ahead. If the square just past the blocker is free, hop over it.
// Otherwise (blockers touching) swap places: you take the blocker's square and it takes yours.
function slotPast(dc, dr) {
  const u = state.user;
  rebuildOccupancy();
  const ush = shapeOf(u);
  const blockers = new Set();
  for (const [c, r] of cellsOf(u.col + dc, u.row + dr, u.shape)) {
    const q = occMap.get(key(c, r));
    if (q && q !== u) blockers.add(q);
  }
  if (!blockers.size) return false;
  const bl = [...blockers];
  let jc = u.col, jr = u.row;
  if (dc > 0) jc = Math.max(...bl.map(b => b.col + shapeOf(b).w));
  else if (dc < 0) jc = Math.min(...bl.map(b => b.col)) - ush.w;
  else if (dr > 0) jr = Math.max(...bl.map(b => b.row + shapeOf(b).h));
  else jr = Math.min(...bl.map(b => b.row)) - ush.h;
  if (fitsAt(jc, jr, u.shape, u)) {
    u.col = jc; u.row = jr;
    rebuildOccupancy(); invalidateTagCache(); updatePosReadout();
    recenterOnUser(false);
    toast('hopped over to [' + jc + ', ' + jr + ']');
    return true;
  }
  const blocked = new Set();
  for (const [k, p] of occMap) if (p !== u && !blockers.has(p)) blocked.add(k);
  const nu = cellsOf(u.col + dc, u.row + dr, u.shape).map(([c, r]) => key(c, r));
  if (nu.some(k => blocked.has(k))) return false;
  for (let m = 1; m <= 3; m++) {
    const taken = new Set(nu);
    let ok = true;
    const moves = [];
    for (const b of bl) {
      const nc = b.col - dc * m, nr = b.row - dr * m;
      for (const [c, r] of cellsOf(nc, nr, b.shape)) {
        const k = key(c, r);
        if (blocked.has(k) || taken.has(k)) { ok = false; break; }
        taken.add(k);
      }
      if (!ok) break;
      moves.push([b, nc, nr]);
    }
    if (!ok) continue;
    u.col += dc; u.row += dr;
    for (const [b, nc, nr] of moves) { b.col = nc; b.row = nr; }
    rebuildOccupancy(); invalidateTagCache(); updatePosReadout();
    recenterOnUser(false);
    toast('slotted in, ' + bl.map(b => b.name).join(', ') + ' shifted back');
    return true;
  }
  return false;
}
function stepUser(dc, dr) {
  const u = state.user;
  let col = u.col + dc, row = u.row + dr;
  if (!fitsAt(col, row, u.shape, u)) {
    if (slotPast(dc, dr)) return;
    const f = findFitInDirection(u.col, u.row, dc, dr, u.shape);
    if (!f) { toast('no free spot that way'); return; }
    col = f.col; row = f.row;
  }
  u.col = col; u.row = row;
  rebuildOccupancy(); invalidateTagCache(); updatePosReadout();
  recenterOnUser(false);
}
function updatePosReadout() {
  const sh = shapeOf(state.user);
  posReadout.textContent = `[${state.user.col}, ${state.user.row}] ${sh.w}×${sh.h}`;
}
let toastTimer = null;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1600);
}
// ---------- pan ----------
let panState = null;
let clickTimer = null;
stage.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  if (overlayOpen()) return;
  if (state.view !== 'map') return;
  if (e.target.closest('#tagMode, #searchBox, #searchDropdown, #controls, #shapeDock, #usercard, #postsView')) return;
  panState = { sx: e.clientX, sy: e.clientY, cx: state.camera.col, cy: state.camera.row, moved: false };
  stage.classList.add('panning');
});
window.addEventListener('mousemove', (e) => {
  if (panState) {
    const cp = cellPx();
    const dx = (e.clientX - panState.sx) / cp;
    const dy = (e.clientY - panState.sy) / cp;
    if (Math.abs(e.clientX - panState.sx) > 3 || Math.abs(e.clientY - panState.sy) > 3) panState.moved = true;
    state.camera.col = panState.cx - dx;
    state.camera.row = panState.cy - dy;
    state.followUser = false;
    draw();
  }
  if (state.view !== 'map') return;
  const rect = stage.getBoundingClientRect();
  const cell = cellAtScreen(e.clientX - rect.left, e.clientY - rect.top);
  state.hover = cell;
  updateHoverCard(e.clientX, e.clientY, cell);
  draw();
});
window.addEventListener('mouseup', (e) => {
  if (!panState) return;
  stage.classList.remove('panning');
  if (!panState.moved) {
    const rect = stage.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    if (sx >= 0 && sy >= 0 && sx <= state.w && sy <= state.h) {
      const hc = cellAtScreen(sx, sy);
      const hit = panelAt(hc.col, hc.row);
      clearTimeout(clickTimer);
      clickTimer = setTimeout(() => {
        if (overlayOpen()) return;
        if (performance.now() - justClosedFocus < 400) return;
        if (performance.now() - justClosedTagMode < 400) return;
        if (hit === state.user) recenterOnUser(true);
        else if (!hit) moveUserTo(hc.col, hc.row);
      }, 220);
    }
  }
  panState = null;
});
stage.addEventListener('mouseleave', () => { cardEl.style.display = 'none'; });
// ---------- hover card ----------
function updateHoverCard(clientX, clientY, cell) {
  const hit = panelAt(cell.col, cell.row);
  const rect = stage.getBoundingClientRect();
  const inside = clientX - rect.left >= 0 && clientY - rect.top >= 0 && clientX - rect.left <= state.w && clientY - rect.top <= state.h;
  if (!inside || !hit || e_isOverUi(clientX, clientY)) { cardEl.style.display = 'none'; return; }
  const isUser = (hit === state.user);
  const sh = shapeOf(hit);
  cardEl.innerHTML = `
    <div class="uc-name"><span class="uc-dot" style="background:${hit.color}"></span>${escapeHtml(hit.name)}</div>
    <div class="uc-meta">panel [${hit.col}, ${hit.row}] ${sh.w}×${sh.h}</div>
    ${isUser ? '<div class="uc-you">this is you</div>' : '<div class="uc-meta">double-click to open</div>'}`;
  cardEl.style.display = 'block';
  cardEl.style.left = Math.min(state.w - 180, clientX - rect.left + 12) + 'px';
  cardEl.style.top = Math.min(state.h - 80, clientY - rect.top + 12) + 'px';
}
function e_isOverUi(x, y) {
  const el = document.elementFromPoint(x, y);
  return !!(el && el.closest('#controls, #searchBox, #searchDropdown, #tagMode, #shapeDock, #postsView, #focusOverlay'));
}
// ---------- zoom ----------
stage.addEventListener('wheel', (e) => {
  if (state.view !== 'map') return;
  if (e.target.closest('#controls, #searchDropdown, #postsView, #focusOverlay, #tagMode')) return;
  if (overlayOpen()) return;
  e.preventDefault();
  const rect = stage.getBoundingClientRect();
  setZoom(state.camera.zoom * Math.pow(1.0015, -e.deltaY), e.clientX - rect.left, e.clientY - rect.top);
}, { passive: false });
document.getElementById('zoomIn').addEventListener('click', () => setZoom(state.camera.zoom * 1.25));
document.getElementById('zoomOut').addEventListener('click', () => setZoom(state.camera.zoom / 1.25));
document.getElementById('recenter').addEventListener('click', () => { recenterOnUser(true); toast('centered on your panel'); });
posReadoutBtn.addEventListener('click', () => { recenterOnUser(true); toast('centered on your panel'); });
// ---------- keyboard ----------
window.addEventListener('keydown', (e) => {
  if (state.view !== 'map') return;
  if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
  if (e.key.indexOf('Arrow') === 0) {
    e.preventDefault();
    if (overlayOpen() || e.ctrlKey || e.metaKey || e.altKey) return;
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (d) stepUser(d[0], d[1]);
  }
  else if (e.key === 'Home') { e.preventDefault(); recenterOnUser(true); }
  else if (e.key === '+' || e.key === '=') setZoom(state.camera.zoom * 1.2);
  else if (e.key === '-' || e.key === '_') setZoom(state.camera.zoom / 1.2);
});
// ---------- your panel: name + colour ----------
const nameInput = document.getElementById('nameInput');
nameInput.addEventListener('input', () => { state.user.name = nameInput.value.slice(0, 18); draw(); });
const colorInput = document.getElementById('colorInput');
colorInput.addEventListener('input', () => { state.user.color = colorInput.value; syncSwatchActive(); draw(); });
const swatchesEl = document.getElementById('swatches');
SWATCH_COLORS.forEach(c => {
  const el = document.createElement('div');
  el.className = 'swatch';
  el.style.background = c;
  el.dataset.color = c;
  el.addEventListener('click', () => { state.user.color = c; colorInput.value = c; syncSwatchActive(); draw(); });
  swatchesEl.appendChild(el);
});
function syncSwatchActive() {
  [...swatchesEl.children].forEach(el => el.classList.toggle('active', el.dataset.color.toLowerCase() === state.user.color.toLowerCase()));
}
syncSwatchActive();
// ---------- settings toggle ----------
const controlsEl = document.getElementById('controls');
const settingsBtn = document.getElementById('settingsBtn');
function setSettingsOpen(open) {
  controlsEl.classList.toggle('hidden', !open);
  settingsBtn.classList.toggle('active-toggle', open);
  settingsBtn.title = open ? 'Hide settings' : 'Show settings';
}
settingsBtn.addEventListener('click', () => setSettingsOpen(controlsEl.classList.contains('hidden')));
document.getElementById('closeSettings').addEventListener('click', () => setSettingsOpen(false));
setSettingsOpen(false);
