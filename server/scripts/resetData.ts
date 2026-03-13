import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import connectDB from '../config/db.js';
import DailyReport from '../models/DailyReport.js';

dotenv.config();

const resetData = async () => {
    try {
        await connectDB();
        console.log("MongoDB ulandi...");

        // 1. Delete all reports to start fresh with new schema
        const result = await DailyReport.deleteMany({});
        console.log(`[CLEANUP] ${result.deletedCount} ta eski formatdagi hisobotlar o'chirildi.`);

        console.log("\n✅ Ma'lumotlar tozalandi. Endi saytdan 'Sync from API' tugmasini bosib yangi formatda yuklashingiz mumkin.");
        process.exit(0);
    } catch (e) {
        console.error("Xatolik:", e);
        process.exit(1);
    }
};

resetData();
