import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export const s3Service = {
  uploadFile: async (fileName: string, fileBuffer: Buffer, fileType: string) => {
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME!,
      Key: `products/${fileName}`,
      Body: fileBuffer,
      ContentType: fileType,
    });

    await s3Client.send(command);
  },

  getPresignedUrl: async (fileName: string, fileType: string) => {
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME!,
      Key: `products/${fileName}`,
      ContentType: fileType,
    });

    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    return signedUrl;
  },

  getReadPresignedUrl: async (fileName: string) => {
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME!,
      Key: `products/${fileName}`,
    });

    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 86400 }); // 24 hours
    return signedUrl;
  },

  getImageUrl: (fileName: string) => {
    const bucketName = process.env.AWS_BUCKET_NAME!;
    const region = process.env.AWS_REGION!;
    const url = `https://${bucketName}.s3.${region}.amazonaws.com/products/${fileName}`;
    console.log('Generated S3 URL:', url);
    return url;
  }
}; 