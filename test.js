const fs = require('fs');
const stationDataJson = JSON.parse(fs.readFileSync('./client/public/data/station_data.json', 'utf8'));

const stations = [];
for (const item of stationDataJson) {
  let id = item.code;
  if (item.dor === 73 && item.code.length >= 6) {
    id = item.code.substring(0, 5);
  }
  stations.push({
    id,
    fullCode: item.code,
    name: item.station_name,
    dor: item.dor
  });
}

const map = new Map();
// pass 1
for (const s of stations) {
  if (!map.has(s.fullCode)) map.set(s.fullCode, s);
}
// pass 2
for (const s of stations) {
  if (s.id !== s.fullCode) {
    if (!map.has(s.id) || map.get(s.id).fullCode !== s.id) {
      map.set(s.id, s);
    }
  }
}
// pass 3
for (const s of stations) {
  if (s.fullCode.length >= 4) {
    const p4 = s.fullCode.substring(0, 4);
    if (!map.has(p4)) map.set(p4, s);
  }
  if (s.fullCode.length >= 5) {
    const p5 = s.fullCode.substring(0, 5);
    if (!map.has(p5)) {
      map.set(p5, s);
      console.log(`Setting ${p5} from ${s.fullCode} (${s.name})`);
    }
  }
}

console.log("Lookup 72802 exact:", map.get('72802')?.name);
console.log("Lookup 72801 exact:", map.get('72801')?.name);
console.log("Lookup 7280 strict 4 prefix:", map.get('7280')?.name);

console.log("Ulus:", stations.filter(s => s.name === 'Улус'));
console.log("Marokand:", stations.filter(s => s.name === 'Мароканд'));
