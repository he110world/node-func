const router = require('koa-router')()

// for function source code storage & messaging
const bluebird = require('bluebird');
const redis = require('redis');
const redis_cli = bluebird.promisifyAll(redis.createClient('redis://redis'));


// get a list of functions
// draw them
router.get('/func', async (ctx, next) => {
	
	ctx.redirect('/pug/view/func-editor');
});

router.get('/func/list', async (ctx, next) => {

	// get a array of function names
	let keys = await redis_cli.keysAsync('func:*');

	// keys are in the form of 'func:name'
	// we only need the 'name' part
	let names = keys.map(name => name.split(':')[1]);

	ctx.body = {func_list:names};
});


// get functions in trash bin
router.get('/func/trash', async (ctx, next) => {

	// get an array of function names
	let keys = await redis_cli.keysAsync('trash:*');

	// keys are in the form of 'func:name'
	// we only need the 'name' part
	let names = keys.map(name => name.split(':')[1]);

	await ctx.render('func', {
		title: 'Have Some Func!',
		func_names: names
	});
});


// get a function's source code by name
router.get('/func/get/:name', async (ctx, next) => {
	let name = ctx.params.name;
	let key = 'func:' + name;

	// get it from redis
	let func = await redis_cli.hgetallAsync(key);

	ctx.body = func;
});

// set a function's source code by name
router.post('/func/deploy', async (ctx, next) => {
	// {name:String, js_source:String, json_source:String}
	let func = ctx.request.body;
	if (!func.name || !func.js_source) {
		ctx.throw('Invalid function', 500);
		return;
	}

	let key = 'func:' + func.name;
	await redis_cli.hmsetAsync(key, func);
	redis_cli.publish('func:dirty', func.name);

	ctx.body = 'Deployed';

	console.log(func.name,'deployed');
});

// 'delete' a function
// not really -- just rename the function to trash:name
router.post('/func/del', async (ctx, next) => {
	let func_name = ctx.request.body.name;
	if (!func_name) {
		ctx.throw('Cannot find func', 500);
		return;
	}

	await redis_cli.renameAsync('func:'+func_name, 'trash:'+func_name);

	redis_cli.publish('func:dirty', func_name);

	ctx.body = 'Deleted';

	console.log(func_name,'deleted');
});

router.post('/func/test', async (ctx, next) => {
	console.log(ctx.request.body);
	let result = await ctx.post('/test', ctx.request.body);
	console.log(result);
	ctx.body = result;
//	ctx.body = 'hello';
//	ctx.redirect('http://api:4000/test');
});

router.post('/func/rename', async (ctx, next) => {
	let old_name = ctx.request.body.old_name;
	let new_name = ctx.request.body.new_name;
	if (!old_name || !new_name) {
		ctx.throw('Cannot find func', 500);
		return;
	}

	let count = Number(await redis_cli.exists(`func:${new_name}`));
	if (isNaN(count) || count>0) {
		ctx.throw('Func exists');
		return;
	}

	await redis_cli.renameAsync(`func:${old_name}`, `func:${new_name}`);

	redis_cli.publish('func:dirty', old_name);

	ctx.body = 'Renamed';

	console.log(old_name,'renamed to', new_name);
});

router.get('/func/dump', async (ctx, next) => {
});

module.exports = router
