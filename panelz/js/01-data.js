'use strict';
// 01-data.js: constants, shared state and the seeded neighbour panels.
// Classic script. All top-level names are shared by the other js/*.js files.

const canvas = document.getElementById('grid');
const stage = document.getElementById('stage');
const ctx = canvas.getContext('2d');
const toastEl = document.getElementById('toast');
const cardEl = document.getElementById('usercard');
const posReadout = document.getElementById('posReadout');
const posReadoutBtn = document.getElementById('posReadoutBtn');
const zoomVal = document.getElementById('zoomVal');

const BASE_CELL = 96;
const MIN_ZOOM = 0.02;
const MAX_ZOOM = 3.0;
const MAX_EMPTY_SPAN = 4096;
const SWATCH_COLORS = ['#7c5cff','#38d6c8','#ff5d5d','#ffb020','#3da5ff','#ff5ca8','#5dd55d','#f5f0e1'];

const HASHTAG_POOL = [
  'love','instagood','photooftheday','fashion','beautiful','happy','cute','tbt','picoftheday','follow','me','selfie',
  'summer','art','instadaily','friends','repost','nature','girl','fun','style','instalike','like4like','smile',
  'family','travel','fitness','food','motivation','life','beauty','gym','workout','photography','sunset','beach',
  'viral','fyp','foryou','explore','trending','meme','funny','dogsofinstagram','catsofinstagram','travelgram','foodie',
  'ootd','skincare','makeupartist','coffee','wanderlust','naturephotography','streetphotography','doodleart','digitalart',
  'mua','yoga','mindfulness','plants','plantbased','sustainability','slow living','cottagecore','aesthetic','golden hour',
  'latergrams','nofilter','behindthescenes','bts','diy','handmade','smallbusiness','supportsmall','shoplocal','crafternoon',
  'AskReddit','aww','pics','todayilearned','Science','worldnews','gaming','movies','music',
  'books','space','DIY','EarthPorn','Art','gadgets','television','sports','Documentaries',
  'explainlikeimfive','AskScience','LifeProTips','Showerthoughts','InternetIsBeautiful','HistoryPorn','oddlysatisfying',
  'creepy','blackmagicfuckery','educationalgifs','educationalvideos','physics','chemistry','biology',
  'psychology','philosophy','spaceporn','waterporn','skyporn','winterporn','autumn','spring',
  'photocritique','analog','mildlyinteresting','nextfuckinglevel','damnthatsinteresting',
  'oddlyterrifying','wholesomememes','mademesmile','humansbeingbros','toastcr','oldpeoplefacebook','nostalgia',
  'retrogaming','patientgamers','games','nintendo','playstation','xbox','pcgaming','buildapc','programming',
  'javascript','webdev','learnprogramming','dataisbeautiful','personalfinance','investing','stocks','cryptocurrency',
  'bodyweightfitness','running','cycling','hiking','climbing','tea','cocktails','baking',
  'cooking','recipes','grilledcheese','pizza','ramen','foodporn','mealprepsunday','eatcheapandhealthy',
  'minimalism','frugal','simpleliving','ZeroWaste','gardening','IndoorGarden','houseplants','whatsthisplant',
  'cats','catsstandingup','catloaf','dogs','dogswithjobs','rarepuppers','foxes','awwducational','babyelephantgifs',
  'babyrhinogifs','babybigcatgifs','tippytaps','likeus','stopsmoking','getdisciplined','DecidingToBeBetter',
  'NonZeroDay','meditation','journaling','WritingPrompts','writing','booksuggestions','bookclub',
  'literature','poetry','comics','webcomics','comicbooks','manga','anime','animemes','starwars','marvelstudios',
  'marvel','DC_Cinematic','doctorwho','startrek','scifi','fantasy','horror','nosleep','creepyencounters',
  'letsplay','twitch','streaming','esports','leagueoflegends','overwatch','Minecraft','lowes','homeimprovement',
  'homeowners','realestate','InteriorDesign','malelivingspace','femalelivingspace','roomporn','cozyplaces',
  'infrastructure','architecture','urbanism','cityporn','villageporn','abandoned','urbanexploration',
  'solotravel','shoestring','onebag','travelhacks','digitalnomad','remote','productivity','getstudying',
  'languages','languagelearning','duolingo','translator','translatorwanted','travelphotography','travelpartner',
  'spaceflight','astronomy','astrophotography','telescopes','cosmology','exoplanet','nasa','spacex','ula'
];

const SHAPES = { single:{w:1,h:1}, h:{w:2,h:1}, v:{w:1,h:2} };
function shapeOf(panel) { return SHAPES[panel.shape] || SHAPES.single; }
function labelShape(s) { return s === 'h' ? '2×1 panel' : s === 'v' ? '1×2 panel' : 'panel'; }

const state = {
  user: { id:'user', col:0, row:0, shape:'single', name:'you', color:'#7c5cff', tags:['cozy','aww','golden hour'] },
  camera: { col:0, row:0, zoom:1 },
  others: [],
  hover: null,
  followUser: true,
  pendingShape: 'single',
  highlight: null,
  followedTags: new Set(),
  activeTag: null,
  tagVisited: 0,
  view: 'map',
  postsTag: null,
  dpr: Math.max(1, window.devicePixelRatio || 1),
  w: 0, h: 0,
};
let justClosedFocus = 0;
let justClosedTagMode = 0;
const overlayOpen = () => !!document.querySelector('#focusOverlay.open');

