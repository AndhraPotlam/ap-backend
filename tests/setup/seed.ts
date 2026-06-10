import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Category } from '../../src/models/Category';
import { User } from '../../src/models/User';
import Settings from '../../src/models/Settings';

// Load environment variables
dotenv.config();

const seedDatabase = async () => {
  try {
    const mongoUrl = process.env.MONGODB_URI || 'mongodb://localhost:27017/andhra-potlam';
    console.log(`Connecting to MongoDB at: ${mongoUrl}`);
    
    // Non-production SSL options logic
    const options: mongoose.ConnectOptions = {};
    if (process.env.NODE_ENV === 'production') {
      options.ssl = true;
      options.tls = true;
      options.tlsAllowInvalidCertificates = false;
    }
    
    await mongoose.connect(mongoUrl, options);
    console.log('✅ MongoDB connected successfully');

    // Clean existing database records
    console.log('Cleaning existing Categories, Users, and Settings...');
    await Category.deleteMany({});
    await User.deleteMany({});
    await Settings.deleteMany({});

    // Seed Categories
    console.log('Seeding categories...');
    const categories = [
      { name: 'Biryani', slug: 'biryani', description: 'Delicious traditional Biryanis' },
      { name: 'Curries', slug: 'curries', description: 'Flavorful curries and gravies' },
      { name: 'Starters', slug: 'starters', description: 'Crispy and savory starters' }
    ];
    await Category.insertMany(categories);
    console.log(`✅ Seeded ${categories.length} categories`);

    // Seed Settings
    console.log('Seeding settings...');
    const settings = [
      {
        key: 'pricing_config',
        category: 'pricing' as const,
        value: {
          tax_rate: 0.05,
          shipping_cost: 40,
          currency: 'INR'
        },
        description: 'Global pricing, tax rate and shipping cost configurations',
        isActive: true
      },
      {
        key: 'general_info',
        category: 'general' as const,
        value: {
          storeName: 'Andhra Potlam',
          contactEmail: 'contact@andhrapotlam.com'
        },
        description: 'General store info',
        isActive: true
      }
    ];
    await Settings.insertMany(settings);
    console.log(`✅ Seeded ${settings.length} settings`);

    // Seed a baseline Admin User
    console.log('Seeding admin user...');
    const adminUser = new User({
      firstName: 'Admin',
      lastName: 'System',
      email: 'admin@andhrapotlam.com',
      phoneNumber: '9999999999',
      password: 'AdminPassword123!',
      role: 'admin',
      isActive: true
    });
    await adminUser.save();
    console.log('✅ Seeded admin user successfully');

    console.log('🎉 Seeding completed successfully!');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

// Run seeding
seedDatabase();
