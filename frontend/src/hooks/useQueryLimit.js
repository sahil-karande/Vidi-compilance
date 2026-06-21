/**
 * Vidi — frontend/src/hooks/useQueryLimit.js
 * Day 21 Task: Query Limit Hook
 *
 * Fetches today's usage from GET /api/usage and exposes data
 * for the usage bar UI component. Auto-refreshes after each query.
 *
 * Usage:
 *   const { used, limit, remaining, unlimited, percentUsed, loading, refresh } = useQueryLimit();
 *
 *   // After sending a successful query, call refresh() to update the bar:
 *   await sendQuery(...);
 *   refresh();
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { getAccessToken } from '../lib/supabaseClient';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Guest session id — persisted in localStorage so anonymous users
// get a consistent quota bucket across page reloads (until they clear storage)
function getOrCreateGuestSessionId() {
  const KEY = 'vidi_guest_session_id';
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}

export function useQueryLimit() {
  const { user, isAuthenticated } = useAuth();

  const [usage, setUsage] = useState({
    role: 'guest',
    limit: 3,
    used: 0,
    remaining: 3,
    unlimited: false,
    percent_used: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchUsage = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      let headers = {};

      if (isAuthenticated) {
        const token = await getAccessToken();
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      } else {
        // Guest — send session id so backend can track quota
        params.set('guest_session_id', getOrCreateGuestSessionId());
      }

      const url = `${API_URL}/api/usage${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url, { headers });

      if (!response.ok) {
        throw new Error(`Usage fetch failed: ${response.status}`);
      }

      const data = await response.json();
      setUsage(data);
    } catch (err) {
      console.error('[useQueryLimit] Failed to fetch usage:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Fetch on mount and whenever auth state changes
  useEffect(() => {
    fetchUsage();
  }, [isAuthenticated]);

  // Helper: should we show an "upgrade" prompt?
  const isNearLimit = !usage.unlimited && usage.percent_used >= 80;
  const isAtLimit = !usage.unlimited && usage.remaining === 0;

  return {
    role: usage.role,
    limit: usage.limit,
    used: usage.used,
    remaining: usage.remaining,
    unlimited: usage.unlimited,
    percentUsed: usage.percent_used,
    loading,
    error,
    isNearLimit,
    isAtLimit,
    refresh: fetchUsage,        // call this after a successful query
    guestSessionId: !isAuthenticated ? getOrCreateGuestSessionId() : null,
  };
}