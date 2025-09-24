import { Request, Response } from 'express';
import { RecipeProcess } from '../models/RecipeProcess';

export const recipeProcessController = {
  create: async (req: Request, res: Response) => {
    try {
      const recipeProcess = await RecipeProcess.create({ ...req.body, createdBy: req.user?.userId });
      res.status(201).json({ recipeProcess });
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to create recipe process', error: error.message });
    }
  },
  list: async (_req: Request, res: Response) => {
    try {
      const recipeProcesses = await RecipeProcess.find().sort({ name: 1 });
      res.json({ recipeProcesses });
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to list recipe processes', error: error.message });
    }
  },
  getById: async (req: Request, res: Response) => {
    try {
      const recipeProcess = await RecipeProcess.findById(req.params.id);
      if (!recipeProcess) return res.status(404).json({ message: 'Recipe process not found' });
      res.json({ recipeProcess });
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to get recipe process', error: error.message });
    }
  },
  update: async (req: Request, res: Response) => {
    try {
      const recipeProcess = await RecipeProcess.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
      if (!recipeProcess) return res.status(404).json({ message: 'Recipe process not found' });
      res.json({ recipeProcess });
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to update recipe process', error: error.message });
    }
  },
  remove: async (req: Request, res: Response) => {
    try {
      const recipeProcess = await RecipeProcess.findByIdAndDelete(req.params.id);
      if (!recipeProcess) return res.status(404).json({ message: 'Recipe process not found' });
      res.json({ message: 'Recipe process deleted' });
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to delete recipe process', error: error.message });
    }
  }
};


