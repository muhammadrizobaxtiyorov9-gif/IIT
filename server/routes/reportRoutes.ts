import { Router } from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { saveReport, getReport, getReportDates, deleteReport, clearLegacyData } from '../controllers/reportController';

const router = Router();

router.delete('/utility/cleanup', protect, clearLegacyData);
router.post('/', protect, saveReport);
router.put('/:date', protect, saveReport);
router.get('/', getReportDates);
router.get('/:date', getReport);
router.delete('/:date', protect, deleteReport);

export default router;
