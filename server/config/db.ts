import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/railway-analytics';
    const conn = await mongoose.connect(mongoURI);
    console.log(`[MongoDB] Ulandi: ${conn.connection.host}`);
  } catch (error: any) {
    console.error(`[MongoDB] Xatolik: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
