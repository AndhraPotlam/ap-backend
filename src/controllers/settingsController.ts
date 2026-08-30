import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { formatDoc, formatDocs } from '../utils/format';

export const getAllSettings = async (req: Request, res: Response) => {
  try {
    const settings = await prisma.setting.findMany({
      where: { isActive: true },
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });
    res.json(formatDocs(settings));
  } catch (error: any) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ message: 'Failed to fetch settings', error: error.message });
  }
};

export const getSettingsByCategory = async (req: Request, res: Response) => {
  try {
    const { category } = req.params;
    const settings = await prisma.setting.findMany({
      where: {
        category: category as any,
        isActive: true,
      },
      orderBy: { key: 'asc' },
    });
    res.json(formatDocs(settings));
  } catch (error: any) {
    console.error('Error fetching settings by category:', error);
    res.status(500).json({ message: 'Failed to fetch settings', error: error.message });
  }
};

export const getSettingByKey = async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const setting = await prisma.setting.findFirst({
      where: { key, isActive: true },
    });

    if (!setting) {
      return res.status(404).json({ message: 'Setting not found' });
    }

    res.json(formatDoc(setting));
  } catch (error: any) {
    console.error('Error fetching setting:', error);
    res.status(500).json({ message: 'Failed to fetch setting', error: error.message });
  }
};

export const upsertSetting = async (req: Request, res: Response) => {
  try {
    const { key, value, description, category = 'general', isActive } = req.body;

    if (!key || value === undefined) {
      return res.status(400).json({ message: 'Key and value are required' });
    }

    const setting = await prisma.setting.upsert({
      where: { key },
      update: {
        value,
        description: description !== undefined ? description : undefined,
        category: category as any,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
      },
      create: {
        key,
        value,
        description: description || null,
        category: category as any,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
    });

    res.json(formatDoc(setting));
  } catch (error: any) {
    console.error('Error upserting setting:', error);
    res.status(500).json({ message: 'Failed to save setting', error: error.message });
  }
};

export const updateMultipleSettings = async (req: Request, res: Response) => {
  try {
    const { settings } = req.body;

    if (!Array.isArray(settings)) {
      return res.status(400).json({ message: 'Settings must be an array' });
    }

    const results = [];

    for (const setting of settings) {
      const { key, value, description, category = 'general', isActive } = setting;

      if (!key || value === undefined) {
        results.push({ key, success: false, error: 'Key and value are required' });
        continue;
      }

      try {
        const updatedSetting = await prisma.setting.upsert({
          where: { key },
          update: {
            value,
            description: description !== undefined ? description : undefined,
            category: category as any,
            isActive: isActive !== undefined ? Boolean(isActive) : undefined,
          },
          create: {
            key,
            value,
            description: description || null,
            category: category as any,
            isActive: isActive !== undefined ? Boolean(isActive) : true,
          },
        });

        results.push({ key, success: true, setting: formatDoc(updatedSetting) });
      } catch (error: any) {
        results.push({ key, success: false, error: error.message });
      }
    }

    res.json({ results });
  } catch (error: any) {
    console.error('Error updating multiple settings:', error);
    res.status(500).json({ message: 'Failed to update settings', error: error.message });
  }
};

export const deleteSetting = async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    await prisma.setting.delete({ where: { key } });
    res.json({ message: 'Setting deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting setting:', error);
    res.status(500).json({ message: 'Failed to delete setting', error: error.message });
  }
};

export const getPricingConfig = async (req: Request, res: Response) => {
  try {
    const pricingSettings = await prisma.setting.findMany({
      where: {
        category: 'pricing',
        isActive: true,
      },
    });

    const config: any = {};
    pricingSettings.forEach((setting) => {
      config[setting.key] = setting.value;
    });

    res.json(config);
  } catch (error: any) {
    console.error('Error fetching pricing config:', error);
    res.status(500).json({ message: 'Failed to fetch pricing configuration', error: error.message });
  }
};
