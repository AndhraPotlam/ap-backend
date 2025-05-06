import express from 'express';
import multer from 'multer';
import { authMiddleware } from '../middleware/authMiddleware';
import { s3Service } from '../services/s3Service';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/presigned-url', authMiddleware, async (req, res) => {
  try {
    const { fileName, fileType } = req.body;

    if (!fileName || !fileType) {
      return res.status(400).json({ message: 'FileName and fileType are required' });
    }

    const presignedUrl = await s3Service.getPresignedUrl(fileName, fileType);
    const imageUrl = s3Service.getImageUrl(fileName);

    res.json({ presignedUrl, imageUrl });
  } catch (error: any) {
    console.error('Error generating presigned URL:', error);
    res.status(500).json({ message: 'Error generating presigned URL', error: error.message });
  }
});

// Upload image and return the URL
router.post('/image', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const fileName = `${Date.now()}-${req.file.originalname}`;
    const fileType = req.file.mimetype;

    // Upload to S3
    await s3Service.uploadFile(fileName, req.file.buffer, fileType);
    
    // Get the public URL and presigned URL
    const imageUrl = s3Service.getImageUrl(fileName);
    const presignedUrl = await s3Service.getReadPresignedUrl(fileName);
    
    res.json({ imageUrl, presignedUrl, fileName });
  } catch (error: any) {
    console.error('Error uploading image:', error);
    res.status(500).json({ message: 'Error uploading image', error: error.message });
  }
});

export default router; 