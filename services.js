export async function fetchChannels() {
  const res = await fetch("https://iptv-org.github.io/iptv/languages/telugu.m3u");
  const text = await res.text();

  return text.split("#EXTINF").slice(1).map(item => {
    const name = item.match(/,(.*)/)?.[1];
    const logo = item.match(/tvg-logo="(.*?)"/)?.[1];
    const url = item.split("\n")[1];
    return { name, logo, url };
  });
}
