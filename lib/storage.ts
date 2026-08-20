import { randomUUID } from 'crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const bucket = process.env.S3_BUCKET;

function client() {
  if (!bucket || !process.env.S3_ENDPOINT || !process.env.S3_REGION) {
    throw new Error('S3_BUCKET, S3_ENDPOINT and S3_REGION are required');
  }
  return new S3Client({
    region: process.env.S3_REGION,
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    credentials: process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
      ? { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY }
      : undefined,
  });
}

export async function createUploadUrl(filename: string, contentType: string) {
  if (!bucket) throw new Error('S3_BUCKET is not configured');
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
  const key = `uploads/${new Date().toISOString().slice(0, 10)}/${randomUUID()}-${safeName}`;
  const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType || 'application/octet-stream' });
  return { key, url: await getSignedUrl(client(), command, { expiresIn: 900 }) };
}