//const {promisify} = require('util');
const router = require('koa-router')()

// for function source code storage & messaging
const bluebird = require('bluebird');
const redis = require('redis');
const redis_cli = bluebird.promisifyAll(redis.createClient('redis://redis'));

// redis client for vm
const redis_cli_vm = bluebird.promisifyAll(redis.createClient('redis://redis'));

// node vm
const vm = require('vm');


let vm_lut = {};
let vm_env = {};	// 'global' for vm

function wrap (code) {
	let wrap_code = `(async function(){\n
		let ctx = ctx_queue.shift();\n
		${code}\n
		ctx.resolve();
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

		//1
		console.log(code);

		if (!code) {
			console.log('Failed to load func:', func_name);
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
	return new Promise((resolve)=>{
		ctx.resolve = resolve;
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

	await run_func(func_info, ctx);

	// pass req & res to vm
	// how to pass req & res? just fetch them from the queue!
//	func_info.context.ctx_queue.push(ctx);
//	func_info.func.runInContext(func_info.context);

	console.log('run', name);
});

module.exports = router
