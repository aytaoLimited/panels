# Panelz demo: RCRT snapshot, design and UX log

This file fixes the state of the Panelz demo as rebuilt inside RCRT, so it can be rebuilt or moved to another workspace without starting again.

- **Baseline in this repo:** `gridwork.html`, VERSION 0.2.3 (commit cd893ae, "Lock the grid (freeze camera) while in posts/doomscroll view")
- **RCRT copy:** the "Panelz" panel on the main board, space "Panelz", cell `e702ceaa41ae`, **panel version 26** (full view about 93 KB of html, css and js in one panel)
- **Logged:** 2026-11-27
- **Naming:** the product is called **panelz** only, never "gridworks".

## How the RCRT build differs from `gridwork.html`

The repo demo is one large HTML file. RCRT could not take it in one write, so it was rebuilt in four plan steps, each one a chunked `html_edits` write to the same panel:

1. Grid on the board: pan, zoom, seeded panels, hover card, your panel.
2. Click a panel: focus overlay, comments, hashtag pills and tag mode, search autocomplete.
3. Posts feed and settings: the posts view, settings panel, shape dock, keyboard shortcuts.
4. Widget and polish: a figure tile (the board widget), render findings cleared, sized 2x2.

RCRT specifics to keep when moving it:

- The panel is html starting with a `<style>` block, then `<main id="app">`, then one IIFE `<script>`. It runs in a frame with no network.
- The topbar, stage and floating controls are laid out with `position:absolute` inside the panel. The page itself does not scroll.
- The script listens for `window` event `rcrt-level` and re-runs `resize()` (and the posts pager resize), because the panel is drawn at more than one scale: tile and opened view.
- Seed data is deterministic: `rng(20260811)`, target 4000 neighbour panels. Do not change the seed or the cluster list, or panel positions change.
- Two build markers are left in the source and are harmless: `/*@@DRAWEXTRA@@*/` and `/*@@JS2@@*/`.
- State that resets on reload (by design in the demo): likes, comments, followed tags, your name, colour and shape.
- Widget tile: a stat "Panels on the grid" (4000, spark) plus a three-line list: "Double-click a panel to focus", "swipe posts, one at a time", "Shapes 1x1, 2x1, 1x2". Board size 2x2.

## UX and design: the fixed state

### Look
- Dark theme tokens: `--bg #0d1117`, `--panel #161b22`, `--panel-2 #1c232e`, `--border #2a313c`, `--text #e6edf3`, `--muted #8b949e`, `--accent #7c5cff`, `--accent-2 #38d6c8`, `--danger #ff5d5d`, radius 12px.
- Logo mark is a 26px rounded square with an accent to teal gradient. Floating panels use translucent surfaces with a blur.
- 12-colour panel palette, 8 swatches in settings plus a custom colour input.
- Names draw on a panel once a cell is at least 56px wide. Text flips to dark on light colours (luminance above 150, or 170 in focus and feed views).

### Map view (the grid)
- Canvas 2D. Base cell 96px, zoom 0.02 to 3.0. Drag to pan, scroll or +/- to zoom around the cursor, Home recentres.
- Empty cells draw as rounded squares up to 4096 cells across. Past that, or below 8px a cell, it draws grid lines. Panels under 2.5px a cell draw as dots.
- Hover card on any panel: name, `panel [col, row] WxH`, and either "this is you" or "double-click to open".
- Your panel has a dashed white outline. The top-right readout shows `[col, row] WxH` and is a button that recentres on you. It also leaves the posts view or focus overlay.
- **Moving your panel (added in this build):**
  - Click an empty cell and your panel moves there (toast "moved to [c, r]"). Click your own panel to recentre. A click is held 220ms so a double-click can win.
  - Arrow keys step your panel one cell. If the next cell is blocked: hop over the blocker if the square just past it is free; otherwise swap into the gap and shift the blockers back (up to 3 cells); otherwise jump to the nearest free spot in that direction. The camera follows.
  - Dragging pans only. It never moves your panel.

