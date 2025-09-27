import mongoose, { Document, Schema } from 'mongoose';

export interface IRawMaterial extends Document {
  name: string;
  description?: string;
  category: string; // e.g., 'vegetables', 'spices', 'grains', 'dairy', 'meat', 'pantry'
  unit: string; // e.g., 'kg', 'g', 'l', 'ml', 'pieces', 'cups', 'tbsp', 'tsp'
  costPerUnit: number; // cost per unit
  supplier?: string;
  minimumStock: number;
  currentStock: number;
  isActive: boolean;
  createdBy?: mongoose.Types.ObjectId;
}

const rawMaterialSchema = new Schema<IRawMaterial>({
  name: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, trim: true, maxlength: 1000 },
  category: { type: String, required: true, trim: true, maxlength: 100 },
  unit: { type: String, required: true, trim: true, maxlength: 20 },
  costPerUnit: { type: Number, required: true, min: 0 },
  supplier: { type: String, trim: true, maxlength: 200 },
  minimumStock: { type: Number, required: true, min: 0, default: 0 },
  currentStock: { type: Number, required: true, min: 0, default: 0 },
  isActive: { type: Boolean, default: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

rawMaterialSchema.index({ name: 1 }, { unique: false });
rawMaterialSchema.index({ category: 1 });

export const RawMaterial = mongoose.model<IRawMaterial>('RawMaterial', rawMaterialSchema);
