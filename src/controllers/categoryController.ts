import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { formatDoc, formatDocs, generateSlug } from '../utils/format';

export const categoryController = {
  // Create category
  createCategory: async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, description } = req.body;

      if (!name || name.trim() === '') {
        res.status(400).json({ message: 'Category name is required' });
        return;
      }

      const baseSlug = generateSlug(name);
      let slug = baseSlug;
      let counter = 1;

      while (await prisma.category.findUnique({ where: { slug } })) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }

      const category = await prisma.category.create({
        data: {
          name: name.trim(),
          description: description?.trim() || null,
          slug,
        },
      });

      res.status(201).json(formatDoc(category));
    } catch (error: any) {
      console.error('Error creating category:', error);
      if (error.code === 'P2002') {
        res.status(400).json({ message: 'A category with this name already exists' });
        return;
      }
      res.status(500).json({ message: 'Error creating category', error: error.message });
    }
  },

  // Get all categories
  getAllCategories: async (req: Request, res: Response): Promise<void> => {
    try {
      const categories = await prisma.category.findMany({
        orderBy: { name: 'asc' },
      });
      res.json(formatDocs(categories));
    } catch (error: any) {
      console.error('Error fetching categories:', error);
      res.status(500).json({ message: 'Error fetching categories', error: error.message });
    }
  },

  // Get category by ID
  getCategory: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const category = await prisma.category.findUnique({
        where: { id },
      });

      if (!category) {
        res.status(404).json({ message: 'Category not found' });
        return;
      }

      res.json(formatDoc(category));
    } catch (error: any) {
      console.error('Error fetching category:', error);
      res.status(500).json({ message: 'Error fetching category', error: error.message });
    }
  },

  // Update category
  updateCategory: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { name, description, isActive } = req.body;

      const existingCategory = await prisma.category.findUnique({
        where: { id },
      });

      if (!existingCategory) {
        res.status(404).json({ message: 'Category not found' });
        return;
      }

      let slug = existingCategory.slug;
      if (name && name !== existingCategory.name) {
        const baseSlug = generateSlug(name);
        slug = baseSlug;
        let counter = 1;

        while (true) {
          const found = await prisma.category.findUnique({ where: { slug } });
          if (!found || found.id === id) break;
          slug = `${baseSlug}-${counter}`;
          counter++;
        }
      }

      const updatedCategory = await prisma.category.update({
        where: { id },
        data: {
          name: name !== undefined ? name.trim() : undefined,
          description: description !== undefined ? description?.trim() || null : undefined,
          isActive: isActive !== undefined ? Boolean(isActive) : undefined,
          slug,
        },
      });

      res.json(formatDoc(updatedCategory));
    } catch (error: any) {
      console.error('Error updating category:', error);
      if (error.code === 'P2002') {
        res.status(400).json({ message: 'A category with this name already exists' });
        return;
      }
      res.status(500).json({ message: 'Error updating category', error: error.message });
    }
  },

  // Delete category (soft delete)
  deleteCategory: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const category = await prisma.category.update({
        where: { id },
        data: { isActive: false },
      });

      if (!category) {
        res.status(404).json({ message: 'Category not found' });
        return;
      }

      res.json({ message: 'Category deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting category:', error);
      res.status(500).json({ message: 'Error deleting category', error: error.message });
    }
  },
};