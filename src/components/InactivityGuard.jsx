import { useInactivityLogout } from '../hooks/useInactivityLogout';

/**
 * Invisible component that activates the inactivity auto-logout timer.
 * Renders nothing — exists solely to invoke the hook inside the
 * AuthProvider tree.
 */
export function InactivityGuard() {
  useInactivityLogout();
  return null;
}
