// ================= GLOBAL =================
let channels = [
  {
    name: "Test Stream 1",
    group: "Live",
    url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    logo: ""
  },
  {
    name: "Test Stream 2",
    group: "Live",
    url: "https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8",
    logo: ""
  }
];

let categories = {};
let currentFocus = null;

const videoContainer = document.getElementById("video");
const ui = document.getElementById("ui");
const overlay = document.getElementById("overlay");

// ================= LOAD =================
async function loadChannels() {

  ui.innerHTML = "Loading channels...";

  let text = "";

  try {
    const res = await fetch(
      "https://iptv-org.github.io/iptv/languages/tel.m3u"
    );

    if (res.ok) {
      text = await res.text();
    }

  } catch (e) {
    console.log("Fetch failed → using fallback");
  }

  if (text) {
    const parsed = parseM3U(text);
    if (parsed.length > 0) {
      channels = parsed;
    }
  }

  buildCategories();
  render();
}

// ================= PARSE =================
function parseM3U(text) {
  const lines = text.split("\n");
  const result = [];

  let name = "", group = "Other", logo = "";

  for (let line of lines) {

    if (line.startsWith("#EXTINF")) {

      name = line.split(",").pop();

      const g = line.match(/group-title="(.*?)"/);
      group = g ? g[1] : "Other";

      const l = line.match(/tvg-logo="(.*?)"/);
      logo = l ? l[1] : "";

    }

    else if (line.startsWith("http")) {
      result.push({ name, group, url: line.trim(), logo });
    }
  }

  return result.slice(0, 120);
}

// ================= CATEGORY =================
function buildCategories() {
  categories = {};

  channels.forEach(ch => {
    if (!categories[ch.group]) {
      categories[ch.group] = [];
    }
    categories[ch.group].push(ch);
  });
}

// ================= RENDER =================
function render() {

  ui.innerHTML = "";

  Object.keys(categories).forEach(group => {

    const row = document.createElement("div");
    row.className = "row";

    const title = document.createElement("div");
    title.className = "row-title";
    title.innerText = group;

    const items = document.createElement("div");
    items.className = "row-items";

    categories[group].forEach(ch => {

      const card = document.createElement("div");
      card.className = "card";
      card.tabIndex = 0;

      if (ch.logo) {
        const img = document.createElement("img");
        img.src = ch.logo;
        card.appendChild(img);
      } else {
        card.innerText = ch.name;
      }

      card.addEventListener("click", () => play(ch));
      card.addEventListener("focus", () => currentFocus = card);

      items.appendChild(card);
    });

    row.appendChild(title);
    row.appendChild(items);
    ui.appendChild(row);
  });

  setTimeout(() => {
    const first = document.querySelector(".card");
    if (first) first.focus();
  }, 200);
}

// ================= PLAY =================
function play(ch) {

  overlay.innerText = ch.name;
  overlay.style.opacity = 1;
  setTimeout(() => overlay.style.opacity = 0, 3000);

  ui.style.display = "none";

  if (window.webapis && webapis.avplay) {
    try {
      webapis.avplay.stop();
      webapis.avplay.close();
      webapis.avplay.open(ch.url);
      webapis.avplay.prepareAsync(() => {
        webapis.avplay.play();
      });
      return;
    } catch (e) {
      console.log("AVPlay failed → fallback");
    }
  }

  playHTML5(ch.url);
}

// ================= HTML5 =================
function playHTML5(url) {

  videoContainer.innerHTML = "";

  const video = document.createElement("video");
  video.src = url;
  video.autoplay = true;
  video.controls = true;

  video.style.width = "100%";
  video.style.height = "100%";

  video.onerror = () => alert("Channel not working");

  videoContainer.appendChild(video);
}

// ================= REMOTE =================
document.addEventListener("keydown", e => {

  const focus = document.activeElement;

  if (e.key === "Enter" && currentFocus) {
    currentFocus.click();
  }

  if (e.key === "Escape") {
    ui.style.display = "block";
    videoContainer.innerHTML = "";
  }

  if (!focus.classList.contains("card")) return;

  if (e.key === "ArrowRight") {
    focus.nextElementSibling?.focus();
  }

  if (e.key === "ArrowLeft") {
    focus.previousElementSibling?.focus();
  }

  if (e.key === "ArrowDown") {
    focus.closest(".row")?.nextElementSibling
      ?.querySelector(".card")?.focus();
  }

  if (e.key === "ArrowUp") {
    focus.closest(".row")?.previousElementSibling
      ?.querySelector(".card")?.focus();
  }

});

// ================= INIT =================
loadChannels();