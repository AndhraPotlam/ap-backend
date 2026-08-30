import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { formatDoc, formatDocs } from '../utils/format';

function formatRecipe(r: any) {
  if (!r) return null;
  return {
    ...r,
    _id: r.id,
    createdBy: formatDoc(r.createdBy),
    ingredients: r.ingredients?.map((i: any) => ({
      ...i,
      _id: i.id,
      rawMaterial: formatDoc(i.rawMaterial),
    })) || [],
    recipeProcess: formatDoc(r.recipeProcess),
  };
}

export const recipeController = {
  getAll: async (req: Request, res: Response) => {
    try {
      const { category, cuisine, difficulty, search, isActive } = req.query;
      const where: any = {};

      if (category) where.category = String(category);
      if (cuisine) where.cuisine = String(cuisine);
      if (difficulty) where.difficulty = difficulty as any;
      if (search) where.name = { contains: String(search), mode: 'insensitive' };
      if (isActive !== undefined) where.isActive = isActive === 'true';

      const recipes = await prisma.recipe.findMany({
        where,
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          ingredients: {
            include: {
              rawMaterial: { select: { id: true, name: true, unit: true, costPerUnit: true, category: true } },
            },
          },
        },
        orderBy: { name: 'asc' },
      });

      res.json({ recipes: recipes.map(formatRecipe) });
    } catch (error: any) {
      console.error('Error fetching recipes:', error);
      res.status(500).json({ error: 'Failed to fetch recipes' });
    }
  },

  getById: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const recipe = await prisma.recipe.findUnique({
        where: { id },
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          ingredients: {
            include: {
              rawMaterial: { select: { id: true, name: true, unit: true, costPerUnit: true, category: true, supplier: true } },
            },
          },
          recipeProcess: true,
        },
      });

      if (!recipe) {
        return res.status(404).json({ error: 'Recipe not found' });
      }

      res.json({ recipe: formatRecipe(recipe) });
    } catch (error: any) {
      console.error('Error fetching recipe:', error);
      res.status(500).json({ error: 'Failed to fetch recipe' });
    }
  },

  create: async (req: Request, res: Response) => {
    try {
      const userId = req.user?.userId || req.user?._id || req.user?.id;
      const {
        name,
        description,
        category,
        serves = 1,
        prepTimeMin,
        cookTimeMin,
        totalTimeMin,
        difficulty = 'medium',
        cuisine,
        ingredients = [],
        isActive = true,
      } = req.body;

      const calcTotalTime = totalTimeMin || ((Number(prepTimeMin) || 0) + (Number(cookTimeMin) || 0));

      const recipe = await prisma.recipe.create({
        data: {
          name: String(name).trim(),
          description: description?.trim() || null,
          category: category?.trim() || null,
          serves: Number(serves),
          prepTimeMin: prepTimeMin ? Number(prepTimeMin) : null,
          cookTimeMin: cookTimeMin ? Number(cookTimeMin) : null,
          totalTimeMin: calcTotalTime || null,
          difficulty: difficulty as any,
          cuisine: cuisine?.trim() || null,
          isActive: Boolean(isActive),
          createdById: userId || null,
          ingredients: {
            create: ingredients.map((ing: any) => ({
              rawMaterialId: typeof ing.rawMaterial === 'object' ? ing.rawMaterial?.id || ing.rawMaterial?._id : ing.rawMaterial,
              quantity: Number(ing.quantity),
              unit: String(ing.unit || 'unit'),
              notes: ing.notes || null,
            })),
          },
        },
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          ingredients: {
            include: { rawMaterial: true },
          },
        },
      });

      res.status(201).json({ recipe: formatRecipe(recipe) });
    } catch (error: any) {
      console.error('Error creating recipe:', error);
      res.status(500).json({ error: 'Failed to create recipe' });
    }
  },

  update: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const {
        name,
        description,
        category,
        serves,
        prepTimeMin,
        cookTimeMin,
        totalTimeMin,
        difficulty,
        cuisine,
        ingredients,
        isActive,
      } = req.body;

      const calcTotalTime = totalTimeMin || ((Number(prepTimeMin) || 0) + (Number(cookTimeMin) || 0));

      const recipe = await prisma.$transaction(async (tx) => {
        if (ingredients && Array.isArray(ingredients)) {
          await tx.recipeIngredient.deleteMany({ where: { recipeId: id } });
          await tx.recipeIngredient.createMany({
            data: ingredients.map((ing: any) => ({
              recipeId: id,
              rawMaterialId: typeof ing.rawMaterial === 'object' ? ing.rawMaterial?.id || ing.rawMaterial?._id : ing.rawMaterial,
              quantity: Number(ing.quantity),
              unit: String(ing.unit || 'unit'),
              notes: ing.notes || null,
            })),
          });
        }

        return tx.recipe.update({
          where: { id },
          data: {
            name: name !== undefined ? String(name).trim() : undefined,
            description: description !== undefined ? description?.trim() || null : undefined,
            category: category !== undefined ? category?.trim() || null : undefined,
            serves: serves !== undefined ? Number(serves) : undefined,
            prepTimeMin: prepTimeMin !== undefined ? Number(prepTimeMin) : undefined,
            cookTimeMin: cookTimeMin !== undefined ? Number(cookTimeMin) : undefined,
            totalTimeMin: calcTotalTime || undefined,
            difficulty: difficulty !== undefined ? difficulty : undefined,
            cuisine: cuisine !== undefined ? cuisine?.trim() || null : undefined,
            isActive: isActive !== undefined ? Boolean(isActive) : undefined,
          },
          include: {
            createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
            ingredients: {
              include: { rawMaterial: true },
            },
          },
        });
      });

      res.json({ recipe: formatRecipe(recipe) });
    } catch (error: any) {
      console.error('Error updating recipe:', error);
      res.status(500).json({ error: 'Failed to update recipe' });
    }
  },

  delete: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await prisma.recipe.delete({ where: { id } });
      res.json({ message: 'Recipe deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting recipe:', error);
      res.status(500).json({ error: 'Failed to delete recipe' });
    }
  },

  calculateCost: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { servings } = req.query;

      const recipe = await prisma.recipe.findUnique({
        where: { id },
        include: {
          ingredients: {
            include: { rawMaterial: true },
          },
        },
      });

      if (!recipe) {
        return res.status(404).json({ error: 'Recipe not found' });
      }

      let totalCost = 0;
      const ingredientCosts = recipe.ingredients.map((ingredient) => {
        const cost = ingredient.quantity * (ingredient.rawMaterial.costPerUnit || 0);
        totalCost += cost;
        return {
          ingredient: { ...ingredient, _id: ingredient.id },
          cost,
        };
      });

      const targetServings = servings ? parseInt(servings as string) : recipe.serves;
      const costPerServing = recipe.serves > 0 ? totalCost / recipe.serves : 0;
      const totalCostForServings = costPerServing * targetServings;

      res.json({
        recipe: recipe.name,
        originalServings: recipe.serves,
        targetServings,
        totalCost,
        costPerServing,
        totalCostForServings,
        ingredientCosts,
      });
    } catch (error: any) {
      console.error('Error calculating recipe cost:', error);
      res.status(500).json({ error: 'Failed to calculate recipe cost' });
    }
  },

  getByCategory: async (req: Request, res: Response) => {
    try {
      const { category } = req.params;
      const recipes = await prisma.recipe.findMany({
        where: {
          category,
          isActive: true,
        },
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          ingredients: {
            include: { rawMaterial: { select: { id: true, name: true, unit: true, costPerUnit: true } } },
          },
        },
        orderBy: { name: 'asc' },
      });

      res.json({ recipes: recipes.map(formatRecipe) });
    } catch (error: any) {
      console.error('Error fetching recipes by category:', error);
      res.status(500).json({ error: 'Failed to fetch recipes by category' });
    }
  },

  getCategories: async (req: Request, res: Response) => {
    try {
      const recipes = await prisma.recipe.findMany({
        where: { isActive: true, category: { not: null } },
        select: { category: true },
        distinct: ['category'],
      });

      const categories = recipes.map((r) => r.category).filter(Boolean);
      res.json({ categories });
    } catch (error: any) {
      console.error('Error fetching recipe categories:', error);
      res.status(500).json({ error: 'Failed to fetch recipe categories' });
    }
  },
};
