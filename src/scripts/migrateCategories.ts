import mongoose from 'mongoose';
import { Category } from '../models/Category';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/andhra-potlam';
    await mongoose.connect(mongoURI);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Migrate categories
const migrateCategories = async () => {
  try {
    // Find all categories
    const categories = await Category.find({});
    console.log(`Found ${categories.length} categories to migrate`);

    // Update each category with a slug
    for (const category of categories) {
      // Skip if category already has a slug
      if (category.slug) {
        console.log(`Category ${category.name} already has a slug: ${category.slug}`);
        continue;
      }

      // Save the category (this will trigger the pre-save middleware to update the slug)
      await category.save();
      console.log(`Updated category ${category.name} with slug: ${category.slug}`);
    }

    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('MongoDB disconnected');
  }
};

// Run migration
connectDB().then(() => {
  migrateCategories();
}); 