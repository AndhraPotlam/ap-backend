import mongoose, { Document, Schema } from 'mongoose';

export interface ITaskTemplate extends Document {
  name: string;
  description: string;
  taskFor: 'hotel' | 'restaurant' | 'maintenance' | 'cleaning' | 'security' | 'guest_services' | 'other';
  procedure: string;
  checklistType: 'daily' | 'weekly' | 'monthly' | 'custom';
  estimatedDuration: number; // in minutes
  priority: 'low' | 'medium' | 'high' | 'urgent';
  tags: string[];
  location?: string;
  isActive: boolean;
  createdBy: mongoose.Types.ObjectId;
  category: string;
  instructions: string[];
  requiredSkills?: string[];
  equipment?: string[];
  safetyNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const taskTemplateSchema = new Schema<ITaskTemplate>({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  taskFor: {
    type: String,
    required: true,
    enum: ['hotel', 'restaurant', 'maintenance', 'cleaning', 'security', 'guest_services', 'other'],
    default: 'hotel'
  },
  procedure: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  checklistType: {
    type: String,
    required: true,
    enum: ['daily', 'weekly', 'monthly', 'custom'],
    default: 'custom'
  },
  estimatedDuration: {
    type: Number,
    required: true,
    min: 0
  },
  priority: {
    type: String,
    required: true,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  tags: [{
    type: String,
    trim: true
  }],
  location: {
    type: String,
    trim: true,
    maxlength: 100
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  category: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  instructions: [{
    type: String,
    trim: true,
    maxlength: 500
  }],
  requiredSkills: [{
    type: String,
    trim: true
  }],
  equipment: [{
    type: String,
    trim: true
  }],
  safetyNotes: {
    type: String,
    trim: true,
    maxlength: 1000
  }
}, {
  timestamps: true
});

// Indexes for better query performance
taskTemplateSchema.index({ checklistType: 1, isActive: 1 });
taskTemplateSchema.index({ taskFor: 1, isActive: 1 });
taskTemplateSchema.index({ category: 1 });
taskTemplateSchema.index({ createdBy: 1 });

export const TaskTemplate = mongoose.model<ITaskTemplate>('TaskTemplate', taskTemplateSchema);
