import { Request, Response } from 'express';
import { fetchDu1Data, parseRailwayDataToTrains } from '../services/railwayApi';
import DailyReport from '../models/DailyReport';

// =====================================================================
// POST /api/integration/sync
// Fetches data from e-nakl.railway.uz API and saves to MongoDB
//
// RAILWAY OPERATIONAL DATE LOGIC:
// A railway "day" runs from 20:00 yesterday to 20:00 today.
// Trains with datearriveBorderStation >= 20:00 are saved under the NEXT
// calendar date. Trains with invalid/empty dates stay under the requested date.
// =====================================================================

/**
 * Given a datearriveBorderStation string, return the railway operational date (YYYY-MM-DD).
 * If arrival hour >= 20, the train belongs to the NEXT calendar day.
 */
const getRailwayOperationalDate = (dateStr: string | undefined | null, fallbackDate: string): string => {
    if (!dateStr || dateStr.startsWith('0001-01-01')) return fallbackDate;
    try {
        // Parse directly from ISO string to avoid timezone issues
        // API format: "2026-04-20T22:38:00"
        const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})/);
        if (!match) return fallbackDate;
        
        const year  = parseInt(match[1], 10);
        const month = parseInt(match[2], 10);
        const day   = parseInt(match[3], 10);
        const hour  = parseInt(match[4], 10);
        
        if (year < 2000) return fallbackDate;
        
        if (hour >= 20) {
            // Belongs to NEXT railway day — use Date for safe day rollover
            const d = new Date(year, month - 1, day + 1);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${dd}`;
        }
        
        return `${match[1]}-${match[2]}-${match[3]}`;
    } catch {
        return fallbackDate;
    }
};

export const syncRailwayData = async (req: Request, res: Response) => {
    try {
        const { date } = req.body;

        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({ error: 'Sana (YYYY-MM-DD) talab qilinadi' });
        }

        console.log(`[SYNC] Starting API sync for date: ${date}`);

        // 1. Fetch raw data from external API
        const rawApiData = await fetchDu1Data(date);

        // 2. Parse into full ITrain[] (all API fields preserved)
        const trains = parseRailwayDataToTrains(rawApiData);

        if (trains.length === 0) {
            return res.json({
                success:    true,
                message:    `${date} sanasi uchun hech qanday ma'lumot topilmadi.`,
                trainCount: 0,
                wagonCount: 0,
            });
        }

        // 3. Group trains by RAILWAY OPERATIONAL DATE using datearriveBorderStation
        // Trains arriving after 20:00 belong to the NEXT day
        const trainsByDate = new Map<string, any[]>();

        trains.forEach(train => {
            const opDate = getRailwayOperationalDate(train.datearriveBorderStation, date);
            if (!trainsByDate.has(opDate)) trainsByDate.set(opDate, []);
            trainsByDate.get(opDate)!.push(train);
        });

        let totalTrains = 0;
        let totalWagons = 0;

        // 4. Save each group to its respective date in MongoDB
        for (const [opDate, dateTrains] of trainsByDate.entries()) {
            const wagonCount = dateTrains.reduce((s: number, t: any) => s + t.wagons.length, 0);
            console.log(`[SYNC] Saving ${dateTrains.length} trains (${wagonCount} wagons) → ${opDate}`);

            await DailyReport.findOneAndUpdate(
                { date: opDate },
                {
                    $set:   { trains: dateTrains, lastUpdated: Date.now() },
                    $unset: { submissions: '' }
                },
                { new: true, upsert: true }
            );

            totalTrains += dateTrains.length;
            totalWagons += wagonCount;
        }

        const dates = Array.from(trainsByDate.keys()).sort();
        console.log(`[SYNC] ✅ Successfully synced ${totalWagons} wagons across dates: ${dates.join(', ')}`);
        res.json({
            success:    true,
            message:    `${dates.join(', ')}: ${totalTrains} poyezd, ${totalWagons} ta vagon saqlandi`,
            trainCount: totalTrains,
            wagonCount: totalWagons,
            dates,
        });

    } catch (e: any) {
        console.error('[SYNC ERROR]', e);
        res.status(500).json({ error: e.message || 'Server xatoligi' });
    }
};
