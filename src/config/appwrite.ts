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
export const USAGE_LOGS_COLLECTION_ID =
  process.env.EXPO_PUBLIC_APPWRITE_USAGE_LOGS_COLLECTION_ID || 'usage_logs';
export const SUBSCRIPTIONS_COLLECTION_ID =
  process.env.EXPO_PUBLIC_APPWRITE_SUBSCRIPTIONS_COLLECTION_ID || 'subscriptions';
export const CONVERSATION_MEMORY_COLLECTION_ID =
  process.env.EXPO_PUBLIC_APPWRITE_CONVERSATION_MEMORY_COLLECTION_ID || 'conversation_memory';
export const API_KEYS_COLLECTION_ID =
  process.env.EXPO_PUBLIC_APPWRITE_API_KEYS_COLLECTION_ID || 'api_keys';
export const API_CREDITS_COLLECTION_ID =
  process.env.EXPO_PUBLIC_APPWRITE_API_CREDITS_COLLECTION_ID || 'api_credits';
export const API_CREDIT_TRANSACTIONS_COLLECTION_ID =
  process.env.EXPO_PUBLIC_APPWRITE_API_CREDIT_TRANSACTIONS_COLLECTION_ID || 'api_credit_transactions';
export const LOGIN_ACTIVITY_COLLECTION_ID =
  process.env.EXPO_PUBLIC_APPWRITE_LOGIN_ACTIVITY_COLLECTION_ID || 'login_activity';
export const STORAGE_BUCKET_ID =
  process.env.EXPO_PUBLIC_APPWRITE_STORAGE_BUCKET_ID || '';
export const APPWRITE_API_KEY =
  process.env.EXPO_PUBLIC_APPWRITE_API_KEY ||
  process.env.APPWRITE_API_KEY ||
  '';
export const WEB_API_URL =
  process.env.EXPO_PUBLIC_WEB_API_URL ||
  'https://chatboxai.co.in';

const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID);

if (APPWRITE_API_KEY) {
  client.headers['x-appwrite-key'] = APPWRITE_API_KEY;
}

export const databases = new Databases(client);

export { client, Query, ID, Permission, Role };