const PALETTE = ['#7c5cff','#38d6c8','#ff5d5d','#ffb020','#3da5ff','#ff5ca8','#5dd55d','#f5f0e1','#9b8cff','#ff8a3d','#46d6a0','#f06292'];
const SHAPES_BY_WEIGHT = ['single','single','single','single','h','v'];
const NAME_SYL = ['mint','sol','nova','echo','rune','ash','vex','lumen','orrin','kade','wren','pax','sage','drift','cinder','halo','juno','nyx','dax','fenn','lio','rae','cob','wisp','tarn','glen','moss','fen','quill','rune','bramble','sable','ivory','ember','frost','silk','vesper','tully','mira','oke','arlo','ren','pip','calix','noor','obe','ti','umn','zax','bri','cove',' dell','holt','ash','bell','lin'];

// Seeded PRNG (mulberry32). Seed 20260811 makes the same field every load.
function rng(seed) {
  let a = seed >>> 0;
  return function() {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function key(col, row) { return col + ',' + row; }
function cellsOf(col, row, shape) {
  const sh = SHAPES[shape] || SHAPES.single;
  const out = [];
  for (let dc = 0; dc < sh.w; dc++)
    for (let dr = 0; dr < sh.h; dr++)
      out.push([col + dc, row + dr]);
  return out;
}
function buildOthers() {
  const rand = rng(20260811);
  const ri = (n) => Math.floor(rand() * n);
  const pick = (arr) => arr[ri(arr.length)];
  const occ = new Set();
  const usedNames = new Set();
  let nameSeq = 0;
  function freshName() {
    let n;
    do { n = pick(NAME_SYL) + (rand() < 0.25 ? ri(99) : ''); }
    while (usedNames.has(n));
    usedNames.add(n); return n;
  }
  function randomTags() {
    const n = 1 + (rand() < 0.4 ? 0 : rand() < 0.5 ? 1 : rand() < 0.6 ? 2 : rand() < 0.7 ? 3 : 4);
    const out = new Set();
    while (out.size < n) out.add(pick(HASHTAG_POOL));
    return [...out];
  }
  function cellFree(c, r) {
    if (c*c + r*r <= 4) return false;
    return !occ.has(key(c, r));
  }
  const TARGET = 4000, CEILING = 4000;
  const atCeiling = () => state.others.length >= CEILING;
  function tryPlace(col, row, shape) {
    if (atCeiling()) return false;
    const cells = cellsOf(col, row, shape);
    if (!cells.every(([c, r]) => cellFree(c, r))) return false;
    cells.forEach(([c, r]) => occ.add(key(c, r)));
    state.others.push({
      id: 'p' + (++nameSeq),
      col, row, shape,
      name: freshName(),
      color: pick(PALETTE),
      tags: randomTags(),
    });
    return true;
  }
  function cluster(cx, cy, r, density) {
    if (atCeiling()) return;
    for (let dc = -r; dc <= r; dc++) {
      for (let dr = -r; dr <= r; dr++) {
        if (dc*dc + dr*dr > r*r) continue;
        if (rand() < density) { if (tryPlace(cx + dc, cy + dr, pick(SHAPES_BY_WEIGHT)) && atCeiling()) return; }
      }
    }
  }
  cluster(18, 12, 8, 0.82);
  cluster(26, 6, 6, 0.68);
  cluster(-22, -16, 6, 0.55);
  cluster(12, -26, 8, 0.5);
  cluster(-28, 10, 6, 0.6);
  cluster(36, -20, 9, 0.3);
  cluster(-12, 30, 9, 0.32);
  cluster(-42, -36, 11, 0.18);
  cluster(46, 36, 11, 0.2);
  cluster(-42, -36, 18, 0.07);
  cluster(46, 36, 18, 0.07);
  cluster(60, -48, 10, 0.28);
  cluster(-58, -52, 10, 0.26);
  cluster(70, 50, 12, 0.22);
  cluster(-66, 44, 12, 0.24);
  cluster(8, 60, 11, 0.3);
  cluster(-4, -64, 11, 0.28);
  cluster(88, -8, 13, 0.18);
  cluster(-86, 6, 13, 0.2);
  cluster(40, 78, 14, 0.16);
  cluster(-44, -78, 14, 0.16);
  const ringN = Math.max(60, Math.floor(TARGET * 0.04));
  for (let i = 0; i < ringN; i++) {
    if (atCeiling()) break;
    const ang = rand() * Math.PI * 2;
    const dist = 8 + ri(6);
    const c = Math.round(Math.cos(ang) * dist);
    const r = Math.round(Math.sin(ang) * dist);
    tryPlace(c, r, pick(SHAPES_BY_WEIGHT));
  }
  const scatterN = Math.max(80, Math.floor(TARGET * 1.15));
  for (let i = 0; i < scatterN; i++) {
    if (atCeiling()) break;
    const c = ri(321) - 160, r = ri(321) - 160;
    tryPlace(c, r, pick(SHAPES_BY_WEIGHT));
  }
}
state.others = [];
buildOthers();
