const express = require('express')
const cors = require('cors')
const jwt = require('jsonwebtoken')
require('dotenv').config()
const { MongoClient, ServerApiVersion } = require('mongodb');

const app = express()

const port = process.env.PORT || 5000;

//midlewares
app.use(cors())
app.use(express.json())




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.skbfv9j.mongodb.net/?retryWrites=true&w=majority`;
console.log(uri)
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


const userCollection = client.db('resaleDb').collection('users');
const categoryColleciton = client.db('resaleDb').collection('categories');
const productColleciton = client.db('resaleDb').collection('products');


const verifyToken = async(req,res,next)=>{
    const token = req.headers.authorization;
    if(!token){
        return res.status(401).send({message:'UnAuthorized User'})
    }
    try{
     jwt.verify(token,process.env.SECRETE_TOKEN,(err,decoded)=>{
        if(err){
           return res.send({message:"Invalid User"})
        }
        req.user = decoded;
        next()
     })
    }catch(err){
        console.log(err.name,err.message)
    }
}

async function run(){
    try{
        // category collection
        app.get('/categories', async(req,res)=>{

            const result = await categoryColleciton.find({}).toArray();
            res.send({
                success:true,
                data: result
            })
        })

        

        //product collection
        app.get('/category/:name', async(req,res)=>{
            const {name} = req.params;
            const query = {category:name};
            const result = await productColleciton.find(query).toArray()
            res.send({
                success:true,
                data:result
            })
        })
        app.post('/products', async(req,res)=>{
            const product = req.body;
            const result = await productColleciton.insertOne(product)
            if(result.insertedId){
                res.send({
                    success:true,
                    message:"Product Submited Successfully"
                })
            }else{
                res.send({
                    success:true,
                    message:"Failed to submit"
                })
            }
        })

        app.get('/jwt', async(req,res)=>{
            const {email} = req.query;
            const query = {email:email}
            const user = await userCollection.findOne(query)
            if(user){
                const token = jwt.sign({email},process.env.SECRETE_TOKEN)
                res.send({
                    success:true,
                    token:token
                })
            }else{
                res.send({
                    success:false,
                    message:"failed to generate token"
                })
            }
        })

        
        //user collection

        app.get('/users/seller', async(req,res) => {
            const query = {mode:'seller'}
            const result = await userCollection.find(query).toArray();
            res.send({
                success:true,
                data:result
            })
        })
        app.get('/users/buyer', async(req,res) => {
            const query = {mode:'buyer'}
            const result = await userCollection.find(query).toArray();
            res.send({
                success:true,
                data:result
            })
        })
        app.post('/users', async(req,res)=>{
            const user = req.body;
            const result = await userCollection.insertOne(user)

            if(result.insertedId){
                res.send({
                    success:true,
                    message:"User save to Db"
                })
            }else{
                res.send({
                    success:false,
                    message:"Failed to send"
                })
            }
        })
    }
    catch(err){
        console.log(err.name,err.message)
    }
}

run()

app.get('/',(req,res) => {
    res.send('server is running')
})


app.listen(port,()=>{
    console.log('server is running on port',port)
})