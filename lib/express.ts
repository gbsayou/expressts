import bodyParser from 'body-parser'
import {EventEmitter} from 'events'
import App from './application'
import Req from './request'
import Res from './request'

const createApplication = () => {
    const app = new App()

    // app.response = new Res('res')
    // app.request = new Req('req')

    app.init();
    return app;
}

export default createApplication