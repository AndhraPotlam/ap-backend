import { Request, Response } from 'express';
import { Product } from '../models/Product';
import { Category } from '../models/Category';
import mongoose from 'mongoose';
import { s3Service } from '../services/s3Service';

export const productController = {
  // Create product
  createProduct: async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, description, price, category, stock, imageUrl } = req.body;

      // Validate category
      if (!mongoose.Types.ObjectId.isValid(category)) {
        res.status(400).json({ message: 'Invalid category ID format' });
        return;
      }

      const categoryExists = await Category.findById(category);
      if (!categoryExists) {
        res.status(404).json({ message: 'Category not found' });
        return;
      }

      const product = new Product({
        name,
        description,
        price,
        category,
        stock,
        imageUrl,
      });

      await product.save();
      res.status(201).json(product);
    } catch (error: any) {
      console.error('Error creating product:', error);
      res.status(500).json({ message: 'Error creating product', error: error.message });
    }
  },

  // Get all products
  // Get products with filtering, pagination, and search
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
        sortOrder = 'desc'
      } = req.query;

      // Build query
      const query: any = { isActive: true };

      // Category filter
      if (category) {
        if (mongoose.Types.ObjectId.isValid(category as string)) {
          query.category = category;
        } else {
          res.status(400).json({ message: 'Invalid category ID format' });
          return;
        }
      }

      // Price range filter
      if (minPrice || maxPrice) {
        query.price = {};
        if (minPrice) query.price.$gte = Number(minPrice);
        if (maxPrice) query.price.$lte = Number(maxPrice);
      }

      // Search by name or description
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }

      // Calculate pagination
      const skip = (Number(page) - 1) * Number(limit);

      // Create sort object
      const sortOptions: { [key: string]: 'asc' | 'desc' } = {
        [(sortBy as string)]: (sortOrder as 'asc' | 'desc')
      };

      // Execute query with pagination and populate category
      const products = await Product.find(query)
        .populate('category', 'name')
        .sort(sortOptions)
        .skip(skip)
        .limit(Number(limit));

      // Get total count for pagination
      const total = await Product.countDocuments(query);

      // Generate presigned URLs for each product's image
      const productsWithPresignedUrls = await Promise.all(
        products.map(async (product) => {
          const fileName = product.imageUrl.split('/').pop();
          const presignedUrl = await s3Service.getReadPresignedUrl(fileName!);
          return {
            ...product.toObject(),
            imageUrl: presignedUrl
          };
        })
      );

      res.json({
        products: productsWithPresignedUrls,
        currentPage: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
        totalProducts: total
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
      
      // Validate category ID format
      if (!mongoose.Types.ObjectId.isValid(category)) {
        res.status(400).json({ message: 'Invalid category ID format' });
        return;
      }
      
      // Check if category exists
      const categoryExists = await Category.findById(category);
      if (!categoryExists) {
        res.status(404).json({ message: 'Category not found' });
        return;
      }
      
      const products = await Product.find({ 
        category,
        isActive: true
      }).populate('category', 'name');
      
      res.json(products);
    } catch (error: any) {
      console.error('Error fetching products by category:', error);
      res.status(500).json({ message: 'Error fetching products by category', error: error.message });
    }
  },

  // Get single product
  getProduct: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      
      // Validate ID format
      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({ message: 'Invalid product ID format' });
        return;
      }
      
      const product = await Product.findOne({ 
        _id: id,
        isActive: true
      }).populate('category', 'name');
      
      if (!product) {
        res.status(404).json({ message: 'Product not found' });
        return;
      }

      // Generate presigned URL for the product's image
      const fileName = product.imageUrl.split('/').pop();
      const presignedUrl = await s3Service.getReadPresignedUrl(fileName!);
      
      res.json({
        ...product.toObject(),
        imageUrl: presignedUrl
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
      
      // Validate ID format
      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({ message: 'Invalid product ID format' });
        return;
      }
      
      // Validate category if provided
      if (req.body.category) {
        if (!mongoose.Types.ObjectId.isValid(req.body.category)) {
          res.status(400).json({ message: 'Invalid category ID format' });
          return;
        }
        
        const categoryExists = await Category.findById(req.body.category);
        if (!categoryExists) {
          res.status(404).json({ message: 'Category not found' });
          return;
        }
      }
      
      const product = await Product.findByIdAndUpdate(
        id,
        { $set: req.body },
        { new: true, runValidators: true }
      ).populate('category', 'name');

      if (!product) {
        res.status(404).json({ message: 'Product not found' });
        return;
      }

      // Generate presigned URL for the updated product's image
      const fileName = product.imageUrl.split('/').pop();
      const presignedUrl = await s3Service.getReadPresignedUrl(fileName!);

      res.json({
        ...product.toObject(),
        imageUrl: presignedUrl
      });
    } catch (error: any) {
      console.error('Error updating product:', error);
      
      if (error instanceof mongoose.Error.ValidationError) {
        const validationErrors = Object.values(error.errors).map(err => err.message);
        res.status(400).json({ message: 'Validation error', errors: validationErrors });
      } else {
        res.status(500).json({ message: 'Error updating product', error: error.message });
      }
    }
  },

  // Delete product (soft delete)
  deleteProduct: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      
      // Validate ID format
      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({ message: 'Invalid product ID format' });
        return;
      }
      
      const product = await Product.findByIdAndUpdate(
        id,
        { isActive: false },
        { new: true }
      );
      
      if (!product) {
        res.status(404).json({ message: 'Product not found' });
        return;
      }

      res.json({ message: 'Product deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting product:', error);
      res.status(500).json({ message: 'Error deleting product', error: error.message });
    }
  }
};