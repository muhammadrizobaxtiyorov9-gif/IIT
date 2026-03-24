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
        
        // =======================================================================
        // 🛠️ DEBUG TAVSIYASI: E-Nakl API dan kelayotgan JSON ni ko'rish uchun 
        // pastdagi qatorni commentdan chiqaring:
        // console.log("== RAW API RESPONSE ==\n", JSON.stringify(response.data, null, 2));
        // =======================================================================

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
// =====================================================================
// NORMALIZE STATION CODE: 6-digit → 5-digit
// API sends codes like 736304 (6 digits). station_data.json uses 73630
// (5 digits). The 6th character is a check digit — take first 5 chars.
// Null/empty values are handled gracefully.
// =====================================================================
const normalizeStationCode = (code: any): string => {
    if (!code) return '';
    const s = String(code).trim();
    if (s.length === 6) {
        return s.substring(0, 5);
    }
    return s;
};

// =====================================================================
// MGSP BORDER STATION RESOLUTION
// Maps MGSP station names → 5-digit station codes (from station_data.json)
// Used as fallback when API sends borderStationCode as null
// =====================================================================
const MGSP_STATION_CODES: Record<string, string> = {
    'САРЫАГАЧ':       '69830',
    'СЫРДАРЬЯ':       '72530',
    'БЕКАБАД':        '72620',
    'ИСТИКЛОЛ':       '73990',
    'КАРАКАЛПАКСТАН': '73690',
    'КУДУКЛИ':        '73620',
    'АМУЗАНГ':        '73650',
    'ГАЛАБА':         '73640',
    'ТАХИАТАШ':       '73890',
    'ХОДЖИДАВЛЕТ':    '73080',
    'СУРХОНОБОД':     '73470',
    'КАРАСУ':        '71810',
    'ШОЛЛИСОЙ':      '71920',
    'КИЗИЛКИЯ':      '71910',
};

