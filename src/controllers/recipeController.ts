import { Request, Response } from 'express';
import { Recipe } from '../models/Recipe';

export const recipeController = {
  create: async (req: Request, res: Response) => {
    try {
      const recipe = await Recipe.create({ ...req.body, createdBy: req.user?.userId });
      res.status(201).json({ recipe });
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to create recipe', error: error.message });
    }
  },
  list: async (_req: Request, res: Response) => {
    try {
      const recipes = await Recipe.find().sort({ name: 1 });
      res.json({ recipes });
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to list recipes', error: error.message });
    }
  },
  getById: async (req: Request, res: Response) => {
    try {
      const recipe = await Recipe.findById(req.params.id);
      if (!recipe) return res.status(404).json({ message: 'Recipe not found' });
      res.json({ recipe });
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to get recipe', error: error.message });
    }
  },
  update: async (req: Request, res: Response) => {
    try {
      const recipe = await Recipe.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
      if (!recipe) return res.status(404).json({ message: 'Recipe not found' });
      res.json({ recipe });
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to update recipe', error: error.message });
    }
  },
  remove: async (req: Request, res: Response) => {
    try {
      const recipe = await Recipe.findByIdAndDelete(req.params.id);
      if (!recipe) return res.status(404).json({ message: 'Recipe not found' });
      res.json({ message: 'Recipe deleted' });
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to delete recipe', error: error.message });
    }
  }
};


