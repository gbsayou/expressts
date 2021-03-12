import onFinished from 'on-finished';
import { SendStream } from 'send';
import ExpressError from '../types/ExpressError';
import Res from '../response';

class Send {
  res:Res ;

  done:boolean;

  streaming: boolean;

  callback: Function;

  constructor(res:Res, callback:Function) {
    this.done = false;
    this.res = res;
    this.callback = callback;
    this.streaming = false;
  }

  onAborted() {
    if (this.done) {
      return;
    }
    this.done = true;

    const err = new ExpressError('Request aborted');
    err.code = 'ECONNABORTED';
    this.callback(err);
  }

  onDirectory() {
    if (this.done) {
      return;
    }
    this.done = true;

    const err = new ExpressError('EISDIR, read');
    err.code = 'EISDIR';
    this.callback(err);
  }

  onError(err:Error) {
    if (this.done) {
      return;
    }
    this.done = true;
    this.callback(err);
  }

  onEnd() {
    if (this.done) {
      return;
    }
    this.done = true;
    this.callback();
  }

  onFile() {
    this.streaming = false;
  }

  onFinish(err: NodeJS.ErrnoException | null) {
    if (err && err.code === 'ECONNRESET') return this.onAborted();
    if (err) return this.onError(err);
    if (this.done) return;

    setImmediate(() => {
      if (this.streaming && !this.done) {
        this.onAborted();
        return;
      }

      if (this.done) return;
      this.done = true;
      this.callback();
    });
  }

  onStream() {
    this.streaming = true;
  }

  send(file:SendStream) {
    file.on('directory', () => { this.onDirectory(); });
    file.on('end', () => { this.onEnd(); });
    file.on('error', (err:NodeJS.ErrnoException) => { this.onError(err); });
    file.on('file', () => { this.onFile(); });
    file.on('stream', () => { this.onStream(); });
    onFinished(this.res, (err:NodeJS.ErrnoException|null) => { this.onFinish(err); });
    // pipe
    file.pipe(this.res);
  }
}

export default Send;
