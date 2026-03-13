import { Request, Response } from 'express';
import { fetchDu1Data, parseRailwayDataToTrains } from '../services/railwayApi';
import DailyReport from '../models/DailyReport';

// =====================================================================
// POST /api/integration/sync
// Fetches data from e-nakl.railway.uz API and saves to MongoDB
// =====================================================================
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

        const totalWagons = trains.reduce((s, t) => s + t.wagons.length, 0);
        console.log(`[SYNC] Parsed ${trains.length} trains, ${totalWagons} wagons. Saving to MongoDB...`);

        // 3. Save to MongoDB — replace existing data for this date
        await DailyReport.findOneAndUpdate(
            { date },
            {
                $set:   { trains, lastUpdated: Date.now() },
                $unset: { submissions: '' }   // Remove legacy format if present
            },
            { new: true, upsert: true }
        );

        console.log(`[SYNC] ✅ Successfully synced ${totalWagons} wagons for ${date}`);
        res.json({
            success:    true,
            message:    `${date}: ${trains.length} poyezd, ${totalWagons} ta vagon saqlandi`,
            trainCount: trains.length,
            wagonCount: totalWagons,
        });

    } catch (e: any) {
        console.error('[SYNC ERROR]', e);
        res.status(500).json({ error: e.message || 'Server xatoligi' });
    }
};
