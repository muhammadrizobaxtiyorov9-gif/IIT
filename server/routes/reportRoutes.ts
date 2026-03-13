import { Router } from 'express';
import { saveReport, getReport, getReportDates, deleteReport, clearLegacyData } from '../controllers/reportController';

const router = Router();

router.delete('/utility/cleanup', clearLegacyData);
router.post('/', saveReport);
router.put('/:date', saveReport);
router.get('/', getReportDates);
router.get('/:date', getReport);
router.delete('/:date', deleteReport);

export default router;
