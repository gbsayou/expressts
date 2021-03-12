/* eslint-disable import/no-cycle */
import { Buffer } from 'safe-buffer';
import contentDisposition from 'content-disposition';
import encodeurl from 'encodeurl';

import escapeHtml from 'escape-html';
import http from 'http';
import path from 'path';
import statuses from 'statuses';
import { sign } from 'cookie-signature';
import cookie from 'cookie';
import send from 'send';

import vary from 'vary';
import mime from 'mime';
import {
  isAbsolute, normalizeType, normalizeTypes, setCharset,
} from './utils';

import App from './application';
import Send from './helpers/sendFile';

const { extname } = path;
const { resolve } = path;

const charsetRegExp = /;\s*charset\s*=/;

const stringify = (value: any, replacer: any, spaces: number, escape: boolean): string => {
  // v8 checks arguments.length for optimizing simple call
  // https://bugs.chromium.org/p/v8/issues/detail?id=4730
  let json = replacer || spaces
    ? JSON.stringify(value, replacer, spaces)
    : JSON.stringify(value);

  if (escape) {
    json = json.replace(/[<>&]/g, (c) => {
      switch (c.charCodeAt(0)) {
        case 0x3c:
          return '\\u003c';
        case 0x3e:
          return '\\u003e';
        case 0x26:
          return '\\u0026';
          /* istanbul ignore next: unreachable default */
        default:
          return c;
      }
    });
  }

  return json;
};

class Res extends http.ServerResponse {
  header: any;

  contentType: any;

  app: App;

  locals: Object;

  constructor(config: any) {
    super(config);
    const { app } = config;
    this.app = app;
    this.header = this.set;
    this.contentType = this.type;
    this.locals = Object.create(null);
  }

  status(code: number):Res {
    this.statusCode = code;
    return this;
  }

  links(links: any):Res {
    const link = this.get('Link') ? `${this.get('Link')}, ` : '';
    const rels = Object.keys(links).map((rel) => `<${links[rel]}>; rel="${rel}"`).join(', ');
    return this.set('Link', `$${link}${rels}`);
  }

  send(body: any): any {
    let chunk: any = body;
    let encoding:any;
    const { request } = this.app;
    let type;

    // settings
    const { app } = this;

    // disambiguate res.send(status) and res.send(status, num)
    if (typeof chunk === 'number') {
      // res.send(status) will set status message as text string
      if (!this.get('Content-Type')) {
        this.type('txt');
      }

      // myDeprecate('res.send(status): Use res.sendStatus(status) instead');
      this.statusCode = chunk;
      chunk = (statuses as any)[chunk];
    }

    switch (typeof chunk) {
      // string defaulting to html
      case 'string':
        if (!this.get('Content-Type')) {
          this.type('html');
        }
        break;
      case 'boolean':
      case 'number':
      case 'object':
        if (chunk === null) {
          chunk = '';
        } else if (Buffer.isBuffer(chunk)) {
          if (!this.get('Content-Type')) {
            this.type('bin');
          }
        } else {
          return this.json(chunk);
        }
        break;
      default:
        break;
    }

    // write strings in utf-8
    if (typeof chunk === 'string') {
      encoding = 'utf8';
      type = this.get('Content-Type');

      // reflect this in content-type
      if (typeof type === 'string') {
        this.set('Content-Type', setCharset(type, 'utf-8'));
      }
    }

    // determine if ETag should be generated
    const etagFn = app.get('etag fn');
    const generateETag = !this.get('ETag') && typeof etagFn === 'function';

    // populate Content-Length
    let len;
    if (chunk !== undefined) {
      if (Buffer.isBuffer(chunk)) {
        // get length of Buffer
        len = chunk.length;
      } else if (!generateETag && chunk.length < 1000) {
        // just calculate length when no ETag + small chunk
        len = Buffer.byteLength(chunk, encoding);
      } else {
        // convert chunk to Buffer and calculate
        chunk = Buffer.from(chunk, encoding);
        encoding = undefined;
        len = chunk.length;
      }

      this.set('Content-Length', len);
    }

    // populate ETag
    let etag;
    if (generateETag && len !== undefined) {
      console.log('在这里扯淡呢');
      if ((etag === etagFn(chunk, encoding))) {
        this.set('ETag', etag);
      }
    }

    // freshness
    if (request.fresh) this.statusCode = 304;

    // strip irrelevant headers
    if (this.statusCode === 204 || this.statusCode === 304) {
      this.removeHeader('Content-Type');
      this.removeHeader('Content-Length');
      this.removeHeader('Transfer-Encoding');
      chunk = '';
    }

    if (request.method === 'HEAD') {
      // skip body for HEAD
      this.end();
    } else {
      // respond
      this.end(chunk, encoding);
    }

    return this;
  }

