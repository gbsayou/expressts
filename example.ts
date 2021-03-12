import bodyParser from 'body-parser';
import send from 'send';
import path from 'path';
import express from '.';
import Request from './lib/request';
import Response from './lib/response';

const app = express();
app.use(bodyParser.json());

app.get('/health', (req:Request, res:Response) => {
  res.send('The server is running');
});

app.get('/', (req:Request, res:Response) => {
  res.send('Hello World!');
});

app.post('/', (req:Request, res:Response) => {
  res.send({
    method: 'POST',
    body: req.body,
  });
});

app.put('/', (req:Request, res:Response) => {
  res.send('Hello, you have sent a PUT request');
});

app.delete('/', (req:Request, res:Response) => {
  res.send('Hello, you have sent a DELETE request');
});

app.get('/file', (req:Request, res:Response, next: Function) => {
  const options:send.SendOptions = {
    root: path.join(__dirname, 'public'),
    dotfiles: 'deny',
  };
  const done = (err:NodeJS.ErrnoException) => {
    if (err) {
      next(err);
    } else {
      console.log('Sent:', '1.txt');
    }
  };
  res.sendFile('./1.txt', options, done);
});
app.listen(3000, () => {
  console.log('Server started on port 3000.');
});
