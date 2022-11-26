const express = require('express')
const cors = require('cors')
const jwt = require('jsonwebtoken')
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { query } = require('express');

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
const orderCollection = client.db('resaleDb').collection('orders');

//midleware to verify token
const verifyToken = async(req,res,next)=>{
    const token = req.headers.authorization;
    if(!token){
        return res.status(401).send({message:'UnAuthorized User'})
    }
    try{
     jwt.verify(token,process.env.SECRETE_TOKEN,(err,decoded)=>{
        if(err){
           return res.status(403).send({message:"Invalid User"})
        }
        req.user = decoded;
        next()
     })
    }catch(err){
        console.log(err.name,err.message)
    }
}

//midleware to verify admin 
const verifyAdmin = async(req,res,next)=>{
    const {email} = req.user;
    const query = {email:email}
    const user = await userCollection.findOne(query);
    if(user.role !== 'admin'){
        return res.send({
            success:false,
            message:"Invalid User"
        })
    }
    next()
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

        app.get('/myProducts', async(req,res)=>{
            const {email} = req.query;
            const query = {email:email}
            const result = await productColleciton.find(query).toArray();
            res.send({
                success:true,
                data:result
            })
        })

        app.get('/Products/advertised', async(req,res)=>{
            const query = {advertised:true};
            const result = await productColleciton.find(query).toArray();
            res.send({
                success:true,
                data:result
            })
        })

        app.get('/product/reported', async(req,res)=>{
            const query = {}
            const products = await productColleciton.find(query).toArray();
            const reportedProducts = products.filter(product => product.reported)
            res.send({
                success:true,
                data: reportedProducts
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

        app.put('/product/advertise/:id', async(req,res)=>{
            const {id} = req.params;
            const query = {_id: ObjectId(id)}
            const alreadyAdvertised = await productColleciton.findOne(query);
            if(alreadyAdvertised.advertised){
               return res.send({
                    success:false,
                    message: 'This product is already advertised!'
                })
            }
            const options = {upsert: true}
            const result = await productColleciton.updateOne(query,{$set:{advertised:true}},options)
            if(result.modifiedCount){
                res.send({
                    success:true,
                    message: "This product is advertised now"
                })
            }
        })

        app.put('/product/report/:id', async(req,res)=>{
            const data = req.body;
            const {id} = req.params;
            const query = {_id: ObjectId(id)}
            const prevReported = await productColleciton.findOne(query);
            if(prevReported.reported){
               return res.send({
                    success:false,
                    message: 'You have already reported this item.Wait for the response'
                })
            }
            const options = {upsert: true}
            const updatedDoc = {
                $set:{
                    reported : data
                }
            }
            const result = await productColleciton.updateOne(query,updatedDoc,options)
            if(result.modifiedCount){
                res.send({
                    success:true,
                    message: "Report submitted"
                })
            }
        })

        app.delete('/product/:id', verifyToken,verifyAdmin, async(req,res)=>{
            const {id} = req.params;
            const query = {_id: ObjectId(id)}
            const result = await productColleciton.deleteOne(query);

            if(result.deletedCount){
                res.send({
                    success:true,
                    message:`Successfuly deleted the product`
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

        app.put('/user/verified/:id',verifyToken, verifyAdmin,async(req,res)=>{
            const {id} = req.params;
            query = {_id: ObjectId(id)}
            const options = {upsert:true}
            const result = await orderCollection.updateOne(query,{$set:{status:verified}},options)
            if(result.modifiedCount){
                res.send({
                    success:true,
                    message:"Successfully verified the user"
                })
            }
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

        app.delete('/users/:id', verifyToken,verifyAdmin, async(req,res)=>{
            const {id} = req.params;
            const query = {_id: ObjectId(id)}
            const result = await userCollection.deleteOne(query);

            if(result.deletedCount){
                res.send({
                    success:true,
                    message:`Successfuly deleted the ${result.mode}`
                })
            }
        })

        //order collections

        app.get('/orders', async(req,res)=>{
            const {email} = req.query;
            const query = {buyerEmail:email};
            const result = await orderCollection.find(query).toArray()
            res.send({
                success:true,
                data:result
            })
        })

        app.post('/orders', async(req,res)=> {
            const data = req.body;
            const query = {email:data.email};
            const alreadyAdded = await orderCollection.find(query).toArray();
            if(alreadyAdded.length){
                return res.send({
                    success:false,
                    message: "You have already ordered this one.Check your order page."
                })
            }
            const result = await orderCollection.insertOne(data);
            if(result.insertedId){
                res.send({
                    success:true,
                    message:"Your order on proceed go to my-orders route to pay"
                })
            }else{
                    res.send({
                        success:false,
                        message:"Failed to proceed order."
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