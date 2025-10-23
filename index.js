// server.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 5000;

// Allowed origins for CORS
const allowedOrigins = [
  'http://localhost:5173',
  'https://amargolpo.vercel.app'
];

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // allow Postman, etc.
    if (allowedOrigins.includes(origin)) return callback(null, true);
    const msg = `❌ CORS blocked for origin: ${origin}`;
    console.error(msg);
    return callback(new Error(msg), false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true
}));
app.use(express.json());

// MongoDB connection
const DB_USER = process.env.DB_USER || '';
const DB_PASS = process.env.DB_PASS || '';
const uri = `mongodb+srv://${DB_USER}:${DB_PASS}@cluster0.0coytx6.mongodb.net/?retryWrites=true&w=majority&appName=AmarGolpo`;

// Diagnostic log
console.log('Mongo URI user:', DB_USER);
console.log('Mongo password length:', DB_PASS ? DB_PASS.length : 0);

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

let booksCollection = null;

async function connectDB() {
  try {
    await client.connect();
    const db = client.db('booksDB'); // keep same database
    booksCollection = db.collection('books'); // keep same collection
    await client.db('admin').command({ ping: 1 });
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error && (error.stack || error.message || error));
    throw error;
  }
}

// Health check route
app.get('/health', async (req, res) => {
  try {
    if (!booksCollection) await connectDB();
    await client.db('admin').command({ ping: 1 });
    res.json({ ok: true, message: '✅ Server & DB connected' });
  } catch (err) {
    console.error('❌ Health check failed:', err && (err.stack || err.message || err));
    res.status(500).json({ ok: false, message: 'DB not connected', error: String(err.message || err) });
  }
});

app.get('/', (req, res) => {
  res.send('AmarGolpo server is running ✅');
});

// CRUD endpoints for books (stories)
app.get('/books', async (req, res) => {
  try {
    if (!booksCollection) throw new Error('DB not connected');
    const result = await booksCollection.find().toArray();
    res.send(Array.isArray(result) ? result : []);
  } catch (err) {
    console.error('❌ GET /books error:', err && (err.stack || err.message || err));
    res.status(500).send({ message: 'Server error', error: String(err.message || err) });
  }
});

app.get('/books/:id', async (req, res) => {
  try {
    if (!booksCollection) throw new Error('DB not connected');
    const id = req.params.id;
    const result = await booksCollection.findOne({ _id: new ObjectId(id) });
    res.send(result || {});
  } catch (err) {
    console.error('❌ GET /books/:id error:', err && (err.stack || err.message || err));
    res.status(500).send({});
  }
});

app.post('/books', async (req, res) => {
  try {
    if (!booksCollection) throw new Error('DB not connected');
    const newBook = req.body;
    const result = await booksCollection.insertOne(newBook);
    res.send(result);
  } catch (err) {
    console.error('❌ POST /books error:', err && (err.stack || err.message || err));
    res.status(500).send({ message: 'Error adding book', error: String(err.message || err) });
  }
});

app.put('/books/:id', async (req, res) => {
  try {
    if (!booksCollection) throw new Error('DB not connected');
    const id = req.params.id;
    const updatedBook = req.body;
    const result = await booksCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updatedBook }
    );
    res.send(result);
  } catch (err) {
    console.error('❌ PUT /books/:id error:', err && (err.stack || err.message || err));
    res.status(500).send({ message: 'Error updating book', error: String(err.message || err) });
  }
});

app.delete('/books/:id', async (req, res) => {
  try {
    if (!booksCollection) throw new Error('DB not connected');
    const id = req.params.id;
    const result = await booksCollection.deleteOne({ _id: new ObjectId(id) });
    res.send(result);
  } catch (err) {
    console.error('❌ DELETE /books/:id error:', err && (err.stack || err.message || err));
    res.status(500).send({ message: 'Error deleting book', error: String(err.message || err) });
  }
});

// Connect DB first, then start server
connectDB()
  .then(() => {
    app.listen(port, () => {
      console.log(`✅ AmarGolpo Server is running on port ${port}`);
    });
  })
  .catch(err => {
    console.error('❌ Server startup aborted due to DB connection error:', err && (err.stack || err.message || err));
    process.exit(1);
  });
