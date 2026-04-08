import express from 'express';
import ProtocolRule from '../models/ProtocolRule.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * GET /api/protocols
 * Returns all custom protocol rules from MongoDB.
 */
router.get('/', async (req, res) => {
  try {
    const rules = await ProtocolRule.find({}).lean();
    const formatted = rules.map(r => ({
      id: r.ruleId,
      index: r.index,
      type: r.type,
      mgsp: r.mgsp,
      createdBy: r.createdBy || '',
    }));
    res.json(formatted);
  } catch (error) {
    console.error('[Protocols] Failed to fetch rules:', error);
    res.json([]);
  }
});

/**
 * POST /api/protocols
 * Creates a new custom protocol rule.
 */
router.post('/', protect, async (req, res) => {
  try {
    const { id, index, type, mgsp, createdBy } = req.body;

    if (!index || !type || !mgsp) {
      return res.status(400).json({ error: 'index, type, and mgsp are required' });
    }

    // Check for duplicates
    const existing = await ProtocolRule.findOne({ index });
    if (existing) {
      return res.status(409).json({ error: 'Rule with this index already exists', existingRule: existing });
    }

    const rule = new ProtocolRule({
      ruleId: id || Date.now().toString(),
      index,
      type,
      mgsp,
      createdBy: createdBy || '',
    });

    await rule.save();
    res.json({ success: true, rule: { id: rule.ruleId, index: rule.index, type: rule.type, mgsp: rule.mgsp, createdBy: rule.createdBy } });
  } catch (error: any) {
    console.error('[Protocols] Failed to save rule:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/protocols/:id
 * Deletes a protocol rule by its ruleId.
 */
router.delete('/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await ProtocolRule.findOneAndDelete({ ruleId: id });
    if (!result) {
      return res.status(404).json({ error: 'Rule not found' });
    }
    res.json({ success: true });
  } catch (error: any) {
    console.error('[Protocols] Failed to delete rule:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
