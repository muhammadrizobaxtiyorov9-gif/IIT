import axios from 'axios';
import dotenv from 'dotenv';
import https from 'https';

const httpsAgent = new https.Agent({ rejectUnauthorized: false });
dotenv.config();

const API_BASE_URL = 'https://e-nakl.railway.uz/public/api';
const CLIENT_ID     = process.env.RAILWAY_CLIENT_ID     || 'arm_kontora';
const CLIENT_SECRET = process.env.RAILWAY_CLIENT_SECRET || '$arm_kontora$';

let currentToken: string | null = null;
let tokenExpiry:  Date   | null = null;

// =====================================================================
// AUTHENTICATE — Token caching with expiry
// =====================================================================
export const authenticateRailwayApi = async (): Promise<string> => {
    if (currentToken && tokenExpiry && new Date() < tokenExpiry) {
        return currentToken;
    }

    try {
        const url = `${API_BASE_URL}/Authenticate?ClientId=${encodeURIComponent(CLIENT_ID)}&ClientSecret=${encodeURIComponent(CLIENT_SECRET)}`;
        const response = await axios.get(url, {
            httpsAgent,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        const data = response.data;
        if (data?.value) {
            currentToken = data.value.replace(/[\r\n\s]+/g, '');
            tokenExpiry  = data.expiryDate
                ? new Date(data.expiryDate)
                : new Date(Date.now() + 55 * 60 * 1000);
            console.log('[Auth] Token refreshed, expires:', tokenExpiry);
            return currentToken!;
        }
        throw new Error('Invalid authentication response: missing value field');
    } catch (error: any) {
        console.error('[Auth] Failed:', error.response?.data || error.message);
        throw new Error('Failed to authenticate with Railway API');
    }
};

// =====================================================================
// FETCH RAW DU-1 DATA — Returns raw API JSON
// =====================================================================
export const fetchDu1Data = async (date: string): Promise<any> => {
    try {
        const token = await authenticateRailwayApi();
        const url   = `${API_BASE_URL}/Du1/GetDu1ForInfrastructure?date=${date}`;

        console.log(`[API] Fetching DU-1 data for ${date}...`);
        const response = await axios.get(url, {
            httpsAgent,
            headers: {
                'Authorization': token,
                'Accept':        'application/json',
                'User-Agent':    'Mozilla/5.0'
            },
            timeout: 120000  // 2 minutes — this endpoint is slow
        });

        const count = response.data?.data?.length ?? 0;
        console.log(`[API] Received ${count} train blocks for ${date}`);
        return response.data;
    } catch (error: any) {
        console.error(`[API] Fetch error for ${date}:`, error.response?.data || error.message);
        throw new Error(`Failed to fetch DU-1 data for ${date}: ${error.message}`);
    }
};

// =====================================================================
// PARSE API RESPONSE → Complete Train Array
//
// SENIOR PRINCIPLE: Save EVERYTHING from the API.
// No field is dropped. Unknown or future fields are also preserved
// via the spread operator. This data belongs to the user.
//
// COLLISION HANDLING:
// Some trains share the same numPoezd+numSostav identifiers in the
// API response (e.g., split/combined trains). We generate unique
// trainIndex values by appending a sequential suffix (_2, _3...)
// on collision so that ALL trains are preserved without overwriting.
//
// Train-level fields from the API:
//   du1Id, beginStationCode, endStationCode, numPoezd, numSostav
//   brutto, maxLength (and any other top-level fields)
//
// Wagon-level fields from the API:
//   du1Id, index, comment, gngCode, etsngCode, etsngName, gngName,
//   weight, wagonNum, tara, os, gp, length, rodWagon, wagonStranaCode,
//   sendStationCode, receiveStationCode, loadStationCode, sendStrana,
//   receiveStrana, codeOwner, codeMarshrut, codeCover, codeOversize,
//   codePodshipn, plombCount, accessoryName, codeMiddleContCount,
//   codeBigContCount, customerName, receiverName, exportStationCode
// =====================================================================
export const parseRailwayDataToTrains = (apiData: any): any[] => {
    if (!apiData?.data || !Array.isArray(apiData.data)) {
        console.warn('[Parser] Invalid or empty API data format. Expected: { data: [...] }');
        return [];
    }

    const trains: any[] = [];
    let totalWagons = 0;

    // Track seen trainIndex values to avoid collisions.
    // When two trains from the API share the same numPoezd+numSostav+begin+end,
    // we append a suffix (_2, _3, ...) to make each one unique and preserve ALL data.
    const seenIndexes = new Map<string, number>();

    apiData.data.forEach((trainBlock: any, trainIdx: number) => {
        // === TRAIN IDENTITY FIELDS ===
        const numPoezd         = String(trainBlock.numPoezd         || '').trim();
        const numSostav        = String(trainBlock.numSostav         || '').trim();
        const beginStationCode = String(trainBlock.beginStationCode  || '').trim();
        const endStationCode   = String(trainBlock.endStationCode    || '').trim();

        // Use 4-digit prefix for display consistency as requested by user
        const beginShort = beginStationCode.substring(0, 4) || '0000';
        const endShort   = endStationCode.substring(0, 4)   || '0000';
        const baseIndex = `${numPoezd} (${beginShort}+${numSostav}+${endShort})`;

        // Handle collisions: track occurrence count and append suffix for duplicates
        const occurrences = seenIndexes.get(baseIndex) || 0;
        seenIndexes.set(baseIndex, occurrences + 1);
        const trainIndex = occurrences === 0 ? baseIndex : `${baseIndex}_${occurrences + 1}`;

        if (occurrences > 0) {
            console.warn(`[Parser] Collision #${occurrences + 1} for "${baseIndex}" → renamed to "${trainIndex}" (API block #${trainIdx})`);
        }

        // === PARSE ALL WAGONS — preserve every API field ===
        const wagons: any[] = [];

        if (Array.isArray(trainBlock.wagons)) {
            trainBlock.wagons.forEach((w: any) => {
                // Use spread to capture EVERYTHING from the API wagon object,
                // then add our derived trainIndex field for grouping.
                wagons.push({
                    // Spread ALL original API fields — zero filtering
                    ...w,
                    // Override/normalize the critical numeric fields
                    weight:     typeof w.weight     === 'number' ? w.weight     : parseFloat(w.weight)     || 0,
                    tara:       typeof w.tara       === 'number' ? w.tara       : parseFloat(w.tara)       || 0,
                    gp:         typeof w.gp         === 'number' ? w.gp         : parseFloat(w.gp)         || 0,
                    index:      typeof w.index      === 'number' ? w.index      : parseInt(w.index, 10)    || 0,
                    os:         typeof w.os         === 'number' ? w.os         : parseInt(w.os, 10)       || 0,
                    plombCount: typeof w.plombCount === 'number' ? w.plombCount : parseInt(w.plombCount, 10) || 0,
                    // Derived field for grouping
                    trainIndex,
                });
            });
            totalWagons += wagons.length;
        } else {
            console.warn(`[Parser] Train #${trainIdx} (${trainIndex}) has no wagons array`);
        }

        // === TRAIN OBJECT — ALL API fields + derived fields ===
        trains.push({
            // Spread ALL original API train-block fields (brutto, maxLength, du1Id, etc.)
            ...trainBlock,
            // Our derived/normalized fields (override raw for consistency)
            trainIndex,
            numPoezd,
            numSostav,
            beginStationCode,
            endStationCode,
            brutto:      typeof trainBlock.brutto    === 'number' ? trainBlock.brutto    : parseFloat(trainBlock.brutto)    || 0,
            maxLength:   typeof trainBlock.maxLength === 'number' ? trainBlock.maxLength : parseFloat(trainBlock.maxLength) || 0,
            // Computed summary (for quick queries without unrolling all wagons)
            wagonCount:  wagons.length,
            totalWeight: wagons.reduce((s: number, w: any) => s + (w.weight || 0), 0),
            // Wagons with ALL fields preserved
            wagons,
        });
    });

    console.log(`[Parser] ✅ Parsed ${trains.length} trains with ${totalWagons} wagons (all fields preserved)`);
    return trains;
};
