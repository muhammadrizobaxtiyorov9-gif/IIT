import { Router } from 'express';
import { login, addAdmin, getAdmins } from '../controllers/authController';
import { protect } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/login', login);
router.post('/add', protect, addAdmin);
router.get('/', protect, getAdmins);

export default router;
