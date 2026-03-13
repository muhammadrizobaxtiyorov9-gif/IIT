import { Request, Response } from 'express';
import DailyReport, { ITrain, IWagon } from '../models/DailyReport';

// =====================================================================
// HELPER: Normalize a single wagon from any source format
//
// Supports:
//   • Full API format (wagonNum, etsngCode, sendStationCode, ...)
//   • Minified frontend format (n, c, st, ti, ...)
//   • Mixed/partial data
// =====================================================================
export const normalizeWagon = (w: any, fallbackTrainIndex: string = 'Unknown'): IWagon => ({
    wagonNum:           String(w.wagonNum           ?? w.n   ?? w.number       ?? '00000000').trim(),
    index:              Number(w.index              ?? w.s   ?? w.sequence     ?? 0),
    wagonStranaCode:    String(w.wagonStranaCode    ?? w.country              ?? '').trim(),
    etsngCode:          String(w.etsngCode          ?? w.c   ?? w.cargoId      ?? w.cargoCode ?? '').trim(),
    weight:             Number(w.weight             ?? w.w   ?? w.cargoWeight  ?? 0),
    sendStationCode:    String(w.sendStationCode    ?? '').trim(),
    sendStrana:         String(w.sendStrana         ?? '').trim(),
    receiveStationCode: String(w.receiveStationCode ?? w.st  ?? w.stationCode  ?? w.stationId ?? '').trim(),
    receiveStrana:      String(w.receiveStrana      ?? '').trim(),
    trainIndex:         String(w.trainIndex         ?? w.ti  ?? fallbackTrainIndex).trim(),
});

// =====================================================================
// HELPER: Group flat wagon array into ITrain[] hierarchy
// Used only when wagons come in without pre-grouping (frontend manual save)
// =====================================================================
export const groupWagonsByTrain = (wagons: any[]): ITrain[] => {
    const trainMap = new Map<string, any[]>();

    wagons.forEach(w => {
        const normalized = normalizeWagon(w);
        const idx = normalized.trainIndex;
        if (!trainMap.has(idx)) trainMap.set(idx, []);
        trainMap.get(idx)!.push(normalized);
    });

    return Array.from(trainMap.entries()).map(([trainIndex, trainWagons]) => ({
        trainIndex,
        numPoezd:         '',
        numSostav:        '',
        beginStationCode: '',
        endStationCode:   '',
        wagonCount:       trainWagons.length,
        totalWeight:      trainWagons.reduce((s, w) => s + w.weight, 0),
        wagons:           trainWagons,
    }));
};

// =====================================================================
// PUT /:date — Save or update a report for a specific date
// Accepts: { wagons: IWagon[] } or { trains: ITrain[] }
// =====================================================================
export const saveReport = async (req: Request, res: Response) => {
    try {
        const date = req.params.date || req.body.date;

        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({ error: 'Sana (YYYY-MM-DD) talab qilinadi' });
        }

        const rawWagons: any[] = req.body.wagons  || [];
        const rawTrains: any[] = req.body.trains  || [];

        let groupedTrains: ITrain[];

        if (rawTrains.length > 0 && rawWagons.length === 0) {
            // Pre-grouped trains (from integration or direct POST)
            groupedTrains = rawTrains.map((t: any) => ({
                trainIndex:       String(t.trainIndex       || 'Unknown').trim(),
                numPoezd:         String(t.numPoezd         || '').trim(),
                numSostav:        String(t.numSostav        || '').trim(),
                beginStationCode: String(t.beginStationCode || '').trim(),
                endStationCode:   String(t.endStationCode   || '').trim(),
                wagonCount:       t.wagons?.length ?? 0,
                totalWeight:      t.totalWeight ?? (t.wagons || []).reduce((s: number, w: any) => s + Number(w.weight ?? 0), 0),
                wagons:           (t.wagons || []).map((w: any) => normalizeWagon(w, t.trainIndex)),
            }));
        } else {
            // Flat wagon list (from frontend manual save)
            groupedTrains = groupWagonsByTrain(rawWagons);
        }

        console.log(`[Backend] Saving ${groupedTrains.length} trains (${groupedTrains.reduce((s, t) => s + t.wagonCount, 0)} wagons) for ${date}`);

        await DailyReport.findOneAndUpdate(
            { date },
            {
                $set:   { trains: groupedTrains, lastUpdated: Date.now() },
                $unset: { submissions: '' }
            },
            { upsert: true, new: true }
        );

        res.json({
            success:    true,
            message:    `${date} uchun ma'lumot saqlandi`,
            trainCount: groupedTrains.length,
            wagonCount: groupedTrains.reduce((s, t) => s + t.wagonCount, 0),
        });

    } catch (e: any) {
        console.error('[Backend] saveReport error:', e.message);
        res.status(500).json({ error: e.message });
    }
};

