import mongoose from 'express';
import { MongoClient } from 'mongodb';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/andhra-potlam-production';

async function migrate() {
  console.log('🚀 Starting MongoDB to PostgreSQL data migration...');
  console.log(`Connecting to MongoDB at: ${mongoUri}`);

  const mongoClient = new MongoClient(mongoUri);
  await mongoClient.connect();
  const db = mongoClient.db();

  console.log('✅ Connected to MongoDB. Extracting collections...');

  // 1. Users
  const users = await db.collection('users').find().toArray();
  console.log(`Found ${users.length} users to migrate.`);
  for (const u of users) {
    const userId = u._id.toString();
    const role = u.role === 'admin' ? 'admin' : u.role === 'employee' ? 'employee' : 'user';
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        id: userId,
        firstName: u.firstName || 'User',
        lastName: u.lastName || '',
        email: u.email,
        phoneNumber: u.phoneNumber || userId.slice(0, 10),
        password: u.password,
        role: role as any,
        isActive: u.isActive !== undefined ? u.isActive : true,
        createdAt: u.createdAt ? new Date(u.createdAt) : new Date(),
        updatedAt: u.updatedAt ? new Date(u.updatedAt) : new Date(),
      },
    });
  }

  // 2. Categories
  const categories = await db.collection('categories').find().toArray();
  console.log(`Found ${categories.length} categories to migrate.`);
  for (const c of categories) {
    const catId = c._id.toString();
    await prisma.category.upsert({
      where: { id: catId },
      update: {},
      create: {
        id: catId,
        name: c.name,
        description: c.description || null,
        slug: c.slug || catId,
        isActive: c.isActive !== undefined ? c.isActive : true,
        createdAt: c.createdAt ? new Date(c.createdAt) : new Date(),
        updatedAt: c.updatedAt ? new Date(c.updatedAt) : new Date(),
      },
    });
  }

  // 3. Products
  const products = await db.collection('products').find().toArray();
  console.log(`Found ${products.length} products to migrate.`);
  for (const p of products) {
    const prodId = p._id.toString();
    const categoryId = p.category?.toString();
    if (!categoryId) continue;

    // Ensure category exists
    const catExists = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!catExists) continue;

    await prisma.product.upsert({
      where: { id: prodId },
      update: {},
      create: {
        id: prodId,
        name: p.name,
        description: p.description || '',
        price: Number(p.price) || 0,
        categoryId,
        imageUrl: p.imageUrl || '',
        stock: Number(p.stock) || 0,
        isActive: p.isActive !== undefined ? p.isActive : true,
        createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
        updatedAt: p.updatedAt ? new Date(p.updatedAt) : new Date(),
      },
    });
  }

  // 4. Coupons
  const coupons = await db.collection('coupons').find().toArray();
  console.log(`Found ${coupons.length} coupons to migrate.`);
  for (const cp of coupons) {
    const cpId = cp._id.toString();
    await prisma.coupon.upsert({
      where: { code: cp.code },
      update: {},
      create: {
        id: cpId,
        code: cp.code,
        name: cp.name || cp.code,
        description: cp.description || null,
        discountType: cp.discountType === 'fixed' ? 'fixed' : 'percentage',
        discountValue: Number(cp.discountValue) || 0,
        minimumOrderAmount: cp.minimumOrderAmount ? Number(cp.minimumOrderAmount) : null,
        maximumDiscount: cp.maximumDiscount ? Number(cp.maximumDiscount) : null,
        validFrom: cp.validFrom ? new Date(cp.validFrom) : new Date(),
        validUntil: cp.validUntil ? new Date(cp.validUntil) : new Date(),
        usageLimit: cp.usageLimit ? Number(cp.usageLimit) : null,
        usedCount: Number(cp.usedCount) || 0,
        isActive: cp.isActive !== undefined ? cp.isActive : true,
        applicableCategories: cp.applicableCategories?.map((x: any) => x.toString()) || [],
        applicableProducts: cp.applicableProducts?.map((x: any) => x.toString()) || [],
        createdAt: cp.createdAt ? new Date(cp.createdAt) : new Date(),
        updatedAt: cp.updatedAt ? new Date(cp.updatedAt) : new Date(),
      },
    });
  }

  // 5. Settings
  const settings = await db.collection('settings').find().toArray();
  console.log(`Found ${settings.length} settings to migrate.`);
  for (const s of settings) {
    const sId = s._id.toString();
    await prisma.setting.upsert({
      where: { key: s.key },
      update: {},
      create: {
        id: sId,
        key: s.key,
        value: s.value || {},
        description: s.description || null,
        category: (s.category as any) || 'general',
        isActive: s.isActive !== undefined ? s.isActive : true,
        createdAt: s.createdAt ? new Date(s.createdAt) : new Date(),
        updatedAt: s.updatedAt ? new Date(s.updatedAt) : new Date(),
      },
    });
  }

  console.log('🎉 Data migration completed successfully!');
  await mongoClient.close();
  await prisma.$disconnect();
}

migrate().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