  json(obj: any): any {
    const val = obj;

    // settings
    const { app } = this;
    const escape = app.get('json escape');
    const replacer = app.get('json replacer');
    const spaces = app.get('json spaces');
    const body = stringify(val, replacer, spaces, escape);

    // content-type
    if (!this.get('Content-Type')) {
      this.set('Content-Type', 'application/json');
    }

    return this.send(body);
  }

  jsonp(obj: any): any {
    const val = obj;

    // settings
    const { app } = this;
    const escape = app.get('json escape');
    const replacer = app.get('json replacer');
    const spaces = app.get('json spaces');
    let body = stringify(val, replacer, spaces, escape);
    let callback = this.app.request.query[app.get('jsonp callback name')];

    // content-type
    if (!this.get('Content-Type')) {
      this.set('X-Content-Type-Options', 'nosniff');
      this.set('Content-Type', 'application/json');
    }

    // fixup callback
    if (Array.isArray(callback)) {
      [callback] = callback;
    }

    // jsonp
    if (typeof callback === 'string' && callback.length !== 0) {
      this.set('X-Content-Type-Options', 'nosniff');
      this.set('Content-Type', 'text/javascript');

      // restrict callback charset
      callback = callback.replace(/[^[\]\w$.]/g, '');

      // replace chars not allowed in JavaScript that are in JSON
      body = body
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');

      // the /**/ is a specific security mitigation for "Rosetta Flash JSONP abuse"
      // the typeof check is just to reduce client error noise
      body = `/**/ typeof ${callback} === 'function' && ${callback}(${body});`;
    }

    return this.send(body);
  }

  sendStatus(statusCode: number): any {
    const body = (statuses as any)[statusCode] || String(statusCode);

    this.statusCode = statusCode;
    this.type('txt');

    return this.send(body);
  }

  sendFile(path: string, options: send.SendOptions, done?: Function) {
    const { request } = this.app;
    const { next } = request;

    if (!options.root && !isAbsolute(path)) {
      throw new TypeError('path must be absolute or specify root to res.sendFile');
    }

    // create file stream
    const pathname = encodeURI(path);
    const file = send(request, pathname, options);

    const cb = (err:NodeJS.ErrnoException) => {
      if (done) return done(err);
      if (err && err.code === 'EISDIR' && next) return next();

      // next() all but write errors
      if (err && err.code !== 'ECONNABORTED' && err.syscall !== 'write' && next) {
        next(err);
      }
    };
    const sender = new Send(this, cb);
    sender.send(file);
  }

  download(path: any, filename: any, options: any, callback: any) {
    let done = callback;
    let name = filename;
    let opts = options || null;

    // support function as second or third arg
    if (typeof filename === 'function') {
      done = filename;
      name = null;
      opts = null;
    } else if (typeof options === 'function') {
      done = options;
      opts = null;
    }

    // set Content-Disposition when file is sent
    const headers: any = {
      'Content-Disposition': contentDisposition(name || path),
    };

    // merge user-provided headers
    if (opts && opts.headers) {
      const keys = Object.keys(opts.headers);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        if (key.toLowerCase() !== 'content-disposition') {
          headers[key] = opts.headers[key];
        }
      }
    }

    // merge user-provided options
    opts = Object.create(opts);
    opts.headers = headers;

    // Resolve the full path for sendFile
    const fullPath = resolve(path);

