import { useEffect, useState } from "react";
import { localDateKey } from "../services/calendar";

/**
 * Returns today's local YYYY-MM-DD and updates when the calendar day changes
 * (midnight, tab focus, or visibility). Use as a memo dependency for
 * "Due today" / calendar bucketing.
 */
export function useLocalTodayKey(): string {
  const [todayKey, setTodayKey] = useState(() => localDateKey());

  useEffect(() => {
    function sync() {
      setTodayKey((current) => {
        const next = localDateKey();
        return current === next ? current : next;
      });
    }
    const intervalId = window.setInterval(sync, 60_000);
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  return todayKey;
}
