// ================================================================
// IPTV — app.js v4.0
// TizenBrew / Samsung TV 2025
// Features: Virtual Scroll · Splash Screen · Remote Number Dial
//           Search-then-select fix · No category row · Big fonts
// ================================================================

/* ── HLS.js check ─────────────────────────────────────────── */
(function checkHLS() {
  if (window.Hls) console.log('[IPTV] HLS.js', window.Hls.version);
  else            console.error('[IPTV] HLS.js missing');
})();

/* ── DOM refs ─────────────────────────────────────────────── */
const searchInput   = document.getElementById('searchInput');
const searchWrap    = document.querySelector('.search-wrap');
const tabBar        = document.getElementById('tabBar');
const channelListEl = document.getElementById('channelList');
const countBadge    = document.getElementById('countBadge');
const nowPlayingEl  = document.getElementById('nowPlaying');
const nowGroupEl    = document.getElementById('nowGroup');
const npChNumEl     = document.getElementById('npChNum');
const statusBadge   = document.getElementById('statusBadge');
const video         = document.getElementById('video');
const videoWrap     = document.getElementById('videoWrap');
const videoOverlay  = document.getElementById('videoOverlay');
const fsHint        = document.getElementById('fsHint');
const loadBar       = document.getElementById('loadBar');
const splash        = document.getElementById('splash');
const splashBar     = document.getElementById('splashBar');
const splashSub     = document.getElementById('splashSub');
const appEl         = document.getElementById('app');
const chDialer      = document.getElementById('chDialer');
const chDialerNum   = document.getElementById('chDialerNum');

/* ── Playlists ───────────────────────────────────────────── */
const PLAYLISTS = [
  { name: 'Telugu', url: 'https://iptv-org.github.io/iptv/languages/tel.m3u' },
  { name: 'India',  url: 'https://iptv-org.github.io/iptv/countries/in.m3u'  },
  { name: 'Sports', url: 'https://iptv-org.github.io/iptv/categories/sports.m3u' },
  { name: 'Movies', url: 'https://iptv-org.github.io/iptv/categories/movies.m3u' },
];

/* ── HLS config ──────────────────────────────────────────── */
const HLS_CONFIG = {
  enableWorker: false, lowLatencyMode: false,
  backBufferLength: 30, maxBufferLength: 60, maxMaxBufferLength: 120,
  maxBufferSize: 60*1000*1000, maxBufferHole: 0.5, nudgeMaxRetry: 5,
  startLevel: -1, abrEwmaDefaultEstimate: 1500000,
  manifestLoadingMaxRetry: 4, manifestLoadingRetryDelay: 500,
  levelLoadingMaxRetry: 4,    levelLoadingRetryDelay: 500,
  fragLoadingMaxRetry: 6,     fragLoadingRetryDelay: 500,
  xhrSetup: function(xhr) { xhr.timeout = 15000; },
};

/* ── State ───────────────────────────────────────────────── */
let channels      = [];
let filtered      = [];
let selectedIndex = 0;
let focusArea     = 'list';   // 'list' | 'search'
let hls           = null;
let plIdx         = 0;
let isFullscreen  = false;
let hasPlayed     = false;
let fsHintTimer   = null;
let loadBarTimer  = null;

/* number-dial state */
let dialBuffer    = '';
let dialTimer     = null;

const STORAGE_KEY = 'iptv:lastPl';
try {
  const s = localStorage.getItem(STORAGE_KEY);
  if (s) plIdx = Math.min(parseInt(s, 10) || 0, PLAYLISTS.length - 1);
} catch(_) {}

/* ══════════════════════════════════════════════════════════
   SPLASH
   ══════════════════════════════════════════════════════════ */
function splashProgress(pct, msg) {
  splashBar.style.width = pct + '%';
  if (msg) splashSub.textContent = msg;
}

