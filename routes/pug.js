const router = require('koa-router')()
const pug = require('pug');
const path = require('path');

router.get('/pug', async (ctx, next) => {
  await ctx.render('pug.html');
})

router.post('/pug/compile', async (ctx, next) => {
	let code = ctx.request.body.code;
	if (!code) {
		ctx.body = {compiled:''};
		return;
	}

	let options = {
		pretty:true,
		filename:path.join(__dirname, '../node_modules/jade-bootstrap/_bootstrap.pug'),
	};
	let compiled = pug.compile(code, options);
	ctx.body = {compiled:compiled()};
});

module.exports = router
