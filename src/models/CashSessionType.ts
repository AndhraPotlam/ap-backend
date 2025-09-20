import mongoose, { Schema } from 'mongoose';

export interface ICashSessionType {
  name: string;
  description?: string;
  isActive: boolean;
  createdBy: string; // User ID
}

const cashSessionTypeSchema = new Schema<ICashSessionType>({
  name: { type: String, required: true, unique: true, trim: true },
  description: { type: String, trim: true },
  isActive: { type: Boolean, default: true, index: true },
  createdBy: { type: String, required: true },
}, { timestamps: true });

export const CashSessionType = mongoose.model<ICashSessionType>('CashSessionType', cashSessionTypeSchema);


