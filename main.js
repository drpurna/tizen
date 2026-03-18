import { fetchChannels } from './services.js';

const root = document.getElementById("root");

async function init() {
  root.innerHTML = "<h1 style='text-align:center;margin-top:40vh;'>Loading Telugu TV...</h1>";

  const channels = await fetchChannels();

  root.innerHTML = "";

  const grid = document.createElement("div");
  grid.style.display = "grid";
  grid.style.gridTemplateColumns = "repeat(6, 1fr)";
  grid.style.gap = "20px";
  grid.style.padding = "40px";

  channels.forEach(ch => {
    const tile = document.createElement("div");
    tile.style.cursor = "pointer";
    tile.innerHTML = `
      <img src="${ch.logo}" style="width:100%;border-radius:10px;" />
      <p>${ch.name}</p>
    `;
    tile.onclick = () => play(ch.url);

    grid.appendChild(tile);
  });

  root.appendChild(grid);
}

function play(url) {
  root.innerHTML = `
    <video src="${url}" controls autoplay style="width:100%;height:100%"></video>
  `;
}

init();
