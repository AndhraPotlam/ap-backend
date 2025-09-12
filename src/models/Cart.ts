import mongoose, { Document, Schema } from 'mongoose';

export interface ICartItem {
  product: mongoose.Types.ObjectId;
  quantity: number;
  priceAtAdd: number;
}

export interface ICart extends Document {
  user: mongoose.Types.ObjectId;
  items: ICartItem[];
  appliedCoupon?: {
    couponId: mongoose.Types.ObjectId;
    code: string;
    discountAmount: number;
  };
  totalPrice: number;
  totalItems: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  addItem(productId: string, quantity: number, price: number): Promise<ICart>;
  updateItemQuantity(productId: string, quantity: number): Promise<ICart>;
  removeItem(productId: string): Promise<ICart>;
  clearCart(): Promise<ICart>;
  applyCoupon(couponId: string, code: string, discountAmount: number): Promise<ICart>;
  removeCoupon(): Promise<ICart>;
}

const cartItemSchema = new Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  priceAtAdd: {
    type: Number,
    required: true
  }
});

const appliedCouponSchema = new Schema({
  couponId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Coupon',
    required: true
  },
  code: {
    type: String,
    required: true
  },
  discountAmount: {
    type: Number,
    required: true
  }
});

const cartSchema = new Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [cartItemSchema],
  appliedCoupon: {
    type: appliedCouponSchema,
    required: false
  },
  totalPrice: {
    type: Number,
    default: 0
  },
  totalItems: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
cartSchema.index({ user: 1 }, { unique: true });
cartSchema.index({ isActive: 1 });

// Pre-save middleware to calculate totals
cartSchema.pre('save', function(next) {
  this.totalItems = this.items.reduce((sum, item) => sum + item.quantity, 0);
  this.totalPrice = this.items.reduce((sum, item) => sum + (item.priceAtAdd * item.quantity), 0);
  next();
});

// Method to add item to cart
cartSchema.methods.addItem = async function(productId: string, quantity: number, price: number) {
  const existingItem = this.items.find((item: any) => item.product.toString() === productId);
  
  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    this.items.push({
      product: productId,
      quantity,
      priceAtAdd: price
    });
  }
  
  await this.save();
  return this;
};

// Method to update item quantity
cartSchema.methods.updateItemQuantity = async function(productId: string, quantity: number) {
  const item = this.items.find((item: any) => item.product.toString() === productId);
  
  if (item) {
    if (quantity <= 0) {
      this.items = this.items.filter((item: any) => item.product.toString() !== productId);
    } else {
      item.quantity = quantity;
    }
    await this.save();
  }
  
  return this;
};

// Method to remove item from cart
cartSchema.methods.removeItem = async function(productId: string) {
  this.items = this.items.filter((item: any) => item.product.toString() !== productId);
  await this.save();
  return this;
};

// Method to clear cart
cartSchema.methods.clearCart = async function() {
  this.items = [];
  this.appliedCoupon = undefined;
  this.isActive = false;
  await this.save();
  return this;
};

// Method to apply coupon
cartSchema.methods.applyCoupon = async function(couponId: string, code: string, discountAmount: number) {
  this.appliedCoupon = {
    couponId,
    code,
    discountAmount
  };
  await this.save();
  return this;
};

// Method to remove coupon
cartSchema.methods.removeCoupon = async function() {
  this.appliedCoupon = undefined;
  await this.save();
  return this;
};

export default mongoose.model<ICart>('Cart', cartSchema);
