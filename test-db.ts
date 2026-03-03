import { getReportDates, getReportByDate } from './utils/db';

async function test() {
    console.log("Fetching dates...");
    const dates = await getReportDates();
    console.log("Dates:", dates);

    if (dates.length > 0) {
        const report = await getReportByDate(dates[0]);
        if (report && report.wagons && report.wagons.length > 0) {
            console.log(`Report for ${dates[0]} has ${report.wagons.length} wagons`);
            const sampleWagon = report.wagons[0];
            console.log("Sample Wagon keys:", Object.keys(sampleWagon));
            console.log("Has rawBlock?", !!sampleWagon.rawBlock);
            console.log("Length of rawBlock:", sampleWagon.rawBlock?.length);
            if (sampleWagon.rawBlock) {
                console.log("First 50 chars:", sampleWagon.rawBlock.substring(0, 50));
            }
        }
    }
}
test();
