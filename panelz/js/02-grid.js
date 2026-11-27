'use strict';
// 02-grid.js: occupancy, fit checks, tag cache, camera maths and the canvas draw().

let occMap = new Map();
let userFreeOcc = null;
function invalidateUserFree() { userFreeOcc = null; }
function occupiedExcludingUser() {
  if (userFreeOcc) return userFreeOcc;
  const s = new Set(occMap.keys());
  for (const [c, r] of cellsOf(state.user.col, state.user.row, state.user.shape)) s.delete(key(c, r));
  userFreeOcc = s;
  return s;
}
function rebuildOccupancy(excludePanel) {
  occMap = new Map();
  const all = [state.user, ...state.others];
  for (const p of all) {
    if (excludePanel && p === excludePanel) continue;
    const sh = shapeOf(p);
    for (let dc = 0; dc < sh.w; dc++) {
      for (let dr = 0; dr < sh.h; dr++) {
        occMap.set(key(p.col + dc, p.row + dr), p);
      }
    }
  }
  invalidateUserFree();
}
rebuildOccupancy();
function panelAt(col, row) { return occMap.get(key(col, row)) || null; }
function shapeFits(col, row, shape, excludePanel) {
  if (excludePanel) rebuildOccupancy(excludePanel);
  const sh = SHAPES[shape] || SHAPES.single;
  for (let dc = 0; dc < sh.w; dc++) {
    for (let dr = 0; dr < sh.h; dr++) {
      if (occMap.has(key(col + dc, row + dr))) return false;
    }
  }
  return true;
}
function occupiedCellSet(excludePanel) {
  if (excludePanel === state.user) return occupiedExcludingUser();
  const s = new Set();
  const all = [state.user, ...state.others];
  for (const p of all) {
    if (excludePanel && p === excludePanel) continue;
    for (const [c, r] of cellsOf(p.col, p.row, p.shape)) s.add(key(c, r));
  }
  return s;
}
function fitsAt(col, row, shape, excludePanel) {
  const s = occupiedCellSet(excludePanel);
  return cellsOf(col, row, shape).every(([c, r]) => !s.has(key(c, r)));
}
function findFitInDirection(startCol, startRow, dc, dr, shape) {
  const MAX = 500;
  for (let i = 1; i <= MAX; i++) {
    const col = startCol + dc * i, row = startRow + dr * i;
    if (fitsAt(col, row, shape, state.user)) return { col, row };
  }
  return null;
}
let tagPanelCache = new Map();
function invalidateTagCache() { tagPanelCache = new Map(); }
function panelsWithTag(tag) {
  const lt = String(tag).toLowerCase();
  let list = tagPanelCache.get(lt);
  if (!list) { list = [...state.others, state.user].filter(p => (p.tags || []).some(t => t.toLowerCase() === lt)); tagPanelCache.set(lt, list); }
  return list;
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function resize() {
  const r = stage.getBoundingClientRect();
  state.w = r.width; state.h = r.height;
  state.dpr = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.floor(r.width * state.dpr);
  canvas.height = Math.floor(r.height * state.dpr);
  canvas.style.width = r.width + 'px';
  canvas.style.height = r.height + 'px';
  draw();
}
window.addEventListener('resize', resize);
function cellPx() { return BASE_CELL * state.camera.zoom; }
function worldToScreen(col, row) {
  const cp = cellPx();
  return { x: (col - state.camera.col) * cp + state.w / 2, y: (row - state.camera.row) * cp + state.h / 2 };
}
function screenToWorld(sx, sy) {
  const cp = cellPx();
  return { col: (sx - state.w / 2) / cp + state.camera.col, row: (sy - state.h / 2) / cp + state.camera.row };
}
function cellAtScreen(sx, sy) { const w = screenToWorld(sx, sy); return { col: Math.round(w.col), row: Math.round(w.row) }; }
function clampZoom(z) { return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z)); }
function setZoom(newZoom, ax, ay) {
  newZoom = clampZoom(newZoom);
  ax = (ax == null ? state.w / 2 : ax);
  ay = (ay == null ? state.h / 2 : ay);
  const before = screenToWorld(ax, ay);
  state.camera.zoom = newZoom;
  const after = screenToWorld(ax, ay);
  state.camera.col += before.col - after.col;
  state.camera.row += before.row - after.row;
  state.followUser = false;
  updateZoomLabel();
  draw();
}
function updateZoomLabel() {
  const z = state.camera.zoom, pct = z * 100;
  if (pct >= 1) zoomVal.textContent = Math.round(pct) + '%';
  else if (pct >= 0.01) zoomVal.textContent = pct.toFixed(2) + '%';
  else zoomVal.textContent = z.toExponential(1) + '×';
}
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function hexToRgb(h) {
  h = h.replace('#','');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function shade(hex, amt) {
  const c = hexToRgb(hex);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + amt)));
  return `rgb(${f(c.r)}, ${f(c.g)}, ${f(c.b)})`;
}
function draw() {
  const { w, h, dpr } = state;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const cp = cellPx();
  const tl = screenToWorld(-cp, -cp), br = screenToWorld(w + cp, h + cp);
  const c0 = Math.floor(tl.col), c1 = Math.ceil(br.col), r0 = Math.floor(tl.row), r1 = Math.ceil(br.row);
  const drawNames = cp >= 56;
  const spanC = c1 - c0, spanR = r1 - r0;
  const detailEmpty = cp >= 8 && spanC <= MAX_EMPTY_SPAN && spanR <= MAX_EMPTY_SPAN;
  if (detailEmpty) {
    for (let col = c0; col <= c1; col++) {
      for (let row = r0; row <= r1; row++) {
        if (occMap.has(key(col, row))) continue;
        const s = worldToScreen(col, row);
        const x = s.x - cp / 2, y = s.y - cp / 2;
        const pad = Math.max(1, cp * 0.04), size = cp - pad * 2;
        const radius = Math.max(0, Math.min(10, cp * 0.1));
        const isHover = state.hover && state.hover.col === col && state.hover.row === row;
        ctx.fillStyle = isHover ? '#3a4250' : '#2b323d';
        roundRect(x + pad, y + pad, size, size, radius);
        ctx.fill();
        ctx.lineWidth = 1; ctx.strokeStyle = '#000';
        roundRect(x + pad, y + pad, size, size, radius);
        ctx.stroke();
      }
    }
  } else {
    ctx.lineWidth = 1; ctx.strokeStyle = '#2b323d';
    ctx.beginPath();
    for (let col = c0; col <= c1 + 1; col++) { const x = (col - state.camera.col) * cp + w / 2; ctx.moveTo(x, 0); ctx.lineTo(x, h); }
    for (let row = r0; row <= r1 + 1; row++) { const y = (row - state.camera.row) * cp + h / 2; ctx.moveTo(0, y); ctx.lineTo(w, y); }
    ctx.stroke();
  }
  const tinyPanel = cp < 2.5;
  const panels = [...state.others, state.user];
  const dimSet = state.activeTag ? new Set(panelsWithTag(state.activeTag)) : null;
  for (const p of panels) {
    const sh = shapeOf(p);
    if (p.col + sh.w < c0 - 1 || p.col > c1 + 1 || p.row + sh.h < r0 - 1 || p.row > r1 + 1) continue;
    const dim = dimSet && !dimSet.has(p) && p !== state.user;
    const s = worldToScreen(p.col, p.row);
    if (tinyPanel) {
      const d = Math.max(2, Math.min(sh.w, sh.h) * cp);
      ctx.save();
      if (dim) ctx.globalAlpha = 0.14;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(s.x + (sh.w - 1) * cp / 2, s.y + (sh.h - 1) * cp / 2, d / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      continue;
    }
    const pad = Math.max(1, cp * 0.04);
    const x = s.x - cp / 2 + pad, y = s.y - cp / 2 + pad;
    const pw = sh.w * cp - pad * 2, ph = sh.h * cp - pad * 2;
    const radius = Math.max(0, Math.min(10, cp * 0.1));
    ctx.save();
    if (dim) ctx.globalAlpha = 0.14;
    ctx.fillStyle = p.color;
    roundRect(x, y, pw, ph, radius); ctx.fill();
    ctx.lineWidth = Math.max(1, cp * 0.02);
    ctx.strokeStyle = shade(p.color, -40);
    roundRect(x, y, pw, ph, radius); ctx.stroke();
    ctx.restore();
    if (p === state.user) {
      ctx.save();
      ctx.lineWidth = Math.max(2, cp * 0.04);
      ctx.strokeStyle = 'rgba(255,255,255,.85)';
      ctx.setLineDash([cp * 0.12, cp * 0.1]);
      roundRect(x - 3, y - 3, pw + 6, ph + 6, radius + 3);
      ctx.stroke();
      ctx.restore();
    }
    if (drawNames && p.name) {
      const fontSize = Math.max(10, Math.min(18, cp * 0.16));
      ctx.font = `600 ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const rgb = hexToRgb(p.color);
      const lum = 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
      ctx.save();
      if (dim) ctx.globalAlpha = 0.18;
      ctx.fillStyle = lum > 150 ? 'rgba(0,0,0,.78)' : 'rgba(255,255,255,.92)';
      ctx.fillText(p.name, s.x - cp / 2 + pw / 2 + pad, s.y - cp / 2 + ph / 2 + pad);
      ctx.restore();
    }
  }
  if (state.activeTag) {
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 220);
    const tagged = panelsWithTag(state.activeTag);
    const curP = state.tagOrder ? state.tagOrder[state.tagVisited] : null;
    for (const p of tagged) {
      const sh = shapeOf(p);
      if (p.col + sh.w < c0 - 1 || p.col > c1 + 1 || p.row + sh.h < r0 - 1 || p.row > r1 + 1) continue;
      const s = worldToScreen(p.col, p.row);
      const isCur = (curP === p);
      ctx.save();
      ctx.strokeStyle = isCur ? '#ffffff' : 'rgba(56,214,200,0.85)';
      if (isCur) { ctx.shadowColor = 'rgba(255,255,255,0.9)'; ctx.shadowBlur = 22; }
      if (cp < 8) {
        const cx = s.x + (sh.w - 1) * cp / 2, cy = s.y + (sh.h - 1) * cp / 2;
        const rad = Math.max(isCur ? 9 : 5, Math.min(sh.w, sh.h) * cp * 0.5 + 3);
        ctx.lineWidth = isCur ? 3 * (0.8 + 0.5 * pulse) : 1.5;
        ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.stroke();
      } else {
        const pad = Math.max(1, cp * 0.04);
        const x = s.x - cp / 2 + pad, y = s.y - cp / 2 + pad;
        const pw = sh.w * cp - pad * 2, ph = sh.h * cp - pad * 2;
        const radius = Math.max(0, Math.min(10, cp * 0.1));
        ctx.lineWidth = (isCur ? Math.max(4, cp * 0.10) : Math.max(2, cp * 0.05)) * (isCur ? (0.8 + 0.5 * pulse) : 1);
        roundRect(x - 5, y - 5, pw + 10, ph + 10, radius + 5);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
  if (state.highlight && state.highlight.panel) {
    const hp = state.highlight.panel;
    const shh = shapeOf(hp);
    const elapsed = (performance.now() - state.highlight.start) / state.highlight.dur;
    if (elapsed < 1 && hp.col + shh.w >= c0 - 1 && hp.col <= c1 + 1 && hp.row + shh.h >= r0 - 1 && hp.row <= r1 + 1) {
      const fade = 1 - elapsed;
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 160);
      const s = worldToScreen(hp.col, hp.row);
      const pad = Math.max(1, cp * 0.04);
      const x = s.x - cp / 2 + pad, y = s.y - cp / 2 + pad;
      const pw = Math.max(4, shh.w * cp - pad * 2), ph = Math.max(4, shh.h * cp - pad * 2);
      const radius = Math.max(0, Math.min(10, cp * 0.1));
      ctx.save();
      ctx.lineWidth = Math.max(3, cp * 0.07) * (0.7 + 0.6 * pulse);
      ctx.strokeStyle = `rgba(255,255,255,${(0.55 * fade).toFixed(3)})`;
      ctx.shadowColor = 'rgba(255,255,255,0.9)';
      ctx.shadowBlur = 24 * fade;
      roundRect(x - 6, y - 6, pw + 12, ph + 12, radius + 6);
      ctx.stroke();
      ctx.restore();
    }
  }
}
