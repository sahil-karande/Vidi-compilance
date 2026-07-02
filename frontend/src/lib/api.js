import axios from 'axios';
import { supabase } from './supabaseClient';

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
  (error) => Promise.reject(error)
);

// Catch token expiries (401), automatically cycle token layers, and replay traffic seamlessly
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Catch 'Token expired' explicitly emitted by backend handler
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        // Attempt background token renewal via Supabase Refresh Tokens
        const { data, error: refreshError } = await supabase.auth.refreshSession();
        if (!refreshError && data?.session) {
          originalRequest.headers.Authorization = `Bearer ${data.session.access_token}`;
          return api(originalRequest); // Re-fire request
        }
      } catch (fail) {
        console.error('Session token lease recovery failed completely:', fail);
      }
    }
    return Promise.reject(error);
  }
);

// Unified API Wrapper Methods for your Frontend Components
export const chatAPI = {
  sendQuery: async (text, threadId = null, mode = 'plain') => {
    const response = await api.post('/api/query', {
      query: text,
      thread_id: threadId,
      mode,
    });
    return response.data;
  },

  getThreads: async () => {
    const response = await api.get('/api/threads'); 
    return response.data;
  },

  getThreadMessages: async (threadId) => {
    const response = await api.get(`/api/threads/${threadId}/messages`);
    return response.data;
  },

  // --- DAY 29 TASK: THREAD MANAGEMENT LAYERS ---
  
  /**
   * Initializes a dedicated thread log with specified corpus configurations
   */
  createThread: async (title, corpusTags = []) => {
    const response = await api.post('/api/threads', {
      title,
      corpus_tags: corpusTags,
    });
    return response.data;
  },

  /**
   * Permanently clears out a compliance thread from user workspace history
   */
  deleteThread: async (threadId) => {
    const response = await api.delete(`/api/threads/${threadId}`);
    return response.data;
  },

  // --- WEEK 7 COMPLIANCE DASHBOARD INTEGRATION METHODS ---
  
  /**
   * Fetches user profile scoring details across GST, RBI, SEBI, and MCA.
   * Dynamically switches to POST mapping if a form payload is explicitly provided.
   */
  
  getScorecard: async (formData = null) => {
    if (formData) {
      const response = await api.post('/api/scorecard', formData);
      return response.data;
    }
    const response = await api.get('/api/scorecard');
    return response.data;
  },

  /**
   * Fetches corporate compliance deadlines matching user configurations
   */
  getCalendarDeadlines: async () => {
    const response = await api.get('/api/calendar');
    return response.data;
  }
};
// (cleaned duplicate exports)