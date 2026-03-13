import { Router } from 'express';
import { login, addAdmin, getAdmins } from '../controllers/authController';

const router = Router();

router.post('/login', login);
router.post('/add', addAdmin);
router.get('/', getAdmins);

export default router;
