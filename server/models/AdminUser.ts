import mongoose, { Schema, Document } from 'mongoose';

export interface IAdminUser extends Document {
  uid: string;
  username: string;
  password?: string;
  role: 'superadmin' | 'admin' | 'user';
  name?: string;
  lastLogin?: number;
  deviceInfo?: string;
  userAgent?: string;
  addedAt: number;
  createdBy?: string;
}

const adminUserSchema = new Schema<IAdminUser>({
  uid: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  password: { type: String }, // Should be hashed in production
  role: { type: String, enum: ['superadmin', 'admin', 'user'], default: 'user' },
  name: { type: String },
  lastLogin: { type: Number },
  deviceInfo: { type: String },
  userAgent: { type: String },
  addedAt: { type: Number, default: Date.now },
  createdBy: { type: String }
}, {
  timestamps: true // Automatically adds createdAt and updatedAt
});

const AdminUser = mongoose.model<IAdminUser>('AdminUser', adminUserSchema);
export default AdminUser;
