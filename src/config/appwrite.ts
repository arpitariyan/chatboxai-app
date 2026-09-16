import { Client, Databases, Query, ID, Permission, Role } from 'appwrite';

// Appwrite Endpoint and Database Credentials
export const APPWRITE_ENDPOINT =
  process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT || 'https://nyc.cloud.appwrite.io/v1';
export const APPWRITE_PROJECT_ID =
  process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID || '';
export const DB_ID =
  process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID || '';
export const USERS_COLLECTION_ID =
  process.env.EXPO_PUBLIC_APPWRITE_USERS_COLLECTION_ID || 'users';
export const LIBRARY_COLLECTION_ID =
  process.env.EXPO_PUBLIC_APPWRITE_LIBRARY_COLLECTION_ID || 'library';
export const CHATS_COLLECTION_ID =
  process.env.EXPO_PUBLIC_APPWRITE_CHATS_COLLECTION_ID || 'chats';
export const IMAGE_GENERATION_COLLECTION_ID =
  process.env.EXPO_PUBLIC_APPWRITE_IMAGE_GENERATION_COLLECTION_ID || 'image_generation';
export const WEBSITE_PROJECTS_COLLECTION_ID =
  process.env.EXPO_PUBLIC_APPWRITE_WEBSITE_PROJECTS_COLLECTION_ID || 'website_projects';
export const MFA_OTPS_COLLECTION_ID =
  process.env.EXPO_PUBLIC_APPWRITE_MFA_OTPS_COLLECTION_ID || 'mfa_otps';

export const APPWRITE_API_KEY =
  process.env.EXPO_PUBLIC_APPWRITE_API_KEY ||
  'standard_9e4fd0e2a9605b7a6efcc104e9d82861d0b7464d7fc7a6c579d0226d002b58f128cde382cc9946c3053848aec2250c24b4c43fa86663a3561ef58cfeea7795a4119c5697e59fbbdcc4b015d68d45d5ad9fc0d0735ae427f768949ffa5dc8144d227217057a886b3dd2941d70a1386f58109f417dcf29d3a7c6c33219bb86ce6d';

const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID);

if (APPWRITE_API_KEY) {
  (client as any).headers['x-appwrite-key'] = APPWRITE_API_KEY;
}

export const databases = new Databases(client);

export { client, Query, ID, Permission, Role };