// =====================================================================
// GET /:date — Return full data for a specific date
// =====================================================================
export const getReport = async (req: Request, res: Response) => {
    try {
        const { date } = req.params;
        console.log(`[Backend] GET /reports/${date}`);

        const report: any = await DailyReport.findOne({ date }).lean();

        if (!report) {
            return res.status(404).json({ error: `${date} sanasi uchun ma'lumot topilmadi` });
        }

        // On-the-fly migration for legacy submissions format
        let trains: any[] = report.trains || [];
        if (trains.length === 0 && report.submissions) {
            console.log(`[Backend] Migrating legacy data for ${date}`);
            report.submissions.forEach((s: any) => {
                (s.trains || []).forEach((t: any) => trains.push(t));
            });
        }

        // Build flat wagon list for frontend compatibility
        // IMPORTANT: each wagon carries its full data + trainIndex for UI grouping
        const flatWagons: any[] = [];
        trains.forEach(t => {
            (t.wagons || []).forEach((w: any) => {
                flatWagons.push({
                    ...w,
                    trainIndex: t.trainIndex, // Always set at train level
                    ti:         t.trainIndex,
                });
            });
        });

        console.log(`[Backend] Returning ${trains.length} trains, ${flatWagons.length} wagons for ${date}`);

        res.json({
            date:      report.date,
            trains,                 // Full hierarchy (for observer & analytics)
            wagons:    flatWagons,  // Flat list (for frontend rehydration)
            timestamp: report.lastUpdated || Date.now(),
        });

    } catch (e: any) {
        console.error('[Backend] getReport error:', e);
        res.status(500).json({ error: e.message });
    }
};

// =====================================================================
// GET / — List all available report dates with metadata
// =====================================================================
export const getReportDates = async (req: Request, res: Response) => {
    try {
        const reports = await DailyReport.find({}, 'date trains lastUpdated').lean();

        const mapped = reports.map(r => {
            let wCount = 0;
            let tCount = 0;
            
            if (r.trains && Array.isArray(r.trains)) {
                tCount = r.trains.length;
                wCount = r.trains.reduce((s: number, t: any) => s + (t.wagonCount || (t.wagons ? t.wagons.length : 0)), 0);
            }

            return {
                date:       r.date,
                timestamp:  r.lastUpdated || Date.now(),
                wagonCount: wCount,
                trainCount: tCount,
            };
        });

        // Sort by date descending
        mapped.sort((a, b) => b.date.localeCompare(a.date));

        console.log(`[Backend] Returning ${mapped.length} report dates`);
        res.json(mapped);
    } catch (e: any) {
        console.error('[Backend] getReportDates error:', e);
        res.status(500).json({ error: e.message });
    }
};

// =====================================================================
// DELETE /:date — Remove report for a specific date
// =====================================================================
export const deleteReport = async (req: Request, res: Response) => {
    try {
        const { date } = req.params;
        const result = await DailyReport.findOneAndDelete({ date });
        if (result) return res.json({ success: true });
        res.status(404).json({ error: 'Topilmadi' });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
};

// =====================================================================
// DELETE /utility/cleanup — Purge all reports (dev/test only)
// =====================================================================
export const clearLegacyData = async (req: Request, res: Response) => {
    try {
        console.warn('[Backend] GLOBAL CLEANUP REQUESTED');
        const result = await DailyReport.deleteMany({});
        console.log(`[Backend] Purged ${result.deletedCount} documents`);
        res.json({ success: true, message: `${result.deletedCount} ta hisobot o'chirildi` });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
};
