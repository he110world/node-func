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

// get a function's source code by name
router.get('/get/:name', async (ctx, next) => {
	let name = ctx.params.name;
	let key = 'func:' + name;

	// get it from redis
	let code = await redis_cli.getAsync(key);

	ctx.body = code;
});

// set a function's source code by name
router.post('/set', async (ctx, next) => {
	let params = ctx.request.body;
	if (!params.name || !params.code) {
		ctx.body = 'Error';
		return;
	}

	let key = 'func:' + params.name;
	await redis_cli.setAsync(key, params.code);
	redis_cli.publish('func:dirty', params.name);

	ctx.body = 'Ok';

	console.log('set');
});

module.exports = router
