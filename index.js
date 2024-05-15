const express = require('express')
const app = express()
const cors = require('cors')
var jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser')
const dotenv = require("dotenv").config();
const port = process.env.PORT || 5000;

// middleware
app.use(cors({
  origin: ['http://localhost:5173',
    'http://localhost:4173',
    'https://magenta-selkie-5b3812.netlify.app',
    'https://6644d81d232fe42a3ff37653--magenta-selkie-5b3812.netlify.app',
    'https://online-group-study-70c2a.web.app',
    'https://online-group-study-70c2a.firebaseapp.com'
  ],
  credentials: true
}

))
app.use(express.json())
app.use(cookieParser())




const { MongoClient, ServerApiVersion, ObjectId, Db } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.jhmpwvf.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});


// auth middle ware
const logger = (req, res, next) => {
  console.log('called', req.hostname, req.originalUrl);
  next()
}
const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).send({ message: 'Unauthorized' })
  }
  try {
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '7d' }, (err, decoded) => {
      if (err) {
        return res.status(401).send({ message: 'Unauthorized' });
      }
      console.log('value in the token', decoded);
      req.user = decoded;
      next();
    });
  } catch (err) {
    console.error('Error verifying token:', err);
    return res.status(401).send({ message: 'Unauthorized' });
  }

}


// const verifyToken = async (req, res, next) => {
//   const token = req.cookies?.token;
//   if (!token) {
//     return res.status(401).send({ message: 'Not authorized' })
//   }
//   jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
//     // error
//     if (err) {
//       console.log('error,', err);
//       return res.status(401).send({ message: 'Not authorized' })
//     }
//     console.log('value in the token ', decoded);
//     req.user = decoded
//     next()
//   })
// }

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production' ? true : false,
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict'
  // httpOnly: true,
  // secure: false,
  // sameSite: 'strict'
}

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    const assignmentCollection = client.db("onlineGroupStudy").collection("assignments")
    const featuresCollection = client.db("onlineGroupStudy").collection("features")
    const TakenAssignmentCollection = client.db("onlineGroupStudy").collection("TakenAssignmentCollection")


    // auth related api 
    app.post('/jwt', logger, async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, (process.env.ACCESS_TOKEN_SECRET), { expiresIn: '12h' })
      res.cookie('token', token, cookieOptions).send({ success: true })
    })

    app.post('/jwt', async (req, res) => {
      const user = req.body;
      console.log('logging out user', user);
      res.clearCookie('token', { ...cookieOptions, maxAge: 0 }).send({ success: true })
    })

    // read all added assignments 
    app.get('/assignments', logger, async (req, res) => {
      const page = parseInt(req.query.page);
      const size = parseInt(req.query.size);
      // const difficultyLevel = req.query.difficultyLevel;
      console.log(page, size);
      const cursor = assignmentCollection.find();
      const count = await assignmentCollection.estimatedDocumentCount()
      const result = await cursor
        .skip(page * size)
        .limit(size)
        .toArray()
      res.send({ result, count })
    })

    // read data based on difficulty level
    app.get('/assignments/difficulty_level', async (req, res) => {
      const difficultyLevel = req.query.difficultyLevel;
      const query = { difficultyLevel: difficultyLevel }
      const cursor = assignmentCollection.find(query);
      const result = await cursor.toArray()
      res.send(result)
    })

    // read assignment based on status pending
    app.get('/assignment_status_pending', async (req, res) => {
      const status = 'pending'
      const query = { status: status }
      const cursor = TakenAssignmentCollection.find(query);
      const result = await cursor.toArray()
      res.send(result)
    })
    // read all assignment status
    app.get('/my_assignment/:email', async (req, res) => {
      const email = req.params.email;
      // const user = req.user.email; 
      // console.log('email' ,email);
      // console.log('user', user);
      // let query = {}
      // if(email === user){
      //    query = { email: email }
      // }
      const query = { email: email }
      const cursor = TakenAssignmentCollection.find(query);
      const result = await cursor.toArray();
      res.send(result)
    })

    // read assignment based on id
    app.get('/assignment_update/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await assignmentCollection.findOne(query)
      res.send(result)
    })
    app.get('/assignment_details/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await assignmentCollection.findOne(query)
      res.send(result)
    })


    app.get('/features', async (req, res) => {
      const cursor = featuresCollection.find();
      const result = await cursor.toArray()
      res.send(result)
    })



    // delete assignment
    app.delete('/assignment_delete/:id', logger, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await assignmentCollection.deleteOne(query)
      res.send(result)
    })

    // update assignment
    app.patch('/assignment_update/:id', async (req, res) => {
      const id = req.params.id;
      const assignment = req.body;
      // console.log(id, assignment);
      const filter = { _id: new ObjectId(id) }
      const options = { upsert: true };
      const updatedAssignment = {
        $set: {
          fullName: assignment.fullName,
          email: assignment.email,
          title: assignment.title,
          difficultyLevel: assignment.difficultyLevel,
          marks: assignment.marks,
          imageUrl: assignment.imageUrl,
          date: assignment.date,
          description: assignment.description
        }
      }
      const result = await assignmentCollection.updateOne(filter, updatedAssignment, options)
      res.send(result)
    })

    // update status and marks
    app.patch('/assignment_status/:id', async (req, res) => {
      const id = req.params.id;
      const UpdateByExaminer = req.body;
      const filter = { _id: new ObjectId(id) }
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          obtainedMarks: UpdateByExaminer.obtainedMarks,
          examinerFeedback: UpdateByExaminer.examinerFeedback,
          status: UpdateByExaminer.statusComplete
        }
      }
      const result = await TakenAssignmentCollection.updateOne(filter, updatedDoc, options)
      res.send(result)
    })


    // created assignments post here
    app.post('/assignments', async (req, res) => {
      const assignment = req.body;
      const result = await assignmentCollection.insertOne(assignment)
      res.send(result)
    })

    // taken assignment 

    app.post('/assignments_taken', async (req, res) => {
      const TakenAssignment = req.body;
      // console.log(TakenAssignment);
      const result = await TakenAssignmentCollection.insertOne(TakenAssignment)
      res.send(result)
    })

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('online group study server')
})

app.listen(port, () => {
  console.log(`online group study server on port:  ${port}`)
})