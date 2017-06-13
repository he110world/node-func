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
		filename:path.join(__dirname, '../node_modules/pug-bootstrap-attr/_bootstrap.pug'),
	};

	// test payload
	let payload = ctx.request.body.payload;
	if (typeof payload === 'object') {
		for(var k in payload) {
			options[k] = payload[k];
		}
	}
	let html = pug.render(code, options);
	ctx.body = {compiled:html};
});

module.exports = router
