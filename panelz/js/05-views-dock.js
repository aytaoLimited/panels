'use strict';
// 05-views-dock.js: map/posts view switch, panel-shape dock, extra keyboard shortcuts.
// renderPosts() and the pager live in 06-posts-pager.js. They are only called after load, so load order is safe.

const postsView = document.getElementById('postsView');
const postsFeed = document.getElementById('postsFeed');
const postsEmpty = document.getElementById('postsEmpty');
const viewTabs = document.getElementById('viewTabs');
const shapeDock = document.getElementById('shapeDock');
const likedPosts = new Set();
function likeBase(p) { let h = 0; const s = String(p.id); for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h) % 240; }
function postsSorted() {
  const base = state.postsTag ? panelsWithTag(state.postsTag) : [...state.others, state.user];
  const d = (p) => (p.col - state.user.col) ** 2 + (p.row - state.user.row) ** 2;
  return base.slice().sort((a, b) => (a === state.user ? -1 : b === state.user ? 1 : d(a) - d(b)));
}
function switchView(v) {
  if (state.view === v) return;
  if (v === 'posts') {
    if (state.activeTag) { state.postsTag = state.activeTag; closeTagMode(); }
    if (state.postsTag) { searchInput.value = '#' + state.postsTag; searchBox.classList.add('has-query'); }
  }
  state.view = v;
  [...viewTabs.children].forEach((b) => b.classList.toggle('active', b.dataset.view === v));
  postsView.classList.toggle('hidden', v !== 'posts');
  shapeDock.style.display = v === 'posts' ? 'none' : '';
  cardEl.style.display = 'none';
  if (v === 'posts') { renderPosts(); }
  else { stage.classList.remove('panning'); panState = null; draw(); }
}
viewTabs.addEventListener('click', (e) => { const b = e.target.closest('.tab'); if (b) switchView(b.dataset.view); });
viewTabs.addEventListener('mousedown', (e) => e.stopPropagation());
posReadoutBtn.addEventListener('click', () => { if (overlayOpen()) closeFocus(); if (state.view !== 'map') switchView('map'); });
// In the posts view, picking a hashtag filters the feed instead of opening tag mode.
const origPickTag = pickTag;
pickTag = function (tag) {
  if (state.view === 'posts') {
    searchInput.value = '#' + tag; searchBox.classList.add('has-query');
    closeDropdown(); searchInput.blur();
    state.postsTag = tag; renderPosts();
  } else origPickTag(tag);
};
searchClear.addEventListener('click', () => { if (state.view === 'posts' && state.postsTag) { state.postsTag = null; renderPosts(); } });
// ---------- panel-type dock ----------
const shapeCurrent = document.getElementById('shapeCurrent');
const shapeCurrentGlyph = document.getElementById('shapeCurrentGlyph');
const shapeCurrentLabel = document.getElementById('shapeCurrentLabel');
const shapePop = document.getElementById('shapePop');
const SHAPE_LABELS = { single: '1×1', h: '2×1', v: '1×2' };
function refreshShapeCurrent() {
  const s = state.pendingShape;
  shapeCurrentLabel.textContent = SHAPE_LABELS[s];
  shapeCurrentGlyph.className = 'shape-glyph ' + s;
  [...shapePop.children].forEach((b) => b.classList.toggle('active', b.dataset.shape === s));
}
function setShapePopOpen(open) { shapePop.classList.toggle('open', open); }
function applyShape(shape) {
  state.pendingShape = shape;
  if (state.user.shape === shape) { toast('panel type: ' + labelShape(shape)); return; }
  if (fitsAt(state.user.col, state.user.row, shape, state.user)) {
    state.user.shape = shape;
    rebuildOccupancy(); updatePosReadout(); draw();
    toast('panel type: ' + labelShape(shape));
    return;
  }
  let best = null;
  for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const f = findFitInDirection(state.user.col, state.user.row, dc, dr, shape);
    if (f && (!best || Math.abs(f.col - state.user.col) + Math.abs(f.row - state.user.row) < Math.abs(best.col - state.user.col) + Math.abs(best.row - state.user.row))) best = f;
  }
  if (!best) { toast('no room for ' + labelShape(shape) + ' nearby'); return; }
  state.user.col = best.col; state.user.row = best.row; state.user.shape = shape;
  rebuildOccupancy(); invalidateTagCache(); updatePosReadout();
  state.followUser = false; recenterOnUser(true);
  toast('switched to ' + labelShape(shape) + ' at [' + best.col + ', ' + best.row + ']');
}
shapeCurrent.addEventListener('click', (e) => { e.stopPropagation(); setShapePopOpen(!shapePop.classList.contains('open')); });
shapePop.addEventListener('click', (e) => {
  e.stopPropagation();
  const btn = e.target.closest('.shape-opt');
  if (!btn) return;
  applyShape(btn.dataset.shape); refreshShapeCurrent(); setShapePopOpen(false);
});
shapeDock.addEventListener('mousedown', (e) => e.stopPropagation());
window.addEventListener('click', () => setShapePopOpen(false));
refreshShapeCurrent();
// ---------- more keyboard shortcuts ----------
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const a = document.activeElement;
  if (a && a.tagName === 'INPUT') return;
  if (overlayOpen()) return;
  const k = e.key.toLowerCase();
  if (k === 'm') switchView('map');
  else if (k === 'p') switchView('posts');
  else if (k === 's') setSettingsOpen(controlsEl.classList.contains('hidden'));
  else if (state.view === 'map' && (k === '1' || k === '2' || k === '3')) { applyShape({ '1': 'single', '2': 'h', '3': 'v' }[k]); refreshShapeCurrent(); }
});
