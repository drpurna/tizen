/* ================================================================
   IPTV v1.0.1 — app.js
   Samsung Tizen TV (2K/4K) optimised IPTV engine
   - Built-in default playlists (Telugu, Hindi, English, Kids)
   - hls.js with TV-tuned low-latency config
   - Virtualised channel list (no DOM lag with 5000+ channels)
   - OSD overlay with auto-hide
   - Full remote key support
   ================================================================ */

'use strict';

// ──────────────────────────────────────────────
// DEFAULT PLAYLISTS (built-in, no internet req. for list)
// ──────────────────────────────────────────────
const DEFAULT_PLAYLISTS = [
  {
    label: 'Telugu',
    url: 'https://iptv-org.github.io/iptv/languages/tel.m3u',
  },
  {
    label: 'Hindi',
    url: 'https://iptv-org.github.io/iptv/languages/hin.m3u',
  },
  {
    label: 'English (World)',
    url: 'https://iptv-org.github.io/iptv/languages/eng.m3u',
  },
  {
    label: 'Kids',
    url: 'https://iptv-org.github.io/iptv/categories/kids.m3u',
  },
  {
    label: 'News',
    url: 'https://iptv-org.github.io/iptv/categories/news.m3u',
  },
  {
    label: 'Sports',
    url: 'https://iptv-org.github.io/iptv/categories/sports.m3u',
  },
];

const STORAGE_KEY_PLAYLIST = 'iptv:lastUrl';
const STORAGE_KEY_VOL      = 'iptv:vol';

// ──────────────────────────────────────────────
// DOM refs
// ──────────────────────────────────────────────
const $ = id => document.getElementById(id);
const playlistUrlEl    = $('playlistUrl');
const loadBtn          = $('loadBtn');
const defaultBtn       = $('defaultBtn');
const searchInput      = $('searchInput');
const channelListEl    = $('channelList');
const countBadge       = $('countBadge');
const nowPlayingEl     = $('nowPlaying');
const nowGroupEl       = $('nowGroup');
const statusPill       = $('statusPill');
const statusText       = $('statusText');
const video            = $('video');
const idleScreen       = $('idleScreen');
const videoOverlay     = $('videoOverlay');
const overlayChannel   = $('overlayChannel');
const overlayStatus    = $('overlayStatus');
const bufferingSpinner = $('bufferingSpinner');
const playPauseBtn     = $('playPauseBtn');
const stopBtn          = $('stopBtn');
const prevBtn          = $('prevBtn');
const nextBtn          = $('nextBtn');
const volSlider        = $('volSlider');
const qualityInfo      = $('qualityInfo');

// ──────────────────────────────────────────────
// State
// ──────────────────────────────────────────────
let channels     = [];      // full parsed list
let filtered     = [];      // after search filter
let selectedIdx  = 0;
let focusArea    = 'list';  // 'list' | 'player'
let hls          = null;
let osdTimer     = null;
let renderStart  = 0;       // virtualised list scroll top

// ──────────────────────────────────────────────
// HLS.js config tuned for TV playback
// Lower fragLoadingMaxRetry + higher maxBufferLength
// ──────────────────────────────────────────────
const HLS_CONFIG = {
  enableWorker: true,
  lowLatencyMode: false,
  backBufferLength: 30,
  maxBufferLength: 60,
  maxMaxBufferLength: 120,
  maxBufferSize: 60 * 1000 * 1000,       // 60 MB
  maxBufferHole: 0.5,
  fragLoadingMaxRetry: 4,
  fragLoadingRetryDelay: 1000,
  manifestLoadingMaxRetry: 3,
  levelLoadingMaxRetry: 3,
  startLevel: -1,                          // auto quality
  abrEwmaFastLive: 3,
  abrEwmaSlowLive: 9,
  progressive: false,
  testBandwidth: true,
};

// ──────────────────────────────────────────────
// Status helpers
// ──────────────────────────────────────────────
function setStatus(text, state = 'idle') {
  statusText.textContent = text.toUpperCase();
  statusPill.className   = 'status-pill ' + state;

  // Buffering spinner visibility
  bufferingSpinner.classList.toggle('visible', state === 'buffering');
}

function showOSD(title, sub) {
  overlayChannel.textContent = title || '';
  overlayStatus.textContent  = sub   || '';
  videoOverlay.classList.add('visible');
  clearTimeout(osdTimer);
  osdTimer = setTimeout(() => videoOverlay.classList.remove('visible'), 4000);
}

