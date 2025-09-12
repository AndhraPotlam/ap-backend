import mongoose, { Document, Schema } from 'mongoose';

export interface ICoupon extends Document {
  code: string;
  name: string;
  description?: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minimumOrderAmount?: number;
  maximumDiscount?: number;
  validFrom: Date;
  validUntil: Date;
  usageLimit?: number;
  usedCount: number;
  isActive: boolean;
  applicableCategories?: mongoose.Types.ObjectId[];
  applicableProducts?: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
  isValid: boolean;
  canBeUsed(orderAmount?: number): { valid: boolean; reason?: string };
  calculateDiscount(orderAmount: number): number;
  incrementUsage(): Promise<void>;
}

const couponSchema = new Schema<ICoupon>({
  code: {
    type: String,
    required: [true, 'Coupon code is required'],
    trim: true,
    uppercase: true,
    minlength: [3, 'Coupon code must be at least 3 characters'],
    maxlength: [20, 'Coupon code cannot exceed 20 characters']
  },
  name: {
    type: String,
    required: [true, 'Coupon name is required'],
    trim: true,
    maxlength: [100, 'Coupon name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  discountType: {
    type: String,
    enum: {
      values: ['percentage', 'fixed'],
      message: 'Discount type must be either percentage or fixed'
    },
    required: [true, 'Discount type is required']
  },
  discountValue: {
    type: Number,
    required: [true, 'Discount value is required'],
    min: [0, 'Discount value cannot be negative'],
    validate: {
      validator: function(this: ICoupon, value: number) {
        if (this.discountType === 'percentage') {
          return value > 0 && value <= 100;
        }
        return value > 0;
      },
      message: 'Percentage discount must be between 1-100%, fixed discount must be greater than 0'
    }
  },
  minimumOrderAmount: {
    type: Number,
    min: [0, 'Minimum order amount cannot be negative']
  },
  maximumDiscount: {
    type: Number,
    min: [0, 'Maximum discount cannot be negative'],
    validate: {
      validator: function(this: ICoupon, value: number) {
        if (this.discountType === 'percentage' && value) {
          return value > 0;
        }
        return true;
      },
      message: 'Maximum discount must be greater than 0 for percentage discounts'
    }
  },
  validFrom: {
    type: Date,
    required: [true, 'Valid from date is required'],
    default: Date.now
  },
  validUntil: {
    type: Date,
    required: [true, 'Valid until date is required']
  },
  usageLimit: {
    type: Number,
    min: [0, 'Usage limit must be 0 (unlimited) or at least 1'],
    validate: {
      validator: function(value: number) {
        return value === 0 || value >= 1;
      },
      message: 'Usage limit must be 0 (unlimited) or at least 1'
    }
  },
  usedCount: {
    type: Number,
    default: 0,
    min: [0, 'Used count cannot be negative']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  applicableCategories: [{
    type: Schema.Types.ObjectId,
    ref: 'Category',
    validate: {
      validator: function(categories: mongoose.Types.ObjectId[]) {
        return categories.length === 0 || categories.every(cat => cat);
      },
      message: 'Invalid category ID provided'
    }
  }],
  applicableProducts: [{
    type: Schema.Types.ObjectId,
    ref: 'Product',
    validate: {
      validator: function(products: mongoose.Types.ObjectId[]) {
        return products.length === 0 || products.every(prod => prod);
      },
      message: 'Invalid product ID provided'
    }
  }]
}, {
  timestamps: true
});

// Indexes for efficient queries
couponSchema.index({ code: 1 }, { unique: true });
couponSchema.index({ isActive: 1 });
couponSchema.index({ validFrom: 1, validUntil: 1 });
couponSchema.index({ usageLimit: 1, usedCount: 1 });

// Pre-save middleware to ensure code is uppercase and validate dates
couponSchema.pre('save', function(next) {
  if (this.isModified('code')) {
    this.code = this.code.toUpperCase();
  }
  
  if (this.validFrom && this.validUntil && this.validFrom > this.validUntil) {
    return next(new Error('Valid from date must be before or equal to valid until date'));
  }
  next();
});

// Pre-update middleware to validate dates
couponSchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate() as any;
  if (update.validFrom && update.validUntil && update.validFrom > update.validUntil) {
    return next(new Error('Valid from date must be before or equal to valid until date'));
  }
  next();
});

// Virtual for checking if coupon is valid
couponSchema.virtual('isValid').get(function() {
  const now = new Date();
  return this.isActive && 
         now >= this.validFrom && 
         now <= this.validUntil &&
         (this.usageLimit === 0 || !this.usageLimit || this.usedCount < this.usageLimit);
});

// Method to check if coupon can be used
couponSchema.methods.canBeUsed = function(orderAmount: number = 0) {
  if (!this.isValid) {
    return { valid: false, reason: 'Coupon is not valid' };
  }
  
  if (this.minimumOrderAmount && orderAmount < this.minimumOrderAmount) {
    return { 
      valid: false, 
      reason: `Minimum order amount of ₹${this.minimumOrderAmount} required` 
    };
  }
  
  return { valid: true };
};

// Method to increment usage count and handle limit reached
couponSchema.methods.incrementUsage = async function() {
  if (this.usageLimit && this.usageLimit > 0) {
    this.usedCount += 1;
    
    // If usage limit reached, mark as inactive
    if (this.usedCount >= this.usageLimit) {
      this.isActive = false;
    }
    
    await this.save();
  }
};

// Method to calculate discount amount
couponSchema.methods.calculateDiscount = function(orderAmount: number) {
  let discountAmount = 0;
  
  if (this.discountType === 'percentage') {
    discountAmount = orderAmount * (this.discountValue / 100);
    if (this.maximumDiscount) {
      discountAmount = Math.min(discountAmount, this.maximumDiscount);
    }
  } else {
    discountAmount = this.discountValue;
  }
  
  // Ensure discount doesn't exceed order amount
  return Math.min(discountAmount, orderAmount);
};

export default mongoose.model<ICoupon>('Coupon', couponSchema);
