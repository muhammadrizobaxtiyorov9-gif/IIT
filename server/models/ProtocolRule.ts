import mongoose, { Schema, Document } from 'mongoose';

export interface IProtocolRule extends Document {
  ruleId: string;       // Unique identifier (e.g., timestamp-based)
  index: string;        // Format: "7200-6980" (fromCode-toCode)
  type: 'qabul' | 'topshirish';
  mgsp: string;        // Target junction station name
  createdBy?: string;   // Who created this rule
  createdAt: Date;
}

const ProtocolRuleSchema: Schema = new Schema({
  ruleId: { type: String, required: true, unique: true, index: true },
  index: { type: String, required: true },
  type: { type: String, required: true, enum: ['qabul', 'topshirish'] },
  mgsp: { type: String, required: true },
  createdBy: { type: String, default: '' },
}, {
  timestamps: true,
  collection: 'protocol_rules'
});

export default mongoose.model<IProtocolRule>('ProtocolRule', ProtocolRuleSchema);
