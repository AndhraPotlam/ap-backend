import mongoose, { Document, Schema } from 'mongoose';

export interface IRecipeIngredient {
  _id?: mongoose.Types.ObjectId;
  rawMaterial: mongoose.Types.ObjectId; // Reference to RawMaterial
  quantity: number;
  unit: string; // Can be different from raw material's base unit
  notes?: string; // e.g., "finely chopped", "at room temperature"
}

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

export interface IRecipeProcess {
  _id?: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  steps: IRecipeStep[];
}

export interface IRecipe extends Document {
  name: string;
  description?: string;
  category?: string;
  serves: number; // Number of people this recipe serves
  prepTimeMin?: number; // Preparation time in minutes
  cookTimeMin?: number; // Cooking time in minutes
  totalTimeMin?: number; // Total time in minutes
  difficulty: 'easy' | 'medium' | 'hard';
  cuisine?: string; // e.g., 'Indian', 'Italian', 'Chinese'
  ingredients: IRecipeIngredient[];
  recipeProcess: IRecipeProcess; // The cooking process with steps and tasks
  isActive: boolean;
  createdBy?: mongoose.Types.ObjectId;
}

const recipeIngredientSchema = new Schema<IRecipeIngredient>({
  rawMaterial: { type: Schema.Types.ObjectId, ref: 'RawMaterial', required: true },
  quantity: { type: Number, required: true, min: 0 },
  unit: { type: String, required: true, trim: true, maxlength: 20 },
  notes: { type: String, trim: true, maxlength: 200 }
});

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
  steps: { type: [recipeStepSchema], default: [] }
});

const recipeSchema = new Schema<IRecipe>({
  name: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, trim: true, maxlength: 1000 },
  category: { type: String, trim: true, maxlength: 100 },
  serves: { type: Number, required: true, min: 1, default: 1 },
  prepTimeMin: { type: Number, min: 0 },
  cookTimeMin: { type: Number, min: 0 },
  totalTimeMin: { type: Number, min: 0 },
  difficulty: { type: String, required: true, enum: ['easy', 'medium', 'hard'], default: 'medium' },
  cuisine: { type: String, trim: true, maxlength: 100 },
  ingredients: { type: [recipeIngredientSchema], default: [] },
  recipeProcess: { type: recipeProcessSchema, required: true },
  isActive: { type: Boolean, default: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

recipeSchema.index({ name: 1 }, { unique: false });
recipeSchema.index({ category: 1 });
recipeSchema.index({ cuisine: 1 });

export const Recipe = mongoose.model<IRecipe>('Recipe', recipeSchema);
