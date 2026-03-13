/**
 * API DATA DIAGNOSTIC - checks raw API vs parsed trains count
 * Run: npx tsx diagnose_api.ts 2026-03-12
 */
import { fetchDu1Data, parseRailwayDataToTrains } from './services/railwayApi';
import mongoose from 'mongoose';
import DailyReport from './models/DailyReport';

const uri = 'mongodb://127.0.0.1:27017/railway-analytics';

async function diagnose(date: string) {
  console.log('\n==============================');
  console.log('API DATA DIAGNOSTIC FOR', date);
  console.log('==============================\n');

  console.log('1. Fetching raw data from external API...');
  const rawData = await fetchDu1Data(date);
  const rawTrainCount = rawData?.data?.length ?? 0;
  console.log(`✅ External API returned: ${rawTrainCount} train blocks`);
  
  if (rawTrainCount > 0) {
    // Show first and last train indexes
    rawData.data.slice(0, 3).forEach((t: any, i: number) => {
      console.log(`  [${i}] numPoezd=${t.numPoezd} beginStation=${t.beginStationCode} endStation=${t.endStationCode} wagons=${t.wagons?.length}`);
    });
    console.log('  ...');
    rawData.data.slice(-3).forEach((t: any, i: number) => {
      const idx = rawTrainCount - 3 + i;
      console.log(`  [${idx}] numPoezd=${t.numPoezd} beginStation=${t.beginStationCode} endStation=${t.endStationCode} wagons=${t.wagons?.length}`);
    });
  }

  console.log('\n2. Parsing raw API data...');
  const trains = parseRailwayDataToTrains(rawData);
  console.log(`✅ parseRailwayDataToTrains produced: ${trains.length} trains`);
  
  if (rawTrainCount !== trains.length) {
    console.log(`⚠️  TRUNCATION AT PARSING STAGE: ${rawTrainCount} → ${trains.length}`);
    
    // Find which indexes are missing
    const rawIndexes = new Set(rawData.data.map((t: any) => `${t.numPoezd}-${t.numSostav}`));
    const parsedIndexes = new Set(trains.map((t: any) => `${t.numPoezd}-${t.numSostav}`));
    rawIndexes.forEach((idx: any) => {
      if (!parsedIndexes.has(idx)) {
        console.log(`  MISSING in parsed: ${idx}`);
      }
    });
  }

  console.log('\n3. Checking what is stored in MongoDB...');
  await mongoose.connect(uri);
  const report = await DailyReport.findOne({ date }).lean() as any;
  if (!report) {
    console.log('❌ NO DATA in MongoDB');
  } else {
    const dbTrains = report.trains || [];
    const dbWagons = dbTrains.reduce((s: number, t: any) => s + (t.wagons?.length ?? 0), 0);
    console.log(`✅ MongoDB has: ${dbTrains.length} trains, ${dbWagons} wagons`);
    if (trains.length !== dbTrains.length) {
      console.log(`⚠️  TRUNCATION AT SAVE STAGE: ${trains.length} → ${dbTrains.length}`);
    }
  }
  await mongoose.disconnect();

  console.log('\n==============================\n');
}

const date = process.argv[2] || '2026-03-12';
diagnose(date).catch(e => { console.error(e); process.exit(1); });
