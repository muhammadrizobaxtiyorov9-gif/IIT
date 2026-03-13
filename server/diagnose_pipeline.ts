/**
 * PIPELINE DIAGNOSTIC SCRIPT
 * Run: npx tsx diagnose_pipeline.ts 2026-03-12
 * 
 * Checks:
 * 1. How many trains are in MongoDB for a date
 * 2. What the /api/reports/:date endpoint returns
 * 3. Identifies where truncation occurs
 */

import mongoose from 'mongoose';
import DailyReport from './models/DailyReport';
import { fetchDu1Data, parseRailwayDataToTrains } from './services/railwayApi';

const uri = 'mongodb://127.0.0.1:27017/railway-analytics';

async function diagnose(date: string) {
  await mongoose.connect(uri);
  console.log('\n==============================');
  console.log('PIPELINE DIAGNOSTIC FOR', date);
  console.log('==============================\n');

  // Step 1: What's in MongoDB?
  const rawReport = await DailyReport.findOne({ date }).lean() as any;
  if (!rawReport) {
    console.log('❌ NO DATA in MongoDB for', date);
  } else {
    const dbTrains = rawReport.trains || [];
    const dbWagons = dbTrains.reduce((s: number, t: any) => s + (t.wagons?.length ?? 0), 0);
    console.log(`✅ MongoDB has: ${dbTrains.length} trains, ${dbWagons} wagons`);
    if (dbTrains.length > 0) {
      console.log('  First train:', dbTrains[0].trainIndex);
      console.log('  Last train:', dbTrains[dbTrains.length-1].trainIndex);
    }
  }

  console.log('\n--- Simulating getReport (what the API returns to frontend) ---');
  // Simulate the exact same code as reportController.getReport
  const report = rawReport;
  let trains: any[] = report?.trains || [];
  if (trains.length === 0 && report?.submissions) {
    report.submissions.forEach((s: any) => {
      (s.trains || []).forEach((t: any) => trains.push(t));
    });
  }

  const flatWagons: any[] = [];
  trains.forEach(t => {
    (t.wagons || []).forEach((w: any) => {
      flatWagons.push({
        ...w,
        trainIndex: t.trainIndex,
        ti: t.trainIndex,
      });
    });
  });
  console.log(`✅ API returns to frontend: ${trains.length} trains, ${flatWagons.length} wagons`);
  
  if (rawReport && rawReport.trains?.length !== trains.length) {
    console.log(`⚠️  TRUNCATION at DB→API layer: ${rawReport.trains?.length} → ${trains.length}`);
  }

  console.log('\n--- unMinifyReport simulation (what db.ts gives to App.tsx) ---');
  // Simulate unMinifyReport for trains[] path
  let flatCount = 0;
  trains.forEach((t: any) => {
    flatCount += (t.wagons || []).length;
  });
  console.log(`✅ db.ts wagons after unMinify: ${flatCount} wagons from ${trains.length} trains`);

  console.log('\n==============================\n');
  await mongoose.disconnect();
}

const date = process.argv[2] || '2026-03-12';
diagnose(date).catch(e => { console.error(e); process.exit(1); });
