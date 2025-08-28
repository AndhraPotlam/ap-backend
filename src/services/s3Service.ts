import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Validate AWS credentials
const validateCredentials = () => {
  console.log('🔍 Environment check - Available env vars:', Object.keys(process.env).filter(key => key.startsWith('AWS_')));
  
  const requiredEnvVars = [
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY', 
    'AWS_REGION',
    'AWS_BUCKET_NAME'
  ];
  
  console.log('🔍 Checking AWS environment variables...');
  console.log('AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID ? 'Set' : 'Not set');
  console.log('AWS_SECRET_ACCESS_KEY:', process.env.AWS_SECRET_ACCESS_KEY ? 'Set' : 'Not set');
  console.log('AWS_REGION:', process.env.AWS_REGION || 'Not set');
  console.log('AWS_BUCKET_NAME:', process.env.AWS_BUCKET_NAME || 'Not set');
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.warn('❌ Missing AWS environment variables:', missingVars);
    return false;
  }
  
  console.log('✅ All AWS environment variables are set');
  return true;
};

// Lazy initialization of S3 client
let s3Client: S3Client | null = null;

const getS3Client = (): S3Client | null => {
  if (s3Client) {
    return s3Client;
  }
  
  if (validateCredentials()) {
    try {
      s3Client = new S3Client({
        region: process.env.AWS_REGION!,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      });
      console.log('✅ S3 client initialized successfully');
      return s3Client;
    } catch (error) {
      console.error('❌ Failed to initialize S3 client:', error);
      return null;
    }
  } else {
    console.warn('❌ S3 client not initialized due to missing credentials');
    return null;
  }
};

export const s3Service = {
  uploadFile: async (fileName: string, fileBuffer: Buffer, fileType: string) => {
    const client = getS3Client();
    if (!client) {
      throw new Error('S3 client not configured. Please check AWS credentials.');
    }
    
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME!,
      Key: `products/${fileName}`,
      Body: fileBuffer,
      ContentType: fileType,
    });

    await client.send(command);
  },

  getPresignedUrl: async (fileName: string, fileType: string) => {
    const client = getS3Client();
    if (!client) {
      throw new Error('S3 client not configured. Please check AWS credentials.');
    }
    
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME!,
      Key: `products/${fileName}`,
      ContentType: fileType,
    });

    const signedUrl = await getSignedUrl(client, command, { expiresIn: 3600 });
    return signedUrl;
  },

  getReadPresignedUrl: async (fileName: string) => {
    const client = getS3Client();
    if (!client) {
      throw new Error('S3 client not configured. Please check AWS credentials.');
    }
    
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME!,
      Key: `products/${fileName}`,
    });

    const signedUrl = await getSignedUrl(client, command, { expiresIn: 86400 }); // 24 hours
    return signedUrl;
  },

  getImageUrl: (fileName: string) => {
    const bucketName = process.env.AWS_BUCKET_NAME;
    const region = process.env.AWS_REGION;
    
    if (!bucketName || !region) {
      console.warn('AWS_BUCKET_NAME or AWS_REGION not configured');
      return '/placeholder.png'; // Fallback to placeholder
    }
    
    const url = `https://${bucketName}.s3.${region}.amazonaws.com/products/${fileName}`;
    console.log('Generated S3 URL:', url);
    return url;
  },

  // Check if S3 is properly configured
  isConfigured: () => {
    return getS3Client() !== null;
  }
}; 