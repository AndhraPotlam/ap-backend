import mongoose, { Document, Schema } from 'mongoose';

export interface IStepTaskTemplate {
  _id?: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  type: 'cooking'|'cutting'|'preparing'|'cleaning'|'mixing'|'removing'|'soaking'|'other';
  procedure?: string;
  priority: 'low'|'medium'|'high'|'urgent';
  itemsUsed?: string[];
  defaultAssignees?: mongoose.Types.ObjectId[]; // User ids
  timeWindow: { startOffsetMin: number; durationMin: number; };
  taskFor?: string[];
  tags?: string[];
  location?: string;
}

export interface IRecipeStep {
  _id?: mongoose.Types.ObjectId;
  name: string;
  order: number;
  instructions?: string;
  location?: string;
  estimatedDurationMin?: number;
  tasks: IStepTaskTemplate[];
}

export interface IRecipeProcess extends Document {
  name: string;
  description?: string;
  category?: string;
  isActive: boolean;
  steps: IRecipeStep[];
  createdBy?: mongoose.Types.ObjectId;
}

const stepTaskTemplateSchema = new Schema<IStepTaskTemplate>({
  name: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, trim: true, maxlength: 1000 },
  type: { type: String, required: true, enum: ['cooking','cutting','preparing','cleaning','mixing','removing','soaking','other'], default: 'other' },
  procedure: { type: String, trim: true, maxlength: 2000 },
  priority: { type: String, required: true, enum: ['low','medium','high','urgent'], default: 'medium' },
  itemsUsed: [{ type: String, trim: true }],
  defaultAssignees: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  timeWindow: {
    startOffsetMin: { type: Number, required: true, min: 0, default: 0 },
    durationMin: { type: Number, required: true, min: 1, default: 5 }
  },
  taskFor: [{ type: String, trim: true }],
  tags: [{ type: String, trim: true }],
  location: { type: String, trim: true, maxlength: 100 }
});

const recipeStepSchema = new Schema<IRecipeStep>({
  name: { type: String, required: true, trim: true, maxlength: 200 },
  order: { type: Number, required: true, min: 0 },
  instructions: { type: String, trim: true, maxlength: 2000 },
  location: { type: String, trim: true, maxlength: 100 },
  estimatedDurationMin: { type: Number, min: 0 },
  tasks: { type: [stepTaskTemplateSchema], default: [] }
});

const recipeProcessSchema = new Schema<IRecipeProcess>({
  name: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, trim: true, maxlength: 1000 },
  category: { type: String, trim: true, maxlength: 100 },
  isActive: { type: Boolean, default: true },
  steps: { type: [recipeStepSchema], default: [] },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

recipeProcessSchema.index({ name: 1 }, { unique: false });

export const RecipeProcess = mongoose.model<IRecipeProcess>('RecipeProcess', recipeProcessSchema);


