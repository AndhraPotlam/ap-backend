import mongoose, { Document, Schema } from 'mongoose';

export interface ITask extends Document {
  title: string;
  description: string;
  taskFor: 'hotel' | 'restaurant' | 'maintenance' | 'cleaning' | 'security' | 'guest_services' | 'other';
  taskOwner: mongoose.Types.ObjectId; // User assigned to the task
  assignedBy: mongoose.Types.ObjectId; // User who assigned the task
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'on_hold';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  startTime?: Date;
  endTime?: Date;
  timeTaken?: number; // in minutes
  procedure?: string;
  checklistType: 'daily' | 'weekly' | 'monthly' | 'custom';
  dueDate?: Date;
  completedAt?: Date;
  notes?: string;
  attachments?: string[]; // URLs to attached files
  isRecurring: boolean;
  recurringPattern?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    interval: number; // every X days/weeks/months
    daysOfWeek?: number[]; // 0-6 for weekly (0 = Sunday)
    dayOfMonth?: number; // 1-31 for monthly
  };
  parentTask?: mongoose.Types.ObjectId; // for subtasks
  subtasks?: mongoose.Types.ObjectId[]; // array of subtask IDs
  tags?: string[];
  location?: string;
  estimatedDuration?: number; // in minutes
  actualDuration?: number; // in minutes
  createdAt: Date;
  updatedAt: Date;
}

const taskSchema = new Schema<ITask>({
  title: {
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
  taskOwner: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'in_progress', 'completed', 'cancelled', 'on_hold'],
    default: 'pending'
  },
  priority: {
    type: String,
    required: true,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  startTime: {
    type: Date
  },
  endTime: {
    type: Date
  },
  timeTaken: {
    type: Number,
    min: 0
  },
  procedure: {
    type: String,
    trim: true,
    maxlength: 2000
  },
  checklistType: {
    type: String,
    required: true,
    enum: ['daily', 'weekly', 'monthly', 'custom'],
    default: 'custom'
  },
  dueDate: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  notes: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  attachments: [{
    type: String
  }],
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurringPattern: {
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly']
    },
    interval: {
      type: Number,
      min: 1
    },
    daysOfWeek: [{
      type: Number,
      min: 0,
      max: 6
    }],
    dayOfMonth: {
      type: Number,
      min: 1,
      max: 31
    }
  },
  parentTask: {
    type: Schema.Types.ObjectId,
    ref: 'Task'
  },
  subtasks: [{
    type: Schema.Types.ObjectId,
    ref: 'Task'
  }],
  tags: [{
    type: String,
    trim: true
  }],
  location: {
    type: String,
    trim: true,
    maxlength: 100
  },
  estimatedDuration: {
    type: Number,
    min: 0
  },
  actualDuration: {
    type: Number,
    min: 0
  }
}, {
  timestamps: true
});

// Indexes for better query performance
taskSchema.index({ taskOwner: 1, status: 1 });
taskSchema.index({ assignedBy: 1 });
taskSchema.index({ status: 1 });
taskSchema.index({ checklistType: 1 });
taskSchema.index({ dueDate: 1 });
taskSchema.index({ createdAt: -1 });
taskSchema.index({ taskFor: 1 });

// Virtual for calculating time taken
taskSchema.virtual('calculatedTimeTaken').get(function() {
  if (this.startTime && this.endTime) {
    return Math.round((this.endTime.getTime() - this.startTime.getTime()) / (1000 * 60)); // in minutes
  }
  return this.timeTaken;
});

// Pre-save middleware to calculate time taken
taskSchema.pre('save', function(next) {
  if (this.startTime && this.endTime && !this.timeTaken) {
    this.timeTaken = Math.round((this.endTime.getTime() - this.startTime.getTime()) / (1000 * 60));
  }
  next();
});

// Pre-save middleware to set completedAt when status changes to completed
taskSchema.pre('save', function(next) {
  if (this.isModified('status') && this.status === 'completed' && !this.completedAt) {
    this.completedAt = new Date();
  }
  next();
});

export const Task = mongoose.model<ITask>('Task', taskSchema);
