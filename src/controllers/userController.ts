import { Request, Response } from 'express';
import { User } from '../models/User';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export const userController = {
  register: async (req: Request, res: Response): Promise<any> => {
    try {
      const { email, phoneNumber, password } = req.body;
      console.log(email, phoneNumber, password)
      // Validate password length
      if (password && password.length < 6) {
        res.status(400).json({
          message: 'Validation failed',
          errors: ['Password must be at least 6 characters long']
        });
        return;
      }

      // Check for existing user
      const existingUser = await User.findOne({ $or: [{ email }, { phoneNumber }] });
      if (existingUser) {
        if (existingUser.email === email) {
          res.status(400).json({
            message: 'Validation failed',
            errors: ['Email address is already registered']
          });
          return;
        }
        if (existingUser.phoneNumber === phoneNumber) {
          res.status(400).json({
            message: 'Validation failed',
            errors: ['Phone number is already registered ']
          });
          return;
        }
      }

      const user = await User.create(req.body);
      res.status(201).json({ 
        message: 'Registration successful',
        user: {
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phoneNumber: user.phoneNumber
        }
      });
    } catch (error: any) {
      if (error.name === 'ValidationError') {
        const validationErrors = [];
        
        // Extract specific validation errors
        for (let field in error.errors) {
          validationErrors.push(error.errors[field].message);
        }

        res.status(400).json({
          message: 'Validation failed',
          errors: validationErrors
        });
      } else {
        res.status(500).json({
          message: 'Registration failed',
          errors: [error.message]
        });
      }
    }
  },

  login: async (req: Request, res: Response): Promise<any> => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({ message: 'Email and password are required' });
        return;
      }

      const user = await User.findOne({ email });
      if (!user) {
        console.log('Invalid email or password');
        res.status(401).json({ message: 'Invalid email or password' });
        return;
      }

      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        console.log('Invalid email or password');
        res.status(401).json({ message: 'Invalid email or password' });
        return;
      }

      if (!user.isActive) {
        res.status(403).json({ message: 'Account is deactivated' });
        return;
      }

      const token = jwt.sign(
        { userId: user._id },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      // Set cookie with cross-origin settings
      res.cookie('token', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });

      res.json({
        message: 'Login successful',
        user: {
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phoneNumber: user.phoneNumber
        }
      });
    } catch (error: any) {
      res.status(500).json({ message: 'Login failed', error: error.message });
    }
  },

  logout: async (req: Request, res: Response): Promise<any> => {
    try {
      res.clearCookie('token', {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/'
      });
      res.json({ message: 'Logout successful' });
    } catch (error: any) {
      res.status(500).json({ message: 'Logout failed', error: error.message });
    }
  },

  getMe: async (req: Request, res: Response): Promise<any> => {
    try {
      if (!req.user) {
        // Not authenticated
        return res.status(401).json({ message: 'Not authenticated' });
      }
      const user = await User.findById(req.user.userId).select('firstName lastName email role');
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      res.json(user);
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to fetch user data', error: error.message });
    }
  },

  updateUser: async (req: Request, res: Response): Promise<any> => {
    try {
      const { email, ...updateData } = req.body;

      // Prevent email from being updated
      if (email) {
        res.status(400).json({
          message: 'Email cannot be updated'
        });
        return;
      }

      const userId = req.user?._id;
      if (!userId) {
        res.status(401).json({
          message: 'Unauthorized'
        });
        return;
      }

      const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
        new: true,
        runValidators: true
      }).select('firstName lastName phoneNumber role');

      if (!updatedUser) {
        res.status(404).json({
          message: 'User not found'
        });
        return;
      }

      res.json({
        message: 'User updated successfully',
        user: updatedUser
      });
    } catch (error: any) {
      if (error.name === 'ValidationError') {
        const validationErrors = [];

        // Extract specific validation errors
        for (let field in error.errors) {
          validationErrors.push(error.errors[field].message);
        }

        res.status(400).json({
          message: 'Validation failed',
          errors: validationErrors
        });
      } else {
        res.status(500).json({
          message: 'Failed to update user',
          errors: [error.message]
        });
      }
    }
  }
};