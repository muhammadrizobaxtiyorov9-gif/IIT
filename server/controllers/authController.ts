import { Request, Response } from 'express';
import AdminUser from '../models/AdminUser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

const JWT_SECRET = process.env.JWT_SECRET || 'secure-railway-secret-key-2026';

// Helper
const generateUid = () => {
    return Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 9);
};

export const login = async (req: Request, res: Response) => {
    try {
        const { username, password } = req.body;

        const user = await AdminUser.findOne({ username });
        if (!user) {
            return res.status(401).json({ error: 'Foydalanuvchi topilmadi' });
        }

        let isMatch = false;
        
        // Legacy Password Migration Support
        // If password is not a bcrypt hash (doesn't start with $2), check if plain text matches
        if (!user.password.startsWith('$2a$') && !user.password.startsWith('$2b$')) {
            if (user.password === password) {
                isMatch = true;
                // Auto-upgrade the password to a hash immediately
                user.password = await bcrypt.hash(password, 10);
            }
        } else {
            // Verify bcrypt hash
            isMatch = await bcrypt.compare(password, user.password);
        }

        if (!isMatch) {
            return res.status(401).json({ error: 'Noto\'g\'ri parol' });
        }

        // Generate JWT Token (Expires in 24 hours)
        const token = jwt.sign(
            { uid: user.uid, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Update login info
        user.lastLogin = Date.now();
        await user.save();

        res.json({
            success: true,
            token,
            user: {
                uid: user.uid,
                username: user.username,
                role: user.role,
                name: user.name
            }
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
};

export const addAdmin = async (req: Request, res: Response) => {
    try {
        const { username, password, role, name, createdBy } = req.body;

        const existing = await AdminUser.findOne({ username });
        if (existing) {
            return res.status(400).json({ error: 'Bu login band' });
        }

        // Hash the new password before storing
        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new AdminUser({
            uid: generateUid(),
            username,
            password: hashedPassword,
            role: role || 'user',
            name,
            createdBy
        });

        await newUser.save();
        res.status(201).json({ success: true, uid: newUser.uid });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
};

export const getAdmins = async (req: Request, res: Response) => {
    try {
        const users = await AdminUser.find({}, '-password').sort({ addedAt: -1 });
        res.json(users);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
};
