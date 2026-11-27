# Panelz: standalone snapshot

This folder is the Panelz demo as built in RCRT (Panelz panel v26), turned into a plain HTML project.
No build step, no dependencies. Open `index.html` in a browser, or serve the folder:

    cd panelz && python3 -m http.server 8080

## Files

| File | What it holds |
|---|---|
| `index.html` | All markup: top bar, canvas stage, posts view, shape dock, search, tag mode, focus overlay, settings. Loads the CSS and scripts below. |
| `css/base.css` | Theme variables, top bar, buttons, settings panel, toast, hover card. |
| `css/focus-search.css` | Focus overlay, comments, hashtag pills, search box and dropdown, tag-mode bar. |
| `css/posts-dock.css` | View tabs, one-at-a-time posts pager, shape dock. |
| `js/01-data.js` | Constants, state, hashtag pool, seeded PRNG and the 4,000 neighbour panels. |
| `js/02-grid.js` | Occupancy map, fit checks, camera maths, canvas `draw()`. |
| `js/03-camera-move.js` | Recentre, click-to-move, arrow-key moves (hop / swap), pan, hover card, zoom, settings. |
| `js/04-tags-focus-search.js` | Fly-to, tag mode, focus overlay and comments, search autocomplete. |
| `js/05-views-dock.js` | Map / posts switch, panel-type dock, extra shortcuts. |
| `js/06-posts-pager.js` | Posts view: one post at a time, frames match the panel shape (square, 16:9, 9:16). |
| `js/07-start.js` | First paint. |

The scripts are classic scripts that share one global scope, so **load order matters** (it is the numeric order, set in `index.html`).

## How this differs from the RCRT panel

The RCRT panel is one 93 KB HTML document wrapped in an IIFE. Here it is split by feature. Behaviour is the same, with these deliberate changes:

- Dropped the RCRT-only `rcrt-level` listeners.
- Dropped the old scrolling card feed (`buildPostCardLegacy`, `renderPostsLegacy`, `postsShown`) and the `/*@@...@@*/` splice markers used to assemble the panel.
- `<main>` is the page body; the page title is set in `<head>`.
- State still resets on reload: your position, name, colour, likes, comments, follows and any panels shifted by your moves.

## Fixed values

- Seed `20260811`; 4,000 neighbour panels; base cell 96 px; zoom 0.02 to 3.0.
- Shapes: `single` 1x1, `h` 2x1, `v` 1x2.
- Keys: arrows move your panel, `Home` recentres, `+`/`-` zoom, `M` map, `P` posts, `S` settings, `1`/`2`/`3` shape, `Esc` closes focus or tag mode. In posts: up/down, `j`/`k`, `PageUp`/`PageDown`, space.

## Not yet tested

This was split and committed from the RCRT panel without being opened in a browser. Open it once and check the console for load-order errors before relying on it.

The `gridwork.html` at the repo root is the older single-file prototype and is untouched. See `../docs/RCRT-PANELZ-DESIGN-LOG.md` for the design notes.
