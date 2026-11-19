const mongoose = require('mongoose');

/**
 * Connect to MongoDB using Mongoose
 * Reads MONGODB_URI strictly from environment variables.
 */
const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error('❌ MongoDB Connection Error: MONGODB_URI is not defined in environment variables.');
    return null;
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000 // Fast fail (5s) if MongoDB server is unreachable
    });

    console.log(`✓ MongoDB Connected Successfully: ${conn.connection.host} [Database: ${conn.connection.name}]`);
    return conn;
  } catch (error) {
    console.error(`❌ MongoDB Connection Failed: ${error.message}`);
    // Do not fake connection. Let the connection state reflect the genuine reality.
    return null;
  }
};

/**
 * Helper to get human-readable database connection status
 */
const getDBStatus = () => {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  const readyState = mongoose.connection.readyState;
  return {
    stateCode: readyState,
    status: states[readyState] || 'unknown',
    host: mongoose.connection.host || null,
    name: mongoose.connection.name || null
  };
};

module.exports = { connectDB, getDBStatus };
