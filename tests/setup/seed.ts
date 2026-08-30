import dotenv from 'dotenv';
import { prisma } from '../../src/config/prisma';
import bcrypt from 'bcryptjs';

dotenv.config();

const seedDatabase = async () => {
  try {
    console.log('Connecting to PostgreSQL database via Prisma...');

    // Clean existing database records
    console.log('Cleaning existing Categories, Users, and Settings...');
    await prisma.category.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.setting.deleteMany({});

    // Seed Categories
    console.log('Seeding categories...');
    const categories = [
      { name: 'Biryani', slug: 'biryani', description: 'Delicious traditional Biryanis' },
      { name: 'Curries', slug: 'curries', description: 'Flavorful curries and gravies' },
      { name: 'Starters', slug: 'starters', description: 'Crispy and savory starters' },
    ];
    await prisma.category.createMany({ data: categories });
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
          currency: 'INR',
        },
        description: 'Global pricing, tax rate and shipping cost configurations',
        isActive: true,
      },
      {
        key: 'general_info',
        category: 'general' as const,
        value: {
          storeName: 'Andhra Potlam',
          contactEmail: 'contact@andhrapotlam.com',
        },
        description: 'General store info',
        isActive: true,
      },
    ];
    await prisma.setting.createMany({ data: settings });
    console.log(`✅ Seeded ${settings.length} settings`);

    // Seed a baseline Admin User
    console.log('Seeding admin user...');
    const hashedPassword = await bcrypt.hash('AdminPassword123!', 10);
    await prisma.user.create({
      data: {
        firstName: 'Admin',
        lastName: 'System',
        email: 'admin@andhrapotlam.com',
        phoneNumber: '9999999999',
        password: hashedPassword,
        role: 'admin',
        isActive: true,
      },
    });
    console.log('✅ Seeded admin user successfully');

    console.log('🎉 Seeding completed successfully!');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    console.log('Disconnected from PostgreSQL');
  }
};

// Run seeding
seedDatabase();
