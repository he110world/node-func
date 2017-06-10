const Koa = require('koa')
const app = new Koa()
const views = require('koa-views')
const json = require('koa-json')
const onerror = require('koa-onerror')
const bodyparser = require('koa-bodyparser')
const logger = require('koa-logger')
const cors = require('koa-cors');

const index = require('./routes/index')
const users = require('./routes/users')

// args
const argv = require('yargs').argv;
const is_func = argv.mode === 'func';

// func
const func = is_func ? require('./routes/func') : null;
const pug = is_func ? require('./routes/pug') : null;
const api = !is_func ? require('./routes/api') : null;

// error handler
onerror(app)

// middlewares
app.use(cors());
app.use(bodyparser({
  enableTypes:['json', 'form', 'text']
}))
app.use(json())
app.use(logger())
app.use(require('koa-static')(__dirname + '/public'))

app.use(views(__dirname + '/views', {
  extension: 'pug'
}))

// logger
app.use(async (ctx, next) => {
  const start = new Date()
  await next()
  const ms = new Date() - start
  console.log(`${ctx.method} ${ctx.url} - ${ms}ms`)
})

// routes
app.use(index.routes(), index.allowedMethods())
app.use(users.routes(), users.allowedMethods())

// func routes
if (func) {
	app.use(func.routes(), func.allowedMethods());
}
if (api) {
	app.use(api.routes(), api.allowedMethods());
}
if (pug) {
	app.use(pug.routes(), pug.allowedMethods());
}

module.exports = app
