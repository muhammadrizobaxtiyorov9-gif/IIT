const fs = require('fs');
const path = require('path');

const historyDir = 'C:\\Users\\Magicbook\\AppData\\Roaming\\Code\\User\\History';
let results = [];

function search(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
            search(fullPath);
        } else if (file !== 'entries.json') {
            if (stat.size > 20000 && stat.size < 150000) {
                try {
                    const content = fs.readFileSync(fullPath, 'utf8');
                    if (content.includes('rehydrateWagons') && content.includes('function App(')) {
                        results.push({
                            path: fullPath,
                            time: stat.mtime,
                            size: stat.size
                        });
                    }
                } catch(e) {}
            }
        }
    }
}

console.log('Searching VS Code history for App.tsx versions broadly...');
search(historyDir);

results.sort((a, b) => b.time - a.time); // newest first

console.log(`Found ${results.length} matches.`);
for (let i = 0; i < Math.min(results.length, 20); i++) {
    console.log(`[${i}] ${results[i].time.toLocaleString()} - ${results[i].path} (Size: ${results[i].size})`);
}
