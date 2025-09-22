import mongoose, { Document, Schema } from 'mongoose';

export interface ISelectedRecipe {
  recipe: mongoose.Types.ObjectId;
  plannedStart?: string; // HH:mm
  serves?: number;
}

export interface IDayPlan extends Document {
  date: Date;
  shift?: 'morning'|'evening'|'other';
  selectedRecipes: ISelectedRecipe[];
  generatedAt?: Date;
  generatedBy?: mongoose.Types.ObjectId;
}

const selectedRecipeSchema = new Schema<ISelectedRecipe>({
  recipe: { type: Schema.Types.ObjectId, ref: 'Recipe', required: true },
  plannedStart: { type: String, trim: true },
  serves: { type: Number, min: 1 }
});

const dayPlanSchema = new Schema<IDayPlan>({
  date: { type: Date, required: true },
  shift: { type: String, enum: ['morning','evening','other'] },
  selectedRecipes: { type: [selectedRecipeSchema], default: [] },
  generatedAt: { type: Date },
  generatedBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

dayPlanSchema.index({ date: 1, shift: 1 }, { unique: false });

export const DayPlan = mongoose.model<IDayPlan>('DayPlan', dayPlanSchema);


