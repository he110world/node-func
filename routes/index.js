const router = require('koa-router')()

router.get('/', async (ctx, next) => {
	await ctx.redirect('/pug/view/home');
})
module.exports = router
