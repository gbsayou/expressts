import Route from './route';
import Layer from './layer';
import methods from 'methods'
import debug from 'debug'
import deprecate from 'depd'
import parseUrl from 'parseurl'
import _ from 'lodash'
import Res from '../response'
import Req from '../request'

const myDebug = debug('express:router')
const myDeprecate = deprecate('express')

const objectRegExp = /^\[object (\S+)\]$/;

class Router {
    options: any;
    params: any;
    _params: any;
    caseSensitive: boolean;
    strict: boolean;
    stack: Array<Layer>;

    constructor(options: any) {
        this.options = options
        this.params = {};
        this._params = {};
        this.caseSensitive = options.caseSensitive;
        this.strict = options.strict
        this.stack = []
    }

    get(path:string, ...handlers:Function[]){
        const route = this.route(path)
        route.get(...handlers)
    }

    param(name: any, fn: Function) {
        if (typeof name === 'function') {
            myDeprecate('router.param(fn): Refactor to use path params');
            this._params.push(name);
            return;
        }
        const params = this._params
        const len = params.length
        let result

        if (name[0] === ':') {
            myDeprecate('router.param(' + JSON.stringify(name) + ', fn): Use router.param(' + JSON.stringify(name.substr(1)) + ', fn) instead');
            name = name.substr(1);
        }
        for (let i = 0; i < len; i++) {
            if (result = params[i](name, fn)) {
                fn = result
            }
        }
        if ('function' !== typeof fn) {
            throw new Error('invalid param() call for ' + name + ', got ' + fn);
        }

        (this.params[name] = this.params[name] || []).push(fn);
        return this;
    }

    handle(req: any, res: any, out: any) {
        myDebug(`dispatch ${req.method} ${req.url}`)
        let idx = 0
        const protoHost = getProtoHost(req.url) || ''
        let removed = '';
        let slashAdded = false;
        const paramcalled = {};
        let options: any = [];
        const stack = this.stack;

        const parentParams = req.params;
        const parentUrl = req.baseUrl || '';
        let done: any= restore(out, req, 'baseUrl', 'next', 'params')

        const next = (err?: any) => {
            let layerError: any = err === 'route' ? null : err
            if (slashAdded) {
                req.url = req.url.substr()
                slashAdded = false
            }
            // restore altered req.url
            if (removed.length !== 0) {
                req.baseUrl = parentUrl;
                req.url = protoHost + removed + req.url.substr(protoHost.length);
                removed = '';
            }

            // signal to exit router
            if (layerError === 'router') {
                setImmediate(done, null)
                return
            }

            // no more matching layers
            if (idx >= stack.length) {
                setImmediate(done, layerError);
                return;
            }

            // get pathname of request
            var path = getPathname(req);

            if (path == null) {
                return done(layerError);
            }
            let layer: any, match, route: any;
            while (match !== true && idx < stack.length) {
                layer = stack[idx++];
                match = matchLayer(layer, path);
                route = layer.route;

                if (typeof match !== 'boolean') {
                    // hold on to layerError
                    layerError = layerError || match;
                }

                if (match !== true) {
                    continue;
                }

                if (!route) {
                    // process non-route handlers normally
                    continue;
                }

                if (layerError) {
                    // routes do not match with a pending error
                    match = false;
                    continue;
                }

                var method = req.method;
                var has_method = route._handles_method(method);

                // build up automatic options response
                if (!has_method && method === 'OPTIONS') {
                    appendMethods(options, route._options());
                }

                // don't even bother matching route
                if (!has_method && method !== 'HEAD') {
                    match = false;
                    continue;
                }
            }

            // no match
            if (match !== true) {
                return done(layerError);
            }

            // store route for dispatch on change
            if (route) {
                req.route = route;
            }

            // Capture one-time layer values
            req.params = layer.params;
            var layerPath = layer.path;

            // this should be done for the layer
            this.processParams(layer, paramcalled, req, res, (err: any) => {
                if (err) {
                    return next(layerError || err);
                }

                if (route) {
                    return layer.handleRequest(req, res, next);
                }

                trimPrefix(layer, layerError, layerPath, path);
            });
        }
        req.next = next

        if (req.method === 'OPTIONS') {
            done = wrap(done, (old: Function, err: Error) => {
                if (err || options.length === 0) return old(err)
                sendOptionsResponse(res, options, old)
            })
        }

        req.baseUrl = parentUrl;
        req.originalUrl = req.originalUrl || req.url

        const trimPrefix = (layer: Layer, layerError: Error, layerPath: string, path: any) => {
            if (layerPath.length !== 0) {
                // Validate path breaks on a path separator
                const c = path[layerPath.length]
                if (c && c !== '/' && c !== '.') return next(layerError)

                // Trim off the part of the url that matches the route
                // middleware (.use stuff) needs to have the path stripped
                myDebug(`trim prefix (${layerPath}) from url ${req.url}`,);
                removed = layerPath;
                req.url = protoHost + req.url.substr(protoHost.length + removed.length);

                // Ensure leading slash
                if (!protoHost && req.url[0] !== '/') {
                    req.url = '/' + req.url;
                    slashAdded = true;
                }

                // Setup base URL (no trailing slash)
                req.baseUrl = parentUrl + (removed[removed.length - 1] === '/'
                    ? removed.substring(0, removed.length - 1)
                    : removed);
            }

            myDebug(`${layer.name}, ${layerPath}, ${req.originalUrl}`);

            if (layerError) {
                layer.handleError(layerError, req, res, next);
            } else {
                layer.handleRequest(req, res, next);
            }
        }
        next()
    }

