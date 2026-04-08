import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import connectDB from './config/db';

// Security Middleware
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
// Routes
import authRoutes from './routes/authRoutes';
import reportRoutes from './routes/reportRoutes';
import logRoutes from './routes/logRoutes';
import integrationRoutes from './routes/integrationRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js'; // Modular settings router
import protocolRoutes from './routes/protocolRoutes.js'; // Protocol rules API

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Connect to MongoDB
  await connectDB();

  // Security Middleware Layer
  app.use(helmet()); // Set security HTTP headers
  
  // Rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // Limit each IP to 500 requests per `window` (here, per 15 minutes)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  });
  app.use('/api', limiter);

  // Standard Middleware
  app.use(cors());
  app.use(express.json({ limit: '2mb' })); // Reduced from 50mb to prevent DoS
  app.use(express.urlencoded({ limit: '2mb', extended: true }));

  // Static Data paths
  const STATION_DATA_FILE = path.join(__dirname, '../client/public/data/station_data.json');

  // --- MONGO DB API ROUTES ---
  app.use('/api/auth', authRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/logs', logRoutes);
  app.use('/api/integration', integrationRoutes); // ADDED
  app.use('/api/settings', settingsRoutes);       // ADDED (Modular Refactoring)
  app.use('/api/protocols', protocolRoutes);       // Protocol rules (custom overrides)

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
