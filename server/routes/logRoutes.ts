import { Router } from 'express';
import { saveLog, getLogs } from '../controllers/logController';

const router = Router();

router.post('/', saveLog);
router.get('/', getLogs);

export default router;
