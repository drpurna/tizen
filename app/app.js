// 🔴 ERROR DISPLAY (NO WHITE SCREEN EVER AGAIN)
window.onerror = function(msg, url, line) {
  document.body.innerHTML =
    "<pre style='color:red'>" + msg + " at line " + line + "</pre>";
};

const PLAYLIST = "https://iptv-org.github.io/iptv/languages/tel.m3u";

let channels = [];
let player = null;
let video = null;

// INIT
window.onload = () => {
  init();
};

async function init() {

  // AVPlay (if available)
  try {
    if (window.webapis && webapis.avplay) {
      player = webapis.avplay;
    }
  } catch {}

  // HTML5 fallback video
  video = document.createElement("video");
  video.style.width = "100%";
  video.style.height = "100%";
  video.autoplay = true;
  document.getElementById("video").appendChild(video);

  // Load playlist
  let text = await fetch(PLAYLIST).then(r => r.text());

  channels = parse(text);

  render();
}

// PARSE M3U
function parse(txt) {
  const lines = txt.split("\n");
  let res = [], meta = {};

  for (let l of lines) {
    l = l.trim();

    if (l.startsWith("#EXTINF")) {
      meta.name = l.split(",").pop();
    }
    else if (l && !l.startsWith("#")) {
      res.push({ ...meta, url: l });
    }
  }

  return res.slice(0, 40); // keep small for stability
}

// RENDER GRID
function render() {
  const grid = document.getElementById("grid");
  grid.innerHTML = "";

  channels.forEach(ch => {

    const card = document.createElement("div");
    card.className = "card";
    card.textContent = ch.name;

    // 🔥 CLICK WORKS GUARANTEED
    card.onclick = () => {
      play(ch.url);
    };

    grid.appendChild(card);
  });
}

// PLAY ENGINE
function play(url) {

  console.log("PLAY:", url);

  document.body.classList.add("fullscreen");

  // HLS → AVPlay first
  if (url.includes(".m3u8") && player) {

    try {
      player.stop();
      player.close();
    } catch {}

    try {
      player.open(url);
      player.setDisplayRect(0, 0, 1920, 1080);

      player.prepareAsync(() => {
        player.play();
      });

      return;

    } catch {
      console.log("AVPlay failed → fallback");
    }
  }

  // HTML5 fallback
  video.src = url;
  video.play().catch(() => {
    alert("Stream not supported");
  });
}