// QabulRules: "beginPrefix-endPrefix" → MGSP station name
// Derived from trainProtocols.ts — all qabul (entry) rules
const QABUL_RULES: Record<string, string> = {
    // САРЫАГАЧ
    '6980-7200': 'САРЫАГАЧ', '6980-7258': 'САРЫАГАЧ', '6980-7478': 'САРЫАГАЧ', '6980-7364': 'САРЫАГАЧ', '6980-7400': 'САРЫАГАЧ',
    '6900-7200': 'САРЫАГАЧ', '6600-7200': 'САРЫАГАЧ', '7076-7200': 'САРЫАГАЧ', '7076-7224': 'САРЫАГАЧ', '7076-7235': 'САРЫАГАЧ',
    '7076-7227': 'САРЫАГАЧ', '7076-7425': 'САРЫАГАЧ', '9800-7200': 'САРЫАГАЧ', '9859-7200': 'САРЫАГАЧ', '9859-7227': 'САРЫАГАЧ',
    '9859-7235': 'САРЫАГАЧ', '9859-7387': 'САРЫАГАЧ', '7076-7364': 'САРЫАГАЧ', '6978-7364': 'САРЫАГАЧ', '6997-7200': 'САРЫАГАЧ',
    '6997-7400': 'САРЫАГАЧ', '6997-7364': 'САРЫАГАЧ', '6915-7230': 'САРЫАГАЧ', '6915-7200': 'САРЫАГАЧ', '6915-7364': 'САРЫАГАЧ',
    '6730-7200': 'САРЫАГАЧ', '6911-7364': 'САРЫАГАЧ', '6628-7369': 'САРЫАГАЧ', '6946-7248': 'САРЫАГАЧ', '6736-7269': 'САРЫАГАЧ',
    '6997-7258': 'САРЫАГАЧ', '6997-7280': 'САРЫАГАЧ', '6979-7258': 'САРЫАГАЧ', '7076-7269': 'САРЫАГАЧ', '7076-7387': 'САРЫАГАЧ',
    '6978-7258': 'САРЫАГАЧ', '6926-7478': 'САРЫАГАЧ', '6925-7252': 'САРЫАГАЧ', '6915-7269': 'САРЫАГАЧ', '6997-7331': 'САРЫАГАЧ',
    '6900-7252': 'САРЫАГАЧ', '6946-7200': 'САРЫАГАЧ', '6900-7225': 'САРЫАГАЧ', '6961-7200': 'САРЫАГАЧ', '6961-7225': 'САРЫАГАЧ',
    // СЫРДАРЬЯ
    '6970-7247': 'СЫРДАРЬЯ',
    // КАРАКАЛПАКСТАН
    '6628-7372': 'КАРАКАЛПАКСТАН', '6611-7372': 'КАРАКАЛПАКСТАН',
    // БЕКАБАД
    '7478-7261': 'БЕКАБАД', '7478-7258': 'БЕКАБАД', '7478-6980': 'БЕКАБАД',
    // ИСТИКЛОЛ
    '7478-7400': 'ИСТИКЛОЛ', '7476-7400': 'ИСТИКЛОЛ',
    // КУДУКЛИ
    '7458-7351': 'КУДУКЛИ',
    // АМУЗАНГ
    '7464-7351': 'АМУЗАНГ',
    // ТАХИАТАШ
    '7585-7390': 'ТАХИАТАШ', '7585-7372': 'ТАХИАТАШ', '7585-7377': 'ТАХИАТАШ',
    // ХОДЖИДАВЛЕТ
    '7571-7300': 'ХОДЖИДАВЛЕТ', '7502-7300': 'ХОДЖИДАВЛЕТ', '7504-7300': 'ХОДЖИДАВЛЕТ', '7571-7453': 'ХОДЖИДАВЛЕТ',
    // СУРХОНОБОД
    '7568-7351': 'СУРХОНОБОД', '7568-7453': 'СУРХОНОБОД', '7568-7458': 'СУРХОНОБОД',
    '7498-7351': 'СУРХОНОБОД', '7498-7458': 'СУРХОНОБОД', '7504-7453': 'СУРХОНОБОД',
    // КАРАСУ
    '7180-7437': 'КАРАСУ',
    // ШОЛЛИСОЙ
    '7192-7414': 'ШОЛЛИСОЙ',
    // КИЗИЛКИЯ
    '7191-7429': 'КИЗИЛКИЯ', '7191-7432': 'КИЗИЛКИЯ',
    // ГАЛАБА
    '7364-7363': 'ГАЛАБА',
};

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
        const beginStationCode = normalizeStationCode(trainBlock.beginStationCode);
        const endStationCode   = normalizeStationCode(trainBlock.endStationCode);

        // === BORDER STATION CODE (MGSP entry point) ===
        // 1. Normalize 6→5 digits
        // 2. If null/empty → fallback via qabulRules
        let borderStationCode = normalizeStationCode(trainBlock.borderStationCode);
        if (!borderStationCode) {
            const beginPrefix = beginStationCode.substring(0, 4);
            const endPrefix   = endStationCode.substring(0, 4);
            const routeKey    = `${beginPrefix}-${endPrefix}`;
            const mgspName    = QABUL_RULES[routeKey];
            if (mgspName && MGSP_STATION_CODES[mgspName]) {
                borderStationCode = MGSP_STATION_CODES[mgspName];
                console.log(`[Fallback] Train ${numPoezd}: borderStationCode null → ${mgspName} (${borderStationCode})`);
            }
        }

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
                    // Normalize ALL wagon-level station codes from 6→5 digits
                    sendStationCode:    normalizeStationCode(w.sendStationCode),
                    receiveStationCode: normalizeStationCode(w.receiveStationCode),
                    loadStationCode:    normalizeStationCode(w.loadStationCode),
                    exportStationCode:  normalizeStationCode(w.exportStationCode),
                    // Inject border station as entry point for frontend MGSP resolution
                    borderStationCode,
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
            // 🛠️ DEBUG: Agar API dan kelgan poyezd ma'lumotining ichida "wagons" bo'lmasa, uni console da ko'ramiz
            console.warn(`[Parser] ⚠️ DIQQAT: API dan kelgan Train #${trainIdx} (${trainIndex}) da vagonlar ro'yxati yo'q (bo'sh)! Bu ehtimol UI dagi tafovutga sababchi bo'lishi mumkin.`);
            // console.log("Bo'sh poyezd bloki:", JSON.stringify(trainBlock, null, 2));
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
            borderStationCode,  // Normalized + fallback applied
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
