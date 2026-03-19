/* =========================
   Tizen IPTV v1 – FULL OPTIMIZED
========================= */

const App = (() => {
  const S = {
    channels: [],
    categories: [],
    focusRow: 0,
    focusCol: 0,
    currentIndex: null,
    dom: {
      rows: document.getElementById("rows"),
      overlay: document.getElementById("overlay"),
      player: document.getElementById("player"),
      header: document.getElementById("header"),
      searchBtn: document.getElementById("searchBtn"),
      addBtn: document.getElementById("addBtn"),
      loader: null
    },
    isFullscreen: false
  };

  const CONFIG = {
    PLAYLIST_URLS: {
      Telugu: "https://iptv-org.github.io/iptv/languages/tel.m3u",
      India: "https://iptv-org.github.io/iptv/streams/in.m3u"
    },
    BUFFER: "300",
    VISIBLE_TILES: 5
  };

  /* =========================
     INIT
  ========================== */
  async function init() {
    S.dom.loader = createLoader();
    S.dom.player.appendChild(S.dom.loader);

    await loadPlaylist("Telugu"); // default

    buildRows();
    renderRows();
    setFocus();
  }

  /* =========================
     CREATE LOADER SPINNER
  ========================== */
  function createLoader() {
    const loader = document.createElement("div");
    loader.className = "loader";
    loader.style.display = "none";
    loader.style.position = "absolute";
    loader.style.top = "50%";
    loader.style.left = "50%";
    loader.style.transform = "translate(-50%, -50%)";
    loader.style.border = "8px solid #f3f3f3";
    loader.style.borderTop = "8px solid #ff0000";
    loader.style.borderRadius = "50%";
    loader.style.width = "60px";
    loader.style.height = "60px";
    loader.style.animation = "spin 1s linear infinite";
    return loader;
  }

  /* =========================
     LOAD PLAYLIST
  ========================== */
  async function loadPlaylist(name) {
    S.channels = [];
    try {
      const text = await fetch(CONFIG.PLAYLIST_URLS[name]).then(r => r.text());
      S.channels = parseM3U(text);
      S.categories = [...new Set(S.channels.map(c => c.group))];
    } catch (e) {
      console.error("Failed to load playlist", e);
    }
  }

  /* =========================
     PARSE M3U
  ========================== */
  function parseM3U(text) {
    const lines = text.split("\n");
    let meta = {};
    const res = [];

    for (let l of lines) {
      l = l.trim();
      if (l.startsWith("#EXTINF")) {
        meta.name = l.split(",").pop();
        const g = l.match(/group-title="([^"]+)"/);
        const logo = l.match(/tvg-logo="([^"]+)"/);
        meta.group = g ? g[1] : "Other";
        meta.logo = logo ? logo[1] : "";
      } else if (l && !l.startsWith("#") && l.endsWith(".m3u8")) {
        res.push({ ...meta, url: l });
      }
    }
    return res;
  }

  /* =========================
     BUILD ROWS
  ========================== */
  function buildRows() {
    S.rowsData = S.categories.map(cat => ({
      title: cat,
      items: S.channels.filter(c => c.group === cat)
    }));
  }

  /* =========================
     RENDER ROWS + CHANNELS
  ========================== */
  function renderRows() {
    const frag = document.createDocumentFragment();
    S.rowsData.forEach((row, rIdx) => {
      const rowEl = div("row");
      const title = div("row-title", row.title);
      const items = div("row-items");

      row.items.forEach((ch, cIdx) => {
        const card = div("card");
        card.tabIndex = 0;
        card._r = rIdx;
        card._c = cIdx;

        if (ch.logo) {
          const img = new Image();
          img.src = ch.logo;
          img.alt = ch.name;
          card.appendChild(img);
        } else {
          card.textContent = ch.name;
        }

        card.addEventListener("click", () => playChannel(rIdx, cIdx));
        items.appendChild(card);
      });

      rowEl.appendChild(title);
      rowEl.appendChild(items);
      frag.appendChild(rowEl);
    });

    S.dom.rows.innerHTML = "";
    S.dom.rows.appendChild(frag);
  }

  /* =========================
     SET FOCUS
  ========================== */
  function setFocus() {
    document.querySelectorAll(".card.active").forEach(e => e.classList.remove("active"));
    const row = S.dom.rows.children[S.focusRow];
    if (!row) return;
    const items = row.children[1];
    const el = items.children[S.focusCol];
    if (el) el.classList.add("active");
    scrollRow(items);
    updateOverlay();
  }

  function scrollRow(items) {
    let scroll = S.focusCol - Math.floor(CONFIG.VISIBLE_TILES / 2);
    if (scroll < 0) scroll = 0;
    items.style.transform = `translateX(${-scroll * 280}px)`;
  }

  function updateOverlay() {
    const ch = S.rowsData[S.focusRow].items[S.focusCol];
    if (ch) {
      S.dom.overlay.textContent = ch.name;
      S.dom.overlay.style.opacity = 1;
      setTimeout(() => (S.dom.overlay.style.opacity = 0), 1500);
    }
  }

  /* =========================
     PLAY CHANNEL
  ========================== */
  async function playChannel(rIdx, cIdx) {
    const ch = S.rowsData[rIdx].items[cIdx];
    if (!ch || !ch.url) return;

    S.currentIndex = { r: rIdx, c: cIdx };
    S.isFullscreen = true;
    S.dom.ui.style.display = "none";
    S.dom.loader.style.display = "block";

    try {
      webapis.avplay.stop();
      webapis.avplay.close();
    } catch (e) {}

    try {
      const res = await fetch(ch.url, { method: "HEAD" });
      if (!res.ok) throw new Error("Channel not playable");
    } catch (e) {
      console.warn("Skipping dead channel", ch.name);
      return;
    }

    try {
      webapis.avplay.open(ch.url);
      webapis.avplay.setDisplayRect(0, 0, 1920, 1080);
      webapis.avplay.setListener({
        onbufferingstart: () => (S.dom.loader.style.display = "block"),
        onbufferingcomplete: () => (S.dom.loader.style.display = "none"),
        onstreamcompleted: () => exitFullscreen(),
        onerror: () => exitFullscreen()
      });
      webapis.avplay.prepareAsync(() => webapis.avplay.play());
    } catch (e) {
      console.error("AVPlay error", e);
      exitFullscreen();
    }
  }

  function exitFullscreen() {
    try {
      webapis.avplay.stop();
      webapis.avplay.close();
    } catch (e) {}
    S.isFullscreen = false;
    S.dom.ui.style.display = "block";
  }

  /* =========================
     REMOTE CONTROL
  ========================== */
  function onKey(e) {
    if (S.isFullscreen) {
      switch (e.key) {
        case "Return":
        case "Escape":
          exitFullscreen();
          return;
        case "ArrowUp":
          playAdjacent(-1);
          return;
        case "ArrowDown":
          playAdjacent(1);
          return;
      }
      return;
    }

    switch (e.key) {
      case "ArrowUp":
        S.focusRow--;
        S.focusCol = 0;
        break;
      case "ArrowDown":
        S.focusRow++;
        S.focusCol = 0;
        break;
      case "ArrowLeft":
        S.focusCol--;
        break;
      case "ArrowRight":
        S.focusCol++;
        break;
      case "Enter":
        playChannel(S.focusRow, S.focusCol);
        return;
      case "ColorF0Red":
        addPlaylist();
        return;
    }
    clampFocus();
    setFocus();
  }

  function playAdjacent(dir) {
    let r = S.currentIndex.r + dir;
    if (r < 0) r = S.rowsData.length - 1;
    if (r >= S.rowsData.length) r = 0;
    const c = Math.min(S.currentIndex.c, S.rowsData[r].items.length - 1);
    playChannel(r, c);
  }

  function clampFocus() {
    S.focusRow = Math.max(0, Math.min(S.focusRow, S.rowsData.length - 1));
    const maxCol = S.rowsData[S.focusRow].items.length - 1;
    S.focusCol = Math.max(0, Math.min(S.focusCol, maxCol));
  }

  /* =========================
     ADD PLAYLIST BUTTON
  ========================== */
  function addPlaylist() {
    const url = prompt("Enter M3U URL:");
    if (!url) return;
    CONFIG.PLAYLIST_URLS["Custom"] = url;
    loadPlaylist("Custom").then(() => {
      buildRows();
      renderRows();
      setFocus();
    });
  }

  function div(cls, txt) {
    const d = document.createElement("div");
    if (cls) d.className = cls;
    if (txt) d.textContent = txt;
    return d;
  }

  window.addEventListener("keydown", onKey);
  return { init };
})();

App.init();