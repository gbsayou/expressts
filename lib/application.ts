import debug from 'debug';
import setprototypeof from 'setprototypeof';
import finalhandler from 'finalhandler';
import methods from 'methods';
import _ from 'lodash';
import setPrototypeOf from 'setprototypeof';
import http from 'http';
import {compileETag,compileQueryParser,compileTrust} from './utils'
import middleware from './middleware/init'
import query from './middleware/query'
import Router from './router'
import Route from './router/route'
import Req from './request'
import Res from './response'

import {EventEmitter} from 'events'
const trustProxyDefaultSymbol = '@@sysbol:trust_proxy_default';

const myDebug = debug('express:application')

class App extends EventEmitter {
    settings: any;
    request: any;
    response: any;
    locals: any;
    mountpath: any;
    _router: Router;
    parent: any;

    constructor({caseSensitiveRouting = false,strictRouting = false}){
        super();
        this.settings = {};

        if(caseSensitiveRouting)this.enable('caseSensitiveRouting')
        if(strictRouting)this.enable('strictRouting')

        this.request = Object.create(new Req('request'), {
          app: { configurable: true, enumerable: true, writable: true, value: this }
        })
      
        // expose the prototype that will get set on responses
        this.response = Object.create(new Res('response'), {
          app: { configurable: true, enumerable: true, writable: true, value: this }
        })

        this._router = new Router({
            caseSensitive: caseSensitiveRouting,
            strict: strictRouting
        });

        this._router.use(query(this.get('query parser fn')));
        this._router.use(middleware.init(this))

        this.defaultConfiguration();
    }

    defaultConfiguration() {
        const env = process.env.NODE_ENV || 'development';

        this.enable('x-powered-by');
        this.set('etag', 'weak');
        this.set('env', env);
        this.set('query parser', 'extended');
        this.set('subdomain offset', 2);
        this.set('trust proxy', false);

        Object.defineProperty(this.settings, trustProxyDefaultSymbol, {
            configurable: true,
            value: true
        });

        myDebug(`booting in ${env} mode`);

        this.on('mount', (parent: any) => {
            if (this.settings[trustProxyDefaultSymbol]
                && typeof parent.settings['trust proxy fn'] === 'function') {
                delete this.settings['trust proxy'];
                delete this.settings['trust proxy fn'];
            }

            setprototypeof(this.request, parent.request)
            setprototypeof(this.response, parent.response)
            setprototypeof(this.settings, parent.settings)
        });

        this.locals = Object.create(null);

        this.mountpath = '/'

        this.locals.settings = this.settings;

        this.set('jsonp callback name', 'callback');

    }

    get router() {
        throw new Error('app.router is deprecated!')
    }

    handle(req: any, res: any, callback: any) {
        const router = this._router;

        const done = callback || finalhandler(req, res, {
            env: this.get('env'),
            onerror: this.logerror.bind(this)
        })

        if (!router) {
            myDebug('no routes defined on app');
            done();
            return
        }
        router.handle(req, res, done)
    }
    logerror(err: Error){
        if(this.get('env')!=='test'){
            console.error(err.stack||err.toString());
        }
    }

    use(...middlewares: any[]) {
        let offset = 0;
        let path = '/';
        if(typeof middlewares[0] != 'function'){
            path = middlewares[0]
            offset = 1;
        }

        const fns = _.flatten(_.slice(middlewares, offset))

        if (fns.length === 0) {
            throw new TypeError('app.use() requires a middleware function')
        }

        const router = this._router;
        fns.forEach(fn => {
            if (!fn || !fn.handle || !fn.set) {
                return router.use(path, fn)
            }

            myDebug(`.use app under ${path}`)
            fn.mountpath = path
            fn.parent = this
            router.use(path, (req: any, res:any, next: any) => {
                const orig = req.app;
                fn.handle(req, res, (err: Error) => {
                    setPrototypeOf(req, orig.request)
                    setPrototypeOf(res, orig.response)
                    next(err)
                })
            })
            fn.emit('mount', this)
        }, this)
        return this
    }

    route(path:any){
        return this._router.route(path)
    }

    param(name: any, fn:Function){
        if(Array.isArray(name)){
            for(const item of name){
                this.param(item, fn)
            }
            return this
        }
        this._router.param(name, fn)
        return this
    }

    set(setting: string, val?: any){
        if(typeof val === 'undefined'){
            return this.settings[setting]
        }

        myDebug(`set ${setting} to ${val}`)

        this.settings[setting] = val

        switch(setting){
            case 'etag':
                this.set('etag fn', compileETag(val));
                break;
            case 'query parser':
                this.set('query parser fn', compileQueryParser(val));
                break;
            case 'trust proxy':
                this.set('trust proxy fn', compileTrust(val));
                Object.defineProperty(this.settings, trustProxyDefaultSymbol,{
                    configurable: true,
                    value: false
                })
                break;
        }
    return this
    }

    get(setting:any, ...handler:Function[]){
        if(typeof handler === 'undefined') return this.settings[setting]

        const route = this._router.route(setting)
        route.get(...handler)
        return this
    }

    put(path: string, ...handler:Function[]){

        const route: Route = this._router.route(path)
        route.put(...handler)
        return this
    }

    path(){
        return this.parent?this.parent.path()+this.mountpath :''
    }

    enabled(setting:any){
        return Boolean(this.set(setting))
    }

    disabled(setting:any){
        return !this.set(setting)
    }

    enable(setting:any){
        return this.set(setting, true)
    }

    disable(setting:any){
        return this.set(setting, false)
    }

    all (path:any, ...handler:Function[]){
        const route = this._router.route(path);

        // for(const method of methods){
        //     route[method].apply(route, handler)
        // }
        return this
    }

    listen(...args: any){
        const server = http.createServer((req:http.IncomingMessage, res: http.ServerResponse) =>{
            this.handle(req, res, null)
        })
        return server.listen(...args)
    }

}


export default App;