    // send file
    return this.sendFile(fullPath, opts, done);
  }

  type(type: any) {
    const ct = type.indexOf('/') === -1
      ? mime.getType(type)
      : type;

    return this.set('Content-Type', ct);
  }

  format(obj: any) {
    const { request } = this.app;
    const { next } = request;

    const fn = obj.default;
    if (fn) delete obj.default;
    const keys = Object.keys(obj);

    const key = keys.length > 0
      ? request.accepts(keys)
      : false;

    this.vary('Accept');

    if (key) {
      this.set('Content-Type', normalizeType(key).value);
      obj[key](request, this, next);
    } else if (fn) {
      fn();
    } else if (next) {
      const err: any = new Error('Not Acceptable');
      err.statusCode = 406;
      err.status = 406;
      err.types = normalizeTypes(keys).map((o) => o.value);
      next(err);
    }

    return this;
  }

  attachment(filename: string) {
    if (filename) {
      this.type(extname(filename));
    }

    this.set('Content-Disposition', contentDisposition(filename));

    return this;
  }

  append(field: any, val: any) {
    const prev = this.get(field);
    let value = val;

    if (prev) {
      // concat the new and prev vals
      // eslint-disable-next-line no-nested-ternary
      value = Array.isArray(prev) ? prev.concat(val)
        : Array.isArray(val) ? [prev].concat(val)
          : [prev, val];
    }

    return this.set(field, value);
  }

  set(field: any, val: any) {
    if (arguments.length === 2) {
      let value = Array.isArray(val)
        ? val.map(String)
        : String(val);

      // add charset to content-type
      if (field.toLowerCase() === 'content-type') {
        if (Array.isArray(value)) {
          throw new TypeError('Content-Type cannot be set to an Array');
        }
        if (!charsetRegExp.test(value)) {
          const charset = mime.getType(value.split(';')[0]);
          if (charset) value += `; charset=${charset.toLowerCase()}`;
        }
      }

      this.setHeader(field, value);
    } else {
      Object.keys(field).forEach((key) => {
        this.set(key, field[key]);
      });
    }
    return this;
  }

  get(field: any) {
    return this.getHeader(field);
  }

  clearCookie(name: string, options: any) {
    const opts = { expires: new Date(1), path: '/', ...options };

    return this.cookie(name, '', opts);
  }

  cookie(name: string, value: any, options: any) {
    const opts: any = { ...options };
    const { secret } = this.app.request;
    const { signed } = opts;

    if (signed && !secret) {
      throw new Error('cookieParser("secret") required for signed cookies');
    }

    let val = typeof value === 'object'
      ? `j:${JSON.stringify(value)}`
      : String(value);

    if (signed && secret) {
      val = `s:${sign(val, secret)}`;
    }

    if ('maxAge' in opts) {
      opts.expires = new Date(Date.now() + opts.maxAge);
      opts.maxAge /= 1000;
    }

    if (opts.path == null) {
      opts.path = '/';
    }

    this.append('Set-Cookie', cookie.serialize(name, String(val), opts));

    return this;
  }

  /**
   *
   * @param url
   * @returns
   */
  location(url: string) {
    let loc: string = url;
    // "back" is an alias for the referrer
    if (url === 'back') {
      loc = this.app.request.get('Referrer') || '/';
    }
    return this.set('Location', encodeurl(loc));
  }

  redirect(...url: any) {
    let [address] = url;
    let body: any;
    let status = 302;

    // allow status / url
    if (url.length === 2) {
      if (typeof url[0] === 'number') {
        [status, address] = url;
      } else {
        // myDeprecate('res.redirect(url, status): Use res.redirect(status, url) instead');
        [,status] = url;
      }
    }

    // Set location header
    address = this.location(address).get('Location');

    // Support text/{plain,html} by default
    this.format({
      text() {
        body = `${(statuses as any)[status]}. Redirecting to ${address}`;
      },

      html() {
        const u = escapeHtml(address);
        body = `<p>${(statuses as any)[status]}. Redirecting to <a href="${u}">${u}</a></p>`;
      },

      default() {
        body = '';
      },
    });

    // Respond
    this.statusCode = status;
    this.set('Content-Length', Buffer.byteLength(body));

    if (this.app.request.method === 'HEAD') {
      this.end();
    } else {
      this.end(body);
    }
  }

  vary(field: any) {
    // checks for back-compat
    if (!field || (Array.isArray(field) && !field.length)) {
      // myDeprecate('res.vary(): Provide a field name');
      return this;
    }

    vary(this, field);

    return this;
  }
}

export default Res;