function splashDone() {
  splashProgress(100, 'Ready');
  setTimeout(() => {
    splash.classList.add('done');
    appEl.style.opacity = '1';
    appEl.style.pointerEvents = '';
    /* remove splash from DOM after fade */
    setTimeout(() => {
      if (splash.parentNode) splash.parentNode.removeChild(splash);
    }, 600);
  }, 300);
}

/* ══════════════════════════════════════════════════════════
   STATUS / LOAD BAR
   ══════════════════════════════════════════════════════════ */
function setStatus(text, cls) {
  statusBadge.textContent = text;
  statusBadge.className   = 'status-badge ' + (cls || 'idle');
}

function startLoadBar() {
  clearTimeout(loadBarTimer);
  loadBar.style.width = '0%';
  loadBar.classList.add('active');
  let w = 0;
  const tick = () => {
    w = Math.min(w + Math.random() * 9, 85);
    loadBar.style.width = w + '%';
    if (w < 85) loadBarTimer = setTimeout(tick, 220);
  };
  loadBarTimer = setTimeout(tick, 100);
}

function finishLoadBar() {
  clearTimeout(loadBarTimer);
  loadBar.style.width = '100%';
  setTimeout(() => { loadBar.classList.remove('active'); loadBar.style.width = '0%'; }, 400);
}

/* ══════════════════════════════════════════════════════════
   M3U PARSER
   ══════════════════════════════════════════════════════════ */
function parseM3U(text) {
  const lines = text.split(/\r?\n/);
  const out   = [];
  let meta    = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#EXTINF')) {
      const namePart   = line.includes(',') ? line.split(',').slice(1).join(',').trim() : 'Unknown';
      const groupMatch = line.match(/group-title="([^"]+)"/i);
      const logoMatch  = line.match(/tvg-logo="([^"]+)"/i);
      meta = {
        name:  namePart || 'Unknown',
        group: groupMatch ? groupMatch[1] : 'Other',
        logo:  logoMatch  ? logoMatch[1]  : '',
      };
      continue;
    }
    if (!line.startsWith('#') && meta) {
      out.push({ name: meta.name, group: meta.group, logo: meta.logo, url: line });
      meta = null;
    }
  }
  return out;
}