    processParams(layer: Layer, called: any, req: Req, res: Res, done: Function) {
        const params = this.params
        const keys = layer.keys
        if (!keys || keys.length === 0) {
            return done();
        }

        let i = 0;
        let paramIndex = 0;
        let name;
        let key: any;
        let paramVal: any;
        let paramCallbacks: any;
        let paramCalled: any;

        const param = (err?: Error):any => {
            if (err) {
                return done(err);
            }

            if (i >= keys.length) {
                return done();
            }
            paramIndex = 0;
            key = keys[i++];
            name = key.name;
            paramVal = req.params[name];
            paramCallbacks = params[name];
            paramCalled = called[name];

            if (paramVal === undefined || !paramCallbacks) {
                return param();
            }

            // param previously called with same value or error occurred
            if (paramCalled && (paramCalled.match === paramVal
                || (paramCalled.error && paramCalled.error !== 'route'))) {
                // restore value
                req.params[name] = paramCalled.value;

                // next param
                return param(paramCalled.error);
            }

            called[name] = paramCalled = {
                error: null,
                match: paramVal,
                value: paramVal
            };
            paramCallback()
        }
        
        const paramCallback = (err?: Error) => {
          const fn = paramCallbacks[paramIndex++];
          paramCalled.value = req.params[key.name];

          if (err) {
              // store error
              paramCalled.error = err;
              param(err);
              return;
          }

          if (!fn) return param();

          try {
              fn(req, res, paramCallback, paramVal, key.name);
          } catch (e) {
              paramCallback(e);
          }
      }
      params();
    }

    use(...middleware: any[]) {
        let offset: any = 0
        let path = '/'
        if(typeof middleware[0] === 'string'){
            offset = 1
            path = middleware[0]
        }
        var callbacks = _.flatten(_.slice(middleware, offset));

        if (callbacks.length === 0) {
            throw new TypeError('Router.use() requires a middleware function')
        }

        for (const callback of callbacks) {
            if (typeof callback !== 'function') {
                throw new TypeError('Router.use() requires a middleware function but got a ' + getType(callback))
            }

            // add the middleware
            myDebug(`use ${path}, ${callback.name || '<anonymous>'}`,)

            const layer = new Layer(path, {
                sensitive: this.caseSensitive,
                strict: false,
                end: false
            }, callback);

            layer.route = undefined;

            this.stack.push(layer);
        }
        return this;
    }

    route(path: string) {
        const route = new Route(path);

        const layer = new Layer(path, {
            sensitive: this.caseSensitive,
            strict: this.strict,
            end: true
        }, route.dispatch.bind(route));

        layer.route = route;

        this.stack.push(layer);
        return route;
    }
}


// append methods to a list of methods
const appendMethods = (list: Array<any>, addition: Array<any>) => {
    for(const method of addition){
      if(list.indexOf(method) === -1)list.push(method)
    }
}

// get pathname of request
const getPathname = (req: Req) => {
    try {
        return parseUrl(req)?.pathname;
    } catch (err) {
        return undefined;
    }
}

// Get get protocol + host for a URL
const getProtoHost = (url?: string) => {
    if (typeof url !== 'string' || url.length === 0 || url[0] === '/') {
        return undefined
    }

    const searchIndex = url.indexOf('?')
    const pathLength = searchIndex !== -1 ? searchIndex : url.length
    const fqdnIndex = url.substr(0, pathLength).indexOf('://')

    return fqdnIndex !== -1 ? url.substr(0, url.indexOf('/', 3 + fqdnIndex)) : undefined
}

// get type for error message
const getType = (obj: any) => {
    if (typeof obj !== 'object') {
        return typeof obj;
    }

    // inspect [[Class]] for objects
    return toString.call(obj).replace(objectRegExp, '$1');
}

/**
 * Match path to a layer.
 *
 * @param {Layer} layer
 * @param {string} path
 * @private
 */

const matchLayer = (layer: Layer, path: string) => {
    try {
        return layer.match(path);
    } catch (err) {
        return err;
    }
}

// restore obj props after function
const restore=(fn: Function, ...obj: any[])=> {
    var props = new Array(obj.length - 1);
    var values = new Array(obj.length - 1);

    props.forEach((prop, i)=>{
      prop = obj[i + 1];
      values[i] = obj[prop];
    })

    return (...args: any[])=> {
        // restore vals
        for (let i = 0; i < props.length; i++) {
            obj[props[i]] = values[i];
        }

        return fn.apply(null, args);
    };
}

// send an OPTIONS response
const sendOptionsResponse=(res: Res, options: Array<any>, next: Function) =>{
    try {
        const body = options.join(',');
        res.set('Allow', body);
        res.send(body);
    } catch (err) {
        next(err);
    }
}

// wrap a function
const wrap = (old: Function, fn: Function) =>{
    return (...args: any[]) => {
        fn.apply(null, [old, ...args]);
    };
}

export default Router
