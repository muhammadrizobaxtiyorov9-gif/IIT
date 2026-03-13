/**
 * API DATA DIAGNOSTIC - checks raw API vs parsed trains count (verbose)
 * Run: npx tsx diagnose_api2.ts 2026-03-12
 */
import mongoose from 'mongoose';
import DailyReport from './models/DailyReport';

const uri = 'mongodb://127.0.0.1:27017/railway-analytics';

async function diagnose(date: string) {
  await mongoose.connect(uri);
  
  const report = await DailyReport.findOne({ date }).lean() as any;
  if (!report) {
    console.log('NO DATA for', date);
    await mongoose.disconnect();
    return;
  }

  const trains = report.trains || [];
  console.log(`Total trains in DB: ${trains.length}`);
  console.log(`\nAll train indexes in DB for ${date}:`);
  trains.forEach((t: any, i: number) => {
    const wc = t.wagons?.length ?? t.wagonCount ?? 0;
    console.log(`  [${i}] trainIndex="${t.trainIndex}" numPoezd="${t.numPoezd}" numSostav="${t.numSostav}" wagons=${wc}`);
  });

  // Check for duplicates by numPoezd+numSostav
  const seen = new Map<string, number>();
  trains.forEach((t: any) => {
    const key = `${t.numPoezd}-${t.numSostav}`;
    seen.set(key, (seen.get(key) || 0) + 1);
  });
  const dupes = Array.from(seen.entries()).filter(([, cnt]) => cnt > 1);
  if (dupes.length > 0) {
    console.log('\n⚠️  DUPLICATE trainIndex (numPoezd+numSostav) in DB:');
    dupes.forEach(([key, cnt]) => console.log(`  ${key} appears ${cnt} times`));
  } else {
    console.log('\n✅ No exact duplicates in DB');
  }

  await mongoose.disconnect();
}

const date = process.argv[2] || '2026-03-12';
diagnose(date).catch(e => { console.error(e); process.exit(1); });