/* ── Helpers ─────────────────────────────────────────────── */
function esc(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function getInitials(name) {
  return name.replace(/[^a-zA-Z0-9]/g,' ').trim()
    .split(/\s+/).slice(0,2).map(w => w[0] || '').join('').toUpperCase() || '?';
}

/* ══════════════════════════════════════════════════════════
   VIRTUAL SCROLL ENGINE  (54 px rows, Tizen-safe)
   ══════════════════════════════════════════════════════════ */
const VS = {
  ITEM_H:  54,    // ← must equal CSS --item-h
  OVERSCAN: 6,
  container:  null,
  inner:      null,
  viewport_h: 0,
  scroll_top: 0,
  total:      0,
  rs: -1, re: -1,   // rendered start / end
  nodes:  [],
  raf_id: null,

  init(container) {
    this.container = container;
    this.inner = document.createElement('div');
    this.inner.id = 'vsInner';
    this.container.appendChild(this.inner);
    this.viewport_h = this.container.clientHeight || 600;

    this.container.addEventListener('scroll', () => {
      if (this.raf_id) return;
      this.raf_id = requestAnimationFrame(() => {
        this.raf_id = null;
        this.scroll_top = this.container.scrollTop;
        this._paint();
      });
    }, { passive: true });
  },

  setData(count) {
    this.total = count;
    this.rs = -1; this.re = -1;
    while (this.inner.firstChild) this.inner.removeChild(this.inner.firstChild);
    this.nodes = [];
    this.inner.style.height = (count * this.ITEM_H) + 'px';
    this.inner.style.position = 'relative';
    this.scroll_top = this.container.scrollTop;
    this.viewport_h = this.container.clientHeight || 600;
    this._paint();
  },

  scrollToIndex(idx) {
    const top    = idx * this.ITEM_H;
    const bottom = top + this.ITEM_H;
    const vh     = this.viewport_h;
    const st     = this.container.scrollTop;
    if (top < st)          this.container.scrollTop = top;
    else if (bottom > st + vh) this.container.scrollTop = bottom - vh;
    this.scroll_top = this.container.scrollTop;
    this._paint();
  },

  _paint() {
    if (!this.total) return;
    const st    = this.scroll_top;
    const vh    = this.viewport_h;
    const H     = this.ITEM_H;
    const os    = this.OVERSCAN;
    const start = Math.max(0, Math.floor(st / H) - os);
    const end   = Math.min(this.total - 1, Math.ceil((st + vh) / H) + os);

    if (start === this.rs && end === this.re) return;
    this.rs = start; this.re = end;

    // prune out-of-range
    this.nodes = this.nodes.filter(node => {
      const i = node._vsIdx;
      if (i < start || i > end) { this.inner.removeChild(node); return false; }
      return true;
    });

    const rendered = new Set(this.nodes.map(n => n._vsIdx));
    for (let i = start; i <= end; i++) {
      if (!rendered.has(i)) {
        const li = this._build(i);
        this.inner.appendChild(li);
        this.nodes.push(li);
      }
    }

    // sync active state
    const sel = selectedIndex;
    this.nodes.forEach(node => {
      const on = node._vsIdx === sel;
      node.classList.toggle('active', on);
      const nm = node._nm;
      const nu = node._nu;
      if (nm) nm.style.color = on ? '#000' : '';
      if (nu) nu.style.color = on ? '#aaa' : '';
    });
  },

  _build(i) {
    const ch  = filtered[i];
    const li  = document.createElement('li');
    li._vsIdx = i;
    li.style.cssText = 'position:absolute;top:' + (i * this.ITEM_H)
      + 'px;left:0;right:0;height:' + this.ITEM_H + 'px;';

    const initials = esc(getInitials(ch.name));
    const logoHtml = ch.logo
      ? '<div class="ch-logo"><img src="' + esc(ch.logo)
        + '" alt="" loading="lazy"'
        + ' onerror="this.style.display=\'none\';this.nextSibling.style.display=\'flex\'"'
        + ' onload="this.nextSibling.style.display=\'none\'">'
        + '<span class="ch-logo-fb" style="display:none">' + initials + '</span></div>'
      : '<div class="ch-logo"><span class="ch-logo-fb">' + initials + '</span></div>';

    li.innerHTML = logoHtml
      + '<div class="ch-info"><div class="ch-name">' + esc(ch.name) + '</div></div>'
      + '<div class="ch-num">' + (i + 1) + '</div>';

    // cache hot child refs to avoid querySelector on every paint
    li._nm = li.querySelector('.ch-name');
    li._nu = li.querySelector('.ch-num');

    if (i === selectedIndex) {
      li.classList.add('active');
      if (li._nm) li._nm.style.color = '#000';
      if (li._nu) li._nu.style.color = '#aaa';
    }

    li.addEventListener('click', () => {
      selectedIndex = i;
      VS.refresh();
      playSelected();
    });
    return li;
  },

  refresh() {
    this.rs = -1; this.re = -1;
    this._paint();
  },
};

/* ══════════════════════════════════════════════════════════
   RENDER  (delegates to VS)
   ══════════════════════════════════════════════════════════ */
function renderList() {
  countBadge.textContent = filtered.length;
  if (!filtered.length) {
    VS.setData(0);
    const li = document.createElement('li');
    li.style.cssText = 'position:absolute;top:0;left:0;right:0;padding:14px;';
    li.innerHTML = '<div class="ch-info"><div class="ch-name" style="color:#333">No channels found</div></div>';
    VS.inner.appendChild(li);
    return;
  }
  VS.setData(filtered.length);
  VS.scrollToIndex(selectedIndex);
}

/* ══════════════════════════════════════════════════════════
   SEARCH  — debounced, focus returns to list after commit
   ══════════════════════════════════════════════════════════ */
let searchDebounce = null;

function applySearch() {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    const q = searchInput.value.trim().toLowerCase();
    filtered = !q
      ? channels.slice()
      : channels.filter(c =>
          c.name.toLowerCase().includes(q) ||
          c.group.toLowerCase().includes(q));
    selectedIndex = 0;
    renderList();
  }, 120);
}

