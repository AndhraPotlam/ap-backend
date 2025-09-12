import mongoose, { Document } from 'mongoose';

export interface IOrderItem {
  product: mongoose.Types.ObjectId;
  quantity: number;
  priceAtOrder: number;
}

export interface IShippingDetails {
  type: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface IPaymentDetails {
  method: string;
  status: string;
}

export interface IPricing {
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  shippingCost: number;
  discountAmount: number;
  discountCode: string;
  totalAmount: number;
}

export interface IAppliedCoupon {
  couponId: mongoose.Types.ObjectId;
  code: string;
  discountAmount: number;
}

export interface IOrder extends Document {
  user: mongoose.Types.ObjectId;
  items: IOrderItem[];
  shippingDetails: IShippingDetails;
  paymentDetails: IPaymentDetails;
  pricing: IPricing;
  appliedCoupon?: IAppliedCoupon;
  automaticDiscounts?: Array<{
    discount: {
      _id: mongoose.Types.ObjectId;
      name: string;
      type: string;
      value: number;
    };
    discountAmount: number;
  }>;
  totalAmount: number;
  status: 'pending' | 'confirmed' | 'processing' | 'delivered' | 'cancelled';
  cancellationReason?: string;
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const orderItemSchema = new mongoose.Schema({
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
  priceAtOrder: {
    type: Number,
    required: true
  }
});

const shippingDetailsSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true
  },
  address: {
    type: String,
    required: true
  },
  city: {
    type: String,
    required: true
  },
  state: {
    type: String,
    required: true
  },
  zipCode: {
    type: String,
    required: true
  },
  country: {
    type: String,
    required: true
  }
});

const paymentDetailsSchema = new mongoose.Schema({
  method: {
    type: String,
    required: true
  },
  status: {
    type: String,
    required: true
  }
});

const pricingSchema = new mongoose.Schema({
  subtotal: {
    type: Number,
    required: true
  },
  taxRate: {
    type: Number,
    required: true
  },
  taxAmount: {
    type: Number,
    required: true
  },
  shippingCost: {
    type: Number,
    required: true
  },
  discountAmount: {
    type: Number,
    required: true,
    default: 0
  },
  discountCode: {
    type: String,
    required: true,
    default: ''
  },
  totalAmount: {
    type: Number,
    required: true
  }
});

const appliedCouponSchema = new mongoose.Schema({
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

const automaticDiscountSchema = new mongoose.Schema({
  discount: {
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Discount',
      required: true
    },
    name: {
      type: String,
      required: true
    },
    type: {
      type: String,
      required: true
    },
    value: {
      type: Number,
      required: true
    }
  },
  discountAmount: {
    type: Number,
    required: true
  }
});

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [orderItemSchema],
  shippingDetails: {
    type: shippingDetailsSchema,
    required: true
  },
  paymentDetails: {
    type: paymentDetailsSchema,
    required: true
  },
  pricing: {
    type: pricingSchema,
    required: true
  },
  appliedCoupon: {
    type: appliedCouponSchema,
    required: false
  },
  automaticDiscounts: [automaticDiscountSchema],
  totalAmount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'delivered', 'cancelled'],
    default: 'pending'
  },
  cancellationReason: {
    type: String,
    required: function(this: IOrder) { 
      return this.status === 'cancelled';
    }
  },
  cancelledAt: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Update the updatedAt field before saving
orderSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export const Order = mongoose.model<IOrder>('Order', orderSchema);