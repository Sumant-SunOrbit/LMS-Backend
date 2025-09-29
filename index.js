const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const { connectDB } = require('./src/config/db');
const quizRoutes = require('./src/routes/quizRoutes');

// Load environment variables from .env file
dotenv.config();

const app = express();

// --- Middleware Setup ---

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  process.env.FRONTEND_URL,
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
};

app.use(cors(corsOptions));
app.use(express.json());

// --- Database Connection Middleware (✅ THE FIX) ---
// This middleware ensures that for any request to '/api/quizzes',
// we first wait for the database connection to be established.
const ensureDbConnection = async (req, res, next) => {
  try {
    await connectDB(); // This will connect once and reuse the connection after
    next(); // Proceed to the next middleware/route handler
  } catch (error) {
    next(error); // Pass errors to the default error handler
  }
};


// --- API Routes ---
// We apply our new middleware right before the quizRoutes.
app.use('/api/quizzes', ensureDbConnection, quizRoutes);


// ✅ Export handler for Vercel
module.exports = app;