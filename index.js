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
    if (!origin) return callback(null, true);
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

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

let booksCollection = null;
let quotesCollection = null;

async function connectDB() {
  try {
    await client.connect();
    const db = client.db('booksDB'); // same database
    booksCollection = db.collection('books');
    quotesCollection = db.collection('quotes'); // NEW collection
    await client.db('admin').command({ ping: 1 });
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error && (error.stack || error.message || error));
    throw error;
  }
}

// Health check
app.get('/health', async (req, res) => {
  try {
    if (!booksCollection || !quotesCollection) await connectDB();
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

/////////////////////
// BOOKS (existing)
/////////////////////

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
    const updateData = req.body;

    const book = await booksCollection.findOne({ _id: new ObjectId(id) });
    if (!book) return res.status(404).send({ message: 'Book not found' });

    // ✅ Handle Ratings
    if (updateData.ratingUpdate) {
      const { userId, rating } = updateData.ratingUpdate;
      const currentRatings = Array.isArray(book.ratings) ? book.ratings : [];

      const existingIndex = currentRatings.findIndex((r) => r.userId === userId);
      if (existingIndex >= 0) {
        currentRatings[existingIndex].rating = rating;
      } else {
        currentRatings.push({ userId, rating });
      }

      const avgRating =
        currentRatings.reduce((sum, r) => sum + r.rating, 0) / currentRatings.length;

      await booksCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            ratings: currentRatings,
            rating: avgRating.toFixed(1),
          },
        }
      );

      return res.send({
        message: "✅ Rating updated successfully",
        avgRating,
      });
    }

    // Normal update for likes/comments
    const result = await booksCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    res.send({ message: "✅ Book updated successfully", result });
  } catch (err) {
    console.error('❌ PUT /books/:id error:', err);
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

/////////////////////
// QUOTES (NEW)
/////////////////////

// Get all quotes, optional category filter
app.get('/quotes', async (req, res) => {
  try {
    if (!quotesCollection) throw new Error('DB not connected');
    const { category } = req.query;
    let query = {};
    if (category) query.category = category;

    const result = await quotesCollection.find(query).sort({ createdAt: -1 }).toArray();
    res.send(Array.isArray(result) ? result : []);
  } catch (err) {
    console.error('❌ GET /quotes error:', err);
    res.status(500).send({ message: 'Server error', error: String(err.message || err) });
  }
});

// Add a new quote
app.post('/quotes', async (req, res) => {
  try {
    if (!quotesCollection) throw new Error('DB not connected');
    const { text, author, category } = req.body;
    if (!text || !author || !category) {
      return res.status(400).send({ message: 'Text, author, and category are required' });
    }

    const newQuote = {
      text,
      author,
      category,
      likes: [],
      createdAt: new Date()
    };

    const result = await quotesCollection.insertOne(newQuote);
    res.send(result);
  } catch (err) {
    console.error('❌ POST /quotes error:', err);
    res.status(500).send({ message: 'Error adding quote', error: String(err.message || err) });
  }
});

// Like / Unlike a quote
app.put('/quotes/:id/like', async (req, res) => {
  try {
    if (!quotesCollection) throw new Error('DB not connected');
    const { userId } = req.body;
    if (!userId) return res.status(400).send({ message: 'userId is required' });

    const quote = await quotesCollection.findOne({ _id: new ObjectId(req.params.id) });
    if (!quote) return res.status(404).send({ message: 'Quote not found' });

    let updatedLikes = Array.isArray(quote.likes) ? [...quote.likes] : [];
    if (updatedLikes.includes(userId)) {
      // unlike
      updatedLikes = updatedLikes.filter(id => id !== userId);
    } else {
      // like
      updatedLikes.push(userId);
    }

    await quotesCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { likes: updatedLikes } }
    );

    res.send({ message: '✅ Like updated', likesCount: updatedLikes.length });
  } catch (err) {
    console.error('❌ PUT /quotes/:id/like error:', err);
    res.status(500).send({ message: 'Error updating like', error: String(err.message || err) });
  }
});

// Delete a quote (optional)
app.delete('/quotes/:id', async (req, res) => {
  try {
    if (!quotesCollection) throw new Error('DB not connected');
    const id = req.params.id;
    const result = await quotesCollection.deleteOne({ _id: new ObjectId(id) });
    res.send(result);
  } catch (err) {
    console.error('❌ DELETE /quotes/:id error:', err);
    res.status(500).send({ message: 'Error deleting quote', error: String(err.message || err) });
  }
});

/////////////////////
// START SERVER
/////////////////////
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
