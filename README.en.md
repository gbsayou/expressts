# ExpressTS
------

```js
import express from '.';
import Request from './lib/request';
import Response from './lib/response';

const app = express();
app.get('/', (req:Request, res:Response) => {
  res.send('Hello World!');
});

app.listen(3000, () => {
  console.log('Server started on port 3000.');
});

```

## Introduction
----
ExpressTs is a light weighted web framework inspried by [Express](https://expressjs.com/). It provides most functions like Express:

  * HTTP helpers (http methods, redirection, etc)
  * Robust routing
  * middleware

Because it mainly focuses on API framework functions, it doesn't support template engines.

## Why It Exists?
----

[Express](https://expressjs.com/) is one of the most popular Node.js web frameworks. Almost every Node beginner knows this framework. It's easy, you can run a Api Server with just a few code. It's also flexible and powerful, it provides various functions required by a framework, many companies choose Express as their back-end framework.

As a developer, I like Express very much. Every time I need a Api Server, Express is my best choice.

With using Express, I was curious that how Express, or a web framework, works, how does it implement functions written by developers, how does it handle request, and how does it return results.

I searched for related articles about Express Principle. There are indeed some articles that take out Express source code snippets to introduce some of its core functions like middleware. I don't think it's enough to learn about Express. 

So I began to read its [source code](https://github.com/expressjs/express).

In the beginning, I found it hard to read these code. It was mainly written more than five years ago. The version of ES at that time should be relatively low. Compared with the ES6, there are many differences in function, grammar, writing, and even format.

After I read most of the code, I wanted to re-write this framework.

I choosed TypeScript for its static typing, and it's easier to read TS than JS.

## To Do
----

 * Unit Tests
 * remove most 'any' in the code