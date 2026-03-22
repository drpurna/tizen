module.exports = {
  async start(ctx) {
    ctx.openApp({
      url: ctx.modulePath + '/app/index.html',
      fullscreen: true,
      title: 'IPTV'
    });
  },
  async stop(ctx) {
    console.log('[IPTV] stopped');
  }
};
