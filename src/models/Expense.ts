import mongoose, { Document, Schema } from 'mongoose';

export type ExpensePaymentType = 'cash' | 'online';

export interface IExpense extends Document {
  amount: number;
  paymentType: ExpensePaymentType;
  paidBy: mongoose.Types.ObjectId; // User who paid
  category: mongoose.Types.ObjectId; // ExpenseCategory
  date: Date; // expense date
  description?: string;
  notes?: string;
  attachments?: string[]; // optional URLs
  createdBy?: mongoose.Types.ObjectId; // who recorded
  createdAt: Date;
  updatedAt: Date;
}

const expenseSchema = new Schema<IExpense>({
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  paymentType: {
    type: String,
    enum: ['cash', 'online'],
    required: true,
    index: true,
  },
  paidBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  category: {
    type: Schema.Types.ObjectId,
    ref: 'ExpenseCategory',
    required: true,
    index: true,
  },
  date: {
    type: Date,
    required: true,
    index: true,
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500,
  },
  notes: {
    type: String,
    trim: true,
    maxlength: 1000,
  },
  attachments: [{ type: String }],
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
}, { timestamps: true });

export const Expense = mongoose.model<IExpense>('Expense', expenseSchema);


