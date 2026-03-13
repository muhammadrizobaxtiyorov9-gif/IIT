import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/railway-analytics";

async function run() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const reports = await db?.collection("dailyreports").find({}).toArray();
  if (!reports) return;
  
  let targetWagon: any = null;
  for (const r of reports) {
    for (const t of (r.trains || [])) {
      for (const w of (t.wagons || [])) {
        if (w.wagonNum === '50495324' || w.number === '50495324') {
          targetWagon = w;
          break;
        }
      }
      if (targetWagon) break;
    }
    if (targetWagon) break;
  }

  if (targetWagon) {
    const fs = require('fs');
    fs.writeFileSync('wagon_data_final.json', JSON.stringify(targetWagon, null, 2));
    console.log("Written to wagon_data_final.json");
  } else {
    console.log("Wagon 50495324 not found in DB");
  }
  process.exit(0);
}
run().catch(console.error);
