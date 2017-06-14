const router = require('koa-router')()

// for function source code storage & messaging
const bluebird = require('bluebird');
const redis = require('redis');
const redis_cli = bluebird.promisifyAll(redis.createClient('redis://redis'));

router.prefix('/func');

// get a list of functions
// draw them
router.get('/', async (ctx, next) => {

	// get a array of function names
	let keys = await redis_cli.keysAsync('func:*');

	// keys are in the form of 'func:name'
	// we only need the 'name' part
	let names = keys.map(name => name.split(':')[1]);

	await ctx.render('func', {
		title: 'Have Some Func!',
		func_names: names
	});
});

// get functions in trash bin
router.get('/trash', async (ctx, next) => {

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
router.get('/get/:name', async (ctx, next) => {
	let name = ctx.params.name;
	let key = 'func:' + name;

	// get it from redis
	let code = await redis_cli.getAsync(key);

	ctx.body = code;
});

// set a function's source code by name
router.post('/deploy', async (ctx, next) => {
	let params = ctx.request.body;
	let func_name = params.name;
	if (!func_name || !params.code) {
		ctx.body = 'Error';
		return;
	}

	let key = 'func:' + func_name;
	await redis_cli.setAsync(key, params.code);
	redis_cli.publish('func:dirty', func_name);

	ctx.body = 'Deployed';

	console.log(func_name,'deployed');
});

// 'delete' a function
// not really -- just rename the function to trash:name
router.post('/del', async (ctx, next) => {
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

router.post('/rename', async (ctx, next) => {
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

// export all functions to a zip file
router.get('/export-all-zip', async (ctx, next) => {
});

// import a zip file containing functions
router.post('/import-zip', async (ctx, next) => {
});



module.exports = router
