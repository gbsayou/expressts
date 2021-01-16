import Route from './route';
import Layer from './layer';
import methods from 'methods'
import mixin from 'utils-merge'
import debug from 'debug'
import deprecate from 'depd'
import parseUrl from 'parseurl'
import setPrototypeOf from 'setprototypeof'
import layer from './layer';
import _ from 'lodash'

const myDebug = debug('express:router')
const myDeprecate = deprecate('express')

const objectRegExp = /^\[object (\S+)\]$/;

class Proto {
    options: any;
    params: any;
    _params: any;
    caseSensitive: any;
    mergeParams: any;
    strict: any;
    stack: any;

    constructor(options: any) {
        this.options = options
        this.params = {};
        this._params = {};
        this.caseSensitive = options.caseSensitive;
        this.mergeParams = options.mergeParams
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
        const protohost = getProtohost(req.url) || ''
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
                req.url = protohost + removed + req.url.substr(protohost.length);
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
            req.params = this.mergeParams
                ? mergeParams(layer.params, parentParams)
                : layer.params;
            var layerPath = layer.path;

            // this should be done for the layer
            this.process_params(layer, paramcalled, req, res, (err: any) => {
                if (err) {
                    return next(layerError || err);
                }

                if (route) {
                    return layer.handle_request(req, res, next);
                }

                trim_prefix(layer, layerError, layerPath, path);
            });
        }
        req.next = next

        if (req.method === 'OPTIONS') {
            done = wrap(done, (old: any, err: any) => {
                if (err || options.length === 0) return old(err)
                sendOptionsResponse(res, options, old)
            })
        }

        req.basuUrl = parentUrl;
        req.originalUrl = req.originalUrl || req.url

        const trim_prefix = (layer: any, layerError: any, layerPath: any, path: any) => {
            if (layerPath.length !== 0) {
                // Validate path breaks on a path separator
                var c = path[layerPath.length]
                if (c && c !== '/' && c !== '.') return next(layerError)

                // Trim off the part of the url that matches the route
                // middleware (.use stuff) needs to have the path stripped
                debug(`trim prefix (${layerPath}) from url ${req.url}`,);
                removed = layerPath;
                req.url = protohost + req.url.substr(protohost.length + removed.length);

                // Ensure leading slash
                if (!protohost && req.url[0] !== '/') {
                    req.url = '/' + req.url;
                    slashAdded = true;
                }

                // Setup base URL (no trailing slash)
                req.baseUrl = parentUrl + (removed[removed.length - 1] === '/'
                    ? removed.substring(0, removed.length - 1)
                    : removed);
            }

            debug(`${layer.name}, ${layerPath}, ${req.originalUrl}`);

            if (layerError) {
                layer.handle_error(layerError, req, res, next);
            } else {
                layer.handle_request(req, res, next);
            }
        }


        next()
    }
    process_params(layer: any, called: any, req: any, res: any, done: any) {
        const params = this.params
        const keys = layer.keys
        if (!keys || keys.length === 0) {
            return done();
        }

        let i = 0;
        let name;
        let paramIndex = 0;
        let key: any;
        let paramVal: any;
        let paramCallbacks: any;
        let paramCalled: any;
        const param = (err?: any): any => {
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

            const paramCallback = (err?: any) => {
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
            paramCallback();
        }

    }

    use(...middlewares: any[]) {
        let offset: any = 0
        let path = '/'
        if(typeof middlewares[0] === 'string'){
            offset = 1
            path = middlewares[0]
        }
        var callbacks = _.flatten(_.slice(middlewares, offset));

        if (callbacks.length === 0) {
            throw new TypeError('Router.use() requires a middleware function')
        }

        for (var i = 0; i < callbacks.length; i++) {
            var fn: any = callbacks[i];

            if (typeof fn !== 'function') {
                throw new TypeError('Router.use() requires a middleware function but got a ' + gettype(fn))
            }

            // add the middleware
            debug(`use ${path}, ${fn.name || '<anonymous>'}`,)

            var layer = new Layer(path, {
                sensitive: this.caseSensitive,
                strict: false,
                end: false
            }, fn);

            layer.route = undefined;

            this.stack.push(layer);
        }
        return this;
    }
    route(path: any) {
        var route = new Route(path);

        var layer = new Layer(path, {
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
function appendMethods(list: any, addition: any) {
    for (var i = 0; i < addition.length; i++) {
        var method = addition[i];
        if (list.indexOf(method) === -1) {
            list.push(method);
        }
    }
}

// get pathname of request
function getPathname(req: any) {
    try {
        return parseUrl(req)?.pathname;
    } catch (err) {
        return undefined;
    }
}

// Get get protocol + host for a URL
function getProtohost(url: any) {
    if (typeof url !== 'string' || url.length === 0 || url[0] === '/') {
        return undefined
    }

    var searchIndex = url.indexOf('?')
    var pathLength = searchIndex !== -1
        ? searchIndex
        : url.length
    var fqdnIndex = url.substr(0, pathLength).indexOf('://')

    return fqdnIndex !== -1
        ? url.substr(0, url.indexOf('/', 3 + fqdnIndex))
        : undefined
}

// get type for error message
function gettype(obj: any) {
    var type = typeof obj;

    if (type !== 'object') {
        return type;
    }

    // inspect [[Class]] for objects
    return toString.call(obj)
        .replace(objectRegExp, '$1');
}

/**
 * Match path to a layer.
 *
 * @param {Layer} layer
 * @param {string} path
 * @private
 */

function matchLayer(layer: any, path: any) {
    try {
        return layer.match(path);
    } catch (err) {
        return err;
    }
}

// merge params with parent params
function mergeParams(params: any, parent: any) {
    if (typeof parent !== 'object' || !parent) {
        return params;
    }

    // make copy of parent for base
    var obj = mixin({}, parent);

    // simple non-numeric merging
    if (!(0 in params) || !(0 in parent)) {
        return mixin(obj, params);
    }

    var i = 0;
    var o = 0;

    // determine numeric gaps
    while (i in params) {
        i++;
    }

    while (o in parent) {
        o++;
    }

    // offset numeric indices in params before merge
    for (i--; i >= 0; i--) {
        params[i + o] = params[i];

        // create holes for the merge when necessary
        if (i < o) {
            delete params[i];
        }
    }

    return mixin(obj, params);
}

// restore obj props after function
function restore(fn: any, ...obj: any[]) {
    var props = new Array(obj.length - 1);
    var vals = new Array(obj.length - 1);

    for (var i = 0; i < props.length; i++) {
        props[i] = obj[i + 1];
        vals[i] = obj[props[i]];
    }

    return function (...args: any[]) {
        // restore vals
        for (var i = 0; i < props.length; i++) {
            obj[props[i]] = vals[i];
        }

        return fn.apply(null, args);
    };
}

// send an OPTIONS response
function sendOptionsResponse(res: any, options: any, next: any) {
    try {
        var body = options.join(',');
        res.set('Allow', body);
        res.send(body);
    } catch (err) {
        next(err);
    }
}

// wrap a function
function wrap(old: any, fn: any) {
    return function proxy(...args: any[]) {
        var args = new Array(args.length + 1);

        args[0] = old;
        for (var i = 0, len = args.length; i < len; i++) {
            args[i + 1] = args[i];
        }

        fn.apply(null, args);
    };
}

export default Proto
