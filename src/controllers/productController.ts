import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { s3Service } from '../services/s3Service';
import { formatDoc, formatDocs } from '../utils/format';

export const productController = {
  // Create product
  createProduct: async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, description, price, category, stock, imageUrl } = req.body;

      const categoryId = typeof category === 'object' ? category?.id || category?._id : category;

      const categoryExists = await prisma.category.findUnique({
        where: { id: categoryId },
      });

      if (!categoryExists) {
        res.status(404).json({ message: 'Category not found' });
        return;
      }

      const product = await prisma.product.create({
        data: {
          name: name.trim(),
          description: description?.trim() || '',
          price: Number(price),
          categoryId,
          stock: stock !== undefined ? Number(stock) : 0,
          imageUrl: imageUrl || '',
        },
        include: {
          category: {
            select: { id: true, name: true, slug: true },
          },
        },
      });

      res.status(201).json(formatDoc({ ...product, category: formatDoc(product.category) }));
    } catch (error: any) {
      console.error('Error creating product:', error);
      res.status(500).json({ message: 'Error creating product', error: error.message });
    }
  },

  // Get all products with filtering, pagination, and search
  getAllProducts: async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        page = 1,
        limit = 10,
        category,
        search,
        minPrice,
        maxPrice,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = req.query;

      const whereClause: any = { isActive: true };

      if (category) {
        whereClause.categoryId = String(category);
      }

      if (minPrice || maxPrice) {
        whereClause.price = {};
        if (minPrice) whereClause.price.gte = Number(minPrice);
        if (maxPrice) whereClause.price.lte = Number(maxPrice);
      }

      if (search) {
        whereClause.OR = [
          { name: { contains: String(search), mode: 'insensitive' } },
          { description: { contains: String(search), mode: 'insensitive' } },
        ];
      }

      const skip = (Number(page) - 1) * Number(limit);
      const take = Number(limit);

      const validSortFields = ['name', 'price', 'stock', 'createdAt', 'updatedAt'];
      const orderField = validSortFields.includes(String(sortBy)) ? String(sortBy) : 'createdAt';
      const orderDirection = String(sortOrder).toLowerCase() === 'asc' ? 'asc' : 'desc';

      const [products, total] = await Promise.all([
        prisma.product.findMany({
          where: whereClause,
          include: {
            category: { select: { id: true, name: true, slug: true } },
          },
          orderBy: { [orderField]: orderDirection },
          skip,
          take,
        }),
        prisma.product.count({ where: whereClause }),
      ]);

      const productsWithPresignedUrls = await Promise.all(
        products.map(async (product) => {
          let resolvedImageUrl = product.imageUrl;
          let imageUrlWarning: string | undefined;

          try {
            if (!s3Service.isConfigured()) {
              const fileName = product.imageUrl.split('/').pop();
              if (fileName) resolvedImageUrl = s3Service.getImageUrl(fileName);
            } else if (product.imageUrl) {
              const fileName = product.imageUrl.split('/').pop();
              if (fileName) resolvedImageUrl = await s3Service.getReadPresignedUrl(fileName);
            }
          } catch (s3Error) {
            const fileName = product.imageUrl.split('/').pop();
            if (fileName) resolvedImageUrl = s3Service.getImageUrl(fileName);
            imageUrlWarning = 'Using direct URL due to S3 configuration issue';
          }

          return {
            ...product,
            _id: product.id,
            category: formatDoc(product.category),
            imageUrl: resolvedImageUrl,
            ...(imageUrlWarning && { imageUrlWarning }),
          };
        })
      );

      res.json({
        products: productsWithPresignedUrls,
        currentPage: Number(page),
        totalPages: Math.ceil(total / take),
        totalProducts: total,
      });
    } catch (error: any) {
      console.error('Error fetching products:', error);
      res.status(500).json({ message: 'Error fetching products', error: error.message });
    }
  },

  // Get products by category
  getProductsByCategory: async (req: Request, res: Response): Promise<void> => {
    try {
      const { category } = req.params;

      const categoryExists = await prisma.category.findUnique({
        where: { id: category },
      });

      if (!categoryExists) {
        res.status(404).json({ message: 'Category not found' });
        return;
      }

      const products = await prisma.product.findMany({
        where: {
          categoryId: category,
          isActive: true,
        },
        include: {
          category: { select: { id: true, name: true, slug: true } },
        },
      });

      const formatted = products.map((p) => ({
        ...p,
        _id: p.id,
        category: formatDoc(p.category),
      }));

      res.json(formatted);
    } catch (error: any) {
      console.error('Error fetching products by category:', error);
      res.status(500).json({ message: 'Error fetching products by category', error: error.message });
    }
  },

  // Get single product
  getProduct: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const product = await prisma.product.findFirst({
        where: {
          id,
          isActive: true,
        },
        include: {
          category: { select: { id: true, name: true, slug: true } },
        },
      });

      if (!product) {
        res.status(404).json({ message: 'Product not found' });
        return;
      }

      let imageUrl = product.imageUrl;
      let imageUrlWarning: string | undefined;

      try {
        if (!s3Service.isConfigured()) {
          const fileName = product.imageUrl.split('/').pop();
          if (fileName) imageUrl = s3Service.getImageUrl(fileName);
          imageUrlWarning = 'S3 not configured - using direct URL';
        } else if (product.imageUrl) {
          const fileName = product.imageUrl.split('/').pop();
          if (fileName) imageUrl = await s3Service.getReadPresignedUrl(fileName);
        }
      } catch (s3Error) {
        const fileName = product.imageUrl.split('/').pop();
        if (fileName) imageUrl = s3Service.getImageUrl(fileName);
        imageUrlWarning = 'Using direct URL due to S3 configuration issue';
      }

      res.json({
        ...product,
        _id: product.id,
        category: formatDoc(product.category),
        imageUrl,
        ...(imageUrlWarning && { imageUrlWarning }),
      });
    } catch (error: any) {
      console.error('Error fetching product:', error);
      res.status(500).json({ message: 'Error fetching product', error: error.message });
    }
  },

  // Update product
  updateProduct: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { name, description, price, category, stock, imageUrl, isActive } = req.body;

      let categoryId: string | undefined;
      if (category) {
        categoryId = typeof category === 'object' ? category?.id || category?._id : category;
        const categoryExists = await prisma.category.findUnique({
          where: { id: categoryId },
        });
        if (!categoryExists) {
          res.status(404).json({ message: 'Category not found' });
          return;
        }
      }

      const product = await prisma.product.update({
        where: { id },
        data: {
          name: name !== undefined ? String(name).trim() : undefined,
          description: description !== undefined ? String(description).trim() : undefined,
          price: price !== undefined ? Number(price) : undefined,
          categoryId: categoryId || undefined,
          stock: stock !== undefined ? Number(stock) : undefined,
          imageUrl: imageUrl !== undefined ? String(imageUrl) : undefined,
          isActive: isActive !== undefined ? Boolean(isActive) : undefined,
        },
        include: {
          category: { select: { id: true, name: true, slug: true } },
        },
      });

      let resolvedImageUrl = product.imageUrl;
      try {
        if (s3Service.isConfigured() && product.imageUrl) {
          const fileName = product.imageUrl.split('/').pop();
          if (fileName) resolvedImageUrl = await s3Service.getReadPresignedUrl(fileName);
        }
      } catch (err) {
        // ignore fallback
      }

      res.json({
        ...product,
        _id: product.id,
        category: formatDoc(product.category),
        imageUrl: resolvedImageUrl,
      });
    } catch (error: any) {
      console.error('Error updating product:', error);
      res.status(500).json({ message: 'Error updating product', error: error.message });
    }
  },

  // Delete product (soft delete)
  deleteProduct: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      await prisma.product.update({
        where: { id },
        data: { isActive: false },
      });

      res.json({ message: 'Product deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting product:', error);
      res.status(500).json({ message: 'Error deleting product', error: error.message });
    }
  },

  // Diagnostic endpoint for AWS credentials
  checkS3Status: async (req: Request, res: Response): Promise<void> => {
    try {
      const s3Status = {
        isConfigured: s3Service.isConfigured(),
        hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
        hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
        hasRegion: !!process.env.AWS_REGION,
        hasBucket: !!process.env.S3_BUCKET_NAME,
        region: process.env.AWS_REGION,
        bucket: process.env.S3_BUCKET_NAME,
      };

      res.json(s3Status);
    } catch (error: any) {
      console.error('Error checking S3 status:', error);
      res.status(500).json({ message: 'Error checking S3 status', error: error.message });
    }
  },
};