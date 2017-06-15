const router = require('koa-router')()
const pug = require('pug');
const path = require('path');

const bluebird = require('bluebird');
const redis = require('redis');
const redis_cli = bluebird.promisifyAll(redis.createClient('redis://redis'));

const TEMP_JS_NAME = 'pug_temp_js';

function pug_render (code, options, js_name) {
	// add script reference
	let code_patched = code + `\n\tscript(src="/pug/js/${js_name}",type="text/javascript")`;
	return pug.render(code_patched, options);
}

router.get('/pug', async (ctx, next) => {
	await redis_cli.delAsync(TEMP_JS_NAME);

	ctx.redirect('/pug/view/pug-editor');
//	await ctx.render('pug');
});

router.get('/pug/list', async (ctx, next) => {

	// get an array of page names
	let keys = await redis_cli.keysAsync("pug:*");

	// keys are in the form of 'page:name'
	// only keep the 'name' part
	let names = keys.map(name => name.split(':')[1]);

	ctx.body = {page_list:names};
});

router.get('/pug/edit/:name', async (ctx, next) => {
	let name = ctx.params.name;
	if (!name) {
		ctx.throw('Cannot find page', 404);
		return;
	}

	let key = 'pug:' + name;
	let pug_info = await redis_cli.hgetallAsync(key);

	await ctx.render('pug', pug_info);

//	ctx.body = pug_info;
});

router.post('/pug/save', async (ctx, next) => {
	let info = ctx.request.body;
	if (!info || !info.pug_source) {
		ctx.throw('Invalid pug', 500);
		return;
	}

	let key = 'pug:' + info.name;

	await redis_cli.hmsetAsync(key, info);

//	ctx.redirect('/pug/get/'+info.name);
//	ctx.redirect(ctx.router.url('pug','get',info.name));

	ctx.body = 'ok';
});

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

	// save temp js
	await redis_cli.setAsync(TEMP_JS_NAME, ctx.request.body.js);
	
	let html = pug_render(code, options, TEMP_JS_NAME);
	ctx.body = {compiled:html};
});


// get rendered page
router.get('/pug/view/:name', async (ctx, next) => {
	let name = ctx.params.name;
	if (!name) {
		ctx.throw('Cannot find page', 404);
		return;
	}

	let key = 'pug:' + name;
	let pug_source = await redis_cli.hgetAsync(key, 'pug_source');

	if (!pug_source) {
		ctx.throw('Cannot find page', 404);
		return;
	}

	let options = {
		pretty:true,
		filename:path.join(__dirname, '../node_modules/pug-bootstrap-attr/_bootstrap.pug'),
//		name:name
	};
	let html = pug_render(pug_source, options, name);
	ctx.body = html;
});

// get editor page
router.get('/pug/view/:name/:name2', async (ctx, next) => {
	let name = ctx.params.name;
	let name2 = ctx.params.name2;
	if (!name) {
		ctx.throw('Cannot find page', 404);
		return;
	}

	// get editor
	let key = 'pug:' + name;
	let pug_source = await redis_cli.hgetAsync(key, 'pug_source');

	if (!pug_source) {
		ctx.throw('Cannot find page', 404);
		return;
	}

	let options = {
		pretty:true,
		filename:path.join(__dirname, '../node_modules/pug-bootstrap-attr/_bootstrap.pug'),
		name:name
	};


	// get page to edit
	let key2 = 'pug:' + name2;

	// function editor?
	// TODO: better handling of function
	if (name.indexOf('func-editor') != -1) {
		key2 = 'func:' + name2;
	}

	let pug_info = await redis_cli.hgetallAsync(key2);
	if (!pug_info) {
		ctx.throw('Cannot find page to edit', 404);
		return;
	}

//	await ctx.render('pug', pug_info);

	for(let k in pug_info) {
		options[k] = pug_info[k];
	}

	let html = pug_render(pug_source, options, name);
	ctx.body = html;
});



// get pug source
router.get('/pug/pug/:name', async (ctx, next) => {
	let name = ctx.params.name;
	if (!name) {
		ctx.throw('Cannot find page', 404);
		return;
	}

	let key = 'pug:' + name;
	let source = await redis_cli.hgetAsync(key, 'pug_source');
	ctx.body = source;
});


// get js source
router.get('/pug/js/:name', async (ctx, next) => {
	let name = ctx.params.name;
	if (!name) {
		ctx.throw('Cannot find page', 404);
		return;
	}

	if (name === TEMP_JS_NAME) {
		ctx.body = await redis_cli.getAsync(TEMP_JS_NAME);
	} else {
		let key = 'pug:' + name;
		let js_source = await redis_cli.hgetAsync(key, 'js_source');
		ctx.body = js_source;
	}
});

module.exports = router
