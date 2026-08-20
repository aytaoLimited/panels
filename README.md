# Gridwork

An infinite-grid social panel demo. Single-file HTML/JS — open `gridwork.html` in a browser, no build step.

## What it is

A canvas-rendered infinite grid where each cell is a user's "panel." Built as a UI/UX demo for a social-networking concept that blends a spatial map view with a TikTok/Instagram-style feed.

## Features

**Map view** — the grid
- Pan (drag) and infinite zoom (scroll / `+` / `-`) without moving your own panel
- ~4,000 generated neighbour panels with varied clustering and density (seeded, deterministic)
- 1×1 / 2×1 / 1×2 panel shapes
- Double-click any panel to open a fullscreen focus view (solid colour + comments)
- `Home` recenteres on your panel

**Posts view** — the feed
- Top tab bar switches between `▦ Map` and `☰ Posts`
- Scrollable, card-based feed of every panel (Instagram/TikTok-style)
- Like, comment, and "take me to this panel" actions per card
- Click a hashtag pill on a card to filter the feed by that tag

**Tags & search**
- 258 real-world hashtags/subreddits, 1–5 random tags per panel
- Click a tag to enter tag mode: zooms out, rings every panel with that tag, `Next ▸` flies to the closest one
- Top-left search with autocomplete (post counts) — `Enter` commits the literal input
- Non-matching panels dim out during tag/search mode
- Followed tags are tracked (profile display planned)

## Tech

Vanilla JS + Canvas 2D. No dependencies, no build tools, no server. Everything lives in `gridwork.html`.

## Repo

Public. https://github.com/aytaoLimited/panels

Versioning follows `VERSION` (semantic versioning): MAJOR.MINOR.PATCH. New features bump MINOR, fixes/internal changes bump PATCH, breaking changes bump MAJOR.
