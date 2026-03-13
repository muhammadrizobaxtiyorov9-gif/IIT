import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import mongoose from 'mongoose';
import connectDB from '../config/db';
import AdminUser from '../models/AdminUser';
import DailyReport from '../models/DailyReport';
import SystemLog from '../models/SystemLog';
import * as dotenv from 'dotenv';

dotenv.config();

const firebaseConfig = {
  apiKey: "AIzaSyDa0NpM85dNSHiV8Bc_7Zhk94zwf-_6Vjk",
  authDomain: "railway-app-95390.firebaseapp.com",
  projectId: "railway-app-95390",
  storageBucket: "railway-app-95390.firebasestorage.app",
  messagingSenderId: "397194105094",
  appId: "1:397194105094:web:43b168e5aa0532c2f70e87",
  measurementId: "G-3KLPST7J1E"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const migrate = async () => {
  try {
    await connectDB();
    console.log("MongoDB Ulandi. Migratsiya boshlanmoqda...");

    // 1. AdminUsers
    const adminsSnap = await getDocs(collection(db, "admins"));
    let adminCount = 0;
    for (const doc of adminsSnap.docs) {
      const data = doc.data();
      const existing = await AdminUser.findOne({ username: data.username || doc.id });
      if (!existing) {
        await AdminUser.create({
          uid: data.uid || String(Date.now()),
          username: data.username || doc.id,
          password: data.password || 'admin',
          role: data.role || 'user',
          name: data.name,
          lastLogin: data.lastLogin,
          deviceInfo: data.deviceInfo,
          addedAt: data.addedAt
        });
        adminCount++;
      }
    }
    console.log(`[+] ${adminCount} ta foydalanuvchi MongoDB ga ko'chirildi.`);

    // 2. DailyReports (Hierarchical structure)
    // Clear out the collection first because we changed the schema
    await DailyReport.deleteMany({});
    console.log("Eski DailyReports formati o'chirildi. Yangidan yacheykalangan holda yuklanmoqda...");

    const reportsSnap = await getDocs(collection(db, "reports"));
    let reportCount = 0;
    for (const doc of reportsSnap.docs) {
       const data = doc.data();
       
       const wagonsArray = Array.isArray(data.wagons) ? data.wagons.map((w: any) => ({
          number: String(w.number || w.n || ""),
          weight: Number(w.cargoWeight || w.w || 0),
          cargoId: String(w.cargoCode || w.c || ""),
          stationId: String(w.stationCode || w.st || ""),
          stationName: w.stationName,
          country: w.country,
          status: w.status,
          date: w.arrivalDate || w.ad || ""
       })) : [];
       
       const datePart = data.date || doc.id.split('__')[0];
       
       // Handle Legacy UID absence
       let reportUid = data.uid;
       if (!reportUid && data.uploadedBy) {
         const uploader = await AdminUser.findOne({ username: data.uploadedBy });
         reportUid = uploader ? uploader.uid : data.uploadedBy;
       }
       if (!reportUid) reportUid = "unknown_uid_" + Math.random().toString(36).substr(2, 5);
       
       if (wagonsArray.length > 0) {
         // Group wagons by trainIndex for the new hierarchy
         const trainMap = new Map<string, any[]>();
         wagonsArray.forEach(w => {
           const idx = (w.trainIndex || (data.wagons.find((orig: any) => orig.number === w.number || orig.n === w.number)?.ti) || "Unknown").toString().trim();
           if (!trainMap.has(idx)) trainMap.set(idx, []);
           trainMap.get(idx)!.push(w);
         });
 
         const groupedTrains = Array.from(trainMap.entries()).map(([trainIndex, wagons]) => ({
           trainIndex,
           wagonCount: wagons.length,
           totalWeight: wagons.reduce((sum, w) => sum + (Number(w.weight) || 0), 0),
           wagons
         }));
 
         // Save directly to the trains array in the root of DailyReport
         await DailyReport.findOneAndUpdate(
           { date: datePart },
           { 
             $set: { 
               trains: groupedTrains,
               lastUpdated: data.timestamp || Date.now()
             } 
           },
           { upsert: true, new: true }
         );
         reportCount++;
       }
    }
    console.log(`[+] ${reportCount} ta hisobotlar yacheykalangan holda ko'chirildi.`);

    // 3. SystemLogs
    const logsSnap = await getDocs(collection(db, "logs"));
    let logCount = 0;
    for (const doc of logsSnap.docs) {
       const data = doc.data();
       const id = data.id || doc.id;
       const existing = await SystemLog.findOne({ id });
       if (!existing) {
         await SystemLog.create({
           id,
           action: data.action || 'UNKNOWN',
           username: data.username || 'System',
           timestamp: data.timestamp ? new Date(data.timestamp).toISOString() : new Date().toISOString(),
           details: data.details || ''
         });
         logCount++;
       }
    }
    console.log(`[+] ${logCount} ta log yozuvlari MongoDB ga ko'chirildi.`);

    console.log("\n✅ Barcha ma'lumotlar muvaffaqiyatli Firebase'dan MongoDB ga o'tkazildi!");
  } catch (err: any) {
    console.error("\n❌ Migratsiya xatosi:", err.message);
  } finally {
    // Close mongoose cleanly so the script exits
    mongoose.connection.close();
  }
};

migrate();
