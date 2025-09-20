import mongoose, { Schema, Types } from 'mongoose';

export interface ICashEntry {
  session: Types.ObjectId; // CashSession reference
  type: 'opening' | 'closing' | 'in' | 'out';
  amount: number;
  description?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
}

const cashEntrySchema = new Schema<ICashEntry>({
  session: { type: Schema.Types.ObjectId, ref: 'CashSession', required: true, index: true },
  type: { type: String, enum: ['opening', 'closing', 'in', 'out'], required: true, index: true },
  amount: { type: Number, required: true, min: 0 },
  description: { type: String, trim: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

export const CashEntry = mongoose.model<ICashEntry>('CashEntry', cashEntrySchema);


