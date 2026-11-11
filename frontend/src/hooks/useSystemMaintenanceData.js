import { useState, useEffect, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Custom hook that fetches system status and MS SQL backup snapshots.
 */
export function useSystemMaintenanceData({ loadBackups = true } = {}) {
  const [status, setStatus] = useState(null);
  const [backups, setBackups] = useState([]);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [loadingBackups, setLoadingBackups] = useState(loadBackups);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/system/status`);
      const data = await res.json();
      if (res.ok) setStatus(data);
    } catch (err) {
      console.error('Failed to fetch status:', err);
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  const fetchBackups = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/system/backups`);
      const data = await res.json();
      if (res.ok && Array.isArray(data)) setBackups(data);
    } catch (err) {
      console.error('Failed to fetch backups:', err);
    } finally {
      setLoadingBackups(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/system/status`);
        const data = await res.json();
        if (active && res.ok) setStatus(data);
      } catch (err) {
        console.error('Failed to fetch status:', err);
      } finally {
        if (active) setLoadingStatus(false);
      }

      if (loadBackups) {
        try {
          const res = await fetch(`${API_BASE}/system/backups`);
          const data = await res.json();
          if (active && res.ok && Array.isArray(data)) setBackups(data);
        } catch (err) {
          console.error('Failed to fetch backups:', err);
        } finally {
          if (active) setLoadingBackups(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [loadBackups]);

  return { status, backups, loadingStatus, loadingBackups, fetchStatus, fetchBackups };
}
