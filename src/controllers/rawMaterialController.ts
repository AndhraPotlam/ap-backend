import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { formatDoc, formatDocs } from '../utils/format';

export const rawMaterialController = {
  getAll: async (req: Request, res: Response) => {
    try {
      const { category, search, isActive } = req.query;
      const where: any = {};

      if (category) where.category = String(category);
      if (search) where.name = { contains: String(search), mode: 'insensitive' };
      if (isActive !== undefined) where.isActive = isActive === 'true';

      const rawMaterials = await prisma.rawMaterial.findMany({
        where,
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
        orderBy: { name: 'asc' },
      });

      const formatted = rawMaterials.map((r) => ({
        ...r,
        _id: r.id,
        createdBy: formatDoc(r.createdBy),
      }));

      res.json({ rawMaterials: formatted });
    } catch (error: any) {
      console.error('Error fetching raw materials:', error);
      res.status(500).json({ error: 'Failed to fetch raw materials' });
    }
  },

  getById: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const rawMaterial = await prisma.rawMaterial.findUnique({
        where: { id },
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      });

      if (!rawMaterial) {
        return res.status(404).json({ error: 'Raw material not found' });
      }

      res.json({
        rawMaterial: {
          ...rawMaterial,
          _id: rawMaterial.id,
          createdBy: formatDoc(rawMaterial.createdBy),
        },
      });
    } catch (error: any) {
      console.error('Error fetching raw material:', error);
      res.status(500).json({ error: 'Failed to fetch raw material' });
    }
  },

  create: async (req: Request, res: Response) => {
    try {
      const userId = req.user?.userId || req.user?._id || req.user?.id;
      const { name, description, category, unit, costPerUnit, supplier, minimumStock = 0, currentStock = 0, isActive = true } = req.body;

      const rawMaterial = await prisma.rawMaterial.create({
        data: {
          name: String(name).trim(),
          description: description?.trim() || null,
          category: String(category).trim(),
          unit: String(unit).trim(),
          costPerUnit: Number(costPerUnit),
          supplier: supplier?.trim() || null,
          minimumStock: Number(minimumStock),
          currentStock: Number(currentStock),
          isActive: Boolean(isActive),
          createdById: userId || null,
        },
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      });

      res.status(201).json({
        rawMaterial: {
          ...rawMaterial,
          _id: rawMaterial.id,
          createdBy: formatDoc(rawMaterial.createdBy),
        },
      });
    } catch (error: any) {
      console.error('Error creating raw material:', error);
      res.status(500).json({ error: 'Failed to create raw material' });
    }
  },

  update: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { name, description, category, unit, costPerUnit, supplier, minimumStock, currentStock, isActive } = req.body;

      const rawMaterial = await prisma.rawMaterial.update({
        where: { id },
        data: {
          name: name !== undefined ? String(name).trim() : undefined,
          description: description !== undefined ? description?.trim() || null : undefined,
          category: category !== undefined ? String(category).trim() : undefined,
          unit: unit !== undefined ? String(unit).trim() : undefined,
          costPerUnit: costPerUnit !== undefined ? Number(costPerUnit) : undefined,
          supplier: supplier !== undefined ? supplier?.trim() || null : undefined,
          minimumStock: minimumStock !== undefined ? Number(minimumStock) : undefined,
          currentStock: currentStock !== undefined ? Number(currentStock) : undefined,
          isActive: isActive !== undefined ? Boolean(isActive) : undefined,
        },
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      });

      res.json({
        rawMaterial: {
          ...rawMaterial,
          _id: rawMaterial.id,
          createdBy: formatDoc(rawMaterial.createdBy),
        },
      });
    } catch (error: any) {
      console.error('Error updating raw material:', error);
      res.status(500).json({ error: 'Failed to update raw material' });
    }
  },

  delete: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await prisma.rawMaterial.delete({ where: { id } });
      res.json({ message: 'Raw material deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting raw material:', error);
      res.status(500).json({ error: 'Failed to delete raw material' });
    }
  },

  updateStock: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { currentStock } = req.body;

      const rawMaterial = await prisma.rawMaterial.update({
        where: { id },
        data: { currentStock: Number(currentStock) },
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      });

      res.json({
        rawMaterial: {
          ...rawMaterial,
          _id: rawMaterial.id,
          createdBy: formatDoc(rawMaterial.createdBy),
        },
      });
    } catch (error: any) {
      console.error('Error updating stock:', error);
      res.status(500).json({ error: 'Failed to update stock' });
    }
  },

  getLowStock: async (req: Request, res: Response) => {
    try {
      const rawMaterials = await prisma.$queryRaw<any[]>`
        SELECT r.*, json_build_object('id', u.id, 'firstName', u."firstName", 'lastName', u."lastName", 'email', u.email) as "createdBy"
        FROM raw_materials r
        LEFT JOIN users u ON r."createdById" = u.id
        WHERE r."isActive" = true AND r."currentStock" <= r."minimumStock"
      `;

      res.json({ rawMaterials: formatDocs(rawMaterials) });
    } catch (error: any) {
      console.error('Error fetching low stock items:', error);
      res.status(500).json({ error: 'Failed to fetch low stock items' });
    }
  },
};
