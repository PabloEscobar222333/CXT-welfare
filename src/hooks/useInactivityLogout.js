import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

const TIMEOUT_MS       = 4 * 60 * 1000;  // 4 minutes total
const WARNING_AT_MS    = 3.5 * 60 * 1000; // show warning at 3 min 30 sec
const COUNTDOWN_SECS   = 30;              // seconds visible in the warning

const ACTIVITY_EVENTS = [
  'mousemove',
  'mousedown',
  'keydown',
  'touchstart',
  'scroll',
  'click',
];

/**
 * Automatically signs the user out after 4 minutes of inactivity.
 * At 3 min 30 sec a warning dialog is shown with a live 30-second countdown.
 * Clicking "Continue This Session" dismisses the dialog and resets the timer.
 *
 * Returns:
 *   showWarning  – boolean, true when the warning modal should be visible
 *   countdown    – number, seconds remaining before auto-logout
 *   dismissWarning – function, call to dismiss the warning and reset the timer
 */
export function useInactivityLogout() {
  const { user, signOut } = useAuth();

  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown]     = useState(COUNTDOWN_SECS);

  // Refs survive across renders without causing re-render loops
  const warningTimerRef  = useRef(null);  // fires at 3:30 to show warning
  const logoutTimerRef   = useRef(null);  // fires at 4:00 to log out
  const countdownRef     = useRef(null);  // 1-second interval for the countdown
  const showWarningRef   = useRef(false); // mirrors showWarning without stale closure issues

  // ── Cleanup helper ──────────────────────────────────────────────────────────
  const clearAllTimers = useCallback(() => {
    if (warningTimerRef.current)  clearTimeout(warningTimerRef.current);
    if (logoutTimerRef.current)   clearTimeout(logoutTimerRef.current);
    if (countdownRef.current)     clearInterval(countdownRef.current);
    warningTimerRef.current = null;
    logoutTimerRef.current  = null;
    countdownRef.current    = null;
  }, []);

  // ── Start / restart the inactivity timers ───────────────────────────────────
  const startTimers = useCallback(() => {
    clearAllTimers();
    setShowWarning(false);
    showWarningRef.current = false;
    setCountdown(COUNTDOWN_SECS);

    // Timer 1: at 3 min 30 sec → show warning + start countdown
    warningTimerRef.current = setTimeout(() => {
      setShowWarning(true);
      showWarningRef.current = true;
      setCountdown(COUNTDOWN_SECS);

      let remaining = COUNTDOWN_SECS;
      countdownRef.current = setInterval(() => {
        remaining -= 1;
        setCountdown(remaining);
        // No need to handle 0 here — the logout timer fires independently
      }, 1000);
    }, WARNING_AT_MS);

    // Timer 2: at 4 min → log out
    logoutTimerRef.current = setTimeout(() => {
      clearAllTimers();
      signOut();
    }, TIMEOUT_MS);
  }, [clearAllTimers, signOut]);

  // ── Dismiss warning (user clicked "Continue This Session") ──────────────────
  const dismissWarning = useCallback(() => {
    startTimers(); // resets everything back to 0
  }, [startTimers]);

  // ── Activity handler: only resets when warning is NOT visible ────────────────
  const handleActivity = useCallback(() => {
    if (!showWarningRef.current) {
      startTimers();
    }
  }, [startTimers]);

  // ── Effect: attach / detach listeners when user is logged in ────────────────
  useEffect(() => {
    if (!user) {
      clearAllTimers();
      setShowWarning(false);
      showWarningRef.current = false;
      return;
    }

    startTimers();

    ACTIVITY_EVENTS.forEach((event) =>
      window.addEventListener(event, handleActivity, { passive: true })
    );

    return () => {
      clearAllTimers();
      ACTIVITY_EVENTS.forEach((event) =>
        window.removeEventListener(event, handleActivity)
      );
    };
  }, [user, startTimers, handleActivity, clearAllTimers]);

  return { showWarning, countdown, dismissWarning };
}
