import { Router } from 'express';
import { syncRailwayData } from '../controllers/integrationController';

const router = Router();

// POST /api/integration/sync
// Requires { date: "YYYY-MM-DD" }
router.post('/sync', syncRailwayData);

export default router;
