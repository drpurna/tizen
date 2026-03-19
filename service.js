module.exports = {
  name: "Tizen TV",

  async start(ctx){
    const appUrl = ctx.modulePath + "/app/index.html?v=" + Date.now();

    ctx.openApp({
      url: appUrl,
      fullscreen: true
    });
  }
};