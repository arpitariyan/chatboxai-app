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
export const STORAGE_BUCKET_ID =
  process.env.EXPO_PUBLIC_APPWRITE_STORAGE_BUCKET_ID || '';

const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID);

export const databases = new Databases(client);

export { client, Query, ID, Permission, Role };
