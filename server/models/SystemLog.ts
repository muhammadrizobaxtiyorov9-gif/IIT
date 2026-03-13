import mongoose, { Schema, Document } from 'mongoose';

export interface ISystemLog extends Document {
  id: string;
  action: string;      // LOGIN, WAGON_ADD, etc
  username: string;
  timestamp: string;   // ISO Date String
  details: string;
}

const systemLogSchema = new Schema<ISystemLog>({
  id: { type: String, required: true, unique: true },
  action: { type: String, required: true },
  username: { type: String, required: true },
  timestamp: { type: String, required: true },
  details: { type: String }
}, {
  timestamps: true
});

const SystemLog = mongoose.model<ISystemLog>('SystemLog', systemLogSchema);
export default SystemLog;
