import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";

const REGION = "us-east-1"; // Spaces defaults to this or the subdomain region
const RAW_ENDPOINT = process.env.SPACES_ENDPOINT || "https://nyc3.digitaloceanspaces.com";
// Ensure endpoint always has https:// protocol
const ENDPOINT = RAW_ENDPOINT.startsWith('http') ? RAW_ENDPOINT : `https://${RAW_ENDPOINT}`;
const BUCKET = process.env.SPACES_BUCKET_NAME || "zeroprompt";

// Clean endpoint for URL generation (remove https://)
const cleanEndpoint = ENDPOINT.replace(/^https?:\/\//, "");

const s3 = new S3Client({
  region: REGION,
  endpoint: ENDPOINT,
  credentials: {
    accessKeyId: process.env.SPACES_KEY || "",
    secretAccessKey: process.env.SPACES_SECRET || ""
  }
});

export const storageService = {
  /**
   * Generates a presigned URL for the frontend to upload a file directly.
   */
  generateUploadUrl: async (folder: string, fileName: string, contentType: string) => {
    const ext = fileName.split('.').pop();
    const key = `${folder}/${crypto.randomUUID()}.${ext}`;
    
    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType,
      ACL: 'public-read' // Ensure public access for displaying
    });

    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 300 }); // 5 minutes
    
    // Return the URL to upload TO, and the public URL to access it AFTER
    return {
      uploadUrl: signedUrl,
      publicUrl: `https://${BUCKET}.${cleanEndpoint}/${key}`,
      key
    };
  },

  /**
   * Uploads a buffer (e.g. downloaded AI image) directly from backend.
   */
  uploadBuffer: async (buffer: Buffer, folder: string, contentType: string) => {
    // Determine file extension from content type
    const extMap: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/svg+xml': 'svg'
    };
    const ext = extMap[contentType] || 'png';
    const key = `${folder}/${crypto.randomUUID()}.${ext}`;

    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ACL: 'public-read'
    }));

    return `https://${BUCKET}.${cleanEndpoint}/${key}`;
  }
};
