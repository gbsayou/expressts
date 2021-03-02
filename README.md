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

[For English](https://github.com/gbsayou/expressts/blob/master/README.en.md)

## 介绍
------

ExpressTS 是改编自 [Express](https://expressjs.com/) 的一个轻量级 Web 框架。实现了 Express 的大部分功能：

 * 处理 Http 请求（http methods, http redirect）
 * 路由
 * 中间件

因为重点关注于 API 框架的领域，所以没有实现对模板引擎的支持。

## 为什么开发此项目
----

[Express](https://expressjs.com/) 是最知名的 Node.js Web 框架。几乎每一个Node的初学者都会接触到这个框架。它十分的简单，只需要几行代码就可以跑起一个Api Server，功能也特别强大，提供了一个完善的框架需要的各种功能，有许多公司都会选择 Express 作为后端框架进行开发。

作为开发者，我十分喜欢 Express，每次都首选 Express 来作为自己项目的 Api Server。

使用久了之后，我开始好奇 Express，或者说一个 Web 框架，是怎么运作的，它是怎么组织起开发者所写的这些方法，怎么处理一个路由，处理 Http 请求，又是怎么返回结果的。

最初，我去搜索相关的文章、资料，看看是否有 “Express 原理” 之类的介绍。有一些文章，会拿出 Express 源码片段来介绍它的一些核心功能，比如中间件的处理。看了许多文章，都是介绍此类的一些内容。我觉得还不够，光看这些文章还是不能全面的了解 Express。

于是我就去读了 [Express 的源码](https://github.com/expressjs/express).

第一次看，是很难受的。Express 的源码，大多数都是五、六年前写的，那时的 ES 的版本应该还比较低，与现在大家所熟悉的 ES6 相比，在功能，语法，写法，甚至格式上，都有很多不同。以现在项目开发中的要求来看这份代码，真觉得写的是十分狂野，时不时感慨“还能这样写？”“怎么这样写？？？”。（这可能部分刚接触到 Node 的人，不信任这门语言的原因之一）但是也不能不佩服，在那时那么简陋的条件下，那些大神仍然写出了这么强大的一个框架。

咬咬牙读了一些源码之后，我开始有了重写这个框架的想法。写一个自己的 Express，并且功能一样，才算是真的了解了 Express。

选择 TypeScript，主要是因为，如果仍以JS去照着源码写的话，估计写出来的跟原项目没有什么差别。相比于JS，TS最显著的优点是静态类型，使用 TS 能大大改善源代码狂野不羁的特点。同时 TS 的可读性更强，初学者如果来看这份代码，可能不会那么难受。

## To Do
----
 * 单元测试
 * 尽量减少代码中的 any
