import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

const POLL_INTERVAL_MS = 15_000

export function useNotificationCount() {
  const { user } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined)

  const fetchCount = useCallback(async () => {
    if (!user) {
      setUnreadCount(0)
      return
    }
    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('read', false)
    setUnreadCount(count || 0)
  }, [user])

  useEffect(() => {
    if (!user?.id) return

    const initialFetchTimeout = window.setTimeout(() => {
      void fetchCount()
    }, 0)

    // Subscribe to real-time notification inserts and read-status updates
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user?.id}`,
        },
        () => {
          setUnreadCount((prev) => prev + 1)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user?.id}`,
        },
        () => {
          void fetchCount()
        }
      )
      .subscribe()

    // Polling fallback in case Realtime is slow or misconfigured
    intervalRef.current = setInterval(fetchCount, POLL_INTERVAL_MS)

    return () => {
      clearTimeout(initialFetchTimeout)
      supabase.removeChannel(channel)
      clearInterval(intervalRef.current)
    }
  }, [fetchCount, user?.id])

  return { unreadCount: user ? unreadCount : 0, refreshCount: fetchCount }
}
