export default class ExpressError extends Error {
  code: number | string;

  syscall: any;

  constructor(message: string) {
    super(message);
    this.code = '';
  }
}
