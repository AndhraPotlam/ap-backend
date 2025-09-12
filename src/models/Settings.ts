import mongoose, { Document, Schema } from 'mongoose';

export interface ISettings extends Document {
  key: string;
  value: any;
  description?: string;
  category: 'pricing' | 'shipping' | 'general' | 'email' | 'payment';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const settingsSchema = new Schema<ISettings>({
  key: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  value: {
    type: Schema.Types.Mixed,
    required: true
  },
  description: {
    type: String,
    trim: true
  },
  category: {
    type: String,
    enum: ['pricing', 'shipping', 'general', 'email', 'payment'],
    required: true,
    default: 'general'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for efficient queries
settingsSchema.index({ category: 1 });
settingsSchema.index({ isActive: 1 });

export default mongoose.model<ISettings>('Settings', settingsSchema);
