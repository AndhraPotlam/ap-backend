import { Request, Response } from 'express';
import { Recipe } from '../models/Recipe';
import { RawMaterial } from '../models/RawMaterial';

export const recipeController = {
  // Get all recipes
  getAll: async (req: Request, res: Response) => {
    try {
      const { category, cuisine, difficulty, search, isActive } = req.query;
      const filter: any = {};

      if (category) filter.category = category;
      if (cuisine) filter.cuisine = cuisine;
      if (difficulty) filter.difficulty = difficulty;
      if (search) filter.name = { $regex: search, $options: 'i' };
      if (isActive !== undefined) filter.isActive = isActive === 'true';

      const recipes = await Recipe.find(filter)
        .populate('createdBy', 'firstName lastName email')
        .populate('ingredients.rawMaterial', 'name unit costPerUnit')
        .sort({ name: 1 });

      res.json({ recipes });
    } catch (error) {
      console.error('Error fetching recipes:', error);
      res.status(500).json({ error: 'Failed to fetch recipes' });
    }
  },

  // Get recipe by ID
  getById: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const recipe = await Recipe.findById(id)
        .populate('createdBy', 'firstName lastName email')
        .populate('ingredients.rawMaterial', 'name unit costPerUnit category supplier');

      if (!recipe) {
        return res.status(404).json({ error: 'Recipe not found' });
      }

      res.json({ recipe });
    } catch (error) {
      console.error('Error fetching recipe:', error);
      res.status(500).json({ error: 'Failed to fetch recipe' });
    }
  },

  // Create new recipe
  create: async (req: Request, res: Response) => {
    try {
      const recipeData = {
        ...req.body,
        createdBy: req.user?.id
      };

      // Calculate total time if not provided
      if (!recipeData.totalTimeMin && (recipeData.prepTimeMin || recipeData.cookTimeMin)) {
        recipeData.totalTimeMin = (recipeData.prepTimeMin || 0) + (recipeData.cookTimeMin || 0);
      }

      const recipe = new Recipe(recipeData);
      await recipe.save();

      await recipe.populate([
        { path: 'createdBy', select: 'firstName lastName email' },
        { path: 'ingredients.rawMaterial', select: 'name unit costPerUnit category' }
      ]);

      res.status(201).json({ recipe });
    } catch (error) {
      console.error('Error creating recipe:', error);
      if (error instanceof Error && error.name === 'ValidationError') {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to create recipe' });
    }
  },

  // Update recipe
  update: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updateData = { ...req.body };

      // Calculate total time if not provided
      if (!updateData.totalTimeMin && (updateData.prepTimeMin || updateData.cookTimeMin)) {
        updateData.totalTimeMin = (updateData.prepTimeMin || 0) + (updateData.cookTimeMin || 0);
      }

      const recipe = await Recipe.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
      ).populate([
        { path: 'createdBy', select: 'firstName lastName email' },
        { path: 'ingredients.rawMaterial', select: 'name unit costPerUnit category' }
      ]);

      if (!recipe) {
        return res.status(404).json({ error: 'Recipe not found' });
      }

      res.json({ recipe });
    } catch (error) {
      console.error('Error updating recipe:', error);
      if (error instanceof Error && error.name === 'ValidationError') {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to update recipe' });
    }
  },

  // Delete recipe
  delete: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const recipe = await Recipe.findByIdAndDelete(id);

      if (!recipe) {
        return res.status(404).json({ error: 'Recipe not found' });
      }

      res.json({ message: 'Recipe deleted successfully' });
    } catch (error) {
      console.error('Error deleting recipe:', error);
      res.status(500).json({ error: 'Failed to delete recipe' });
    }
  },

  // Calculate recipe cost
  calculateCost: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { servings } = req.query; // Optional: calculate cost for different number of servings

      const recipe = await Recipe.findById(id)
        .populate('ingredients.rawMaterial', 'name unit costPerUnit');

      if (!recipe) {
        return res.status(404).json({ error: 'Recipe not found' });
      }

      let totalCost = 0;
      const ingredientCosts = recipe.ingredients.map(ingredient => {
        const rawMaterial = ingredient.rawMaterial as any;
        const cost = (ingredient.quantity * rawMaterial.costPerUnit);
        totalCost += cost;
        
        return {
          ingredient: ingredient,
          cost: cost
        };
      });

      const targetServings = servings ? parseInt(servings as string) : recipe.serves;
      const costPerServing = totalCost / recipe.serves;
      const totalCostForServings = costPerServing * targetServings;

      res.json({
        recipe: recipe.name,
        originalServings: recipe.serves,
        targetServings: targetServings,
        totalCost: totalCost,
        costPerServing: costPerServing,
        totalCostForServings: totalCostForServings,
        ingredientCosts: ingredientCosts
      });
    } catch (error) {
      console.error('Error calculating recipe cost:', error);
      res.status(500).json({ error: 'Failed to calculate recipe cost' });
    }
  },

  // Get recipes by category
  getByCategory: async (req: Request, res: Response) => {
    try {
      const { category } = req.params;
      const recipes = await Recipe.find({ 
        category: category,
        isActive: true 
      })
        .populate('createdBy', 'firstName lastName email')
        .populate('ingredients.rawMaterial', 'name unit costPerUnit')
        .sort({ name: 1 });

      res.json({ recipes });
    } catch (error) {
      console.error('Error fetching recipes by category:', error);
      res.status(500).json({ error: 'Failed to fetch recipes by category' });
    }
  },

  // Get recipe categories
  getCategories: async (req: Request, res: Response) => {
    try {
      const categories = await Recipe.distinct('category', { isActive: true });
      res.json({ categories: categories.filter(Boolean) });
    } catch (error) {
      console.error('Error fetching recipe categories:', error);
      res.status(500).json({ error: 'Failed to fetch recipe categories' });
    }
  }
};
