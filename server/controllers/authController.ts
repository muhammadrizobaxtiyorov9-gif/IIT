import { Request, Response } from 'express';
import AdminUser from '../models/AdminUser';
import { v4 as uuidv4 } from 'uuid'; // need uuid or a simple generator

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

        if (user.password !== password) {
            return res.status(401).json({ error: 'Noto\'g\'ri parol' });
        }

        // Update login info
        user.lastLogin = Date.now();
        await user.save();

        res.json({
            success: true,
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

        const newUser = new AdminUser({
            uid: generateUid(),
            username,
            password,
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
