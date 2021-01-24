import App from './application';

const createApplication = (config?:{caseSensitiveRouting?: boolean, strictRouting?:boolean}) => {
  const app = new App(config || {});
  return app;
};

export default createApplication;
