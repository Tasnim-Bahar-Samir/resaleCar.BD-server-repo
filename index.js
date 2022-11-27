const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { query } = require("express");

const stripe = require("stripe")(process.env.STRYPE_SECRETE_KEY);

const app = express();

const port = process.env.PORT || 5000;

//midlewares
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.skbfv9j.mongodb.net/?retryWrites=true&w=majority`;
console.log(uri);
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});


//database collections
const userCollection = client.db("resaleDb").collection("users");
const categoryColleciton = client.db("resaleDb").collection("categories");
const productColleciton = client.db("resaleDb").collection("products");
const orderCollection = client.db("resaleDb").collection("orders");
const paymentsCollection = client.db('resaleDb').collection("payments")

//midleware to verify token
const verifyToken = async (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).send({ message: "UnAuthorized User" });
  }
  try {
    jwt.verify(token, process.env.SECRETE_TOKEN, (err, decoded) => {
      if (err) {
        return res.status(403).send({ message: "Invalid User" });
      }
      req.user = decoded;
      next();
    });
  } catch (err) {
    console.log(err.name, err.message);
  }
};

//midleware to verify admin
const verifyAdmin = async (req, res, next) => {
  const { email } = req.user;
  const query = { email: email };
  const user = await userCollection.findOne(query);
  if (user.role !== "admin") {
    return res.send({
      success: false,
      message:  ` You are on ${user.role} mode. Admin is not allowed to do this.`,
    });
  }
  next();
};

const verifySeller = async (req, res, next) => {
  const { email } = req.user;
  const query = { email: email };
  const user = await userCollection.findOne(query);
  if (user.role !== "seller") {
    return res.send({
      success: false,
      message: `Sorry you are not a 'Seller'. You are on ${user.role} mode`,
    });
  }
  next();
};

const verifyBuyer = async (req, res, next) => {
  const { email } = req.user;
  const query = { email: email };
  const user = await userCollection.findOne(query);
  if (user.role !== "buyer") {
    return res.send({
      success: false,
      message: `Sorry you are not a 'Buyer'. You are on ${user.role} mode`
    });
  }
  next();
};

async function run() {
  try {
    // category collection
    app.get("/categories", async (req, res) => {
      const result = await categoryColleciton.find({}).toArray();
      res.send({
        success: true,
        data: result,
      });
    });

    //product collection
    app.get("/category/:name", async (req, res) => {
      const { name } = req.params;
      const query = { category: name };
      const result = await productColleciton.find(query).toArray();
      res.send({
        success: true,
        data: result,
      });
    });

    app.get("/myProducts", async (req, res) => {
      const { email } = req.query;
      const query = { email: email };
      const result = await productColleciton.find(query).toArray();
      res.send({
        success: true,
        data: result,
      });
    });

    app.get("/Products/advertised", async (req, res) => {
      const query = { advertised: true };
      const result = await productColleciton.find(query).toArray();
      res.send({
        success: true,
        data: result,
      });
    });

    app.get("/product/reported", async (req, res) => {
      const query = {};
      const products = await productColleciton.find(query).toArray();
      const reportedProducts = products.filter((product) => product.reported);
      res.send({
        success: true,
        data: reportedProducts,
      });
    });

    app.post("/products",verifyToken, verifySeller, async (req, res) => {
      const product = req.body;
      const result = await productColleciton.insertOne(product);
      if (result.insertedId) {
        res.send({
          success: true,
          message: "Product Submited Successfully",
        });
      } else {
        res.send({
          success: false,
          message: "Only Seller can add a product",
        });
      }
    });

    app.put("/product/advertise/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      const query = { _id: ObjectId(id) };
      const alreadyAdvertised = await productColleciton.findOne(query);
      if (alreadyAdvertised.advertised) {
        return res.send({
          success: false,
          message: "This product is already advertised!",
        });
      }
      const options = { upsert: true };
      const result = await productColleciton.updateOne(
        query,
        { $set: { advertised: true } },
        options
      );
      if (result.modifiedCount) {
        res.send({
          success: true,
          message: "This product is advertised now",
        });
      }
    });

    app.put("/product/report/:id", async (req, res) => {
      const data = req.body;
      const { id } = req.params;
      const query = { _id: ObjectId(id) };
      const prevReported = await productColleciton.findOne(query);
      if (prevReported.reported) {
        return res.send({
          success: false,
          message: "You have already reported this item.Wait for the response",
        });
      }
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          reported: data,
        },
      };
      const result = await productColleciton.updateOne(
        query,
        updatedDoc,
        options
      );
      if (result.modifiedCount) {
        res.send({
          success: true,
          message: "Report submitted",
        });
      }
    });

    app.delete("/product/:id", async (req, res) => {
      const { id } = req.params;
      const query = { _id: ObjectId(id) };
      const result = await productColleciton.deleteOne(query);

      if (result.deletedCount) {
        res.send({
          success: true,
          message: `Successfuly deleted the product`,
        });
      }
    });

    app.get("/jwt", async (req, res) => {
      const { email } = req.query;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      if (user) {
        const token = jwt.sign({ email }, process.env.SECRETE_TOKEN);
        res.send({
          success: true,
          token: token,
        });
      } else {
        res.send({
          success: false,
          message: "failed to generate token",
        });
      }
    });

    //user collection

    app.get("/users/seller", async (req, res) => {
      const query = { role: "seller" };
      const result = await userCollection.find(query).toArray();
      res.send({
        success: true,
        data: result,
      });
    });
    app.get("/users/buyer", async (req, res) => {
      const query = { role: "buyer" };
      const result = await userCollection.find(query).toArray();
      res.send({
        success: true,
        data: result,
      });
    });

    app.put(
      "/user/verified/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const { id } = req.params;
        const query = { _id: ObjectId(id) };
        const result = await userCollection.updateOne(
          query,
          { $set: { status: 'verified' } }
        );
        console.log(result)
        if (result.modifiedCount) {
          res.send({
            success: true,
            message: "Successfully verified the user",
          });
        }else{
          res.send({
            success: false,
            message:"failed to update"
          })
        }
      }
    );

    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await userCollection.insertOne(user);

      if (result.insertedId) {
        res.send({
          success: true,
          message: "User save to Db",
        });
      } else {
        res.send({
          success: false,
          message: "Failed to send",
        });
      }
    });

    app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      const { id } = req.params;
      const query = { _id: ObjectId(id) };
      const result = await userCollection.deleteOne(query);

      if (result.deletedCount) {
        res.send({
          success: true,
          message: `Successfuly deleted the ${result.mode}`,
        });
      }
    });

//getting user role
    app.get('/users/admin/:email', async(req,res)=>{
      const {email} = req.params
      const query = {email}
      const user = await userCollection.findOne(query);
      if(user.role === 'admin'){
       return res.send({
          admin:true,
        })
      }
      if(user.role === "seller"){
        return res.send({
          seller: true,
        })
      }
      if(user.role === 'buyer'){
        return res.send({
          buyer: true
        })
      }
  })

    //order collections

    app.get("/orders", async (req, res) => {
      const { email } = req.query;
      const query = { buyerEmail: email };
      const result = await orderCollection.find(query).toArray();
      res.send({
        success: true,
        data: result,
      });
    });

    app.get("/orders/:id", async (req, res) => {
      const { id } = req.params;
      const query = { _id: ObjectId(id) };
      const result = await orderCollection.findOne(query);
      res.send({
        success: true,
        data: result,
      });
    });

    app.post("/orders",verifyToken, verifyBuyer, async (req, res) => {
      const data = req.body;
      const query = { buyerEmail: data.buyerEmail };
      const alreadyAdded = await orderCollection.find(query).toArray();
      if (alreadyAdded.length) {
        return res.send({
          success: false,
          message: "You have already ordered this one.Check your order page.",
        });
      }
      const result = await orderCollection.insertOne(data);
      if (result.insertedId) {
        res.send({
          success: true,
          message: "Your order on proceed go to my-orders route to pay",
        });
      } else {
        res.send({
          success: false,
          message: "Only buyer can a proceed order.",
        });
      }
    });

    //payment api
    app.post("/create-payment-intent", async (req, res) => {
      const data = req.body;
      const price = data.price;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "BDT",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.post('/payments',async(req,res)=>{
        const paymentData = req.body;
        const result = await paymentsCollection.insertOne(paymentData);
        const id = paymentData.orderId;
        const query = {_id: ObjectId(id)}
        const updatedDoc = {
            $set :{
                paid: true,
                transactionId: paymentData.transactionId
            }
        }
        const updateOrder = await orderCollection.updateOne(query,updatedDoc)
        
        const productQuery = {_id : paymentData.productId}

        const updateProduct = await productColleciton.updateOne(productQuery,{$set:{status:'sold'}})
        if(result.insertedId){
            res.send({
                success: true,
                message:"Inserted successfully"
            })
        }
    })

  } catch (err) {
    console.log(err.name, err.message);
  }
}

run();

app.get("/", (req, res) => {
  res.send("server is running");
});

app.listen(port, () => {
  console.log("server is running on port", port);
});
