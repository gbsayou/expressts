import bodyParser from 'body-parser';
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

app.listen(3000, () => {
  console.log('Server started on port 3000.');
});
