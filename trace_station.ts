import { readFileSync } from 'fs';

// 1. Read the JSON manually to mimic the import
const jsonRaw = readFileSync('./client/public/data/station_data.json', 'utf-8');
const stationDataJson = JSON.parse(jsonRaw);

// 2. Mock RAW_STATION_DATA
const RAW_STATION_DATA = "72802 Мароканд\n72801 Улус\n";

// 3. Recreate the parser.ts functions exactly as they are
const detectCountryAndRegion = (code: string, explicitOtd?: number) => {
  return { dor: 73, otd: explicitOtd || 3, regionName: "Узбекистан" };
};

const parseStationData = (rawText: string): any[] => {
  const stations: any[] = [];
  try {
    const extraStations = stationDataJson as any[];
    for (const item of extraStations) {
      const fullCode = item.code;
      const name = item.station_name;
      const isBorderPoint = item.isBorderPoint;

      let dor = typeof item.dor === 'number' ? item.dor : undefined;
      const explicitOtd = typeof item.otd === 'number' ? item.otd : undefined;
      const country = item.country;

      const detection = detectCountryAndRegion(fullCode, explicitOtd);
      dor = dor !== undefined ? dor : detection.dor;
      const otd = detection.otd;

      let regionName = country || detection.regionName;
      if (dor === 73 || country === "Узбекистан") {
        regionName = "Узбекистан";
        dor = 73;
      }

      let id = fullCode;
      if (dor === 73 && fullCode.length >= 6) {
        id = fullCode.substring(0, 5);
      }

      const existingIdx = stations.findIndex(s => s.fullCode === fullCode);
      const stationObj = {
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

const createStationMap = (stations: any[]) => {
  const map = new Map<string, any>();

  // First pass: exact matches
  for (const s of stations) {
    if (!map.has(s.fullCode)) {
      map.set(s.fullCode, s);
    }
  }

  // Second pass: standard IDs (truncations) - only if they don't overwrite a true exact match
  for (const s of stations) {
    if (s.id !== s.fullCode) {
      if (!map.has(s.id) || map.get(s.id)?.fullCode !== s.id) {
        map.set(s.id, s);
      }
    }
  }

  // Second pass: prefixes
  for (const s of stations) {
    if (s.fullCode.length >= 4) {
      const prefix4 = s.fullCode.substring(0, 4);
      if (!map.has(prefix4) || (s.isBorderPoint && !map.get(prefix4)?.isBorderPoint)) {
        map.set(prefix4, s);
      }
    }

    if (s.fullCode.length >= 5) {
      const standardKey = s.fullCode.substring(0, 5);
      if (!map.has(standardKey)) map.set(standardKey, s);
    }
  }

  return map;
};

const findStationFast = (code: string, stationMap: Map<string, any>, stationsArr?: any[]) => {
  if (!code) return undefined;

  const exact = stationMap.get(code);
  if (exact) {
      console.log(`[Lookup: ${code}] Match 1. Exact ->`, exact.name);
      return exact;
  }

  if (code.length === 6) {
    const prefix5 = code.substring(0, 5);
    const match5 = stationMap.get(prefix5);
    if (match5) {
        console.log(`[Lookup: ${code}] Match 2. Prefix 5 ->`, match5.name);
        return match5;
    }
  }
  
  if (code.length >= 4) {
    const prefix4 = code.substring(0, 4);
    const match4 = stationMap.get(prefix4);
    if (match4) {
        console.log(`[Lookup: ${code}] Match 3. Prefix 4 ->`, match4.name);
        return match4;
    }
  }

  return undefined;
};

const stations = parseStationData("");
const map = createStationMap(stations);

console.log("Total stations loaded:", stations.length);
console.log("Looking up '72802'...");
console.log("Result:", findStationFast('72802', map, stations)?.name);

console.log("\nWhat is actually stored in the map for keys related to 72802?");
console.log("Key '72802':", map.get('72802')?.name);
console.log("Key '7280':", map.get('7280')?.name);
console.log("All Ulus stations in map:");
for (const [k, v] of map.entries()) {
    if (v.name === 'Улус') console.log(`Key: ${k}, fullCode: ${v.fullCode}`);
}
console.log("All Marokand stations in map:");
for (const [k, v] of map.entries()) {
    if (v.name === 'Мароканд') console.log(`Key: ${k}, fullCode: ${v.fullCode}`);
}