function commitSearch() {
  /* Exit search mode, move focus to list so arrow keys work */
  setFocus('list');
  /* If there's exactly one result, play it automatically */
  if (filtered.length === 1) {
    selectedIndex = 0;
    VS.refresh();
    playSelected();
  }
}

function clearSearch() {
  searchInput.value = '';
  applySearch();
  setFocus('list');
}

/* ══════════════════════════════════════════════════════════
   XHR / PLAYLIST LOAD
   ══════════════════════════════════════════════════════════ */
function xhrFetch(url, timeoutMs, cb) {
  let done = false;
  const xhr = new XMLHttpRequest();
  const tid = setTimeout(() => {
    if (done) return; done = true; xhr.abort(); cb(new Error('Timeout'), null);
  }, timeoutMs);
  xhr.onreadystatechange = function() {
    if (xhr.readyState !== 4 || done) return;
    done = true; clearTimeout(tid);
    if (xhr.status >= 200 && xhr.status < 400) cb(null, xhr.responseText);
    else cb(new Error('HTTP ' + xhr.status), null);
  };
  xhr.onerror = function() {
    if (done) return; done = true; clearTimeout(tid);
    cb(new Error('Network error'), null);
  };
  xhr.open('GET', url, true);
  xhr.send();
}

function githubMirror(url) {
  try {
    const u = new URL(url);
    if (u.hostname !== 'raw.githubusercontent.com') return null;
    const p = u.pathname.split('/').filter(Boolean);
    if (p.length < 4) return null;
    return 'https://cdn.jsdelivr.net/gh/' + p[0] + '/' + p[1] + '@' + p[2]
      + '/' + p.slice(3).join('/');
  } catch(_) { return null; }
}

function loadPlaylist(urlOverride) {
  const url = urlOverride || PLAYLISTS[plIdx].url;
  setStatus('Loading…', 'loading');
  startLoadBar();
  splashProgress(20, 'Fetching playlist…');

  xhrFetch(url, 25000, (err, text) => {
    if (err) {
      const mirror = githubMirror(url);
      if (mirror) {
        setStatus('Retrying…', 'loading');
        splashProgress(40, 'Trying mirror…');
        xhrFetch(mirror, 25000, (err2, text2) => {
          finishLoadBar();
          if (err2) { setStatus('Failed', 'error'); splashProgress(100, 'Failed'); return; }
          onLoaded(text2);
        });
      } else {
        finishLoadBar();
        setStatus('Failed', 'error');
        splashProgress(100, 'Failed to load');
      }
      return;
    }
    finishLoadBar();
    onLoaded(text);
  });
}

function onLoaded(text) {
  splashProgress(80, 'Building channel list…');
  channels      = parseM3U(text);
  filtered      = channels.slice();
  selectedIndex = 0;
  renderList();
  try { localStorage.setItem(STORAGE_KEY, String(plIdx)); } catch(_) {}
  setStatus('Ready · ' + channels.length + ' ch', 'idle');
  setFocus('list');
  splashDone();
}

/* ══════════════════════════════════════════════════════════
   PLAYBACK
   ══════════════════════════════════════════════════════════ */