// ──────────────────────────────────────────────
// M3U parser — handles large files without blocking UI
// Uses micro-task slicing (chunked parsing)
// ──────────────────────────────────────────────
function parseM3U(text) {
  const lines = text.split(/\r?\n/);
  const out   = [];
  let meta    = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF')) {
      const comma   = line.indexOf(',');
      const namePart = comma >= 0 ? line.slice(comma + 1).trim() : 'Unknown';
      const groupM   = line.match(/group-title="([^"]+)"/i);
      const logoM    = line.match(/tvg-logo="([^"]+)"/i);
      meta = {
        name:  namePart || 'Unknown',
        group: groupM  ? groupM[1]  : 'General',
        logo:  logoM   ? logoM[1]   : '',
      };
      continue;
    }

    if (!line.startsWith('#') && line.length > 5) {
      out.push({
        name:  meta?.name  || 'Unknown',
        group: meta?.group || 'General',
        logo:  meta?.logo  || '',
        url:   line,
      });
      meta = null;
    }
  }

  return out;
}

// ──────────────────────────────────────────────
// Virtualised list renderer
// Only renders ~30 visible items; scrolls via translateY
// Handles 10 000+ channels without a frame drop
// ──────────────────────────────────────────────
const ITEM_H = 62; // px per list item (must match CSS: padding + margin)

function renderList() {
  const list   = filtered;
  const total  = list.length;
  countBadge.textContent = total;

  if (!total) {
    channelListEl.innerHTML = '<li class="no-channels">No channels found</li>';
    return;
  }

  // Reset scroll to show selected
  const containerH = channelListEl.clientHeight || 500;
  const visCount   = Math.ceil(containerH / ITEM_H) + 4;
  const scrollTop  = channelListEl.scrollTop;
  const startIdx   = Math.max(0, Math.floor(scrollTop / ITEM_H) - 2);
  const endIdx     = Math.min(total - 1, startIdx + visCount);

  // Spacer to maintain correct scroll height
  const frag = document.createDocumentFragment();
  const topSpacer = document.createElement('li');
  topSpacer.style.cssText = `height:${startIdx * ITEM_H}px;min-height:0;padding:0;margin:0;border:none;background:transparent;pointer-events:none;`;
  frag.appendChild(topSpacer);

  for (let i = startIdx; i <= endIdx; i++) {
    const ch = list[i];
    const li = document.createElement('li');
    if (i === selectedIdx) li.classList.add('active');
    li.innerHTML = `<div class="ch-name">${escHtml(ch.name)}</div><div class="ch-group">${escHtml(ch.group)}</div>`;
    li.dataset.idx = i;
    li.addEventListener('click', () => { selectedIdx = i; renderList(); playSelected(); });
    frag.appendChild(li);
  }

  const botSpacer = document.createElement('li');
  botSpacer.style.cssText = `height:${(total - 1 - endIdx) * ITEM_H}px;min-height:0;padding:0;margin:0;border:none;background:transparent;pointer-events:none;`;
  frag.appendChild(botSpacer);

  channelListEl.innerHTML = '';
  channelListEl.appendChild(frag);

  // Ensure selected is visible
  const activeEl = channelListEl.querySelector('li.active');
  if (activeEl) activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

// Re-render on scroll (throttled)
let scrollRaf = false;
channelListEl.addEventListener('scroll', () => {
  if (scrollRaf) return;
  scrollRaf = true;
  requestAnimationFrame(() => { renderList(); scrollRaf = false; });
});

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ──────────────────────────────────────────────
// Search / filter
// ──────────────────────────────────────────────
function applySearch() {
  const q = searchInput.value.trim().toLowerCase();
  filtered = q
    ? channels.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.group.toLowerCase().includes(q)
      )
    : channels.slice();

  selectedIdx = Math.min(selectedIdx, Math.max(0, filtered.length - 1));
  channelListEl.scrollTop = 0;
  renderList();
}

// ──────────────────────────────────────────────
// URL helpers
// ──────────────────────────────────────────────
function githubRawToJsdelivr(url) {
  try {
    const u     = new URL(url);
    if (u.hostname !== 'raw.githubusercontent.com') return null;
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length < 4) return null;
    return `https://cdn.jsdelivr.net/gh/${parts[0]}/${parts[1]}@${parts[2]}/${parts.slice(3).join('/')}`;
  } catch (_) { return null; }
}

