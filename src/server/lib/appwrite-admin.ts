import './env';
import { Client, Databases, Storage, ID, Query, Permission, Role } from 'node-appwrite';
import { InputFile } from 'node-appwrite/file';

const endpoint =
  process.env.APPWRITE_ENDPOINT ||
  process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT ||
  'https://nyc.cloud.appwrite.io/v1';

const projectId =
  process.env.APPWRITE_PROJECT_ID ||
  process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID ||
  '69a3eac50018b30b4556';

const apiKey =
  process.env.APPWRITE_API_KEY ||
  process.env.EXPO_PUBLIC_APPWRITE_API_KEY ||
  '';

export const DB_ID =
  process.env.APPWRITE_DATABASE_ID ||
  process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID ||
  '69a6aeff003b4922f883';

export const STORAGE_BUCKET_ID =
  process.env.APPWRITE_STORAGE_BUCKET_ID ||
  process.env.EXPO_PUBLIC_APPWRITE_STORAGE_BUCKET_ID ||
  '69a69b9c0009d1b683dd';

export const MOBILE_ATTACHMENTS_COLLECTION_ID =
  process.env.APPWRITE_MOBILE_ATTACHMENTS_COLLECTION_ID ||
  'mobile_attachments';

export const LIBRARY_COLLECTION_ID =
  process.env.APPWRITE_LIBRARY_COLLECTION_ID ||
  process.env.EXPO_PUBLIC_APPWRITE_LIBRARY_COLLECTION_ID ||
  'library';

export const CHATS_COLLECTION_ID =
  process.env.APPWRITE_CHATS_COLLECTION_ID ||
  process.env.EXPO_PUBLIC_APPWRITE_CHATS_COLLECTION_ID ||
  'chats';

export const USERS_COLLECTION_ID =
  process.env.APPWRITE_USERS_COLLECTION_ID ||
  process.env.EXPO_PUBLIC_APPWRITE_USERS_COLLECTION_ID ||
  'users';

export const MFA_OTPS_COLLECTION_ID =
  process.env.APPWRITE_MFA_OTPS_COLLECTION_ID ||
  process.env.EXPO_PUBLIC_APPWRITE_MFA_OTPS_COLLECTION_ID ||
  'mfa_otps';

export const IMAGE_GENERATION_COLLECTION_ID =
  process.env.APPWRITE_IMAGE_GENERATION_COLLECTION_ID ||
  process.env.EXPO_PUBLIC_APPWRITE_IMAGE_GENERATION_COLLECTION_ID ||
  'image_generation';

export const WEBSITE_PROJECTS_COLLECTION_ID =
  process.env.APPWRITE_WEBSITE_PROJECTS_COLLECTION_ID ||
  process.env.EXPO_PUBLIC_APPWRITE_WEBSITE_PROJECTS_COLLECTION_ID ||
  'website_projects';

const client = new Client()
  .setEndpoint(endpoint)
  .setProject(projectId)
  .setKey(apiKey);

export const databases = new Databases(client);
export const storage = new Storage(client);

export { ID, Query, Permission, Role, InputFile };
