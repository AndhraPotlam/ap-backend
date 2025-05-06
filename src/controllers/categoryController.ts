import { Request, Response } from 'express';
import { Category, generateSlug } from '../models/Category';
import mongoose from 'mongoose';

export const categoryController = {
  // Create category
  createCategory: async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, description } = req.body;

      // Validate required fields
      if (!name || name.trim() === '') {
        res.status(400).json({ message: 'Category name is required' });
        return;
      }

      // Generate slug from name
      const baseSlug = generateSlug(name);
      let slug = baseSlug;
      let counter = 1;
      
      // Check if category with same slug exists and append number if needed
      while (await Category.findOne({ slug })) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }

      const category = new Category({
        name,
        description,
        slug
      });

      await category.save();
      res.status(201).json(category);
    } catch (error: any) {
      console.error('Error creating category:', error);
      
      // Handle duplicate key error specifically
      if (error.code === 11000) {
        res.status(400).json({ message: 'A category with this name already exists' });
        return;
      }
      
      res.status(500).json({ message: 'Error creating category', error: error.message });
    }
  },

  // Get all categories
  getAllCategories: async (req: Request, res: Response): Promise<void> => {
    try {
      const categories = await Category.find({ }).sort({ name: 1 });
      res.json(categories);
    } catch (error: any) {
      console.error('Error fetching categories:', error);
      res.status(500).json({ message: 'Error fetching categories', error: error.message });
    }
  },

  // Get category by ID (admin only)
  getCategory: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({ message: 'Invalid category ID format' });
        return;
      }

      const category = await Category.findById(id);
      if (!category) {
        res.status(404).json({ message: 'Category not found' });
        return;
      }

      res.json(category);
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

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({ message: 'Invalid category ID format' });
        return;
      }

      // Find the category first (including inactive ones)
      const category = await Category.findById(id);
      if (!category) {
        res.status(404).json({ message: 'Category not found' });
        return;
      }

      // Update the category
      if (name) {
        category.name = name;
        // Generate new slug when name is updated
        const baseSlug = generateSlug(name);
        let slug = baseSlug;
        let counter = 1;
        
        // Check if category with same slug exists (excluding current category)
        while (await Category.findOne({ slug, _id: { $ne: id } })) {
          slug = `${baseSlug}-${counter}`;
          counter++;
        }
        
        category.slug = slug;
      }
      if (description !== undefined) category.description = description;
      if (isActive !== undefined) category.isActive = isActive;

      await category.save();

      res.json(category);
    } catch (error: any) {
      console.error('Error updating category:', error);
      
      // Handle duplicate key error specifically
      if (error.code === 11000) {
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

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({ message: 'Invalid category ID format' });
        return;
      }

      const category = await Category.findByIdAndUpdate(
        id,
        { isActive: false },
        { new: true }
      );

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