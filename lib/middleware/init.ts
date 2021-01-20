import setPrototypeOf from 'setprototypeof'
import App from '../application'
import Req from '../request'
import Res from '../response'

const init = (app: App) => {
    const expressInit = (req: Req, res: Res, next: Function) => {
        if (app.enabled('x-powered-by')) {
          res.setHeader('X-Powered-By', 'Expressts');
        }
        req.res = res;
        res.req = req;
        req.next = next;
    
        setPrototypeOf(req, app.request)
        setPrototypeOf(res, app.response)
        res.locals = res.locals || Object.create(null);
    
        next();
    }
    return expressInit
}

export default {
    init
}