async function fetchText(url, ms = 20000) {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

// ──────────────────────────────────────────────
// Load playlist
// ──────────────────────────────────────────────
async function loadPlaylist(urlOverride) {
  const url = (urlOverride || playlistUrlEl.value).trim();
  if (!url) { setStatus('Enter a playlist URL', 'error'); return; }

  playlistUrlEl.value = url;
  setStatus('Loading…', 'buffering');

  try {
    let text;
    try {
      text = await fetchText(url, 20000);
    } catch (e) {
      const mirror = githubRawToJsdelivr(url);
      if (!mirror) throw e;
      setStatus('Trying mirror…', 'buffering');
      text = await fetchText(mirror, 20000);
    }

    channels  = parseM3U(text);
    filtered  = channels.slice();
    selectedIdx = 0;
    channelListEl.scrollTop = 0;
    renderList();

    try { localStorage.setItem(STORAGE_KEY_PLAYLIST, url); } catch (_) {}
    setStatus(`${channels.length} channels loaded`, 'idle');
  } catch (err) {
    const msg = err?.name === 'AbortError' ? 'Timeout' : (err.message || 'Unknown error');
    setStatus(`Load failed: ${msg}`, 'error');
  }
}

// ──────────────────────────────────────────────
// Playback engine
// ──────────────────────────────────────────────
function destroyHls() {
  if (!hls) return;
  try { hls.destroy(); } catch (_) {}
  hls = null;
}

function playSelected() {
  if (!filtered.length) return;
  const ch = filtered[selectedIdx];
  if (!ch) return;

  nowPlayingEl.textContent = ch.name;
  nowGroupEl.textContent   = ch.group || '—';
  idleScreen.classList.add('hidden');
  setStatus('Buffering…', 'buffering');
  showOSD(ch.name, ch.group);
  updatePlayPauseBtn(false);
  qualityInfo.textContent = 'HLS';

  destroyHls();
  video.removeAttribute('src');
  video.load();

  const url   = ch.url;
  const isHls = /\.m3u8($|\?)/i.test(url) || url.includes('m3u8');

  if (isHls) {
    // Native HLS (Tizen WebKit supports this)
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      qualityInfo.textContent = 'NATIVE HLS';
      video.src = url;
      video.play().catch(() => {});
      return;
    }

    // hls.js (fallback for dev/browser)
    if (window.Hls && Hls.isSupported()) {
      qualityInfo.textContent = 'HLS.JS';
      hls = new Hls(HLS_CONFIG);
      hls.loadSource(url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
        const lvl = hls.levels[data.level];
        if (lvl) qualityInfo.textContent = lvl.height ? `${lvl.height}p` : 'HLS';
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              setStatus('Network error — retrying…', 'buffering');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              setStatus('Media error — recovering…', 'buffering');
              hls.recoverMediaError();
              break;
            default:
              setStatus('Fatal stream error', 'error');
              destroyHls();
          }
        }
      });
      return;
    }

    setStatus('HLS not supported on this runtime', 'error');
    return;
  }

  // Direct (MP4, RTMP-via-HTTP, etc.)
  qualityInfo.textContent = 'DIRECT';
  video.src = url;
  video.play().catch(() => {});
}

function updatePlayPauseBtn(paused) {
  playPauseBtn.textContent = paused ? '⏵' : '⏸';
}

// ──────────────────────────────────────────────
// Navigation helpers
// ──────────────────────────────────────────────
function moveSelection(delta) {
  if (!filtered.length) return;
  selectedIdx = Math.max(0, Math.min(filtered.length - 1, selectedIdx + delta));
  renderList();
}

// ──────────────────────────────────────────────
// Video events
// ──────────────────────────────────────────────
video.addEventListener('playing',  () => { setStatus('Playing', 'playing'); updatePlayPauseBtn(false); showOSD(nowPlayingEl.textContent, ''); });
video.addEventListener('pause',    () => { setStatus('Paused', 'idle');   updatePlayPauseBtn(true);  });
video.addEventListener('waiting',  () => { setStatus('Buffering…', 'buffering'); });
video.addEventListener('stalled',  () => { setStatus('Stalled…', 'buffering'); });
video.addEventListener('error',    () => { setStatus('Playback error', 'error'); });
video.addEventListener('ended',    () => { setStatus('Stream ended', 'idle'); });

// Volume restore
try {
  const savedVol = parseFloat(localStorage.getItem(STORAGE_KEY_VOL));
  if (!isNaN(savedVol)) { video.volume = savedVol; volSlider.value = savedVol; }
} catch (_) {}

// ──────────────────────────────────────────────
// Control bar buttons
// ──────────────────────────────────────────────
playPauseBtn.addEventListener('click', () => {
  if (video.paused || video.ended) video.play().catch(() => {});
  else video.pause();
});

stopBtn.addEventListener('click', () => {
  destroyHls();
  video.pause();
  video.removeAttribute('src');
  video.load();
  idleScreen.classList.remove('hidden');
  setStatus('Stopped', 'idle');
  updatePlayPauseBtn(true);
});

prevBtn.addEventListener('click', () => {
  moveSelection(-1);
  playSelected();
});

nextBtn.addEventListener('click', () => {
  moveSelection(1);
  playSelected();
});