function playSelected() {
  if (!filtered.length) return;
  const ch = filtered[selectedIndex];
  if (!ch) return;

  nowPlayingEl.textContent = ch.name;
  nowGroupEl.textContent   = ch.group || '';
  npChNumEl.textContent    = 'CH ' + (selectedIndex + 1);
  videoOverlay.classList.add('hidden');
  hasPlayed = true;
  setStatus('Buffering…', 'loading');
  startLoadBar();

  try {
    if (hls) { hls.destroy(); hls = null; }
    video.removeAttribute('src');
    video.load();

    const url   = ch.url;
    const isHLS = /\.m3u8($|\?)/i.test(url) || url.toLowerCase().includes('m3u8');

    if (isHLS) {
      if (video.canPlayType('application/vnd.apple.mpegurl') && !window.Hls) {
        video.src = url; video.play().catch(() => {}); return;
      }
      if (window.Hls && window.Hls.isSupported()) {
        hls = new window.Hls(HLS_CONFIG);
        hls.on(window.Hls.Events.MANIFEST_PARSED, () => { video.play().catch(() => {}); });
        hls.on(window.Hls.Events.ERROR, (_, data) => {
          if (!data.fatal) return;
          if (data.type === window.Hls.ErrorTypes.NETWORK_ERROR) {
            setStatus('Net error', 'error'); hls.startLoad();
          } else if (data.type === window.Hls.ErrorTypes.MEDIA_ERROR) {
            setStatus('Recovering…', 'loading'); hls.recoverMediaError();
          } else {
            setStatus('Stream error', 'error'); finishLoadBar();
            hls.destroy(); hls = null;
          }
        });
        hls.loadSource(url);
        hls.attachMedia(video);
        return;
      }
      setStatus('HLS not supported', 'error');
      return;
    }

    video.src = url;
    video.play().catch(() => {});
  } catch(err) {
    finishLoadBar();
    setStatus('Play error', 'error');
  }
}

/* ══════════════════════════════════════════════════════════
   NAVIGATION
   ══════════════════════════════════════════════════════════ */
function moveSelection(delta) {
  if (!filtered.length) return;
  selectedIndex = Math.max(0, Math.min(filtered.length - 1, selectedIndex + delta));
  VS.scrollToIndex(selectedIndex);
  VS.refresh();
}

function setFocus(area) {
  focusArea = area;
  if (area === 'search') {
    searchWrap.classList.add('active');
    searchInput.focus();
  } else {
    searchWrap.classList.remove('active');
    if (document.activeElement === searchInput) searchInput.blur();
  }
}

/* ══════════════════════════════════════════════════════════
   REMOTE NUMBER DIAL
   Pressing 0-9 on the remote buffers digits, waits 1.5 s,
   then jumps to that channel number (1-based).
   ══════════════════════════════════════════════════════════ */
function handleDigit(d) {
  clearTimeout(dialTimer);
  dialBuffer += d;
  chDialerNum.textContent = dialBuffer;
  chDialer.classList.add('visible');

  dialTimer = setTimeout(() => {
    const num = parseInt(dialBuffer, 10);
    dialBuffer = '';
    chDialer.classList.remove('visible');
    if (!filtered.length) return;
    const idx = Math.max(0, Math.min(filtered.length - 1, num - 1));
    selectedIndex = idx;
    VS.scrollToIndex(idx);
    VS.refresh();
    playSelected();
    setTimeout(() => { if (hasPlayed) enterFullscreen(); }, 600);
  }, 1500);
}

/* ══════════════════════════════════════════════════════════
   TAB SWITCH
   ══════════════════════════════════════════════════════════ */
function switchTab(idx) {
  plIdx = idx;
  document.querySelectorAll('.tab').forEach((t, i) => t.classList.toggle('active', i === idx));
  loadPlaylist();
}
tabBar.querySelectorAll('.tab').forEach((btn, i) =>
  btn.addEventListener('click', () => switchTab(i)));

/* ══════════════════════════════════════════════════════════
   FULLSCREEN
   ══════════════════════════════════════════════════════════ */
