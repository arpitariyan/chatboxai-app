import { apiClient } from '../api/client';
import { databases, DB_ID, CHATS_COLLECTION_ID, ID } from '../../config/appwrite';

export interface ChatSessionPayload {
  userEmail: string;
  msg: string;
  userId: string;
  sourceList: any[];
  searchType: 'chat' | 'search' | 'research' | 'imageGen';
  selectedModel: any;
  folderId?: string | null;
}

export interface ChatService {
  performDeepSearch: (query: string) => Promise<any[]>;
  performResearch: (query: string) => Promise<any[]>;
  createChatRecord: (payload: ChatSessionPayload) => Promise<any>;
  updateChatRecord: (chatId: string, updateData: any) => Promise<any>;
  triggerLLMGeneration: (payload: any) => Promise<any>;
  pollChatStatus: (chatId: string) => Promise<any>;
}

export const chatService: ChatService = {
  performDeepSearch: async (query: string) => {
    const response = await apiClient.post('/api/deep-search', { query });
    return response.data?.results || [];
  },

  performResearch: async (query: string) => {
    const response = await apiClient.post('/api/research', { query });
    return response.data?.results || [];
  },

  createChatRecord: async (payload: ChatSessionPayload) => {
    try {
      const document = await databases.createDocument(
        DB_ID,
        CHATS_COLLECTION_ID,
        ID.unique(),
        {
          userEmail: payload.userEmail,
          userId: payload.userId,
          msg: payload.msg,
          sourceList: JSON.stringify(payload.sourceList),
          searchType: payload.searchType,
          model: JSON.stringify(payload.selectedModel),
          folderId: payload.folderId || null,
          createdAt: new Date().toISOString(),
          status: 'pending'
        }
      );
      return document;
    } catch (error) {
      console.error('Error creating chat record:', error);
      throw error;
    }
  },

  updateChatRecord: async (chatId: string, updateData: any) => {
    try {
      const document = await databases.updateDocument(
        DB_ID,
        CHATS_COLLECTION_ID,
        chatId,
        updateData
      );
      return document;
    } catch (error) {
      console.error('Error updating chat record:', error);
      throw error;
    }
  },

  triggerLLMGeneration: async (payload: any) => {
    const response = await apiClient.post('/api/llm-model', payload);
    return response.data;
  },

  pollChatStatus: async (chatId: string) => {
    const response = await apiClient.get(`/api/search/chats?chatId=${chatId}`);
    return response.data;
  },
};
