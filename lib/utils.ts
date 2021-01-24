import etag from 'etag';
import querystring from 'querystring';
import qs from 'qs';
import proxyaddr from 'proxy-addr';
import { Buffer } from 'safe-buffer';
import { mime } from 'send';
import contentType from 'content-type';

const createETagGenerator = (options: object) => {
  const generateETag = (body: any, encoding: string) => {
    const buf: any = !Buffer.isBuffer(body)
      ? Buffer.from(body, encoding)
      : body;
    return etag(buf, options);
  };
  return generateETag;
};
const strongTag = createETagGenerator({ weak: true });
const weakTag = createETagGenerator({ weak: false });

const parseExtendedQueryString = (str: string) => qs.parse(str, {
  allowPrototypes: true,
});
export const compileETag = (val: any) => {
  let fn: any;
  if (typeof val === 'function') {
    return val;
  }
  switch (val) {
    case true:
      fn = strongTag;
      break;
    case false:
      break;
    case 'strong':
      fn = weakTag;
      break;
    case 'weak':
      fn = strongTag;
      break;
    default:
      throw new TypeError(`unknown value for etag function: ${val}`);
  }
  return fn;
};

export const compileQueryParser = (val: any) => {
  let fn: any;

  if (typeof val === 'function') {
    return val;
  }

  switch (val) {
    case true:
      fn = querystring.parse;
      break;
    case false:
      fn = {};
      break;
    case 'extended':
      fn = parseExtendedQueryString;
      break;
    case 'simple':
      fn = querystring.parse;
      break;
    default:
      throw new TypeError(`unknown value for query parser function: ${val}`);
  }

  return fn;
};

export const compileTrust = (val: any) => {
  if (typeof val === 'function') return val;

  if (val === true) {
    // Support plain true/false
    return () => true;
  }

  if (typeof val === 'number') {
    // Support trusting hop count
    return (a: any, i: any) => i < val;
  }

  if (typeof val === 'string') {
    // Support comma-separated values
    val = val.split(/ *, */);
  }

  return proxyaddr.compile(val || []);
};

export const isAbsolute = (path: string) => {
  if (path[0] === '/') return true;
  if (path[1] === ':' && (path[2] === '\\' || path[2] === '/')) return true; // Windows device path
  if (path.substring(0, 2) === '\\\\') return true; // Microsoft Azure absolute path
};

const acceptParams = (str: string, index?: number) => {
  const parts = str.split(/ *; */);
  const ret: any = {
    value: parts[0], quality: 1, params: {}, originalIndex: index,
  };

  for (let i = 1; i < parts.length; ++i) {
    const pms = parts[i].split(/ *= */);
    if (pms[0] === 'q') {
      ret.quality = parseFloat(pms[1]);
    } else {
      // eslint-disable-next-line prefer-destructuring
      ret.params[pms[0]] = pms[1];
    }
  }

  return ret;
};
// eslint-disable-next-line no-bitwise
export const normalizeType = (type: any) => (~type.indexOf('/')
  ? acceptParams(type)
  : { value: mime.getType(type), params: {} });
export const normalizeTypes = (types: any) => {
  const ret = [];

  for (let i = 0; i < types.length; ++i) {
    ret.push(exports.normalizeType(types[i]));
  }

  return ret;
};
export const setCharset = (type: any, charset: any) => {
  if (!type || !charset) {
    return type;
  }

  // parse type
  const parsed = contentType.parse(type);

  // set charset
  parsed.parameters.charset = charset;

  // format type
  return contentType.format(parsed);
};
