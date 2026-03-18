import mongoose, { Schema, Document } from 'mongoose';

export interface ISettings extends Document {
  id: string;
  mapPoints?: any[];
  mtuRegions?: any[];
  [key: string]: any; // Allow flexible fields like Firestore
}

// Ensure the collection name matches the one imported from Firestore
const SettingsSchema: Schema = new Schema({
  id: { type: String, required: true, default: 'map_config', index: true },
  mapPoints: { type: Schema.Types.Mixed, default: [] },
  mtuRegions: { type: Schema.Types.Mixed, default: [] },
}, { 
  strict: false, 
  timestamps: true, 
  collection: 'settings' 
});

export default mongoose.model<ISettings>('Settings', SettingsSchema);
