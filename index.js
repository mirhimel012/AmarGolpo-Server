// server.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 5000;

/* ===============================
   MIDDLEWARE (CORS + JSON)
================================ */

// ✅ Universal CORS (Vercel-safe)
app.use(cors({
  origin: true,              // allow all origins dynamically
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ✅ Explicit preflight support
app.options('*', cors());

app.use(express.json());

/* ===============================
   MONGODB CONNECTION
================================ */

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.0coytx6.mongodb.net/?retryWrites=true&w=majority&appName=AmarGolpo`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

let booksCollection;
let quotesCollection;

// ✅ Prevent multiple DB connections (important for serverless)
async function connectDB() {
  if (booksCollection && quotesCollection) return;

  await client.connect();
  const db = client.db('booksDB');

  booksCollection = db.collection('books');
  quotesCollection = db.collection('quotes');

  console.log('✅ MongoDB connected');
}

/* ===============================
   BASIC ROUTES
================================ */

app.get('/', (req, res) => {
  res.send('✅ AmarGolpo server is running');
});

app.get('/health', async (req, res) => {
  try {
    await connectDB();
    res.json({ ok: true, message: 'Server & DB connected' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ===============================
   BOOKS ROUTES
================================ */

// Get all books
app.get('/books', async (req, res) => {
  try {
    await connectDB();
    const books = await booksCollection.find().toArray();
    res.send(books);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

// Get single book
app.get('/books/:id', async (req, res) => {
  try {
    await connectDB();
    const book = await booksCollection.findOne({
      _id: new ObjectId(req.params.id)
    });
    res.send(book || {});
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

// Add book
app.post('/books', async (req, res) => {
  try {
    await connectDB();
    const result = await booksCollection.insertOne(req.body);
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

// Update book (likes, comments, ratings)
app.put('/books/:id', async (req, res) => {
  try {
    await connectDB();
    const id = req.params.id;
    const data = req.body;

    const book = await booksCollection.findOne({ _id: new ObjectId(id) });
    if (!book) return res.status(404).send({ message: 'Book not found' });

    // ⭐ Rating logic
    if (data.ratingUpdate) {
      const { userId, rating } = data.ratingUpdate;
      const ratings = book.ratings || [];

      const index = ratings.findIndex(r => r.userId === userId);
      if (index >= 0) ratings[index].rating = rating;
      else ratings.push({ userId, rating });

      const avgRating =
        ratings.reduce((s, r) => s + r.rating, 0) / ratings.length;

      await booksCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { ratings, rating: avgRating.toFixed(1) } }
      );

      return res.send({ message: 'Rating updated', avgRating });
    }

    // Normal update
    await booksCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: data }
    );

    res.send({ message: 'Book updated' });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

// Delete book
app.delete('/books/:id', async (req, res) => {
  try {
    await connectDB();
    const result = await booksCollection.deleteOne({
      _id: new ObjectId(req.params.id)
    });
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

/* ===============================
   QUOTES ROUTES
================================ */

// Get quotes (optional category)
app.get('/quotes', async (req, res) => {
  try {
    await connectDB();
    const query = req.query.category ? { category: req.query.category } : {};
    const quotes = await quotesCollection
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    res.send(quotes);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

// Add quote
app.post('/quotes', async (req, res) => {
  try {
    await connectDB();
    const { text, author, category } = req.body;

    if (!text || !author || !category) {
      return res.status(400).send({ message: 'All fields required' });
    }

    const quote = {
      text,
      author,
      category,
      likes: [],
      createdAt: new Date()
    };

    const result = await quotesCollection.insertOne(quote);
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

// Like / Unlike quote
app.put('/quotes/:id/like', async (req, res) => {
  try {
    await connectDB();
    const { userId } = req.body;

    const quote = await quotesCollection.findOne({
      _id: new ObjectId(req.params.id)
    });

    if (!quote) return res.status(404).send({ message: 'Quote not found' });

    const likes = quote.likes.includes(userId)
      ? quote.likes.filter(id => id !== userId)
      : [...quote.likes, userId];

    await quotesCollection.updateOne(
      { _id: quote._id },
      { $set: { likes } }
    );

    res.send({ likesCount: likes.length });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

// Delete quote
app.delete('/quotes/:id', async (req, res) => {
  try {
    await connectDB();
    const result = await quotesCollection.deleteOne({
      _id: new ObjectId(req.params.id)
    });
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

/* ===============================
   START SERVER
================================ */

connectDB()
  .then(() => {
    app.listen(port, () => {
      console.log(`🚀 AmarGolpo server running on port ${port}`);
    });
  })
  .catch(err => {
    console.error('❌ Server failed to start:', err);
    process.exit(1);
  });
