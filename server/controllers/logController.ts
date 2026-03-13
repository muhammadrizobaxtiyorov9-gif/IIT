import { Request, Response } from 'express';
import SystemLog from '../models/SystemLog';

export const saveLog = async (req: Request, res: Response) => {
    try {
        const { id, action, username, timestamp, details } = req.body;

        const newLog = new SystemLog({ id, action, username, timestamp, details });
        await newLog.save();

        res.status(201).json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
};

export const getLogs = async (req: Request, res: Response) => {
    try {
        const { username, isSuperAdmin } = req.query;

        let query: any = {};
        
        // Users can only view their own logs
        if (isSuperAdmin !== 'true' && username) {
            query.username = username;
        }

        const logs = await SystemLog.find(query).sort({ timestamp: -1 }).limit(100);
        res.json(logs);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
};
