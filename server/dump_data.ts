import mongoose from 'mongoose';
import DailyReport from './models/DailyReport';

const uri = 'mongodb://127.0.0.1:27017/railway-analytics';

async function run() {
  try {
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');
    const reports = await DailyReport.find({}, 'date').lean();
    console.log('Available reports in DB:');
    reports.forEach(r => {
      let byteStr = '';
      for (let i=0; i<r.date.length; i++) {
        byteStr += r.date.charCodeAt(i) + ' ';
      }
      console.log(`- Date string: "${r.date}" length: ${r.date.length} bytes: [${byteStr.trim()}]`);
    });
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