function showFsHint() {
  clearTimeout(fsHintTimer);
  fsHint.classList.add('visible');
  fsHintTimer = setTimeout(() => fsHint.classList.remove('visible'), 3000);
}
function enterFullscreen() {
  const fn = videoWrap.requestFullscreen || videoWrap.webkitRequestFullscreen
           || videoWrap.mozRequestFullScreen;
  if (fn) { try { fn.call(videoWrap); } catch(_) {} }
  document.body.classList.add('fullscreen');
  isFullscreen = true;
  showFsHint();
}
function exitFullscreen() {
  const fn = document.exitFullscreen || document.webkitExitFullscreen
           || document.mozCancelFullScreen;
  if (fn) { try { fn.call(document); } catch(_) {} }
  document.body.classList.remove('fullscreen');
  isFullscreen = false;
  fsHint.classList.remove('visible');
}
function toggleFullscreen() { isFullscreen ? exitFullscreen() : enterFullscreen(); }

document.addEventListener('fullscreenchange', () => {
  isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement);
  if (!isFullscreen) { document.body.classList.remove('fullscreen'); fsHint.classList.remove('visible'); }
});
document.addEventListener('webkitfullscreenchange', () => {
  isFullscreen = !!(document.webkitFullscreenElement || document.fullscreenElement);
  if (!isFullscreen) { document.body.classList.remove('fullscreen'); fsHint.classList.remove('visible'); }
});
video.addEventListener('dblclick', toggleFullscreen);

/* ══════════════════════════════════════════════════════════
   VIDEO EVENTS
   ══════════════════════════════════════════════════════════ */
video.addEventListener('playing', () => { setStatus('Playing', 'playing'); finishLoadBar(); });
video.addEventListener('pause',   () => setStatus('Paused', 'paused'));
video.addEventListener('waiting', () => { setStatus('Buffering…', 'loading'); startLoadBar(); });
video.addEventListener('stalled', () => setStatus('Buffering…', 'loading'));
video.addEventListener('error',   () => { setStatus('Error', 'error'); finishLoadBar(); });

/* ══════════════════════════════════════════════════════════
   TIZEN KEY REGISTRATION
   ══════════════════════════════════════════════════════════ */
(function registerKeys() {
  try {
    if (window.tizen && tizen.tvinputdevice) {
      ['MediaPlay','MediaPause','MediaPlayPause','MediaStop',
       'MediaFastForward','MediaRewind',
       'ColorF0Red','ColorF1Green','ColorF2Yellow','ColorF3Blue',
       'ChannelUp','ChannelDown','Back',
       '0','1','2','3','4','5','6','7','8','9']
      .forEach(k => { try { tizen.tvinputdevice.registerKey(k); } catch(_) {} });
    }
  } catch(_) {}
})();

/* ══════════════════════════════════════════════════════════
   KEYBOARD / REMOTE HANDLER
   ══════════════════════════════════════════════════════════ */
