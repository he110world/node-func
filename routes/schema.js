const router = require('koa-router')()

// for function source code storage & messaging
const bluebird = require('bluebird');
const redis = require('redis');
const redis_cli = bluebird.promisifyAll(redis.createClient('redis://redis'));


// get a list of functions
// draw them
router.get('/schema', async (ctx, next) => {
	
	ctx.redirect('/pug/view/schema-editor');
});

router.get('/schema/list', async (ctx, next) => {

	// get a array of function names
	let keys = await redis_cli.keysAsync('schema:*');

	// keys are in the form of 'func:name'
	// we only need the 'name' part
	let names = keys.map(name => name.split(':')[1]);

	ctx.body = {schema_list:names};
});

router.get('/schema/get/:name', async (ctx, next) => {
	let name = ctx.params.name;
	if (!name) {
		ctx.throw('Cannot find schema', 404);
		return;
	}

	let key = 'schema:' + name;

	// get a array of function names
	let schema = await redis_cli.hgetAsync(key, 'source');

	ctx.body = schema;
});

router.get('/schema/json/:name', async (ctx, next) => {
	let name = ctx.params.name;
	if (!name) {
		ctx.throw('Cannot find schema', 404);
		return;
	}

	let key = 'schema:' + name;

	// get a array of function names
	let json = await redis_cli.hgetAsync(key, 'json');

	if (json) {
		try {
			ctx.body = JSON.parse(json);
		} catch (e) {
			ctx.body = {};
		}
	} else {
		ctx.body = {};
	}
});


// set a function's source code by name
router.post('/schema/deploy', async (ctx, next) => {
	// {name:String, js_source:String, json_source:String}
	let schema = ctx.request.body;
	if (!schema.name || !schema.source) {
		ctx.throw('Invalid schema', 500);
		return;
	}

	let key = 'schema:' + schema.name;
	await redis_cli.hmsetAsync(key, schema);
	redis_cli.publish('schema:dirty', schema.name);

	ctx.body = 'Deployed';

	console.log(schema.name,'deployed');
});

module.exports = router
