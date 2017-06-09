//const {promisify} = require('util');
const router = require('koa-router')()

// for function source code storage & messaging
const bluebird = require('bluebird');
const redis = require('redis');
const redis_cli = bluebird.promisifyAll(redis.createClient('redis://redis'));

// subscribe needs its own client
const redis_sub = redis.createClient('redis://redis');

// subscribe on func update events
redis_sub.on('message', function(channel, message){
	if (channel === 'func:dirty') {
		let func_name = message;
		if (vm_lut[func_name]) {
			delete vm_lut[func_name];
		}

		console.log('dirty');
	}
});
redis_sub.subscribe('func:dirty');

// redis client for vm
const redis_cli_vm = bluebird.promisifyAll(redis.createClient('redis://redis'));

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

// script cache
async function get_func (func_name) {
	let vm_func = vm_lut[func_name];

	// not cached
	if (!vm_func) {
		let key = 'func:' + func_name;
		let code = await redis_cli.getAsync(key);

		if (!code) {
			console.log('Failed to load func:', func_name);
			return null;
		} else {
			try {
				let wrap_code = wrap(code);
				console.log('wrap code', code, wrap_code);
				let func = vm.createScript(wrap_code);

				// one context for each script
				let context = vm.createContext();

				// add some useful libs to context
				context.redis = redis_cli_vm;
				context.console = console;
				context.env = vm_env;
				context.ctx_queue = [];	// shared queue to store req/res

				// cache
				let func_info = {func:func, context:context};
				vm_func = vm_lut[func_name] = func_info

				console.log('compiled', wrap_code);

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

async function run_func (func_info, ctx) {
	return new Promise((resolve, reject)=>{
		ctx.resolve = resolve;
		ctx.reject = reject;
		func_info.context.ctx_queue.push(ctx);
		func_info.func.runInContext(func_info.context);
	});
}

// execute a function
router.post('/api', async (ctx, next) => {
	let name = ctx.request.body.func;
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

	console.time('api');
	await run_func(func_info, ctx);
	console.timeEnd('api');

	console.log('run', name);
});

module.exports = router
