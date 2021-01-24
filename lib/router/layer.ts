import { pathToRegexp } from 'path-to-regexp';
import debug from 'debug';

const { hasOwnProperty } = Object.prototype;
const myDebug = debug('express:router:layer');
const decodeParam = (val: any) => {
  if (typeof val !== 'string' || val.length === 0) {
    return val;
  }

  try {
    return decodeURIComponent(val);
  } catch (err: any) {
    if (err instanceof URIError) {
      err.message = `Failed to decode param '${val}'`;
      (err as any).statusCode = 400;
      (err as any).status = 400;
    }

    throw err;
  }
};
class Layer {
  handle: any;

  name: string;

  params: any;

  keys: Array<any>;

  regexp: any;

  path: string | undefined;

  method: any;

  route: any;

  constructor(path: string, options: any = {}, fn: any) {
    myDebug(`new ${path}`);
    this.handle = fn;
    this.name = fn.name || '<anonymous>';
    this.params = undefined;
    this.regexp = pathToRegexp(path, this.keys = [], options);
    this.regexp.fast_star = path === '*';
    this.regexp.fast_slash = path === '/' && options.end === false;
    this.path = undefined;
  }

  handleError(error: Error, req: any, res: any, next: Function) {
    const fn = this.handle;
    if (fn.length !== 4) {
      return next(error);
    }
    try {
      fn(req, res, next);
    } catch (err) {
      next(err);
    }
  }

  handleRequest(req: any, res: any, next: Function) {
    const fn = this.handle;
    if (fn.length > 3) {
      // not a standard request handler
      return next();
    }

    try {
      fn(req, res, next);
    } catch (err) {
      next(err);
    }
  }

  match(path: any) {
    let match: any;
    if (path != null) {
      if (this.regexp.fast_slash) {
        this.params = {};
        this.path = '';
        return true;
      }
      if (this.regexp.fast_star) {
        this.params = { 0: decodeParam(path) };
        this.path = path;
        return true;
      }

      match = this.regexp.exec(path);
    }
    if (!match) {
      this.params = undefined;
      this.path = undefined;
      return false;
    }

    // store values
    this.params = {};
    [this.path] = match;

    const { keys } = this;
    const { params } = this;

    for (let i = 1; i < match.length; i++) {
      const key: any = keys[i - 1];
      const prop = key.name;
      const val = decodeParam(match[i]);

      if (val !== undefined || !(hasOwnProperty.call(params, prop))) {
        params[prop] = val;
      }
    }

    return true;
  }
}
export default Layer;
