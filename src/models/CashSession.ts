import mongoose, { Schema, Types } from 'mongoose';

export interface ICashSession {
  date: Date; // business date (no time significance beyond grouping)
  sessionName: string; // e.g., "Morning", "Afternoon", "Evening"
  openedBy: Types.ObjectId;
  closedBy?: Types.ObjectId;
  openingAmount: number;
  closingAmount?: number;
  notes?: string;
  status: 'open' | 'closed';
  openedAt: Date;
  closedAt?: Date;
}

const cashSessionSchema = new Schema<ICashSession>({
  date: { type: Date, required: true, index: true },
  sessionName: { type: String, required: true, index: true },
  openedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  closedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  openingAmount: { type: Number, required: true, min: 0 },
  closingAmount: { type: Number, min: 0 },
  notes: { type: String, trim: true },
  status: { type: String, enum: ['open', 'closed'], default: 'open', index: true },
  openedAt: { type: Date, default: Date.now },
  closedAt: { type: Date },
}, { timestamps: true });

export const CashSession = mongoose.model<ICashSession>('CashSession', cashSessionSchema);


