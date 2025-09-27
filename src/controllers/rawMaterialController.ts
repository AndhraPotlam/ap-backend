import { Request, Response } from 'express';
import { RawMaterial } from '../models/RawMaterial';

export const rawMaterialController = {
  // Get all raw materials
  getAll: async (req: Request, res: Response) => {
    try {
      const { category, search, isActive } = req.query;
      const filter: any = {};

      if (category) filter.category = category;
      if (search) filter.name = { $regex: search, $options: 'i' };
      if (isActive !== undefined) filter.isActive = isActive === 'true';

      const rawMaterials = await RawMaterial.find(filter)
        .populate('createdBy', 'firstName lastName email')
        .sort({ name: 1 });

      res.json({ rawMaterials });
    } catch (error) {
      console.error('Error fetching raw materials:', error);
      res.status(500).json({ error: 'Failed to fetch raw materials' });
    }
  },

  // Get raw material by ID
  getById: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const rawMaterial = await RawMaterial.findById(id)
        .populate('createdBy', 'firstName lastName email');

      if (!rawMaterial) {
        return res.status(404).json({ error: 'Raw material not found' });
      }

      res.json({ rawMaterial });
    } catch (error) {
      console.error('Error fetching raw material:', error);
      res.status(500).json({ error: 'Failed to fetch raw material' });
    }
  },

  // Create new raw material
  create: async (req: Request, res: Response) => {
    try {
      const rawMaterialData = {
        ...req.body,
        createdBy: req.user?.id
      };

      const rawMaterial = new RawMaterial(rawMaterialData);
      await rawMaterial.save();

      await rawMaterial.populate('createdBy', 'firstName lastName email');

      res.status(201).json({ rawMaterial });
    } catch (error) {
      console.error('Error creating raw material:', error);
      if (error instanceof Error && error.name === 'ValidationError') {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to create raw material' });
    }
  },

  // Update raw material
  update: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const rawMaterial = await RawMaterial.findByIdAndUpdate(
        id,
        req.body,
        { new: true, runValidators: true }
      ).populate('createdBy', 'firstName lastName email');

      if (!rawMaterial) {
        return res.status(404).json({ error: 'Raw material not found' });
      }

      res.json({ rawMaterial });
    } catch (error) {
      console.error('Error updating raw material:', error);
      if (error instanceof Error && error.name === 'ValidationError') {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to update raw material' });
    }
  },

  // Delete raw material
  delete: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const rawMaterial = await RawMaterial.findByIdAndDelete(id);

      if (!rawMaterial) {
        return res.status(404).json({ error: 'Raw material not found' });
      }

      res.json({ message: 'Raw material deleted successfully' });
    } catch (error) {
      console.error('Error deleting raw material:', error);
      res.status(500).json({ error: 'Failed to delete raw material' });
    }
  },

  // Update stock
  updateStock: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { currentStock } = req.body;

      const rawMaterial = await RawMaterial.findByIdAndUpdate(
        id,
        { currentStock },
        { new: true, runValidators: true }
      ).populate('createdBy', 'firstName lastName email');

      if (!rawMaterial) {
        return res.status(404).json({ error: 'Raw material not found' });
      }

      res.json({ rawMaterial });
    } catch (error) {
      console.error('Error updating stock:', error);
      res.status(500).json({ error: 'Failed to update stock' });
    }
  },

  // Get low stock items
  getLowStock: async (req: Request, res: Response) => {
    try {
      const rawMaterials = await RawMaterial.find({
        isActive: true,
        $expr: { $lte: ['$currentStock', '$minimumStock'] }
      }).populate('createdBy', 'firstName lastName email');

      res.json({ rawMaterials });
    } catch (error) {
      console.error('Error fetching low stock items:', error);
      res.status(500).json({ error: 'Failed to fetch low stock items' });
    }
  }
};
