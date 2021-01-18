import parseUrl from 'parseurl'
import qs from 'qs'
import Req from '../request'
import Res from '../response'

export default (options:Function | Object) => {
    let opts: any = Object.assign({}, options)
    let queryParse: Function = qs.parse;

    if (typeof options === 'function') {
      queryParse = options;
      opts = undefined;
    }
  
    if (opts !== undefined && opts.allowPrototypes === undefined) {
      // back-compat for qs module
      opts.allowPrototypes = true;
    }
  
    return  (req: Req, res: Res, next: Function) => {
      if (!req.query) {
        const val: any = parseUrl(req)?.query;
        req.query = queryParse(val, opts);
      }
  
      next();
    };
}
