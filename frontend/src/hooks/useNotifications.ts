import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  fetchNotifications,
  markNotificationsRead,
  type AppNotification,
} from "../api/notifications";

const POLL_MS = 60_000;

/**
 * Server-backed in-app notifications for the header bell. Refreshes on mount,
 * every minute while the tab is visible, and when the window regains focus.
 * Failures (offline, backend asleep, migration not yet applied) leave the
 * current list in place rather than showing an error in the header.
 */
export function useNotifications() {
  const { authFetch, user } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const authFetchRef = useRef(authFetch);
  authFetchRef.current = authFetch;

  const refresh = useCallback(async () => {
    if (!user || user.accountType === "organization") return;
    try {
      const result = await fetchNotifications(authFetchRef.current);
      setItems(result.items);
    } catch {
      // Keep whatever we last had.
    }
  }, [user?.id, user?.accountType]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  const markRead = useCallback(async (id: string) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, read: true } : item)));
    try {
      await markNotificationsRead(authFetchRef.current, { ids: [id] });
    } catch {
      // The next refresh reconciles with the server.
    }
  }, []);

  const markAllRead = useCallback(async () => {
    setItems((current) => current.map((item) => ({ ...item, read: true })));
    try {
      await markNotificationsRead(authFetchRef.current, { all: true });
    } catch {
      // The next refresh reconciles with the server.
    }
  }, []);

  return {
    items,
    unreadCount: items.filter((item) => !item.read).length,
    refresh,
    markRead,
    markAllRead,
  };
}
