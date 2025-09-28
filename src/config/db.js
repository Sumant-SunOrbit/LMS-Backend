// This file handles the connection to your MongoDB database and sets up GridFS for file storage.

const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');

let bucket;       // GridFS bucket instance
let isConnected;  // Track MongoDB connection status

const connectDB = async () => {
  if (isConnected) {
    console.log("⚡ Using existing MongoDB connection.");
    return;
  }

  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    isConnected = conn.connections[0].readyState;
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);

    // Initialize GridFSBucket once after connection
    const db = conn.connection.db;
    bucket = new GridFSBucket(db, {
      bucketName: 'uploads', // Collection name where files are stored
    });
    console.log('✅ GridFS Bucket initialized.');
  } catch (error) {
    console.error(`❌ Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

// Helper to access the initialized bucket
const getBucket = () => {
  if (!bucket) {
    throw new Error(
      "❌ GridFS Bucket not initialized. Call connectDB() before using getBucket()."
    );
  }
  return bucket;
};

module.exports = { connectDB, getBucket };