### Focus overlay (double-click a panel)
- Full-screen blurred overlay, card up to 1100x720: solid colour panel with its name on the left, a 340px sidebar on the right (name and "(you)", position and shape, hashtag pills with count "n / total", "Take me to this panel", comments, comment form).
- Up and down arrows (and the top and bottom edge buttons) cycle through panels sharing the current tag. Esc or the X closes. Under 700px wide it stacks.
- Hashtag pills: click the name to enter tag mode, double-click it to make it the cycling tag, click the + / tick to follow or unfollow.

### Tag mode and search
- Tag mode zooms out to fit every panel with that tag, rings them in teal, dims the others to 14%, and shows a bottom pill with the tag, count, "Next" (flies to the nearest unvisited, current one glows white) and close. Esc exits.
- Search box top-left with autocomplete: prefix matches first, then by count, up to 40 rows, arrow keys and Enter to pick, clear button.
- In the posts view, picking a tag filters the feed instead of the grid.
- 258-tag pool (instagram-style tags and subreddits), 1 to 5 tags per panel.

### Shapes
- 1x1, 2x1 (landscape) and 1x2 (portrait). The dock is bottom-centre. The popover lists the three shapes with glyphs. Keys 1, 2, 3.
- If the new shape does not overlap anything it applies in place. If not, the panel moves to the nearest free spot in a straight line. It never shrinks and never pushes others.

### Posts view (the doomscroll pager)
This is the part changed most recently. It replaced the first scrolling card list.
- **One post at a time**, like Instagram Reels, TikTok and YouTube Shorts. Scrolling, swiping or the arrow keys moves to the next or previous post. Posts slide in from below or above. Only the current post and its neighbours are in the page.
- **Frame matches the panel's shape on the grid:** square for 1x1, 16:9 landscape for 2x1, 9:16 portrait for 1x2. The frame fits the available height and width and has a badge, for example "1x2 · portrait".
- Caption overlay bottom-left: avatar, name, `[col, row] · WxH`, tag pills with follow. Action rail bottom-right: like with count, comments with count, "Find" (jumps to the map and flies to the panel).
- Tap to open focus. Double-tap to like, with a heart that pops. Tags filter the feed, and a filter bar at the top shows the tag, post count and a clear button.
- Controls: wheel (with an accumulator and lock so one flick moves one post, including trackpad momentum), pointer drag with a 15% height or fast-flick threshold and rubber-band at the ends, up and down buttons with an "n / total" count on the right, keys Down, PageDown, J, Space for next and Up, PageUp, K for previous.
- Order: yours first, then nearest to you.
- The map camera is frozen while in posts view (matches repo v0.2.3). The shape dock is hidden there.
- The earlier card-list code (`buildPostCardLegacy`, `renderPostsLegacy`) is still in the file but unused. It can be deleted. `renderPostsLegacy` calls a `buildPostCard` that does not exist, so do not re-enable it.

### Keyboard map
| Key | Action |
|---|---|
| Arrow keys | Move your panel (map). Next or previous post (posts). Cycle tag siblings (focus). |
| Home | Recentre on your panel |
| + / - | Zoom |
| M / P | Map or posts view |
| S | Toggle settings |
| 1 / 2 / 3 | Shape 1x1 / 2x1 / 1x2 |
| Esc | Leave focus, then tag mode |

## Known gaps to fix on the next pass
- The settings tip "Panels stay put: you can't move your panel in grid view" contradicts the click and arrow-key movement. Reword it.
- Settings tips do not yet mention the posts pager controls beyond "scroll, swipe or up and down".
- Likes, comments and follows are not stored anywhere.
- Not clicked through end to end by the agent that built it. Only static renders were checked. Test: the posts pager on a trackpad and on touch, and the arrow-key hop and swap cases.

## Moving it to another workspace
1. Create a panel titled "Panelz" and write the full view html (style, then main, then script). Do it in chunks of about 10 KB with `html_edits`, because one write cannot hold all of it.
2. Add the widget: a stat ("Panels on the grid", 4000, spark) and the three-line list above. Size 2x2.
3. Check the result against this log: seed, palette, shapes, posts pager ratios, shortcuts.

The canonical source of the RCRT build is the panel itself (version 26). If a copy of the full html is needed in git, export it from the panel and commit it as `rcrt/panelz-panel-v26.html` in this repo.
