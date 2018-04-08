const router = require('koa-router')()
const pug = require('pug');
const path = require('path');
const ip = require('ip');
const request = require('superagent')

const bluebird = require('bluebird');
const redis = require('redis');
const redis_cli = bluebird.promisifyAll(redis.createClient('redis://redis'));
const fs = bluebird.promisifyAll(require('fs'))
const AsyncBusboy = require('koa-async-busboy')

const TEMP_JS_NAME = 'pug_temp_js';
const ASSET_PATH = 'public/assets'

const CWD = process.cwd()

//TODO: fuck this
const api_host = ip.address() + ':4000';

function pug_render (code, options, js_name) {
	// add script reference
	let code_patched = code;
	
	if (js_name) {
		code_patched += `\n\tscript(src="/pug/js/${js_name}",type="text/javascript")`;
	}
	return pug.render(code_patched, options);
}

function get_temp_js(ctx){
	return `${TEMP_JS_NAME}${ctx.request.ip}`
}

router.get('/pug', async (ctx, next) => {
	console.log(ctx.request.ip)
	await redis_cli.delAsync(get_temp_js(ctx))//TEMP_JS_NAME);

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

router.get('/api-proxy/:name', async (ctx, next) => {
	let name = ctx.params.name
	try {
		const url = `http://${api_host}/api/${name}`
		const result = await request.get(url)
		ctx.body = result.text
	} catch (err) {
		ctx.body = err
	}
})

router.post('/api-proxy/:name', async (ctx, next) => {
	let data = ctx.request.body || {}
	let name = ctx.params.name
	try {
		const url = `http://${api_host}/api/${name}`
		const result = await request.post(url).send(data)
		ctx.body = result.text
	} catch (err) {
		ctx.body = err
	}
})

router.post('/pug/save', async (ctx, next) => {
	let info = ctx.request.body;
	if (!info || !info.pug_source) {
		ctx.throw('Invalid pug', 500);
		return;
	}

	let key = 'pug:' + info.name;
	await redis_cli.hmsetAsync(key, info);

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
	let js_name = get_temp_js(ctx)
	await redis_cli.setAsync(js_name/*TEMP_JS_NAME*/, ctx.request.body.js);
	
	let html = pug_render(code, options, js_name/*TEMP_JS_NAME*/);
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
	if (name.indexOf('func-editor') !== -1) {
		key2 = 'func:' + name2;
		options.api_host = api_host;
	} else if (name.indexOf('schema-editor') !== -1) {
		key2 = 'schema:' + name2;
	}

	let pug_info = await redis_cli.hgetallAsync(key2);

	if (!pug_info) {
		ctx.throw('Cannot find page to edit', 404);
		return;
	}

	for(let k in pug_info) {
		options[k] = pug_info[k];
	}

	console.log(options);


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
		ctx.throw('File not found', 404);
		return;
	}

	let js_name = get_temp_js(ctx)
	if (name === js_name/*TEMP_JS_NAME*/) {
		ctx.body = await redis_cli.getAsync(js_name/*TEMP_JS_NAME*/);
	} else {
		let key = 'pug:' + name;
		let js_source = await redis_cli.hgetAsync(key, 'js_source');
		ctx.body = js_source;
	}
});

router.get('/pug/assets/:name', async (ctx, next) => {
	ctx.redirect(`/assets/${ctx.params.name}`);
})

router.post('/pug/assets/delete', async (ctx, next) => {
	const file = ctx.request.body.file	
	if (!file) {
		ctx.throw('File not found', 404)
		return
	}

	const path = `${CWD}/${ASSET_PATH}/${file}`
	try {
		await fs.unlinkAsync(path)
		ctx.body = 'ok'
	} catch (e) {
		ctx.throw(e, 500)
	}
})

router.post('/pug/assets', async (ctx, next) => {
  const busboy = new AsyncBusboy({
    headers: ctx.req.headers
  });

  const resBody = {files: [], fields: []};

  const writes = [];

  await busboy
    .onFile((fieldname, file, filename, encoding, mimetype) => {
      const tmpFilePath = `${CWD}/${ASSET_PATH}/${filename}`
      const write = fs.createWriteStream(tmpFilePath);
      const obj = {fieldname, filename, encoding, mimetype, tmpFilePath};

      file.pipe(write);

      writes.push(new Promise(resolve => {
        write.on('finish', () => {
          resolve(obj);
        });
      }));
    })
    .onField((fieldname, val, fieldnameTruncated, valTruncated, encoding, mimetype) => {
      resBody.fields.push({fieldname, val, fieldnameTruncated, valTruncated, encoding, mimetype});
    })
    .pipe(ctx.req);

  resBody.files = await Promise.all(writes);

  ctx.body = resBody;	
})

module.exports = router
