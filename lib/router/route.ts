import debug from 'debug';
import Layer from './layer'
// import methods from 'methods'
import _ from 'lodash'

const myDebug = debug('express:router:route')

class Route {
    path: string
    stack: Array<any>
    methods: any
    constructor(path: string) {
        this.path = path
        this.stack = []
        myDebug(`new ${path}`)
        this.methods = {}
    }
    _handles_method(method: string) {
        if (this.methods._all) {
            return true
        }
        let name: string = method.toLowerCase();

        if (name === 'head' && !this.methods['head']) {
            name = 'get'
        }
        return Boolean(this.methods[name])
    }
    _options() {
        const methods = Object.keys(this.methods).map(method => method.toLowerCase())
        if (this.methods.get && !this.methods.head) {
            methods.push('head')
        }
        return methods
    }
    dispatch(req: any, res: any, done: any) {
        let idx = 0;
        const stack = this.stack;
        if (stack.length === 0) return done()

        let method: string = req.method.toLowerCase()
        if (method === 'head' && !this.methods['head']) {
            method = 'get'
        }
        req.route = this
        const next: any = (err: any) => {
            // signal to exit route
            if (err && err === 'route') {
                return done();
            }

            // signal to exit router
            if (err && err === 'router') {
                return done(err)
            }

            var layer = stack[idx++];
            if (!layer) {
                return done(err);
            }

            if (layer.method && layer.method !== method) {
                return next(err);
            }

            if (err) {
                layer.handle_error(err, req, res, next);
            } else {
                layer.handle_request(req, res, next);
            }
        }
        next();

    }
    all(...handlers:Function[]) {
        for (const handle of handlers) {
            const layer = new Layer('/', {}, handle);
            layer.method = undefined;
            this.methods._all = true;
            this.stack.push(layer);
        }
        return this
    }

    get(...handlers: Function[]){

        for(const handler of handlers){
            myDebug(`get ${this.path}`)
            const layer = new Layer('/',{}, handler)
            layer.method = 'get'
            this.methods['get'] = true;
            this.stack.push(layer);
        }
    }
}

export default Route
