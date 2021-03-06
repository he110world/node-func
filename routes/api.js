const router = require('koa-router')()
const pug = require('pug');
const path = require('path');

// for function source code storage & messaging
const bluebird = require('bluebird');
const redis = require('redis');
const Docker = require('dockerode')
const docker_vm = new Docker()
const superagent = require('superagent')
const redis_cli = bluebird.promisifyAll(redis.createClient('redis://redis'));
const redis_cli_vm = bluebird.promisifyAll(redis.createClient('redis://redis'));	// redis client for vm
const mysql = require('mysql2/promise')
const fs_vm = bluebird.promisifyAll(require('fs'))

let mysql_connection
let schema_loaded = false;

//mysql
async function init_mysql () {
	mysql_connection = await mysql.createConnection({host:'mysql', user: 'root', password: '123456', database: 'test', Promise: bluebird})
}

init_mysql()

// mongoose
const mongoose = require('mongoose');
mongoose.Promise = Promise;
//mongoose.connect('mongodb://mongo:27017/vm');		// mongo client for vm

// load mongoose schemas
async function load_schema () {
	let keys = await redis_cli.keysAsync('schema:*');
	for(let i=0; i<keys.length; i++){
		let key = keys[i];
		let source = await redis_cli.hgetAsync(key, 'source');
		let name = key.split(':')[1];
		try {
			let init_schema = `mongoose.model('${name}', new mongoose.Schema(${source}))`;
			console.log(init_schema);
			eval(init_schema);
		} catch (e) {
			console.log('schema error:', e.message);
		}
	}

	schema_loaded = true;
}

// subscribe needs its own client
const redis_sub = redis.createClient('redis://redis');

// subscribe on func update events
redis_sub.on('message', function(channel, message){
	if (channel === 'func:dirty') {
		let func_name = message;
		if (vm_lut[func_name]) {
			delete vm_lut[func_name];
		}

		console.log('func dirty');
	} else if (channel === 'schema:dirty') {
		let schema_name = message;

		// reload mongoose schema
		delete mongoose.models[schema_name];
		delete mongoose.modelSchemas[schema_name];

		redis_cli.hget('schema:'+schema_name, 'source', (err, schema_source)=>{
			try {
				eval(`mongoose.model('${schema_name}', new mongoose.Schema(${schema_source}))`);
			} catch (e) {
				console.log('mongoose error:', e.message);
			}
		});
	}
});
redis_sub.subscribe('func:dirty');
redis_sub.subscribe('schema:dirty');


// node vm
const vm = require('vm');


let vm_lut = {};
let vm_env = {};	// 'global' for vm

function wrap (code) {
	let wrap_code = `(async function(){\n
		let ctx = ctx_queue.shift();\n
		try{
			${code}\n
			ctx.resolve();\n
		}catch(e){\n
			ctx.status = 500;\n
			ctx.body = e.message;\n
			ctx.resolve();\n
		}\n
	})()`;
	return wrap_code;
}

// serve js source
const TEMP_JS_NAME = "pug_temp_js";	

function get_temp_js(ctx){
	return `${TEMP_JS_NAME}${ctx.request.ip}`
}

