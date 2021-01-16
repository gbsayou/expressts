import App from './application'
import Req from './request'
import Res from './request'

const createApplication = () => {
    const app = new App()
    app.init();
    return app;
}

export default createApplication
