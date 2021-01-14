import parseUrl from 'parseurl'
import qs from 'qs'

export default (options:any) => {
    let opts = Object.assign({}, options)
    let queryparse = qs.parse;

    if (typeof options === 'function') {
      queryparse = options;
      opts = undefined;
    }
  
    if (opts !== undefined && opts.allowPrototypes === undefined) {
      // back-compat for qs module
      opts.allowPrototypes = true;
    }
  
    return function query(req:any, res:any, next:any){
      if (!req.query) {
        var val:any = parseUrl(req)?.query;
        req.query = queryparse(val, opts);
      }
  
      next();
    };
}