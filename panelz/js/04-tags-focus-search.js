'use strict';
// 04-tags-focus-search.js: fly-to, tag mode, focus overlay with comments, hashtag pills, search autocomplete.

function flyToPanel(panel) {
  if (!panel) return;
  const sh = shapeOf(panel);
  const toCol = panel.col + (sh.w - 1) / 2, toRow = panel.row + (sh.h - 1) / 2;
  const panelCells = Math.max(sh.w, sh.h);
  const targetZoom = clampZoom(Math.min((Math.min(state.w, state.h) * 0.68) / (panelCells * BASE_CELL), MAX_ZOOM));
  followAnim = { from: { col: state.camera.col, row: state.camera.row }, to: { col: toCol, row: toRow }, fromZoom: state.camera.zoom, toZoom: targetZoom, start: performance.now(), dur: 720, relock: false };
  state.followUser = false;
  state.highlight = { panel, start: performance.now(), dur: 2400 };
  requestAnimationFrame(tickFollow);
  requestAnimationFrame(tickHighlight);
  toast(`flying to ${panel.name || 'panel'} at [${panel.col}, ${panel.row}]`);
}
function tickHighlight(now) {
  if (!state.highlight) return;
  const t = (now - state.highlight.start) / state.highlight.dur;
  if (t >= 1) { state.highlight = null; draw(); return; }
  draw();
  requestAnimationFrame(tickHighlight);
}
// ---------- tag mode ----------
const tagModeEl = document.getElementById('tagMode');
const tagModeLabel = document.getElementById('tagModeLabel');
const tagModeCountEl = document.getElementById('tagModeCount');
const tagModeNext = document.getElementById('tagModeNext');
const tagModeClose = document.getElementById('tagModeClose');
let tagLoop = false;
function tickTagMode() {
  if (!state.activeTag) { tagLoop = false; return; }
  draw();
  requestAnimationFrame(tickTagMode);
}
function startTagLoop() { if (!tagLoop) { tagLoop = true; requestAnimationFrame(tickTagMode); } }
function tagPanelsByDistance(tag, fromCol, fromRow) {
  const mid = (p) => ({ c: p.col + (shapeOf(p).w - 1) / 2, r: p.row + (shapeOf(p).h - 1) / 2 });
  return panelsWithTag(tag).slice().sort((a, b) => {
    const A = mid(a), B = mid(b);
    return ((A.c - fromCol) ** 2 + (A.r - fromRow) ** 2) - ((B.c - fromCol) ** 2 + (B.r - fromRow) ** 2);
  });
}
function panelsBounds(panels) {
  let minC = Infinity, minR = Infinity, maxC = -Infinity, maxR = -Infinity;
  for (const p of panels) {
    const sh = shapeOf(p);
    minC = Math.min(minC, p.col); minR = Math.min(minR, p.row);
    maxC = Math.max(maxC, p.col + sh.w - 1); maxR = Math.max(maxR, p.row + sh.h - 1);
  }
  return { minC, minR, maxC, maxR, w: maxC - minC + 1, h: maxR - minR + 1 };
}
function openTagMode(tag) {
  if (!tag) return;
  const panels = panelsWithTag(tag);
  if (!panels.length) { toast(`no panels hold #${tag}`); return; }
  const b = panelsBounds(panels);
  const padCells = 3;
  const fitZoom = clampZoom(Math.min(state.w / ((b.w + padCells * 2) * BASE_CELL), state.h / ((b.h + padCells * 2) * BASE_CELL)));
  state.activeTag = tag;
  state.tagOrder = tagPanelsByDistance(tag, state.user.col, state.user.row);
  state.tagVisited = 0;
  tagModeLabel.textContent = '#' + tag;
  tagModeCountEl.textContent = `${panels.length} panel${panels.length === 1 ? '' : 's'}`;
  tagModeNext.disabled = panels.length < 2;
  tagModeEl.classList.add('open');
  followAnim = { from: { col: state.camera.col, row: state.camera.row }, to: { col: (b.minC + b.maxC) / 2, row: (b.minR + b.maxR) / 2 }, fromZoom: state.camera.zoom, toZoom: fitZoom, start: performance.now(), dur: 620, relock: false };
  state.followUser = false;
  state.highlight = null;
  requestAnimationFrame(tickFollow);
  startTagLoop();
  toast(`tag mode: #${tag} — ${panels.length} panel${panels.length === 1 ? '' : 's'}`);
}
function closeTagMode() {
  if (!state.activeTag) return;
  state.activeTag = null;
  state.tagOrder = null;
  state.tagVisited = 0;
  tagModeEl.classList.remove('open');
  justClosedTagMode = performance.now();
  draw();
}
function nextTagPanel() {
  if (!state.activeTag || !state.tagOrder || !state.tagOrder.length) return;
  const ordered = state.tagOrder;
  state.tagVisited = (state.tagVisited + 1) % ordered.length;
  tagModeCountEl.textContent = `${state.tagVisited + 1} / ${ordered.length}`;
  flyToPanel(ordered[state.tagVisited]);
  startTagLoop();
}
tagModeNext.addEventListener('click', nextTagPanel);
tagModeClose.addEventListener('click', closeTagMode);
tagModeEl.addEventListener('mousedown', (e) => e.stopPropagation());
// ---------- focus overlay ----------
const focusOverlay = document.getElementById('focusOverlay');
const focusPanelEl = document.getElementById('focusPanel');
const focusPanelName = document.getElementById('focusPanelName');
const focusName = document.getElementById('focusName');
const focusMeta = document.getElementById('focusMeta');
const focusTagCount = document.getElementById('focusTagCount');
const focusTagsEl = document.getElementById('focusTags');
const focusComments = document.getElementById('focusComments');
const focusForm = document.getElementById('focusCommentForm');
const focusInput = document.getElementById('focusCommentInput');
const focusPrev = document.getElementById('focusPrev');
const focusNext = document.getElementById('focusNext');
const focusTakeMe = document.getElementById('focusTakeMe');
let focusedPanel = null, focusedTag = null;
const commentsByPanel = new Map();
function toggleFollow(tag) {
  if (state.followedTags.has(tag)) { state.followedTags.delete(tag); toast(`unfollowed #${tag}`); }
  else { state.followedTags.add(tag); toast(`following #${tag}`); }
}
function renderComments(panel) {
  const list = commentsByPanel.get(panel.id) || [];
  if (!list.length) { focusComments.innerHTML = '<div class="fc-empty">no comments yet</div>'; return; }
  focusComments.innerHTML = list.map(c => `<div class="fc-comment"><div class="fc-who">${escapeHtml(c.who)}</div><div class="fc-text">${escapeHtml(c.text)}</div></div>`).join('');
  focusComments.scrollTop = focusComments.scrollHeight;
}
function focusOnPanel(panel, tag) {
  if (!panel) return;
  focusedPanel = panel;
  const tags = panel.tags || [];
  focusedTag = tag && tags.includes(tag) ? tag : tags[0] || null;
  const sh = shapeOf(panel);
  focusPanelEl.style.background = panel.color;
  focusPanelName.textContent = panel.name || 'panel';
  const rgb = hexToRgb(panel.color);
  focusPanelEl.classList.toggle('light', (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) > 170);
  focusName.textContent = (panel.name || 'panel') + (panel === state.user ? '  (you)' : '');
  focusMeta.textContent = `panel [${panel.col}, ${panel.row}] · ${sh.w}×${sh.h}`;
  renderComments(panel);
  renderFocusTags(panel);
  updateFocusTagCount();
  cardEl.style.display = 'none';
  focusOverlay.classList.add('open');
  setTimeout(() => focusInput.focus(), 50);
}
function renderFocusTags(panel) {
  focusTagsEl.innerHTML = '';
  for (const t of (panel.tags || [])) {
    const el = document.createElement('span');
    el.className = 'fc-tag' + (state.followedTags.has(t) ? ' followed' : '') + (t === focusedTag ? ' current' : '');
    const name = document.createElement('span');
    name.className = 'fc-name';
    name.textContent = '#' + t;
    name.title = `Show #${t} on the grid (double-click to cycle by it)`;
    name.addEventListener('click', (ev) => { ev.stopPropagation(); closeFocus(); openTagMode(t); });
    name.addEventListener('dblclick', (ev) => { ev.stopPropagation(); focusedTag = t; renderFocusTags(panel); updateFocusTagCount(); });
    const f = document.createElement('span');
    f.className = 'fc-follow';
    f.textContent = state.followedTags.has(t) ? '✓' : '+';
    f.title = state.followedTags.has(t) ? `Unfollow #${t}` : `Follow #${t}`;
    f.addEventListener('click', (ev) => { ev.stopPropagation(); toggleFollow(t); renderFocusTags(panel); });
    el.appendChild(name); el.appendChild(f);
    focusTagsEl.appendChild(el);
  }
}
function updateFocusTagCount() {
  if (!focusedPanel || !focusedTag) { focusTagCount.textContent = '0 / 0'; return; }
  const sibs = panelsWithTag(focusedTag);
  focusTagCount.textContent = `${sibs.indexOf(focusedPanel) + 1} / ${sibs.length}`;
  const solo = sibs.length < 2;
  focusPrev.classList.toggle('solo', solo);
  focusNext.classList.toggle('solo', solo);
}
function cycleSibling(dir) {
  if (!focusedPanel || !focusedTag) return;
  const sibs = panelsWithTag(focusedTag);
  if (sibs.length < 2) { toast('only this panel holds #' + focusedTag); return; }
  const i = (sibs.indexOf(focusedPanel) + dir + sibs.length) % sibs.length;
  focusOnPanel(sibs[i], focusedTag);
}
function closeFocus() {
  focusOverlay.classList.remove('open');
  focusedPanel = null;
  focusInput.blur();
  justClosedFocus = performance.now();
}
document.getElementById('focusClose').addEventListener('click', closeFocus);
focusOverlay.addEventListener('click', (e) => { if (e.target === focusOverlay) closeFocus(); });
focusPrev.addEventListener('click', (e) => { if (!e.currentTarget.classList.contains('solo')) cycleSibling(-1); });
focusNext.addEventListener('click', (e) => { if (!e.currentTarget.classList.contains('solo')) cycleSibling(1); });
focusTakeMe.addEventListener('click', () => { if (!focusedPanel) return; const t = focusedPanel; closeFocus(); flyToPanel(t); });
focusForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!focusedPanel) return;
  const text = focusInput.value.trim();
  if (!text) return;
  if (!commentsByPanel.has(focusedPanel.id)) commentsByPanel.set(focusedPanel.id, []);
  commentsByPanel.get(focusedPanel.id).push({ who: state.user.name || 'you', text });
  focusInput.value = '';
  renderComments(focusedPanel);
});
stage.addEventListener('dblclick', (e) => {
  clearTimeout(clickTimer);
  if (overlayOpen() || state.view !== 'map') return;
  if (e.target.closest('#controls, #searchBox, #searchDropdown, #tagMode, #shapeDock, #postsView')) return;
  const rect = stage.getBoundingClientRect();
  const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
  if (sx < 0 || sy < 0 || sx > state.w || sy > state.h) return;
  const c = cellAtScreen(sx, sy);
  const hit = panelAt(c.col, c.row);
  if (hit) focusOnPanel(hit);
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && state.activeTag && !overlayOpen()) { closeTagMode(); e.preventDefault(); return; }
  if (e.key === 'Escape' && overlayOpen()) { closeFocus(); e.preventDefault(); return; }
  if (overlayOpen() && document.activeElement !== focusInput) {
    if (e.key === 'ArrowUp') { e.preventDefault(); cycleSibling(-1); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); cycleSibling(1); }
  }
});
// ---------- search autocomplete ----------
const searchBox = document.getElementById('searchBox');
const searchInput = document.getElementById('searchInput');
const searchClear = document.getElementById('searchClear');
const searchDropdown = document.getElementById('searchDropdown');
let tagIndex = null;
let sdRows = [], sdSel = -1;
function getTagIndex() {
  if (tagIndex) return tagIndex;
  const m = new Map();
  for (const p of [...state.others, state.user]) {
    for (const t of (p.tags || [])) {
      const k = t.toLowerCase();
      const e = m.get(k);
      if (e) e.count++; else m.set(k, { tag: t, count: 1 });
    }
  }
  tagIndex = [...m.values()];
  return tagIndex;
}
function closeDropdown() { searchDropdown.classList.remove('open'); sdSel = -1; }
function renderDropdown() {
  const q = searchInput.value.trim().toLowerCase().replace(/^#/, '');
  searchBox.classList.toggle('has-query', !!searchInput.value);
  if (!q) { closeDropdown(); return; }
  const hits = getTagIndex().filter(e => e.tag.toLowerCase().includes(q));
  hits.sort((a, b) => {
    const as = a.tag.toLowerCase().startsWith(q) ? 0 : 1, bs = b.tag.toLowerCase().startsWith(q) ? 0 : 1;
    return as - bs || b.count - a.count || a.tag.localeCompare(b.tag);
  });
  sdRows = hits.slice(0, 40);
  sdSel = sdRows.length ? 0 : -1;
  searchDropdown.innerHTML = '';
  if (!sdRows.length) {
    const d = document.createElement('div');
    d.className = 'sd-empty';
    d.textContent = 'no matching hashtags';
    searchDropdown.appendChild(d);
  } else {
    sdRows.forEach((e, i) => {
      const row = document.createElement('div');
      row.className = 'sd-row' + (i === sdSel ? ' kbd' : '');
      row.setAttribute('role', 'option');
      const t = document.createElement('span');
      t.className = 'sd-tag';
      t.textContent = '#' + e.tag;
      const c = document.createElement('span');
      c.className = 'sd-count';
      c.textContent = e.count + (e.count === 1 ? ' panel' : ' panels');
      row.appendChild(t); row.appendChild(c);
      row.addEventListener('mousedown', (ev) => ev.preventDefault());
      row.addEventListener('click', () => pickTag(e.tag));
      searchDropdown.appendChild(row);
    });
  }
  searchDropdown.classList.add('open');
}
function moveSel(d) {
  if (!sdRows.length) return;
  sdSel = (sdSel + d + sdRows.length) % sdRows.length;
  [...searchDropdown.querySelectorAll('.sd-row')].forEach((r, i) => r.classList.toggle('kbd', i === sdSel));
  const el = searchDropdown.querySelectorAll('.sd-row')[sdSel];
  if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
}
// pickTag is a function declaration so 05-views-dock.js can wrap it for the posts view.
function pickTag(tag) {
  searchInput.value = '#' + tag;
  searchBox.classList.add('has-query');
  closeDropdown();
  searchInput.blur();
  openTagMode(tag);
}
searchInput.addEventListener('input', renderDropdown);
searchInput.addEventListener('focus', renderDropdown);
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') { e.preventDefault(); moveSel(1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); moveSel(-1); }
  else if (e.key === 'Enter') { e.preventDefault(); if (sdRows[sdSel]) pickTag(sdRows[sdSel].tag); }
  else if (e.key === 'Escape') { e.preventDefault(); closeDropdown(); searchInput.blur(); }
});
searchInput.addEventListener('blur', () => setTimeout(closeDropdown, 120));
searchClear.addEventListener('click', () => {
  searchInput.value = '';
  searchBox.classList.remove('has-query');
  closeDropdown();
  closeTagMode();
});
