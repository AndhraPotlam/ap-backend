import mongoose, { Document, Schema } from 'mongoose';

export interface IExpenseCategory extends Document {
  name: string;
  description?: string;
  isActive: boolean;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const expenseCategorySchema = new Schema<IExpenseCategory>({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 120,
    unique: true,
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500,
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
}, { timestamps: true });

export const ExpenseCategory = mongoose.model<IExpenseCategory>('ExpenseCategory', expenseCategorySchema);


