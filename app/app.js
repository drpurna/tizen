let channels = [
  {
    name: "Test Stream",
    group: "Live",
    url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"
  }
];

let categories = {};
let currentFocus = null;

const videoContainer = document.getElementById("video");
const grid = document.getElementById("grid");
const ui = document.getElementById("ui");
const overlay = document.getElementById("overlay");
const loader = document.getElementById("loader");

// LOAD CHANNELS
async function loadChannels() {

  try {
    const res = await fetch("https://iptv-org.github.io/iptv/languages/tel.m3u");

    if (res.ok) {
      const text = await res.text();
      const parsed = parseM3U(text);
      if (parsed.length) channels = parsed;
    }

  } catch (e) {
    console.log("Using fallback channels");
  }

  buildCategories();
  render();

  // RESUME
  const last = localStorage.getItem("last_channel");
  if (last) {
    try {
      const ch = JSON.parse(last);
      setTimeout(() => play(ch), 1500);
    } catch {}
  }
}

// PARSE
function parseM3U(text) {

  const lines = text.split("\n");
  const result = [];

  let name="", group="Other", logo="";

  for (let line of lines) {

    if (line.startsWith("#EXTINF")) {

      name = line.split(",").pop();

      const g = line.match(/group-title="(.*?)"/);
      group = g ? g[1] : "Other";

      const l = line.match(/tvg-logo="(.*?)"/);
      logo = l ? l[1] : "";
    }

    else if (line.startsWith("http")) {
      result.push({ name, group, logo, url: line.trim() });
    }
  }

  return result.slice(0,200);
}

// CATEGORY
function buildCategories() {

  categories = {
    News: [],
    Movies: [],
    Sports: [],
    Entertainment: [],
    Others: []
  };

  channels.forEach(ch => {

    const n = ch.name.toLowerCase();

    if (n.includes("news")) categories.News.push(ch);
    else if (n.includes("movie")) categories.Movies.push(ch);
    else if (n.includes("sport")) categories.Sports.push(ch);
    else if (n.includes("tv")) categories.Entertainment.push(ch);
    else categories.Others.push(ch);

  });
}

// RENDER
function render() {

  grid.innerHTML = "";

  Object.keys(categories).forEach(group => {

    if (!categories[group].length) return;

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
        img.onerror = () => card.innerText = ch.name;
        card.appendChild(img);
      } else {
        card.innerText = ch.name;
      }

      card.onclick = () => play(ch);

      card.addEventListener("focus", () => {
        currentFocus = card;
        card.scrollIntoView({ behavior:"smooth", inline:"center", block:"nearest" });
      });

      items.appendChild(card);
    });

    row.appendChild(title);
    row.appendChild(items);
    grid.appendChild(row);
  });

  setTimeout(() => document.querySelector(".card")?.focus(), 200);
}

// PLAY
function play(ch) {

  localStorage.setItem("last_channel", JSON.stringify(ch));

  overlay.innerText = ch.name;
  overlay.style.opacity = 1;
  setTimeout(()=>overlay.style.opacity=0,3000);

  ui.style.display = "none";
  loader.style.display = "block";

  playHTML5(ch.url);
}

// HTML5 PLAYER
function playHTML5(url) {

  videoContainer.innerHTML = "";

  const video = document.createElement("video");
  video.src = url;
  video.autoplay = true;
  video.controls = true;

  video.style.width = "100%";
  video.style.height = "100%";

  video.addEventListener("playing", () => {
    loader.style.display = "none";
  });

  video.onerror = () => {
    loader.style.display = "none";
    alert("Stream failed");
  };

  videoContainer.appendChild(video);
}

// REMOTE
document.addEventListener("keydown", e => {

  const f = document.activeElement;

  if (e.key === "Enter" && currentFocus) currentFocus.click();

  if (e.key === "Escape" || e.key === "Return") {
    ui.style.display = "block";
    videoContainer.innerHTML = "";
  }

  if (!f.classList.contains("card")) return;

  if (e.key==="ArrowRight") f.nextElementSibling?.focus();
  if (e.key==="ArrowLeft") f.previousElementSibling?.focus();

  if (e.key==="ArrowDown")
    f.closest(".row")?.nextElementSibling?.querySelector(".card")?.focus();

  if (e.key==="ArrowUp")
    f.closest(".row")?.previousElementSibling?.querySelector(".card")?.focus();

});

// INIT
loadChannels();