import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { formatDoc, formatDocs } from '../utils/format';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export const userController = {
  register: async (req: Request, res: Response): Promise<any> => {
    try {
      const { firstName, lastName, email, phoneNumber, password, role } = req.body;

      if (!password || password.length < 6) {
        res.status(400).json({
          message: 'Validation failed',
          errors: ['Password must be at least 6 characters long'],
        });
        return;
      }

      if (!email || !phoneNumber || !firstName || !lastName) {
        res.status(400).json({
          message: 'Validation failed',
          errors: ['First name, last name, email, and phone number are required'],
        });
        return;
      }

      const normalizedEmail = String(email).trim().toLowerCase();
      const normalizedPhone = String(phoneNumber).trim();

      // Check existing user
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [{ email: normalizedEmail }, { phoneNumber: normalizedPhone }],
        },
      });

      if (existingUser) {
        if (existingUser.email === normalizedEmail) {
          res.status(400).json({
            message: 'Validation failed',
            errors: ['Email address is already registered'],
          });
          return;
        }
        if (existingUser.phoneNumber === normalizedPhone) {
          res.status(400).json({
            message: 'Validation failed',
            errors: ['Phone number is already registered'],
          });
          return;
        }
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const userRole = role === 'admin' ? 'admin' : role === 'employee' ? 'employee' : 'user';

      const user = await prisma.user.create({
        data: {
          firstName: String(firstName).trim(),
          lastName: String(lastName).trim(),
          email: normalizedEmail,
          phoneNumber: normalizedPhone,
          password: hashedPassword,
          role: userRole,
        },
      });

      res.status(201).json({
        message: 'Registration successful',
        user: {
          id: user.id,
          _id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phoneNumber: user.phoneNumber,
          role: user.role,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        message: 'Registration failed',
        errors: [error.message],
      });
    }
  },

  login: async (req: Request, res: Response): Promise<any> => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({ message: 'Email and password are required' });
        return;
      }

      const normalizedEmail = String(email).trim().toLowerCase();
      const user = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (!user) {
        res.status(401).json({ message: 'Invalid email or password' });
        return;
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        res.status(401).json({ message: 'Invalid email or password' });
        return;
      }

      if (!user.isActive) {
        res.status(403).json({ message: 'Account is deactivated' });
        return;
      }

      const token = jwt.sign(
        { userId: user.id, _id: user.id, role: user.role },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      const isProduction = process.env.NODE_ENV === 'production';
      res.cookie('token', token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
        path: '/',
        maxAge: 24 * 60 * 60 * 1000,
        domain: isProduction ? undefined : 'localhost',
      });

      res.json({
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          _id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phoneNumber: user.phoneNumber,
          role: user.role,
        },
      });
    } catch (error: any) {
      res.status(500).json({ message: 'Login failed', error: error.message });
    }
  },

  logout: async (req: Request, res: Response): Promise<any> => {
    try {
      const isProduction = process.env.NODE_ENV === 'production';
      res.clearCookie('token', {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
        path: '/',
        domain: isProduction ? undefined : 'localhost',
      });
      res.json({ message: 'Logout successful' });
    } catch (error: any) {
      res.status(500).json({ message: 'Logout failed', error: error.message });
    }
  },

  getMe: async (req: Request, res: Response): Promise<any> => {
    try {
      const targetUserId = req.user?.userId || req.user?._id || req.user?.id;
      if (!targetUserId) {
        return res.status(401).json({ message: 'Not authenticated' });
      }

      const user = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phoneNumber: true,
          role: true,
        },
      });

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json(formatDoc(user));
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to fetch user data', error: error.message });
    }
  },

  listUsers: async (req: Request, res: Response): Promise<any> => {
    try {
      if (!req.user || req.user.role !== 'admin') {
        res.status(403).json({ message: 'Forbidden' });
        return;
      }

      const users = await prisma.user.findMany({
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phoneNumber: true,
          role: true,
          isActive: true,
        },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      });

      res.json({ users: formatDocs(users) });
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to list users', error: error.message });
    }
  },

  updateUser: async (req: Request, res: Response): Promise<any> => {
    try {
      const { email, password, ...updateData } = req.body;

      if (email) {
        res.status(400).json({ message: 'Email cannot be updated' });
        return;
      }

      const userId = req.user?.userId || req.user?._id || req.user?.id;
      if (!userId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      const dataToUpdate: any = {};
      if (updateData.firstName) dataToUpdate.firstName = String(updateData.firstName).trim();
      if (updateData.lastName) dataToUpdate.lastName = String(updateData.lastName).trim();
      if (updateData.phoneNumber) dataToUpdate.phoneNumber = String(updateData.phoneNumber).trim();
      if (password) {
        const salt = await bcrypt.genSalt(10);
        dataToUpdate.password = await bcrypt.hash(password, salt);
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: dataToUpdate,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phoneNumber: true,
          email: true,
          role: true,
        },
      });

      res.json({
        message: 'User updated successfully',
        user: formatDoc(updatedUser),
      });
    } catch (error: any) {
      res.status(500).json({
        message: 'Failed to update user',
        errors: [error.message],
      });
    }
  },
};