import express from './index'

const app = express()

app.get('/', (req:any, res:any) =>{
    console.log(req)
    console.log('laile')
    res.send({
        msg:'hello world'
    })
})

app.listen(3000,() =>{
    console.log('started')
})