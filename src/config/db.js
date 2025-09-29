// This file handles the connection to your MongoDB database and sets up GridFS for file storage.

const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');

let connPromise = null; // This will cache the connection promise
let bucket = null;      // This will cache the GridFS bucket instance

const connectDB = async () => {
  // If the connection promise already exists, reuse it.
  // This prevents creating a new connection for concurrent requests.
  if (connPromise) {
    console.log("⚡ Reusing existing MongoDB connection promise.");
    return connPromise;
  }

  // If no promise exists, create a new one.
  console.log("=> Creating new MongoDB connection.");
  connPromise = (async () => {
    try {
      const conn = await mongoose.connect(process.env.MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });

      console.log(`✅ MongoDB Connected: ${conn.connection.host}`);

      // Initialize GridFSBucket once after connection
      const db = conn.connection.db;
      bucket = new GridFSBucket(db, {
        bucketName: 'uploads', // Collection name where files are stored
      });
      console.log('✅ GridFS Bucket initialized.');

      return conn; // Return the successful connection
    } catch (error) {
      console.error(`❌ Error connecting to MongoDB: ${error.message}`);
      // Set promise to null on failure to allow retry on the next request
      connPromise = null; 
      process.exit(1); // Or handle error without exiting for serverless
    }
  })();

  // Return the new promise
  return connPromise;
};

// Helper to access the initialized bucket
const getBucket = () => {
  if (!bucket) {
    throw new Error(
      "❌ GridFS Bucket not initialized. Ensure connectDB() has been successfully awaited."
    );
  }
  return bucket;
};

module.exports = { connectDB, getBucket };