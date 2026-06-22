import axios from 'axios';
import { supabase } from './supabaseClient';

// Fallback to localhost if your Vite environmental configs aren't fully populated yet
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to auto-inject the JWT Bearer authorization token on every single request
api.interceptors.request.use(
  async (config) => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) throw error;

      if (session && session.access_token) {
        config.headers.Authorization = `Bearer ${session.access_token}`;
      }
    } catch (err) {
      console.error('API Interceptor failed to extract session token safely:', err);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Unified API Wrapper Methods for your Chat Frontend Components
export const chatAPI = {
  /**
   * Sends user query along with targeted context variables
   * @param {string} text - User prompt
   * @param {string|null} threadId - Existing thread ID or null for a brand new chat
   * @param {string} mode - 'plain' or 'legal'
   */
  sendQuery: async (text, threadId = null, mode = 'plain') => {
    const response = await api.post('/api/query', {
      text,
      thread_id: threadId,
      mode,
    });
    return response.data;
  },

  /**
   * Fetches all persistent threads for the active sidebar navigation
   */
  getThreads: async () => {
    // If you build dedicated GET endpoints on FastAPI, point them here.
    // Alternatively, you can pull directly via Supabase client depending on preference.
    const response = await api.get('/api/threads'); 
    return response.data;
  },

  /**
   * Fetches full historical logs inside an opened thread
   */
  getThreadMessages: async (threadId) => {
    const response = await api.get(`/api/threads/${threadId}/messages`);
    return response.data;
  }
};

export default api;