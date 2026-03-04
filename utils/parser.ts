

import { Station, Wagon, RegionName, Language, RouteVerification } from '../types';
import stationDataJson from '../station_data.json';
import trainIndexData from '../train_index_data.json';

const TAJ_BEK_PREFIXES = new Set(["7473", "7474", "7475", "7476", "7477", "7478", "7479", "7480", "7481", "7483", "7484", "7485", "7486"]);
const TAJ_KUD_PREFIXES = new Set(["7450", "7451", "7452", "7453", "7454", "7455", "7456", "7457", "7458", "7459", "7460", "7461", "7462", "7463", "7464", "7465", "7466", "7467", "7468", "7469", "7470", "7471", "7472", "7482", "7487", "7488", "7489", "9385", "9386"]);

/**
 * Identifies the border station based on the train index (from-to).
 * Uses the 1st and 3rd components of the index.
 */
const identifyBorderPoint = (idx1: string, idx3: string, stations: Station[], stationMap: Map<string, Station>): Station | undefined => {
  if (!idx1 || !idx3) return undefined;

  // Search in the train index data
  const match = (trainIndexData as any[]).find(rule => rule.from === idx1 && rule.to === idx3);

  if (match) {
    // Find the station object by name or code
    // The JSON has "station" name in Russian (e.g. "Сарыагач")
    // We need to find the corresponding Station object

    // Try to find by name first
    let st = stations.find(s => s.name.toLowerCase().includes(match.station.toLowerCase()));

    // Special mapping for names that might differ
    if (!st) {
      if (match.station === "Сарыагач") st = findStationFast("69830", stationMap, stations); // Saryagach exp
      else if (match.station === "Алтынколь (эксп.)") st = findStationFast("707701", stationMap, stations);
      else if (match.station === "Сирдарья") st = findStationFast("72530", stationMap, stations); // Sirdaryo exp
      else if (match.station === "Каракалпакстан") st = findStationFast("73680", stationMap, stations);
      else if (match.station === "Бекабад") st = findStationFast("72620", stationMap, stations);
      else if (match.station === "Истиклол") st = findStationFast("73990", stationMap, stations);
      else if (match.station === "Кудукли") st = findStationFast("73620", stationMap, stations);
      else if (match.station === "Амузанг") st = findStationFast("73650", stationMap, stations);
      else if (match.station === "Тахиаташ") st = findStationFast("73890", stationMap, stations);
      else if (match.station === "Хожа давлет") st = findStationFast("73080", stationMap, stations);
      else if (match.station === "Сурхонобод") st = findStationFast("73471", stationMap, stations); // Or 734713
      else if (match.station === "Карасу") st = findStationFast("71810", stationMap, stations); // Karasu exp
      else if (match.station === "Шоллисой") st = findStationFast("71920", stationMap, stations); // Shollisoy (maybe 71920?)
      else if (match.station === "Кизилкия") st = findStationFast("71910", stationMap, stations);
      else if (match.station === "Галаба") st = findStationFast("73640", stationMap, stations);
    }

    return st;
  }

  return undefined;
};


const mapOtdToRegion = (otd: number): string => {
  switch (otd) {
    case 1: return RegionName.Tashkent;
    case 2: return RegionName.Kokand;
    case 3: return RegionName.Bukhara;
    case 4: return RegionName.Kungrad;
    case 5: return RegionName.Karshi;
    case 6: return RegionName.Termez;
    default: return "Узбекистан (прочие)";
  }
};

const detectCountryAndRegion = (code: string, providedOtd?: number): { dor: number; regionName: string; otd?: number } => {
  const cleanCode = code.trim();
  const prefix2 = parseInt(cleanCode.substring(0, 2), 10);
  const prefix3 = parseInt(cleanCode.substring(0, 3), 10);

  let dor = 0;
  let otd = providedOtd;
  let regionName = "СНГ / Россия";

  if (prefix2 === 72) {
    dor = 73;
    if (!otd) {
      if (prefix3 >= 727 && prefix3 <= 729) otd = 3;
      else otd = 1;
    }
    regionName = mapOtdToRegion(otd);
  }
  else if (prefix2 === 73) {
    dor = 73;
    if (!otd) {
      if (prefix3 >= 730 && prefix3 <= 732) otd = 3;
      else if (prefix3 >= 733 && prefix3 <= 734) otd = 5;
      else if (prefix3 >= 735 && prefix3 <= 736) otd = 6;
      else if (prefix3 >= 737 && prefix3 <= 739) otd = 4;
      else otd = 4;
    }
    regionName = mapOtdToRegion(otd);
  }
  else if (prefix2 === 74) {
    // 740xxx - 744xxx are Kokand (Uzbekistan)
    if (prefix3 >= 740 && prefix3 <= 744) {
      dor = 73; otd = otd || 2; regionName = mapOtdToRegion(otd);
    }
    // 7496xx is Hairatan (Afghanistan)
    else if (cleanCode.startsWith("7496")) {
      dor = 74; regionName = "Афганистан";
    }
    // 7499xx is Razyezd 161 (Turkmenistan border)
    else if (cleanCode.startsWith("7499")) {
      dor = 75; regionName = "Туркменистан";
    }
    // 745xxx - 748xxx are Tajikistan
    else {
      dor = 74; regionName = "Таджикистан";
    }
  }
  else if (prefix2 >= 66 && prefix2 <= 70) {
    dor = 66; regionName = "Казахстан";
  }
  else if (prefix2 === 71) {
    dor = 71; regionName = "Киргизия";
  }
  else if (prefix2 === 75) {
    dor = 75; regionName = "Туркменистан";
  }
  else if (prefix2 >= 20 && prefix2 <= 65) {
    dor = 20; regionName = "Россия";
  }

  return { dor, regionName, otd };
};