window.addEventListener('keydown', (e) => {
  const key  = e.key;
  const code = e.keyCode;

  /* ── Digit keys: 0-9 on remote ────────────────────────── */
  if ((code >= 48 && code <= 57) || (code >= 96 && code <= 105)) {
    /* Only when not typing in search */
    if (focusArea !== 'search') {
      const d = code >= 96 ? code - 96 : code - 48;
      handleDigit(String(d));
      e.preventDefault();
      return;
    }
  }

  /* ── Back / Escape ─────────────────────────────────────── */
  if (key === 'Escape' || key === 'Back' || key === 'GoBack'
      || code === 10009 || code === 27) {
    if (isFullscreen) { exitFullscreen(); e.preventDefault(); return; }
    if (focusArea === 'search') { clearSearch(); e.preventDefault(); return; }
    try { if (window.tizen) tizen.application.getCurrentApplication().exit(); } catch(_) {}
    e.preventDefault(); return;
  }

  /* ── Search mode: Enter commits, arrows escape search ──── */
  if (focusArea === 'search') {
    if (key === 'Enter' || code === 13) {
      commitSearch();
      e.preventDefault();
      return;
    }
    /* ArrowDown/Up while searching: jump to list */
    if (key === 'ArrowDown' || key === 'ArrowUp' || code === 40 || code === 38) {
      commitSearch();
      /* then fall through to normal arrow handling below */
      /* (no return — fall through) */
    } else {
      return; /* let other keys type normally in the input */
    }
  }

  /* ── Arrow keys ─────────────────────────────────────────── */
  if (key === 'ArrowUp'    || code === 38) {
    isFullscreen ? showFsHint() : moveSelection(-1);
    e.preventDefault(); return;
  }
  if (key === 'ArrowDown'  || code === 40) {
    isFullscreen ? showFsHint() : moveSelection(1);
    e.preventDefault(); return;
  }
  if (key === 'ArrowLeft'  || code === 37) {
    isFullscreen ? exitFullscreen() : setFocus('list');
    e.preventDefault(); return;
  }
  if (key === 'ArrowRight' || code === 39) {
    if (!isFullscreen && hasPlayed) enterFullscreen();
    e.preventDefault(); return;
  }

  /* ── Enter ──────────────────────────────────────────────── */
  if (key === 'Enter' || code === 13) {
    if (isFullscreen) { exitFullscreen(); e.preventDefault(); return; }
    if (focusArea === 'list') {
      playSelected();
      setTimeout(() => { if (hasPlayed) enterFullscreen(); }, 600);
    }
    e.preventDefault(); return;
  }

  /* ── Page keys ──────────────────────────────────────────── */
  if (key === 'PageUp')   { moveSelection(-10); e.preventDefault(); return; }
  if (key === 'PageDown') { moveSelection(10);  e.preventDefault(); return; }

  /* ── Media keys ─────────────────────────────────────────── */
  if (key === 'MediaPlayPause'   || code === 10252) {
    video.paused ? video.play().catch(()=>{}) : video.pause();
    e.preventDefault(); return;
  }
  if (key === 'MediaPlay'        || code === 415) { video.play().catch(()=>{}); e.preventDefault(); return; }
  if (key === 'MediaPause'       || code === 19)  { video.pause(); e.preventDefault(); return; }
  if (key === 'MediaStop'        || code === 413) {
    if (hls) { hls.destroy(); hls = null; }
    video.pause(); video.removeAttribute('src'); video.load();
    setStatus('Stopped', 'idle'); finishLoadBar();
    e.preventDefault(); return;
  }
  if (key === 'MediaFastForward' || code === 417) { moveSelection(1);  playSelected(); e.preventDefault(); return; }
  if (key === 'MediaRewind'      || code === 412) { moveSelection(-1); playSelected(); e.preventDefault(); return; }
  if (key === 'ChannelUp'        || code === 427) { moveSelection(1);  playSelected(); e.preventDefault(); return; }
  if (key === 'ChannelDown'      || code === 428) { moveSelection(-1); playSelected(); e.preventDefault(); return; }

  /* ── Colour buttons ─────────────────────────────────────── */
  if (key === 'ColorF0Red'    || code === 403) { loadPlaylist(); e.preventDefault(); return; }
  if (key === 'ColorF1Green'  || code === 404) { switchTab((plIdx + 1) % PLAYLISTS.length); e.preventDefault(); return; }
  if (key === 'ColorF2Yellow' || code === 405) { setFocus('search'); e.preventDefault(); return; }
  if (key === 'ColorF3Blue'   || code === 406) { if (hasPlayed) toggleFullscreen(); e.preventDefault(); return; }
});

/* ── Search input live ───────────────────────────────────── */
searchInput.addEventListener('input', applySearch);

/* ══════════════════════════════════════════════════════════
   INIT
   ══════════════════════════════════════════════════════════ */
(function init() {
  document.querySelectorAll('.tab').forEach((t, i) => t.classList.toggle('active', i === plIdx));
  VS.init(channelListEl);
  loadPlaylist();
})();
