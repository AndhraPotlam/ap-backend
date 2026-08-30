import { prisma } from '../config/prisma';
import dotenv from 'dotenv';

dotenv.config();

async function cleanupDuplicateCarts() {
  try {
    const allCarts = await prisma.cart.findMany({
      orderBy: { createdAt: 'desc' },
    });
    console.log(`Found ${allCarts.length} total carts`);

    const userCartMap = new Map<string, typeof allCarts>();
    allCarts.forEach((cart) => {
      if (!userCartMap.has(cart.userId)) {
        userCartMap.set(cart.userId, []);
      }
      userCartMap.get(cart.userId)!.push(cart);
    });

    for (const [userId, userCarts] of userCartMap) {
      if (userCarts.length > 1) {
        console.log(`User ${userId} has ${userCarts.length} carts`);
        const [newest, ...duplicates] = userCarts;

        for (const dup of duplicates) {
          await prisma.cartItem.deleteMany({ where: { cartId: dup.id } });
          await prisma.cart.delete({ where: { id: dup.id } });
          console.log(`Deleted duplicate cart ${dup.id} for user ${userId}`);
        }
      }
    }

    console.log('Cart cleanup completed successfully');
  } catch (error) {
    console.error('Error during cleanup:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupDuplicateCarts();