/**
 * Calculates the "Railway Operational Date".
 * Rule: If time is >= 18:00, it counts as the NEXT calendar day.
 * If time is < 18:00, it counts as the CURRENT calendar day.
 */
export const calculateRailwayDate = (inputDate: Date): string => {
  const d = new Date(inputDate);
  const hours = d.getHours();

  // Logic: 18:00 is the start of the next railway day
  if (hours >= 18) {
    d.setDate(d.getDate() + 1);
  }

  // Return YYYY-MM-DD
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

/**
 * Attempts to extract a date/time stamp from the raw report in strict priority:
 * 1. ПРМД lines (e.g. ПРМД 01.03 20-55)
 * 2. CППB lines (e.g. CППB-69830 01.03 20-25)
 * 3. :902 machine block headers if IPPV missing (e.g. (:902 7222 2062 6980 741 7364 1 02 03 02 32 ...)
 * 4. Generic Header
 */
export const extractReportDate = (text: string): Date | null => {
  if (!text) return null;

  // Check first 150 lines
  const lines = text.split('\n').slice(0, 150);

  // Regexes
  const prmdRegex = /(?:[ПP][РP][МM][ДDОO0ТT]).*?(\d{2})[.,/](\d{2})[^\d\n]*(\d{1,2})[-:.](\d{2})/i;
  const borderDateRegex = /(?:C|С|c|с)[ПPnmIiÏï1]{2}[BВ8].{0,30}?(\d{2})[.,/](\d{2})\s+(\d{1,2})[-:.,\s](\d{2})/i;
  const machine902Regex = /^\(:902\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/;
  const genericDateRegex = /(\d{2})[.,/](\d{2})\s+(\d{1,2})[-:.,](\d{2})/;

  // Storage for standard parsing
  let matchDay, matchMonth, matchHour, matchMin;

  const tryParseDate = (day: string, month: string, hour: string, minute: string): Date | null => {
    const dDay = parseInt(day, 10);
    const dMonth = parseInt(month, 10) - 1; // JS months are 0-indexed
    const dHour = parseInt(hour, 10);
    const dMin = parseInt(minute, 10);

    const now = new Date();
    let year = now.getFullYear();

    if (dMonth < 0 || dMonth > 11 || dDay < 1 || dDay > 31 || dHour < 0 || dHour > 24 || dMin < 0 || dMin > 59) {
      return null;
    }

    if (now.getMonth() === 0 && dMonth === 11) {
      year = year - 1;
    }
    else if (now.getMonth() === 11 && dMonth === 0) {
      year = year + 1;
    }

    const extractedDate = new Date(year, dMonth, dDay, dHour, dMin);
    if (!isNaN(extractedDate.getTime())) {
      return extractedDate;
    }
    return null;
  };

  // PRIORITY 1: ПРМД
  for (const line of lines) {
    const match = line.match(prmdRegex);
    if (match) {
      return tryParseDate(match[1], match[2], match[3], match[4]);
    }
  }

  // PRIORITY 2: CППB
  for (const line of lines) {
    const match = line.match(borderDateRegex);
    if (match) {
      return tryParseDate(match[1], match[2], match[3], match[4]);
    }
  }

  // PRIORITY 3: (:902 machine header (used heavily when IPPV missing)
  for (const line of lines) {
    const match = line.match(machine902Regex);
    if (match) {
      // regex matches group: 7=date, 8=month, 9=hour, 10=minute
      return tryParseDate(match[7], match[8], match[9], match[10]);
    }
  }

  // PRIORITY 4: Generic Header Fallback
  for (const line of lines) {
    const match = line.match(genericDateRegex);
    if (match) {
      if (line.includes("BЦ") || line.includes("ВЦ") || line.length < 50) {
        return tryParseDate(match[1], match[2], match[3], match[4]);
      }
    }
  }

  return null;
};

/**
 * Splits a massive text block into date-specific chunks.
 * This is crucial for multi-day uploads.
 */
export const groupDataByDate = (fullText: string): Record<string, string> => {
  const grouped: Record<string, string[]> = {};

  // Split logic: Split by Naturka start or manual split
  // Improved regex to include optional parenthesis and whitespace at the start of headers
  // Also handles common Cyrillic/Latin character mix-ups in "ВЦ УТИ"
  const rawChunks = fullText.split(/(?=\(?\s*[BВ][ЦC]\s+[УY][TТ][ИI]|--- FILE SPLIT ---)/i);

  // Filter out tiny noise chunks
  const chunks = rawChunks.filter(c => c.trim().length > 20);

  // We will combine chunks that belong to the same train to preserve headers
  const combinedChunks: string[] = [];
  let currentCombined = "";
  let currentTrainKey = "";
  let orphanHeader = "";

  const getTrainKey = (text: string) => {
    // Improved regex: space after train number is now optional (\s*)
    const vMatch = text.match(/(?:(\d{3,5})\s*)?(\(\s*(\d+)\s*\+\s*(\d+)\s*\+\s*(\d+)\s*\))/);
    const mMatch = text.match(/\(:902\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/);

    if (vMatch) {
      const trainNum = vMatch[1] || "";
      const idx = vMatch[2].replace(/\s+/g, ''); // Normalize index part: (7478+43+6980)
      return trainNum ? `${trainNum} ${idx}` : idx;
    }
    if (mMatch) {
      return `${mMatch[1]} (${mMatch[2]}+${mMatch[3]}+${mMatch[4]})`;
    }
    return null;
  };

  const getIndexPart = (key: string) => {
    const m = key.match(/\(\d+\+\d+\+\d+\)/);
    return m ? m[0] : key;
  };

  chunks.forEach(chunk => {
    const key = getTrainKey(chunk);

    if (!key) {
      // Chunk has no train key (likely a header block or continuation of wagons)
      if (currentCombined) {
        currentCombined += "\n" + chunk;
      } else {
        orphanHeader += (orphanHeader ? "\n" : "") + chunk;
      }
    } else {
      // Chunk has a train key. 
      const normalizedKey = key.replace(/\s+/g, ' ').trim();
      const normalizedCurrentKey = currentTrainKey.replace(/\s+/g, ' ').trim();

      const indexPart = getIndexPart(normalizedKey);
      const currentIndexPart = getIndexPart(normalizedCurrentKey);

      if (indexPart === currentIndexPart && currentCombined) {
        // Same train continuation (even if one has train number and other doesn't)
        currentCombined += "\n" + chunk;
        // Keep the more descriptive key (the one with the train number)
        if (normalizedKey.length > normalizedCurrentKey.length) {
          currentTrainKey = key;
        }
      } else {
        // New train found
        if (currentCombined) combinedChunks.push(currentCombined);

        currentCombined = orphanHeader ? orphanHeader + "\n" + chunk : chunk;
        currentTrainKey = key;
        orphanHeader = "";
      }
    }
  });
  if (currentCombined) combinedChunks.push(currentCombined);

  let lastRailwayDate: string | null = null;

  combinedChunks.forEach(chunk => {
    // Extract date for THIS specific chunk
    const dateObj = extractReportDate(chunk);

    if (dateObj) {
      const railwayDate = calculateRailwayDate(dateObj);
      if (!grouped[railwayDate]) grouped[railwayDate] = [];
      grouped[railwayDate].push(chunk);
      lastRailwayDate = railwayDate;
    } else {
      const targetDate = lastRailwayDate || 'unknown';
      if (!grouped[targetDate]) grouped[targetDate] = [];
      grouped[targetDate].push(chunk);
    }
  });

  const result: Record<string, string> = {};
  Object.keys(grouped).forEach(date => {
    result[date] = grouped[date].join('\n\n--- FILE SPLIT ---\n\n');
  });

  return result;
};

export const parseStationData = (rawData: string): Station[] => {
  const lines = rawData.trim().split('\n');
  const stations: Station[] = [];

  const regex = /^(\d+)\s+(.+?)\s+(\d{2})(?:\s+(\d+))?.*$/;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed || (trimmed.length < 5) || /^(KOD|CODE)/i.test(trimmed)) continue;

    const match = trimmed.match(regex);
    if (match) {
      const fullCode = match[1];
      const name = match[2].trim();
      let dor = parseInt(match[3], 10); // Extracted from file
      let otd = match[4] ? parseInt(match[4], 10) : undefined;

      const detection = detectCountryAndRegion(fullCode, otd);
      dor = detection.dor || dor; // Use calculated or fallback to file dor
      otd = detection.otd || otd;
      const regionName = detection.regionName;

      let id = fullCode;
      if (dor === 73) {
        id = fullCode.length >= 5 ? fullCode.substring(0, 5) : fullCode;
      }

      const isBorderPoint = name.toLowerCase().includes('(эксп)') || name.toLowerCase().includes('стык');

      stations.push({
        id,
        fullCode,
        name,
        dor,
        otd,
        regionName,
        isBorderPoint
      });
    }
  }

  // Merge JSON data
  try {
    const extraStations = stationDataJson as any[];
    for (const item of extraStations) {
      const fullCode = item.code;
      const name = item.station_name;
      const isBorderPoint = item.isBorderPoint;

      let dor = typeof item.dor === 'number' ? item.dor : undefined;
      const explicitOtd = typeof item.otd === 'number' ? item.otd : undefined;
      const country = item.country;

      // Extract OTD/MTU regions via code prefixes, respecting JSON OTD
      const detection = detectCountryAndRegion(fullCode, explicitOtd);
      dor = dor !== undefined ? dor : detection.dor;
      const otd = detection.otd;

      // Prefer explicit country, but override with detailed MTU region for Uzbekistan
      let regionName = country || detection.regionName;
      if (dor === 73 || country === "Узбекистан") {
        regionName = detection.regionName !== "СНГ / Россия" ? detection.regionName : "Узбекистан";
        dor = 73;
      } else if (country === "Кыргызстан" || country === "Киргизия") {
        regionName = "Киргизия";
        dor = 71; // Force DOR 71 for Kyrgyzstan regardless of JSON errors
      }

      let id = fullCode;
      // Truncate non-border local stations for grouping (e.g. 720140 -> 72014)
      if (dor === 73 && fullCode.length >= 6) {
        id = fullCode.substring(0, 5);
      }

      const existingIdx = stations.findIndex(s => s.fullCode === fullCode);
      const stationObj: Station = {
        id,
        fullCode,
        name,
        dor,
        otd,
        regionName,
        isBorderPoint
      };

      if (existingIdx >= 0) {
        stations[existingIdx] = stationObj;
      } else {
        stations.push(stationObj);
      }
    }
  } catch (e) {
    console.warn("Failed to load extra station data", e);
  }

  return stations;
};

// --- OPTIMIZED LOOKUP ---
type StationMap = Map<string, Station>;

export const createStationMap = (stations: Station[]): StationMap => {
  const map = new Map<string, Station>();

  // First pass: exact matches and standard IDs
  for (const s of stations) {
    map.set(s.fullCode, s);
    if (s.id !== s.fullCode) {
      map.set(s.id, s);
    }
  }

  // Second pass: prefixes (don't overwrite exact matches unless it's a border point)
  for (const s of stations) {
    if (s.fullCode.length >= 4) {
      const prefix4 = s.fullCode.substring(0, 4);
      // Prioritize border points for prefix matching
      if (!map.has(prefix4) || (s.isBorderPoint && !map.get(prefix4)?.isBorderPoint)) {
        map.set(prefix4, s);
      }
    }

    if (s.fullCode.length === 6) {
      const standardKey = s.fullCode.substring(0, 5);
      if (!map.has(standardKey)) map.set(standardKey, s);

      const specialKey = s.fullCode.substring(0, 4) + s.fullCode[5];
      if (!map.has(specialKey)) map.set(specialKey, s);
    }
  }

  return map;
};

const findStationFast = (code: string, stationMap: StationMap, stationsArr?: Station[]): Station | undefined => {
  if (!code) return undefined;

  // 1. Exact match
  const exact = stationMap.get(code);
  if (exact) return exact;

  // 2. If 6 digits, try 5 digits
  if (code.length === 6) {
    const prefix5 = code.substring(0, 5);
    const match5 = stationMap.get(prefix5);
    if (match5) return match5;
  }

  // 3. Try 4-digit prefix match (Senior logic: check first 4 digits)
  if (code.length >= 4) {
    const prefix4 = code.substring(0, 4);
    const match4 = stationMap.get(prefix4);
    if (match4) return match4;
  }

  // 4. Fallback search in array for border points
  if (stationsArr && code.length >= 4) {
    const prefix4 = code.substring(0, 4);
    const prefixMatch = stationsArr.find(s => s.fullCode.startsWith(prefix4) && s.isBorderPoint);
    if (prefixMatch) return prefixMatch;
  }

  return undefined;
};

const KNOWN_FOREIGN_STATIONS: Record<string, string> = {
  "7077": "Алтынколь (эксп.)",
  "70771": "Алтынколь (эксп.)",
  "707701": "Алтынколь (эксп.)",
  "6980": "Сарыагач",
  "69830": "Сарыагач",
  "6700": "Арысь",
  "6720": "Шымкент",
  "6733": "Тараз",
  "6741": "Луговая",
  "67410": "Луговая",
  "67413": "Луговая",
  "6800": "Алматы",
  "68001": "Алматы-1",
  "68020": "Алматы-2",
  "6900": "Актобе",
  "7000": "Караганда",
  "7100": "Астана",
  "71000": "Астана",
  "7200": "Павлодар",
  "6600": "Мангышлак",
  "6633": "Атырау",
  "6660": "Уральск",
  "6770": "Туркестан",
  "6830": "Талдыкорган",
  "6870": "Семей",
  "6920": "Костанай",
  "6940": "Кокшетау",
  "6960": "Петропавловск",
  "6603": "Кандагач",
  "6610": "Никельтау",
  "6620": "Эмба",
  "6640": "Макат",
  "6650": "Кульсары",
  "6670": "Илецк",
  "6701": "Арысь-1",
  "6702": "Арысь-2",
  "6717": "Тюлькубас",
  "6740": "Чу",
  "6745": "Отар",
  "6750": "Защита",
  "6760": "Аягуз",
  "6780": "Кзыл-Орда",
  "6790": "Казалинск",
  "6810": "Сары-Озек",
  "6840": "Уштобе",
  "6850": "Актогай",
  "6880": "Локоть",
  "6910": "Кушмурун",
  "6930": "Железорудная",
  "6950": "Курорт-Боровое",
  "6970": "Пресногорьковская",
  "6990": "Жана-Семей",
  "7010": "Агадырь",
  "7020": "Моинты",
  "7030": "Балхаш",
  "7040": "Жезказган",
  "7060": "Есиль",
  "7070": "Аркалык",
  "7080": "Экибастуз",
  "7090": "Ерейментау",
  "7101": "Бишкек",
  "7116": "Ош",
  "7166": "Кара-Суу",
  "7191": "Кызыл-Кия",
  "7453": "Худжанд",
  "7463": "Канибадам",
  "7478": "Душанбе",
  "7482": "Бохтар",
  "7485": "Куляб",
  "7496": "Хайратон",
  "7500": "Фарап",
  "7528": "Талимарджан",
  "7514": "Ходжадавлет",
  "7499": "Разъезд 161",
};

const inferStation = (code: string): Station => {
  const cleanCode = code.trim();
  const prefix4 = cleanCode.substring(0, 4);
  const prefix5 = cleanCode.substring(0, 5);

  // Deep analysis: try matching by 5 digits then 4 digits in KNOWN_FOREIGN_STATIONS
  let name = KNOWN_FOREIGN_STATIONS[prefix5] || KNOWN_FOREIGN_STATIONS[prefix4] || `Ст. ${cleanCode}`;

  const detection = detectCountryAndRegion(cleanCode);

  // Apply visual naming enhancements based on detected regions
  if (detection.regionName === "Афганистан" && !name.includes("(Афг)")) name += " (Афг)";
  else if (detection.regionName === "Туркменистан" && !name.includes("(Туркм)")) name += " (Туркм)";
  else if (detection.regionName === "Таджикистан" && !name.includes("(Тадж)")) name += " (Тадж)";
  else if (detection.regionName === "Казахстан" && !name.includes("(Каз)")) name += " (Каз)";
  else if (detection.regionName === "Киргизия" && !name.includes("(Кирг)")) name += " (Кирг)";
  else if (detection.regionName === "Россия" && !name.includes("(РФ)")) name += " (РФ)";

  return {
    id: cleanCode,
    fullCode: cleanCode,
    name,
    dor: detection.dor || 0,
    otd: detection.otd,
    regionName: detection.regionName,
    isBorderPoint: false
  };
};

export const verifyTrainRoute = (
  originStation: Station | undefined,
  borderStation: Station | undefined,
  destinationStation: Station | undefined,
  wagonNumber: string
): RouteVerification => {
  const warnings: string[] = [];

  if (!originStation || !destinationStation) {
    return {
      routeType: 'НЕИЗВЕСТНО',
      description: 'Недостаточно данных для анализа (НЕТ СТАНЦИИ)',
      isValid: false,
      warnings: ['Отсутствует базовая станция формирования или назначения.']
    };
  }

  const isOriginUz = originStation.dor === 73;
  const isDestUz = destinationStation.dor === 73;
  let routeType: RouteVerification['routeType'] = 'НЕИЗВЕСТНО';

  if (!isOriginUz && isDestUz) {
    routeType = 'ИМПОРТ';
  } else if (isOriginUz && !isDestUz) {
    routeType = 'ЭКСПОРТ';
  } else if (!isOriginUz && !isDestUz) {
    routeType = 'ТРАНЗИТ';
  } else if (isOriginUz && isDestUz) {
    routeType = 'МЕСТНЫЙ';
  }

  // Cross-check anomalies based on the comprehensive station_data parameters
  if (routeType === 'ИМПОРТ' && !borderStation) {
    warnings.push(`Внимание: Импортный вагон ${wagonNumber} (${originStation.regionName} -> ${destinationStation.regionName}), но не зафиксирован входной МГСП.`);
  }

  if (routeType === 'ТРАНЗИТ') {
    if (!borderStation) {
      warnings.push(`Аномалия: Транзитный вагон ${wagonNumber} (${originStation.regionName} -> ${destinationStation.regionName}) без указания въездного МГСП.`);
    } else if (originStation.regionName === destinationStation.regionName) {
      warnings.push(`Ложный транзит? Вагон ${wagonNumber} формируется и направляется в одну страну (${originStation.regionName}), проходя через УТИ.`);
    }
  }

  if (routeType === 'МЕСТНЫЙ' && borderStation) {
    warnings.push(`Логическая ошибка: Вагон ${wagonNumber} формируется и остается в УТИ, но зафиксирован проход через МГСП (${borderStation.name}).`);
  }

  const description = `${routeType}: ${originStation.regionName} (${originStation.name}) -> ${destinationStation.regionName} (${destinationStation.name})`;

  return {
    routeType,
    description,
    isValid: warnings.length === 0,
    warnings
  };
};

/**
 * GENERATOR FUNCTION FOR TIME-SLICING
 */
export function* parseOperationalDataGenerator(rawData: string, stations: Station[], lang: Language = 'ru'): Generator<Wagon[], void, unknown> {
  const stationMap = createStationMap(stations);

  // Split into sections (chunks) by manual split marker
  // Note: groupDataByDate already combined related Naturka blocks into these chunks
  const sections = rawData.split(/(?=--- FILE SPLIT ---)/i);

  let currentEntryPoint: Station | undefined = undefined;
  let entryPointSource: 'visual_index' | 'machine_header' | 'border' | 'date_fallback' | null = null;
  let currentTrainIndex: string | undefined = undefined;

  const seenWagons = new Set<string>();

  const visualIndexRegex = /(?:(\d{3,5})\s*)?(\(\s*(\d+)\s*\+\s*(\d+)\s*\+\s*(\d+)\s*\))/;
  const machine902Regex = /^\(:902\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/; // Extended to capture date
  const machine902FallbackRegex = /(\(:902\s+(\d+).*)/;

  // Updated Border Regex to handle "CÏÏB" (UTF garbage) and "CППB"
  const borderRegex = /((?:C|С|c|с)[ПPnmIiÏï1]{2}[BВ8][-\s]+(\d+))/i;
  // Regex to capture date from border line: CППB ... 16.02 14-00
  const borderDateRegex = /(?:C|С|c|с)[ПPnmIiÏï1]{2}[BВ8].{0,30}?(\d{2})[.,/](\d{2})\s+(\d{1,2})[-:.,\s](\d{2})/i;

  // Regex for PRMD/PRMO (Priority 1) - Updated to handle station codes and variants
  // Matches: ПPMД 74452 25.02 04-14 or ПPMД 25.02 04-14
  const prmdRegex = /(?:[ПP][РP][МM][ДDОO0ТT]).*?(\d{2})[.,/](\d{2})[^\d\n]*(\d{1,2})[-:.](\d{2})/i;

  // Regex for OTPR (Departure) - Priority 1 (Same as PRMD for this context)
  // Matches: OTПP 72610 10.02 05-45
  const otprRegex = /(?:OT[ПP]P|O[ТT][ПP]P).*?(\d{5})?\s*(\d{2})[.,/](\d{2})\s+(\d{1,2})[-:.](\d{2})/i;

  // Fallback: Looks for code immediately preceding a date (e.g., "-69830 05.02")
  // Captures the 5-digit code before the date pattern
  const codeBeforeDateRegex = /(?:^|[\s-])(\d{5})\s+(?:\d{2}[.,]\d{2})\s+(?:\d{2}[-:]\d{2})/;

  // Updated Wagon Regex to be more flexible with spacing and columns
  // Matches: 01 53428793 0201 064 70771 15123 ...
  const wagonRegex = /^\s*(\d+)\s+(\d{8})\s+\S+\s+(\d+)\s+(\d{5,6})\s+(\d{5,6})/;

  const CHUNK_SIZE = 500;
  let batch: Wagon[] = [];

  let currentTrainArrivalDate: Date | undefined = undefined;
  let currentDatePriority = 0;
  let wagonsProcessed = false;
  let currentTrainDirection: 'BEKABAD' | 'KUDUKLI' | 'GALABA' | null = null;

  // Helper to parse date
  const parseDate = (d: string, m: string, H: string, M: string): Date => {
    const now = new Date();
    let year = now.getFullYear();
    const month = parseInt(m, 10) - 1;
    const day = parseInt(d, 10);
    const hour = parseInt(H, 10);
    const minute = parseInt(M, 10);

    // Handle year wrap-around
    if (now.getMonth() === 0 && month === 11) year--;
    else if (now.getMonth() === 11 && month === 0) year++;

    return new Date(year, month, day, hour, minute);
  };

  for (const section of sections) {
    if (section.trim().length < 10) continue;

    // VALIDATION: Check if train is not yet accepted (IPPV missing is a hard blocker UNLESS PRMD is present)
    const upperSection = section.toUpperCase();

    // Senior Logic: Check for PRMD specifically (Acceptance Override)
    // Matches: ПРМД (Cyrillic), PRMD (Latin), or mixed like ПPMД
    const hasPrmd = /[ПP][РP][МM][ДD]/.test(upperSection);
    const hasOtpr = /OT[ПP]P|O[ТT][ПP]P/.test(upperSection); // Also allow OTPR to override

    const isIppvMissing = upperSection.includes("ИППВ ОТСУТСТВУЕТ") ||
      upperSection.includes("ИППB OTCУTCTBУET") ||
      upperSection.includes("ИППB OTCYTCТBYET");

    // Logic:
    // If IPPV is missing:
    //    If PRMD or OTPR is present -> ALLOW (Continue processing)
    //    Else -> BLOCK (Yield validation error)
    if (isIppvMissing && !hasPrmd && !hasOtpr) {
      // Find train index for the error message
      const vIdxMatch = section.match(visualIndexRegex);
      let trainIdx = "Неизвестный состав";
      if (vIdxMatch) {
        const num = vIdxMatch[1];
        const i1 = vIdxMatch[3];
        const i2 = vIdxMatch[4];
        const i3 = vIdxMatch[5];
        trainIdx = num ? `${num} (${i1}+${i2}+${i3})` : `(${i1}+${i2}+${i3})`;
      }

      const errorMsg = lang === 'uz'
        ? `Ogohlantirish: Poyezd sostavi (${trainIdx}) hali qabul qilinmadi (ИППВ ОТСУТСТВУЕТ), lekin bazaga qo'shilmoqda.`
        : `Внимание: Состав поезда (${trainIdx}) еще не принят (ИППВ ОТСУТСТВУЕТ), но добавляется в базу.`;

      yield { validationError: errorMsg } as any;
      // removed "continue;" to allow the parser to process the wagons anyway
    }

    const lines = section.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.length < 5) continue;

      // GLOBAL SCAN: Check for direction keywords in ANY line
      const upperLine = line.toUpperCase();
      if (upperLine.includes("БЕКАБАД") || upperLine.includes("БEKAБ") || upperLine.includes("BEKAB")) {
        currentTrainDirection = 'BEKABAD';
      } else if (upperLine.includes("КУДУК") || upperLine.includes("KUDUK")) {
        currentTrainDirection = 'KUDUKLI';
      }

      // PRIORITY 1: PRMD Date (Highest Priority = 3)
      const prmdMatch = line.match(prmdRegex);
      if (prmdMatch) {
        if (wagonsProcessed) { currentDatePriority = 0; wagonsProcessed = false; }
        // PRMD is the gold standard. Always overwrite if found for the current block.
        const parsed = parseDate(prmdMatch[1], prmdMatch[2], prmdMatch[3], prmdMatch[4]);
        if (parsed) {
          currentTrainArrivalDate = parsed;
          currentDatePriority = 3;
        }
      }

      // PRIORITY 1.5: OTPR Date (High Priority)
      const otprMatch = line.match(otprRegex);
      if (otprMatch) {
        if (wagonsProcessed) { currentDatePriority = 0; wagonsProcessed = false; }
        // Group 1 is optional station code, 2=Day, 3=Month, 4=Hour, 5=Min
        const parsed = parseDate(otprMatch[2], otprMatch[3], otprMatch[4], otprMatch[5]);
        if (parsed) {
          // Only overwrite if we don't have a PRMD date yet (priority 3)
          if (currentDatePriority < 3) {
            currentTrainArrivalDate = parsed;
            currentDatePriority = 3; // Treat as high priority
          }
        }
        // Also try to extract station from OTPR line if available
        if (otprMatch[1]) {
          const st = findStationFast(otprMatch[1], stationMap, stations);
          if (st) {
            currentEntryPoint = st;
            entryPointSource = 'machine_header';
          }
        }
      }

      // PRIORITY 2 Check: VISUAL HEADER (Resets Context)
      const vIdx = line.match(visualIndexRegex);
      if (vIdx) {
        const trainNum = vIdx[1];
        const idx1 = vIdx[3];
        const idx2 = vIdx[4];
        const idx3 = vIdx[5];

        const normalizedIndex = `(${idx1}+${idx2}+${idx3})`;
        const newTrainIndex = trainNum ? `${trainNum} ${normalizedIndex}` : normalizedIndex;

        // Senior Logic: If we already have a train index with a number, and this one is just the index part, keep the number
        const isCompatible = currentTrainIndex && currentTrainIndex.includes(normalizedIndex);

        if (isCompatible && !trainNum) {
          // Keep old one (it has the train number)
        } else {
          if (wagonsProcessed && currentTrainIndex !== newTrainIndex) {
            wagonsProcessed = false;
            currentTrainDirection = null;
          }
          currentTrainIndex = newTrainIndex;
        }
        entryPointSource = 'visual_index';

        const idx3Prefix = idx3.substring(0, 4);
        if (idx3Prefix === '7364') {
          currentTrainDirection = 'GALABA';
        } else if (TAJ_BEK_PREFIXES.has(idx3Prefix)) {
          currentTrainDirection = 'BEKABAD';
        } else if (TAJ_KUD_PREFIXES.has(idx3Prefix)) {
          currentTrainDirection = 'KUDUKLI';
        }

        // Try to identify border point using the new JSON logic (1st and 3rd index)
        const borderSt = identifyBorderPoint(idx1, idx3, stations, stationMap);

        if (borderSt) {
          currentEntryPoint = borderSt;
          // If identified by strict rule, we can consider it a high confidence source
          entryPointSource = 'machine_header';
        } else {
          const st = findStationFast(idx1, stationMap, stations);
          if (st) currentEntryPoint = st;
          else currentEntryPoint = undefined;
        }
      }

      // PRIORITY 3 Check: BORDER MARKER (Explicit CППB or CÏÏB)
      const borderMatch = line.match(borderRegex);
      const isTajBek = upperLine.includes("БEKAБ") || upperLine.includes("БЕКАБ") || upperLine.includes("BEKAB");
      const isTajKud = upperLine.includes("КУДУК") || upperLine.includes("KUDUK");

      if ((borderMatch || isTajBek || isTajKud) && !wagonRegex.test(line)) {
        let code = borderMatch ? borderMatch[2] : "";
        let st = code ? findStationFast(code, stationMap, stations) : undefined;

        if (!st) {
          if (isTajBek) st = stations.find(s => s.name.toUpperCase().includes("БЕКАБ") || s.name.toUpperCase().includes("BEKAB"));
          if (isTajKud) st = stations.find(s => s.name.toUpperCase().includes("КУДУК") || s.name.toUpperCase().includes("KUDUK"));
        }

        if (st) {
          currentEntryPoint = st;
          entryPointSource = 'border';
          if (!currentTrainIndex) currentTrainIndex = `Border ${st.name}`;
        }

        const bDateMatch = line.match(borderDateRegex);
        if (bDateMatch) {
          if (wagonsProcessed) { currentDatePriority = 0; wagonsProcessed = false; }
          if (currentDatePriority < 2) {
            currentTrainArrivalDate = parseDate(bDateMatch[1], bDateMatch[2], bDateMatch[3], bDateMatch[4]);
            currentDatePriority = 2;
          }
        }
      }
      else if (!wagonRegex.test(line)) {
        const dateMatch = line.match(codeBeforeDateRegex);
        if (dateMatch) {
          const code = dateMatch[1];
          const st = findStationFast(code, stationMap, stations);
          if (st) {
            currentEntryPoint = st;
            entryPointSource = 'date_fallback';
            if (!currentTrainIndex) currentTrainIndex = `Border ${code}`;
          }
        }
      }

      // PRIORITY 3 Check: MACHINE HEADER (:902)
      const m902 = line.match(/^\(:902\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/);
      if (m902) {
        const stCode = m902[1];
        const trainNum = m902[2];
        const idx1 = m902[3];
        const idx2 = m902[4];
        const idx3 = m902[5];

        const d = m902[7];
        const m = m902[8];
        const H = m902[9];
        const M = m902[10];

        if (wagonsProcessed) { currentDatePriority = 0; wagonsProcessed = false; }
        if (currentDatePriority < 1) {
          currentTrainArrivalDate = parseDate(d, m, H, M);
          currentDatePriority = 1;
        }

        const machineDerivedIndex = `${trainNum} (${idx1}+${idx2}+${idx3})`;
        const seemsSameTrain = currentTrainIndex &&
          currentTrainIndex.includes(trainNum) &&
          currentTrainIndex.includes(idx1) &&
          currentTrainIndex.includes(idx3);

        if (!seemsSameTrain) {
          currentTrainIndex = machineDerivedIndex;
        }

        if (entryPointSource !== 'border' && entryPointSource !== 'date_fallback') {
          const st = findStationFast(stCode, stationMap, stations);
          if (st) {
            currentEntryPoint = st;
            entryPointSource = 'machine_header';
          } else {
            // Try new JSON logic first
            const borderSt = identifyBorderPoint(idx1, idx3, stations, stationMap);
            if (borderSt) {
              currentEntryPoint = borderSt;
              entryPointSource = 'machine_header';
            } else {
              const stFromIndex = findStationFast(idx1, stationMap, stations);
              if (stFromIndex) {
                currentEntryPoint = stFromIndex;
                entryPointSource = 'machine_header';
              }
            }
          }
        }
      }
      else if (machine902FallbackRegex.test(line)) {
        const mFallback = line.match(machine902FallbackRegex);
        if (mFallback) {
          if (!currentTrainIndex || currentTrainIndex.includes('Unknown')) {
            currentTrainIndex = mFallback[1].split(')')[0] + ')';
          }
          if (entryPointSource !== 'border' && entryPointSource !== 'date_fallback') {
            const code = mFallback[2];
            const st = findStationFast(code, stationMap, stations);
            if (st) {
              currentEntryPoint = st;
              entryPointSource = 'machine_header';
            }
          }
        }
      }

      // --- WAGON PROCESSING ---
      const match = line.match(wagonRegex);
      if (match) {
        const seq = parseInt(match[1], 10);
        const wagonNum = match[2];
        const weight = parseInt(match[3], 10);
        const destCode = match[4];
        const cargoCode = match[5];

        const key = wagonNum;
        if (seenWagons.has(key)) continue;
        seenWagons.add(key);

        const matchedStation = findStationFast(destCode, stationMap, stations) || inferStation(destCode);
        const destPrefix = destCode.substring(0, 4);
        if (currentTrainDirection !== 'GALABA') {
          if (TAJ_BEK_PREFIXES.has(destPrefix)) {
            currentTrainDirection = 'BEKABAD';
          } else if (TAJ_KUD_PREFIXES.has(destPrefix)) {
            currentTrainDirection = 'KUDUKLI';
          }
        }

        // VERIFICATION LOGIC: Calculate precise route analytics
        let originStation: Station | undefined = undefined;
        if (currentTrainIndex) {
          const oMatch = currentTrainIndex.match(/\((\d{3,5})\+/);
          if (oMatch && oMatch[1]) {
            originStation = findStationFast(oMatch[1], stationMap, stations) || inferStation(oMatch[1]);
          }
        }
        const routeVerification = verifyTrainRoute(originStation, currentEntryPoint, matchedStation, wagonNum);

        const wagon: Wagon = {
          sequence: seq,
          number: wagonNum,
          operationCode: 'transit',
          cargoWeight: weight,
          stationCode: destCode,
          cargoCode: cargoCode,
          destinationStation: matchedStation.name,
          matchedStation,
          entryPoint: currentEntryPoint,
          trainIndex: (currentTrainIndex || "Неопознанный состав").replace(/\s*\[.*?_MARKER\]/g, ''),
          arrivalDate: currentTrainArrivalDate,
          rawBlock: section.trim(),
          routeVerification
        };

        wagonsProcessed = true;
        batch.push(wagon);

        if (batch.length >= CHUNK_SIZE) {
          yield batch;
          batch = [];
        }
      }
    }
  }

  if (batch.length > 0) {
    yield batch;
  }
}

export const rehydrateWagons = (wagons: any[], stations: Station[], sections: string[] = []): Wagon[] => {
  const stationMap = createStationMap(stations);

  return wagons.map(w => {
    const stCode = w.stationCode || w.st || "";
    const matchedStation = findStationFast(stCode, stationMap, stations) || inferStation(stCode);

    let entryPoint: Station | undefined = undefined;
    const epId = w.entryPointId || w.ep || w.entryPoint?.id || w.entryPoint?.fullCode;

    if (epId) {
      entryPoint = findStationFast(epId, stationMap, stations);
    }

    return {
      sequence: w.sequence || w.s || 0,
      number: w.number || w.n || "",
      operationCode: w.operationCode || w.o || "",
      cargoWeight: w.cargoWeight || w.w || 0,
      stationCode: stCode,
      cargoCode: w.cargoCode || w.c || "",
      destinationStation: matchedStation.name,
      matchedStation,
      entryPoint,
      trainIndex: (w.trainIndex || w.ti || "Unknown").replace(/\s*\[.*?_MARKER\]/g, ''),
      rawBlock: w.rawBlock || w.rb || (w.si !== undefined ? sections[w.si] : ""),
      arrivalDate: (() => {
        const rawDate = w.arrivalDate || w.ad;
        if (!rawDate) return undefined;
        const d = new Date(rawDate);
        return isNaN(d.getTime()) ? undefined : d;
      })()
    };
  });
};
