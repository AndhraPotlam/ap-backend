import { prisma } from '../config/prisma';
import dotenv from 'dotenv';

dotenv.config();

const migrateCategories = async () => {
  try {
    const categories = await prisma.category.findMany({});
    console.log(`Found ${categories.length} categories to check`);

    for (const category of categories) {
      if (!category.slug) {
        const slug = category.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
        await prisma.category.update({
          where: { id: category.id },
          data: { slug },
        });
        console.log(`Updated category ${category.name} with slug: ${slug}`);
      }
    }

    console.log('Category migration completed successfully');
  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    await prisma.$disconnect();
  }
};

migrateCategories();