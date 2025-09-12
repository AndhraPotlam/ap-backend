import { Request, Response } from 'express';
import Settings from '../models/Settings';

// Get all settings
export const getAllSettings = async (req: Request, res: Response) => {
  try {
    const settings = await Settings.find({ isActive: true }).sort({ category: 1, key: 1 });
    res.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ message: 'Failed to fetch settings' });
  }
};

// Get settings by category
export const getSettingsByCategory = async (req: Request, res: Response) => {
  try {
    const { category } = req.params;
    const settings = await Settings.find({ 
      category, 
      isActive: true 
    }).sort({ key: 1 });
    
    res.json(settings);
  } catch (error) {
    console.error('Error fetching settings by category:', error);
    res.status(500).json({ message: 'Failed to fetch settings' });
  }
};

// Get a specific setting by key
export const getSettingByKey = async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const setting = await Settings.findOne({ key, isActive: true });
    
    if (!setting) {
      return res.status(404).json({ message: 'Setting not found' });
    }
    
    res.json(setting);
  } catch (error) {
    console.error('Error fetching setting:', error);
    res.status(500).json({ message: 'Failed to fetch setting' });
  }
};

// Create or update a setting
export const upsertSetting = async (req: Request, res: Response) => {
  try {
    const { key, value, description, category, isActive } = req.body;
    
    if (!key || value === undefined) {
      return res.status(400).json({ message: 'Key and value are required' });
    }
    
    const setting = await Settings.findOneAndUpdate(
      { key },
      { 
        key, 
        value, 
        description, 
        category: category || 'general',
        isActive: isActive !== undefined ? isActive : true
      },
      { upsert: true, new: true }
    );
    
    res.json(setting);
  } catch (error) {
    console.error('Error upserting setting:', error);
    res.status(500).json({ message: 'Failed to save setting' });
  }
};

// Update multiple settings
export const updateMultipleSettings = async (req: Request, res: Response) => {
  try {
    const { settings } = req.body;
    
    if (!Array.isArray(settings)) {
      return res.status(400).json({ message: 'Settings must be an array' });
    }
    
    const results = [];
    
    for (const setting of settings) {
      const { key, value, description, category, isActive } = setting;
      
      if (!key || value === undefined) {
        results.push({ key, success: false, error: 'Key and value are required' });
        continue;
      }
      
      try {
        const updatedSetting = await Settings.findOneAndUpdate(
          { key },
          { 
            key, 
            value, 
            description, 
            category: category || 'general',
            isActive: isActive !== undefined ? isActive : true
          },
          { upsert: true, new: true }
        );
        
        results.push({ key, success: true, setting: updatedSetting });
      } catch (error) {
        results.push({ key, success: false, error: (error as Error).message });
      }
    }
    
    res.json({ results });
  } catch (error) {
    console.error('Error updating multiple settings:', error);
    res.status(500).json({ message: 'Failed to update settings' });
  }
};

// Delete a setting
export const deleteSetting = async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const setting = await Settings.findOneAndDelete({ key });
    
    if (!setting) {
      return res.status(404).json({ message: 'Setting not found' });
    }
    
    res.json({ message: 'Setting deleted successfully' });
  } catch (error) {
    console.error('Error deleting setting:', error);
    res.status(500).json({ message: 'Failed to delete setting' });
  }
};

// Get pricing configuration
export const getPricingConfig = async (req: Request, res: Response) => {
  try {
    const pricingSettings = await Settings.find({ 
      category: 'pricing', 
      isActive: true 
    });
    
    const config: any = {};
    pricingSettings.forEach(setting => {
      config[setting.key] = setting.value;
    });
    
    res.json(config);
  } catch (error) {
    console.error('Error fetching pricing config:', error);
    res.status(500).json({ message: 'Failed to fetch pricing configuration' });
  }
};
