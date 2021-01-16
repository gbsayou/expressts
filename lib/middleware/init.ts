import setPrototypeOf from 'setprototypeof'
import App from '../application'

const init = (app:App) => {
    const expressInit = (req: any, res: any,next:any) => {
        if (app.enabled('x-powered-by')) res.setHeader('X-Powered-By', 'Express');
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