router.get('/pug/js/:name', async (ctx, next) => {
	let name = ctx.params.name;
	if (!name) {
		ctx.throw('Cannot find page', 404);
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


async function pug_render (ctx, name, user_opts) {
	let pug_info = await redis_cli.hgetallAsync('pug:'+name);
	if (!pug_info) {
		ctx.throw('page not found', 404);
		return;
	}

	let options = {
		pretty:true,
		filename:path.join(__dirname, '../node_modules/pug-bootstrap-attr/_bootstrap.pug'),
	};

	for (let opt_key in user_opts) {
		options[opt_key] = user_opts[opt_key];
	}
	let code_patched = pug_info.pug_source;
	code_patched += `\n\tscript(src="/pug/js/${name}",type="text/javascript")`;
	let rendered = pug.render(code_patched, options);
	console.log(rendered);
	return rendered;
//	ctx.body = rendered;
	//ctx.body = pug.render(code_patched, options);
}

function create_func (code) {
	let wrap_code = wrap(code);
	let func = vm.createScript(wrap_code);

	// one context for each script
	let context = vm.createContext();

	// add some useful libs to context
	context.redis = redis_cli_vm;
	context.schema = mongoose.models;
	context.mysql = mysql_connection
	context.docker = docker_vm
	context.httpclient = superagent
	context.console = console;
	context.fs = fs_vm
	context.env = vm_env;
	context.ctx_queue = [];	// shared queue to store req/res

	// cache
	return {func:func, context:context};
}

// script cache
async function get_func (func_name) {
	if (!schema_loaded) {
//		await load_schema();
	}

	let vm_func = vm_lut[func_name];

	// not cached
	if (!vm_func) {
		let key = 'func:' + func_name;
		let code = await redis_cli.hgetAsync(key, 'js_source');

		if (!code) {
			console.log('Failed to load func:', func_name);
			return null;
		} else {
			try {
				let func_info = create_func(code);
				vm_func = vm_lut[func_name] = func_info

				// done
				return func_info;


			} catch (e) {
				console.log('Failed to compile func:', func_name, e);

				return null;
			}
		}
	} else {
		console.log('cache hit');
		return vm_func;
	}
}

async function run_func (func_info, ctx, is_test) {
	return new Promise((resolve, reject)=>{
		ctx.resolve = resolve;
		ctx.reject = reject;

		if (is_test) {
			ctx.page = async (name, opts) => {
				let res = await pug_render(ctx, name, opts);
				console.log('res',res);
				ctx.body = {
					res: res,
					log: ctx._log
				}
			};
			// fake console.log
			ctx._log = '';
			ctx.log = function () {
				for(let i=0; i<arguments.length; i++){
					this._log += arguments[i];
					if (i === arguments.length-1) {
						this._log += '\n';
					} else {
						this._log += ' ';
					}
				}
			}

			Object.defineProperty(ctx, 'result', {
				set: function (val) {
					this.body = {
						res: val,
						log: this._log
					}
				}
			});
		} else {
			ctx.page = async (name, opts) => {
				ctx.body = await pug_render(ctx, name, opts);
			};
			ctx.log = console.log;
			Object.defineProperty(ctx, 'result', {
				set: function(val){
					this.body=val
				}
			});
		}

		func_info.context.ctx_queue.push(ctx);
		func_info.func.runInContext(func_info.context);
	});
}

function begin_profile (name) {
	console.log('begin:', name);
	console.time('exec time');
}

function end_profile () {
	console.timeEnd('exec time');
	console.log('mem:', parseInt(process.memoryUsage().heapTotal / 1024 / 1024), 'MB');
	console.log('end');
}

router.get('/api/:func', async (ctx, next) => {
	let name = ctx.params.func;
	if (!name) {
		ctx.body = 'Error';
		return;
	}

	// get func
	let func_info = await get_func(name);
	if (!func_info) {
		ctx.body = 'Error';
		return;
	}

	begin_profile(name);
	await run_func(func_info, ctx);
	end_profile();
});

// execute a function
router.post('/api/:func', async (ctx, next) => {
	let name = ctx.params.func;
	if (!name) {
		ctx.body = 'Error';
		return;
	}

	// get func
	let func_info = await get_func(name);
	if (!func_info) {
		ctx.body = 'Error';
		return;
	}

	// post data
	let data = ctx.request.body || {}
	for(let i in data){
		ctx[i] = data[i]
	}

	begin_profile(name);
	await run_func(func_info, ctx);
	end_profile();
});

// test run
router.post('/test', async (ctx, next) => {
	let input = ctx.request.body;
	if (!input.js_source) {
		ctx.body = 'Error';
		return;
	}

	if (!schema_loaded) {
//		await load_schema();
	}


	let func_info = create_func(input.js_source);

	// add payload
	if (input.json_source) {
		try {
			let json = JSON.parse(input.json_source);
			for(let k in json) {
				ctx[k] = json[k];
			}
		} catch(e) {
			console.log(e.message);
		}
	}

	begin_profile('test');
	await run_func(func_info, ctx, true);
	end_profile();
});


module.exports = router
