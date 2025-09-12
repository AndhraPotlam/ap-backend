import mongoose, { Document, Schema } from 'mongoose';

export interface IDiscount extends Document {
  name: string;
  description?: string;
  type: 'percentage' | 'fixed' | 'bulk' | 'buy_x_get_y';
  value: number;
  minimumOrderAmount?: number;
  maximumDiscount?: number;
  validFrom: Date;
  validUntil: Date;
  usageLimit?: number;
  usedCount: number;
  isActive: boolean;
  applicableCategories?: mongoose.Types.ObjectId[];
  applicableProducts?: mongoose.Types.ObjectId[];
  conditions: {
    buyQuantity?: number;
    getQuantity?: number;
    bulkThreshold?: number;
    bulkDiscount?: number;
  };
  createdAt: Date;
  updatedAt: Date;
  isValid: boolean;
  canBeApplied(orderAmount?: number, totalQuantity?: number): { valid: boolean; reason?: string };
  calculateDiscount(orderAmount: number, totalQuantity?: number): number;
  incrementUsage(): Promise<void>;
}

const discountSchema = new Schema<IDiscount>({
  name: {
    type: String,
    required: [true, 'Discount name is required'],
    trim: true,
    maxlength: [100, 'Discount name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  type: {
    type: String,
    enum: {
      values: ['percentage', 'fixed', 'bulk', 'buy_x_get_y'],
      message: 'Discount type must be percentage, fixed, bulk, or buy_x_get_y'
    },
    required: [true, 'Discount type is required']
  },
  value: {
    type: Number,
    required: [true, 'Discount value is required'],
    min: [0, 'Discount value cannot be negative'],
    validate: {
      validator: function(this: IDiscount, value: number) {
        if (this.type === 'percentage') {
          return value > 0 && value <= 100;
        }
        if (this.type === 'fixed') {
          return value > 0;
        }
        if (this.type === 'bulk') {
          return value > 0 && value <= 100;
        }
        return true;
      },
      message: 'Invalid discount value for the selected type'
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
      validator: function(this: IDiscount, value: number) {
        if ((this.type === 'percentage' || this.type === 'bulk') && value) {
          return value > 0;
        }
        return true;
      },
      message: 'Maximum discount must be greater than 0 for percentage/bulk discounts'
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
  }],
  conditions: {
    buyQuantity: {
      type: Number,
      min: [0, 'Buy quantity cannot be negative'],
      validate: {
        validator: function(this: any, value: number) {
          if (this.type === 'buy_x_get_y' && value !== undefined) {
            return value > 0;
          }
          return true;
        },
        message: 'Buy quantity must be greater than 0 for buy_x_get_y discounts'
      }
    },
    getQuantity: {
      type: Number,
      min: [0, 'Get quantity cannot be negative'],
      validate: {
        validator: function(this: any, value: number) {
          if (this.type === 'buy_x_get_y' && value !== undefined) {
            return value > 0;
          }
          return true;
        },
        message: 'Get quantity must be greater than 0 for buy_x_get_y discounts'
      }
    },
    bulkThreshold: {
      type: Number,
      min: [0, 'Bulk threshold cannot be negative'],
      validate: {
        validator: function(this: any, value: number) {
          if (this.type === 'bulk' && value !== undefined) {
            return value > 0;
          }
          return true;
        },
        message: 'Bulk threshold must be greater than 0 for bulk discounts'
      }
    },
    bulkDiscount: {
      type: Number,
      min: [0, 'Bulk discount cannot be negative'],
      max: [100, 'Bulk discount cannot exceed 100%'],
      validate: {
        validator: function(this: any, value: number) {
          if (this.type === 'bulk' && value !== undefined) {
            return value > 0 && value <= 100;
          }
          return true;
        },
        message: 'Bulk discount must be between 1-100% for bulk discounts'
      }
    }
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
discountSchema.index({ isActive: 1 });
discountSchema.index({ validFrom: 1, validUntil: 1 });
discountSchema.index({ usageLimit: 1, usedCount: 1 });
discountSchema.index({ type: 1 });

// Pre-save middleware to validate dates
discountSchema.pre('save', function(next) {
  if (this.validFrom && this.validUntil && this.validFrom > this.validUntil) {
    return next(new Error('Valid from date must be before or equal to valid until date'));
  }
  next();
});

// Pre-update middleware to validate dates
discountSchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate() as any;
  if (update.validFrom && update.validUntil && update.validFrom > update.validUntil) {
    return next(new Error('Valid from date must be before or equal to valid until date'));
  }
  next();
});

// Virtual for checking if discount is valid
discountSchema.virtual('isValid').get(function() {
  const now = new Date();
  return this.isActive && 
         now >= this.validFrom && 
         now <= this.validUntil &&
         (this.usageLimit === 0 || !this.usageLimit || this.usedCount < this.usageLimit);
});

// Method to check if discount can be applied
discountSchema.methods.canBeApplied = function(orderAmount: number = 0, totalQuantity: number = 0) {
  if (!this.isValid) {
    return { valid: false, reason: 'Discount is not valid' };
  }
  
  if (this.minimumOrderAmount && orderAmount < this.minimumOrderAmount) {
    return { 
      valid: false, 
      reason: `Minimum order amount of ₹${this.minimumOrderAmount} required` 
    };
  }
  
  if (this.type === 'bulk' && this.conditions?.bulkThreshold) {
    if (totalQuantity < this.conditions.bulkThreshold) {
      return { 
        valid: false, 
        reason: `Minimum ${this.conditions.bulkThreshold} items required for bulk discount` 
      };
    }
  }
  
  return { valid: true };
};

// Method to increment usage count and handle limit reached
discountSchema.methods.incrementUsage = async function() {
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
discountSchema.methods.calculateDiscount = function(orderAmount: number, totalQuantity: number = 0) {
  let discountAmount = 0;
  
  switch (this.type) {
    case 'percentage':
      discountAmount = orderAmount * (this.value / 100);
      break;
    case 'fixed':
      discountAmount = this.value;
      break;
    case 'bulk':
      if (this.conditions?.bulkThreshold && totalQuantity >= this.conditions.bulkThreshold) {
        discountAmount = orderAmount * ((this.conditions.bulkDiscount || 0) / 100);
      }
      break;
    case 'buy_x_get_y':
      // This would need more complex logic based on specific items
      break;
  }
  
  // Apply maximum discount limit
  if (this.maximumDiscount) {
    discountAmount = Math.min(discountAmount, this.maximumDiscount);
  }
  
  // Ensure discount doesn't exceed order amount
  return Math.min(discountAmount, orderAmount);
};

export default mongoose.model<IDiscount>('Discount', discountSchema);
