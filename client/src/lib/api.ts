import { localApiHandle, localLogout, restoreLocalSessionFromToken, ensureSeeded } from './localApi';

const TOKEN_KEY = 'am_token';

/** Production (e.g. GitHub Pages) always uses localStorage. Dev tries Express first. */
const FORCE_LOCAL = import.meta.env.PROD;

let useLocal: boolean | null = FORCE_LOCAL ? true : null;
let apiProbe: Promise<boolean> | null = null;

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

function routerBasename(): string {
  const base = import.meta.env.BASE_URL || '/';
  return base.endsWith('/') ? base.slice(0, -1) : base;
}

function loginPath(): string {
  const b = routerBasename();
  return b ? `${b}/login` : '/login';
}

async function probeApi(): Promise<boolean> {
  if (FORCE_LOCAL) return false;
  if (useLocal === true) return false;
  if (useLocal === false) return true;
  if (!apiProbe) {
    apiProbe = (async () => {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 800);
        const res = await fetch('/api/settings', {
          method: 'GET',
          signal: ctrl.signal,
          headers: { Authorization: 'Bearer probe' },
        });
        clearTimeout(t);
        // Any HTTP response (even 401) means Express is up
        useLocal = false;
        return true;
      } catch {
        useLocal = true;
        ensureSeeded();
        return false;
      }
    })();
  }
  return apiProbe;
}

export async function api<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const preferNetwork = await probeApi();

  if (!preferNetwork || FORCE_LOCAL || useLocal) {
    return localRequest<T>(path, options);
  }

  try {
    return await networkRequest<T>(path, options);
  } catch (err) {
    // Network failure mid-session → fall back to local
    if (err instanceof TypeError || (err as Error)?.name === 'AbortError') {
      useLocal = true;
      ensureSeeded();
      return localRequest<T>(path, options);
    }
    throw err;
  }
}

async function localRequest<T>(path: string, options: RequestInit): Promise<T> {
  const token = getToken();
  if (token) restoreLocalSessionFromToken(token);

  try {
    // Logout: clear local session when token cleared via caller
    if (path.includes('/auth/login') === false && !token && path.includes('/auth/me')) {
      const err = new Error('Unauthorised');
      throw err;
    }
    const result = await localApiHandle(path, options);
    return result as T;
  } catch (err) {
    const status = (err as Error & { status?: number }).status;
    if (status === 401) {
      setToken(null);
      localLogout();
      if (!path.includes('/auth/login')) {
        window.location.href = loginPath();
      }
      throw new Error((err as Error).message || 'Unauthorised');
    }
    throw err instanceof Error ? err : new Error(String(err));
  }
}

async function networkRequest<T>(path: string, options: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(path, { ...options, headers });
  if (res.status === 401) {
    setToken(null);
    if (!path.includes('/auth/login')) {
      window.location.href = loginPath();
    }
    throw new Error('Unauthorised');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `Request failed (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

/** Call on logout to clear local session too. */
export function clearLocalSession() {
  localLogout();
}
