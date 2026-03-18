import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import connectDB from './config/db';

// Routes
import authRoutes from './routes/authRoutes';
import reportRoutes from './routes/reportRoutes';
import logRoutes from './routes/logRoutes';
import integrationRoutes from './routes/integrationRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js'; // Modular settings router

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Connect to MongoDB
  await connectDB();

  // Middleware
  app.use(cors());
  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

  // Static Data paths
  const STATION_DATA_FILE = path.join(__dirname, '../client/public/data/station_data.json');

  // --- MONGO DB API ROUTES ---
  app.use('/api/auth', authRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/logs', logRoutes);
  app.use('/api/integration', integrationRoutes); // ADDED
  app.use('/api/settings', settingsRoutes);       // ADDED (Modular Refactoring)

  // --- STATIC FILE ROUTES (For huge fixed datasets) ---
  
  // 1. Upload Station Data (Admin tool saves raw JSON back to disk)
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

  // 2. Fetch Station Data
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
      res.json([]);
    }
  });

  // Express will only serve the API. 
  // The frontend will run independently on a Vite dev server (port 5173) in dev, 
  // or be served by a separate web server (NGINX/Vercel/etc) in production.
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
