const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
// --- FIX IS HERE ---
const { connectDB } = require('./src/config/db');
const quizRoutes = require('./src/routes/quizRoutes');

// Load environment variables from .env file
dotenv.config();

// Connect to the database
connectDB();

const app = express();

// ✅ START: Updated CORS Configuration
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  process.env.FRONTEND_URL, // add your deployed frontend domain here
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // allow curl/postman
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg =
        'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
};

app.use(cors(corsOptions));
// ✅ END: Updated CORS Configuration

app.use(express.json());

// API Routes
app.use('/api/quizzes', quizRoutes);

// ✅ Instead of app.listen(), export handler for Vercel
module.exports = app;
