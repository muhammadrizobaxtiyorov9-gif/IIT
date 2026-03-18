import express from 'express';
import Settings from '../models/Settings.js';

const router = express.Router();

/**
 * GET /api/settings
 * 
 * Serves map settings from MongoDB. Handles 3 known document shapes:
 *   1. FLAT (priority): { id, mapPoints, mtuRegions } — correct format, prioritized
 *   2. NESTED FIREBASE:  { settings: { map_config: { mapPoints, mtuRegions } } }
 *   3. MAP_CONFIG TOP:   { map_config: { mapPoints, mtuRegions } }
 */
router.get('/', async (req, res) => {
  try {
    console.log("\n--- GET /api/settings ---");

    // PRIORITY 1: Flat document — this is already exactly what the frontend needs
    const flatDoc = await Settings.findOne({ mapPoints: { $exists: true } }).lean();
    if (flatDoc?.mapPoints) {
      console.log(`[Settings] Flat doc found. mapPoints: ${(flatDoc.mapPoints as any[]).length}, mtuRegions: ${(flatDoc.mtuRegions as any[] || []).length}`);
      return res.json({
        id: flatDoc.id || "map_config",
        mapPoints: flatDoc.mapPoints,
        mtuRegions: flatDoc.mtuRegions || []
      });
    }

    // PRIORITY 2: Firebase nested export { settings: { map_config: { mapPoints } } }
    const nestedDoc = await Settings.findOne({ 'settings.map_config': { $exists: true } }).lean();
    if (nestedDoc?.settings?.map_config) {
      const mc = (nestedDoc.settings as any).map_config;
      console.log(`[Settings] Firebase nested doc found. mapPoints: ${mc.mapPoints?.length || 0}`);
      return res.json({
        id: mc.id || "map_config",
        mapPoints: mc.mapPoints || [],
        mtuRegions: mc.mtuRegions || []
      });
    }

    // PRIORITY 3: Top-level map_config key
    const topDoc = await Settings.findOne({ map_config: { $exists: true } }).lean();
    if (topDoc?.map_config) {
      const mc = topDoc.map_config as any;
      console.log(`[Settings] Top-level map_config found. mapPoints: ${mc.mapPoints?.length || 0}`);
      return res.json({
        id: mc.id || "map_config",
        mapPoints: mc.mapPoints || [],
        mtuRegions: mc.mtuRegions || []
      });
    }

    console.log("[Settings] No valid settings document found.");
    return res.json({ id: "map_config", mapPoints: [], mtuRegions: [] });

  } catch (error) {
    console.error("[Settings] Failed to fetch settings from DB:", error);
    res.json({ id: "map_config", mapPoints: [], mtuRegions: [] });
  }
});

/**
 * POST /api/settings
 * Upserts the flat map_config document.
 */
router.post('/', async (req, res) => {
  try {
    const { mapPoints, mtuRegions } = req.body;
    await Settings.findOneAndUpdate(
      { id: 'map_config' },
      { $set: { id: 'map_config', mapPoints, mtuRegions } },
      { upsert: true, new: true }
    );
    res.json({ success: true });
  } catch (error) {
    console.error("[Settings] Failed to save settings to DB:", error);
    res.status(500).json({ error: 'Failed to write settings' });
  }
});

export default router;
