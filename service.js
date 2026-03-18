module.exports = {

  name: "Tizen TV",

  async start(ctx){

    ctx.openApp({
      url: ctx.modulePath + "/app/index.html",
      fullscreen: true
    })

  }

}
