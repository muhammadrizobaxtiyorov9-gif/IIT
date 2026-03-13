import { readFileSync } from "fs";

// Load station_data.json manually to simulate the environment
const JSON_PATH = "C:/Users/Magicbook/Desktop/IIT/client/public/data/station_data.json";
const stationDataJson = JSON.parse(readFileSync(JSON_PATH, "utf-8"));

export const detectCountryAndRegion = (code: string, explicitOtd?: number) => {
    return { dor: 73, otd: 3, regionName: "Узбекистан" };
};

const parseStationData = (rawText: string): any[] => {
  const stations: any[] = [];
  try {
    const extraStations = stationDataJson as any[];
    for (const item of extraStations) {
      const fullCode = item.code;
      const name = item.station_name;
      const isBorderPoint = item.isBorderPoint;

      let dor = typeof item.dor === "number" ? item.dor : undefined;
      const explicitOtd = typeof item.otd === "number" ? item.otd : undefined;
      const country = item.country;

      const detection = detectCountryAndRegion(fullCode, explicitOtd);
      dor = 73;

      let id = fullCode;
      if (dor === 73 && fullCode.length >= 6) {
        id = fullCode.substring(0, 5);
      }

      stations.push({
        id,
        fullCode,
        name,
        dor,
        otd: detection.otd,
        regionName: "Узбекистан",
        isBorderPoint
      });
    }
  } catch (e) {
    console.error(e);
  }
  return stations;
};

const createStationMap = (stations: any[]) => {
  const map = new Map<string, any>();
  for (const s of stations) {
    map.set(s.fullCode, s);
    if (s.id !== s.fullCode) {
      map.set(s.id, s);
    }
  }
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
  if (exact) return exact;
  if (code.length === 6) {
    const prefix5 = code.substring(0, 5);
    const match5 = stationMap.get(prefix5);
    if (match5) return match5;
  }
  if (code.length >= 4) {
    const prefix4 = code.substring(0, 4);
    const match4 = stationMap.get(prefix4);
    if (match4) return match4;
  }
  return undefined;
};

const stations = parseStationData("");
const map = createStationMap(stations);

console.log("Looking up 72802:", findStationFast("72802", map, stations)?.name);
console.log("Looking up 72801:", findStationFast("72801", map, stations)?.name);
console.log("Is 72802 exactly in map?:", !!map.get("72802"));
console.log("What is 7280 mapped to?:", map.get("7280")?.name);
