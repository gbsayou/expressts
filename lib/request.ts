/* eslint-disable no-case-declarations */
/* eslint-disable import/no-cycle */
import accepts from 'accepts';
import { isIP } from 'net';
import typeis from 'type-is';
import http from 'http';
import fresh from 'fresh';
import parseRange from 'range-parser';
import parse from 'parseurl';
import proxyaddr from 'proxy-addr';
import App from './application';

class Req extends http.IncomingMessage {
  constructor(config: any) {
    super(config);
    const { app } = config;
    this.app = app;
  }

  secret: string | undefined;

  acceptsEncoding: any;

  acceptsCharset: any;

  acceptsLanguage: any;

  params: any;

  body: any;

  query: any;

  connection: any;

  app: App;

  next: Function | undefined;

  public get protocol() {
    const proto = this.connection.encrypted
      ? 'https'
      : 'http';
    const trust = this.app.get('trust proxy fn');

    if (!trust(this.connection.remoteAddress, 0)) {
      return proto;
    }

    // Note: X-Forwarded-Proto is normally only ever a
    //       single value, but this is to be safe.
    const header: any = this.get('X-Forwarded-Proto') || proto;
    const index = header.indexOf(',');

    return index !== -1
      ? header.substring(0, index).trim()
      : header.trim();
  }

  public get secure() {
    return this.protocol === 'https';
  }

  public get ip() {
    const trust = this.app.get('trust proxy fn');
    return proxyaddr(this, trust);
  }

  public get ips() {
    const trust = this.app.get('trust proxy fn');
    const addrs = proxyaddr.all(this, trust);
    // reverse the order (to farthest -> closest)
    // and remove socket address
    addrs.reverse().pop();

    return addrs;
  }

  public get subdomains() {
    const { hostname } = this;
    if (!hostname) return [];

    const offset = this.app.get('subdomain offset');
    const subdomains = !isIP(hostname)
      ? hostname.split('.').reverse()
      : [hostname];

    return subdomains.slice(offset);
  }

  public get path() {
    return parse(this)?.pathname;
  }

  public get hostname() {
    const trust = this.app.get('trust proxy fn');
    let host: any = this.get('X-Forwarded-Host');

    if (!host || !trust(this.connection.remoteAddress, 0)) {
      host = this.get('Host');
    } else if (host.indexOf(',') !== -1) {
      // Note: X-Forwarded-Host is normally only ever a
      //       single value, but this is to be safe.
      host = host.substring(0, host.indexOf(',')).trimRight();
    }

    if (!host) return;

    // IPv6 literal support
    const offset = host[0] === '['
      ? host.indexOf(']') + 1
      : 0;
    const index = host.indexOf(':', offset);

    return index !== -1
      ? host.substring(0, index)
      : host;
  }

  public get fresh() {
    const { method } = this;
    const { response } = this.app;
    const status = response.statusCode;

    // GET or HEAD for weak freshness validation only
    if (method !== 'GET' && method !== 'HEAD') return false;

    // 2xx or 304 as per rfc2616 14.26
    if ((status >= 200 && status < 300) || status === 304) {
      return fresh(this.headers, {
        etag: response.get('ETag'),
        'last-modified': response.get('Last-Modified'),
      });
    }

    return false;
  }

  public get stale() {
    return !this.fresh;
  }

  public get xhr() {
    const val: any = this.get('X-Requested-With') || '';
    return val.toLowerCase() === 'xmlhttprequest';
  }

  get(name: string): string| undefined {
    const lc = name.toLowerCase();

    const { headers } = this;
    switch (lc) {
      case 'referer':
      case 'referrer':
        const referrer = headers.referrer || headers.referer;
        return Array.isArray(referrer) ? referrer[0] : referrer;
      default:
        const result = headers[lc];
        return Array.isArray(result) ? result[0] : result;
    }
  }

  header(name: string) {
    const lc = name.toLowerCase();

    switch (lc) {
      case 'referer':
      case 'referrer':
        return this.headers.referrer
                    || this.headers.referer;
      default:
        return this.headers[lc];
    }
  }

  accepts(types: string[]): any {
    const accept = accepts(this);
    return accept.types(...types);
  }

  acceptsEncodings(...encodings: string[]) {
    const accept = accepts(this);
    return accept.encodings(...encodings);
  }

  acceptsCharsets(...charsets: string[]) {
    const accept = accepts(this);
    return accept.charsets(...charsets);
  }

  acceptsLanguages(...languages: string[]) {
    const accept = accepts(this);
    return accept.languages(...languages);
  }

  range(size: number, options: object): number | Array<any> | void {
    const range: any = this.get('Range');
    if (!range) return;
    return parseRange(size, range, options);
  }

  param(name: string, defaultValue?: any) {
    const params = this.params || {};
    const body = this.body || {};
    const query = this.query || {};

    if (params[name] != null
        && Object.prototype.hasOwnProperty.call(params, name)) return params[name];
    if (body[name] != null) return body[name];
    if (query[name] != null) return query[name];

    return defaultValue;
  }

  is(...types: string[]) {
    return typeis(this, types);
  }
}

export default Req;
