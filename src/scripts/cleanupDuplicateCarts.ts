import mongoose from 'mongoose';
import Cart from '../models/Cart';

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/andhra-potlam';

async function cleanupDuplicateCarts() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find all carts
    const allCarts = await Cart.find({});
    console.log(`Found ${allCarts.length} total carts`);

    // Group carts by user
    const cartsByUser = new Map();
    allCarts.forEach(cart => {
      const userId = cart.user.toString();
      if (!cartsByUser.has(userId)) {
        cartsByUser.set(userId, []);
      }
      cartsByUser.get(userId).push(cart);
    });

    console.log(`Found ${cartsByUser.size} unique users with carts`);

    // Process each user's carts
    for (const [userId, userCarts] of cartsByUser) {
      if (userCarts.length > 1) {
        console.log(`User ${userId} has ${userCarts.length} carts`);
        
        // Sort by creation date (newest first)
        userCarts.sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime());
        
        // Keep the newest active cart, deactivate others
        const newestCart = userCarts[0];
        const olderCarts = userCarts.slice(1);
        
        // Deactivate older carts
        for (const oldCart of olderCarts) {
          oldCart.isActive = false;
          await oldCart.save();
          console.log(`Deactivated cart ${oldCart._id} for user ${userId}`);
        }
        
        // Ensure newest cart is active
        if (!newestCart.isActive) {
          newestCart.isActive = true;
          await newestCart.save();
          console.log(`Activated cart ${newestCart._id} for user ${userId}`);
        }
      }
    }

    console.log('Cleanup completed successfully');
  } catch (error) {
    console.error('Error during cleanup:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the cleanup
cleanupDuplicateCarts();
