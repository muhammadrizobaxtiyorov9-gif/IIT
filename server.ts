import express from 'express';
// import { createServer as createViteServer } from 'vite'; // Dynamically imported
import cors from 'cors';
import bodyParser from 'body-parser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(cors());
  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

  // Data directories
  const DATA_DIR = path.join(__dirname, 'data');
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

  const REPORTS_DIR = path.join(DATA_DIR, 'reports');
  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR);

  const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
  const STATION_DATA_FILE = path.join(DATA_DIR, 'station_data.json');

  // --- API ROUTES ---

  // 1. Upload Station Data
  app.post('/api/admin/upload-stations', async (req, res) => {
    try {
      const data = req.body;
      if (!Array.isArray(data)) {
        return res.status(400).json({ error: 'Data must be an array of stations' });
      }
      await fs.promises.writeFile(STATION_DATA_FILE, JSON.stringify(data, null, 2));
      console.log(`[Saved] Station data updated (${data.length} records)`);
      res.json({ success: true, count: data.length });
    } catch (e: any) {
      console.error("Station upload error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // 2. Get Station Data
  app.get('/api/station-data', async (req, res) => {
    if (fs.existsSync(STATION_DATA_FILE)) {
      try {
        const data = await fs.promises.readFile(STATION_DATA_FILE, 'utf8');
        res.json(JSON.parse(data));
      } catch (e) {
        console.error("Error reading station data:", e);
        res.json([]);
      }
    } else {
      // Fallback to empty array or bundled data logic on frontend
      res.json([]);
    }
  });

  // 3. Reports API
  app.post('/api/reports', async (req, res) => {
    try {
      const { date, ...data } = req.body;
      if (!date) return res.status(400).send('Date is required');

      const filePath = path.join(REPORTS_DIR, `${date}.json`);
      await fs.promises.writeFile(filePath, JSON.stringify({ date, ...data }, null, 2));

      console.log(`[Saved] Report for ${date}`);
      res.json({ success: true, message: "Saved" });
    } catch (e: any) {
      console.error("Save error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/reports/:date', async (req, res) => {
    const filePath = path.join(REPORTS_DIR, `${req.params.date}.json`);
    if (fs.existsSync(filePath)) {
      try {
        const data = await fs.promises.readFile(filePath, 'utf8');
        res.json(JSON.parse(data));
      } catch (e) {
        res.status(500).send('Error reading report');
      }
    } else {
      res.status(404).send('Report not found');
    }
  });

  app.get('/api/reports', async (req, res) => {
    try {
      const files = await fs.promises.readdir(REPORTS_DIR);
      const reportPromises = files
        .filter(file => file.endsWith('.json'))
        .map(async file => {
          const content = JSON.parse(await fs.promises.readFile(path.join(REPORTS_DIR, file), 'utf8'));
          return {
            date: content.date,
            timestamp: content.timestamp,
            wagonCount: content.wagons ? content.wagons.length : 0
          };
        });

      const reports = await Promise.all(reportPromises);
      res.json(reports);
    } catch (e) {
      res.json([]);
    }
  });

  app.delete('/api/reports/:date', async (req, res) => {
    const filePath = path.join(REPORTS_DIR, `${req.params.date}.json`);
    if (fs.existsSync(filePath)) {
      try {
        await fs.promises.unlink(filePath);
        console.log(`[Deleted] Report ${req.params.date}`);
        res.json({ success: true });
      } catch (e) {
        res.status(500).send('Error deleting report');
      }
    } else {
      res.status(404).send('Not found');
    }
  });

  // 4. Settings API
  app.post('/api/settings', async (req, res) => {
    try {
      await fs.promises.writeFile(SETTINGS_FILE, JSON.stringify(req.body, null, 2));
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to save settings" });
    }
  });

  app.get('/api/settings', async (req, res) => {
    if (fs.existsSync(SETTINGS_FILE)) {
      try {
        const data = await fs.promises.readFile(SETTINGS_FILE, 'utf8');
        res.json(JSON.parse(data));
      } catch (e) {
        res.json(null);
      }
    } else {
      res.json(null);
    }
  });

  // --- VITE MIDDLEWARE ---
  if (process.env.NODE_ENV !== 'production') {
    try {
      console.log('[Server] Starting in DEVELOPMENT mode');
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: {
          middlewareMode: true,
          hmr: false // EXPLICITLY DISABLE HMR to prevent WebSocket errors
        },
        appType: 'spa',
      });
      app.use(vite.middlewares);
      console.log('[Dev] Vite middleware initialized (HMR Disabled)');
    } catch (e) {
      console.error('[Dev] Failed to load Vite:', e);
    }
  } else {
    console.log('[Server] Starting in PRODUCTION mode');
    // Serve static files in production
    app.use(express.static(path.join(__dirname, 'dist')));

    // SPA Fallback - matches any route not handled above
    app.use((req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
