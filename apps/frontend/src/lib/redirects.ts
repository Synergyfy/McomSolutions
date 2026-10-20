const AUTH_ONBOARDING_PATHS = ['/login', '/admin/login', '/register', '/signup', '/getstarted'];

/**
 * True when a post-login / onboarding redirect points back into the auth or
 * onboarding funnel. Those targets are self-referential (e.g. the "Log in
 * here" link on /getstarted/business) and would trap an already-onboarded
 * user in a loop instead of letting login finish.
 */
export function isAuthOrOnboardingRedirect(value: string | null | undefined): boolean {
  if (!value) return false;

  let path = value;
  if (/^https?:\/\//i.test(value)) {
    try {
      const parsed = new URL(value);
      if (typeof window !== 'undefined' && parsed.origin !== window.location.origin) {
        return false;
      }
      path = parsed.pathname;
    } catch {
      return false;
    }
  } else {
    path = value.split(/[?#]/)[0];
  }

  return AUTH_ONBOARDING_PATHS.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}