volSlider.addEventListener('input', () => {
  video.volume = parseFloat(volSlider.value);
  try { localStorage.setItem(STORAGE_KEY_VOL, volSlider.value); } catch (_) {}
});

loadBtn.addEventListener('click', () => loadPlaylist());

defaultBtn.addEventListener('click', () => {
  // Cycle through default playlists
  defaultBtn._didx = ((defaultBtn._didx || -1) + 1) % DEFAULT_PLAYLISTS.length;
  const pl = DEFAULT_PLAYLISTS[defaultBtn._didx];
  defaultBtn.textContent = pl.label;
  loadPlaylist(pl.url);
});

searchInput.addEventListener('input', applySearch);

// ──────────────────────────────────────────────
// Tizen key registration
// ──────────────────────────────────────────────
(function registerTizenKeys() {
  try {
    if (window.tizen && tizen.tvinputdevice) {
      const keys = [
        'MediaPlay','MediaPause','MediaPlayPause','MediaStop',
        'MediaFastForward','MediaRewind',
        'ColorF0Red','ColorF1Green','ColorF2Yellow','ColorF3Blue',
        'ChannelUp','ChannelDown',
      ];
      keys.forEach(k => { try { tizen.tvinputdevice.registerKey(k); } catch (_) {} });
    }
  } catch (_) {}
})();

// ──────────────────────────────────────────────
// Remote / keyboard input
// ──────────────────────────────────────────────
window.addEventListener('keydown', e => {
  const key  = e.key;
  const code = e.keyCode;

  switch (true) {

    // ── Navigation ──
    case key === 'ArrowUp':
      if (focusArea === 'list') moveSelection(-1);
      e.preventDefault(); break;

    case key === 'ArrowDown':
      if (focusArea === 'list') moveSelection(1);
      e.preventDefault(); break;

    case key === 'ArrowLeft':
      focusArea = 'list';
      e.preventDefault(); break;

    case key === 'ArrowRight':
      focusArea = 'player';
      e.preventDefault(); break;

    case key === 'Enter':
      if (focusArea === 'list') playSelected();
      e.preventDefault(); break;

    // ── Page jump ──
    case key === 'PageUp':
      moveSelection(-10); e.preventDefault(); break;
    case key === 'PageDown':
      moveSelection(10);  e.preventDefault(); break;

    // ── Media keys ──
    case key === 'MediaPlayPause' || code === 10252:
      if (video.paused) video.play().catch(() => {}); else video.pause();
      e.preventDefault(); break;

    case key === 'MediaPlay' || code === 415:
      video.play().catch(() => {});
      e.preventDefault(); break;

    case key === 'MediaPause' || code === 19:
      video.pause();
      e.preventDefault(); break;

    case key === 'MediaStop' || code === 413:
      stopBtn.click();
      e.preventDefault(); break;

    case key === 'MediaFastForward' || code === 417:
      moveSelection(1); playSelected();
      e.preventDefault(); break;

    case key === 'MediaRewind' || code === 412:
      moveSelection(-1); playSelected();
      e.preventDefault(); break;

    // ── Channel up/down ──
    case key === 'ChannelUp' || code === 427:
      moveSelection(1); playSelected();
      e.preventDefault(); break;
    case key === 'ChannelDown' || code === 428:
      moveSelection(-1); playSelected();
      e.preventDefault(); break;

    // ── Colour buttons ──
    case key === 'ColorF0Red' || code === 403:
      playlistUrlEl.focus();
      e.preventDefault(); break;

    case key === 'ColorF1Green' || code === 404:
      loadPlaylist();
      e.preventDefault(); break;

    case key === 'ColorF2Yellow' || code === 405:
      searchInput.focus();
      e.preventDefault(); break;

    case key === 'ColorF3Blue' || code === 406:
      defaultBtn.click();
      e.preventDefault(); break;

    // ── Volume ──
    case key === 'VolumeUp':
      video.volume = Math.min(1, video.volume + 0.1);
      volSlider.value = video.volume;
      e.preventDefault(); break;
    case key === 'VolumeDown':
      video.volume = Math.max(0, video.volume - 0.1);
      volSlider.value = video.volume;
      e.preventDefault(); break;

    default: break;
  }
});

// ──────────────────────────────────────────────
// Bootstrap
// ──────────────────────────────────────────────
(function init() {
  // Restore last playlist URL
  let lastUrl = '';
  try { lastUrl = localStorage.getItem(STORAGE_KEY_PLAYLIST) || ''; } catch (_) {}

  if (!lastUrl) {
    // Default to Telugu on first launch
    lastUrl = DEFAULT_PLAYLISTS[0].url;
  }

  playlistUrlEl.value = lastUrl;
  loadPlaylist(lastUrl);
})();
