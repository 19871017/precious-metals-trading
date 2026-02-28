// 前端认证服务

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
const USE_DEMO_AUTH = import.meta.env.VITE_USE_DEMO_AUTH === 'true';
const SESSION_STORAGE_KEY = 'auth.session.v1';
const CSRF_HEADER_KEY = 'X-CSRF-Token';
const CSRF_CACHE_TTL = 60 * 60 * 1000;

export interface UserInfo {
  id: string | number;
  username: string;
  role?: string;
  roleId?: number;
  realName?: string;
  phone?: string;
  email?: string;
  [key: string]: any;
}

export interface RegisterResponse {
  id: string;
  username: string;
}

export interface SessionData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: UserInfo;
}

let csrfTokenCache: string | null = null;
let csrfFetchedAt = 0;
let refreshPromise: Promise<SessionData | null> | null = null;

const roleMap: Record<number, string> = {
  1: 'ADMIN',
  2: 'AGENT_L1',
  3: 'AGENT_L2',
  4: 'USER'
};

function normalizeUser(user: any = {}): UserInfo {
  const roleId = user.roleId ?? user.role_id;
  return {
    id: user.id ?? user.user_id ?? user.userId ?? '',
    username: user.username ?? user.email ?? 'unknown',
    role: user.role ?? roleMap[roleId as number] ?? 'USER',
    roleId,
    realName: user.realName ?? user.real_name ?? '',
    phone: user.phone ?? '',
    email: user.email ?? '',
    ...user
  } as UserInfo;
}

function createSession(payload: any): SessionData {
  const accessToken = payload.access_token || payload.token;
  if (!accessToken) {
    throw new Error('缺少访问令牌');
  }
  const refreshToken = payload.refresh_token || payload.refreshToken || payload.token || '';
  const expiresIn = Math.max(5, payload.expires_in ?? payload.expiresIn ?? 15 * 60);
  return {
    accessToken,
    refreshToken,
    expiresAt: Date.now() + expiresIn * 1000,
    user: normalizeUser(payload.user)
  };
}

function readSession(): SessionData | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SessionData) : null;
  } catch (error) {
    console.error('[Auth] 解析会话失败:', error);
    return null;
  }
}

function writeSession(session: SessionData | null) {
  if (!session) {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    return;
  }
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

function isSessionExpired(session: SessionData): boolean {
  return Date.now() >= session.expiresAt - 5000;
}

async function ensureCsrfToken(force = false): Promise<string> {
  if (!force && csrfTokenCache && Date.now() - csrfFetchedAt < CSRF_CACHE_TTL) {
    return csrfTokenCache;
  }

  const response = await fetch(`${API_BASE_URL}/auth/csrf-token`, {
    credentials: 'include'
  });
  const result = await response.json();
  if (result.code !== 0 || !result.data?.csrfToken) {
    throw new Error(result.message || '获取 CSRF Token 失败');
  }
  csrfTokenCache = result.data.csrfToken;
  csrfFetchedAt = Date.now();
  return csrfTokenCache;
}

async function callAuthEndpoint(path: string, body: Record<string, unknown>, options: { csrf?: boolean } = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  if (options.csrf) {
    headers[CSRF_HEADER_KEY] = await ensureCsrfToken();
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers,
    body: JSON.stringify(body)
  });

  const result = await response.json();
  if (!response.ok || result.code !== 0) {
    throw new Error(result.message || '请求失败');
  }
  return result.data;
}

function buildDemoSession(username: string): SessionData {
  const demoUser: UserInfo = {
    id: 'demo-user-001',
    username,
    role: 'USER',
    roleId: 4,
    realName: '演示用户',
    phone: '13800138000',
    email: `${username}@demo.com`
  };
  const token = `demo-token-${Date.now()}`;
  return {
    accessToken: token,
    refreshToken: token,
    expiresAt: Date.now() + 60 * 60 * 1000,
    user: demoUser
  };
}

export async function login(username: string, password: string): Promise<SessionData> {
  if (USE_DEMO_AUTH) {
    const demoSession = buildDemoSession(username);
    writeSession(demoSession);
    return demoSession;
  }

  const data = await callAuthEndpoint('/auth/login', { username, password }, { csrf: true });
  const session = createSession(data);
  writeSession(session);
  return session;
}

export async function register(params: {
  username: string;
  password: string;
  phone?: string;
  email?: string;
  agentCode?: string;
}): Promise<RegisterResponse> {
  const payload: Record<string, unknown> = {
    username: params.username,
    password: params.password,
    phone: params.phone,
    email: params.email
  };

  if (params.agentCode) {
    payload.referral_code = params.agentCode;
  }

  return await callAuthEndpoint('/auth/register', payload, { csrf: true });
}

export async function getCurrentUser(): Promise<UserInfo> {
  const session = await ensureAuthSession();
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: {
      Authorization: `Bearer ${session.accessToken}`
    }
  });
  const result = await response.json();
  if (result.code !== 0) {
    throw new Error(result.message || '获取用户信息失败');
  }
  const updated = { ...session, user: normalizeUser(result.data) };
  writeSession(updated);
  return updated.user;
}

export async function logout(): Promise<void> {
  const session = readSession();
  writeSession(null);
  if (!session?.accessToken) {
    return;
  }
  try {
    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.accessToken}`
      }
    });
  } catch (error) {
    console.warn('[Auth] 退出登录调用失败:', error);
  }
}

export function getToken(): string | null {
  const session = readSession();
  if (!session || isSessionExpired(session)) {
    return null;
  }
  return session.accessToken;
}

export function isLoggedIn(): boolean {
  const session = readSession();
  return !!session && !isSessionExpired(session);
}

export function getUser(): UserInfo | null {
  return readSession()?.user ?? null;
}

export function isAdmin(): boolean {
  const user = getUser();
  if (!user) return false;
  return user.role === 'ADMIN' || user.roleId === 1;
}

export async function verifyToken(token: string): Promise<any> {
  return await callAuthEndpoint('/auth/verify', { token });
}

export async function sendVerificationCode(email: string): Promise<{ email: string; expiresIn: number }> {
  return await callAuthEndpoint('/auth/send-code', { email });
}

export async function resetPassword(params: { email: string; code: string; newPassword: string }): Promise<void> {
  await callAuthEndpoint('/auth/reset-password', params, { csrf: true });
}

export async function ensureAuthSession(options: { requireAdmin?: boolean } = {}): Promise<SessionData> {
  let session = readSession();
  if (!session) {
    throw new Error('UNAUTHENTICATED');
  }

  if (isSessionExpired(session)) {
    session = await refreshSession();
  }

  if (!session) {
    throw new Error('UNAUTHENTICATED');
  }

  if (options.requireAdmin && !isAdmin()) {
    throw new Error('FORBIDDEN');
  }

  return session;
}

export async function refreshSession(): Promise<SessionData | null> {
  const current = readSession();
  if (!current?.refreshToken) {
    writeSession(null);
    return null;
  }

  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const data = await callAuthEndpoint('/auth/refresh', { refresh_token: current.refreshToken });
      const session = createSession(data);
      writeSession(session);
      return session;
    } catch (error) {
      console.warn('[Auth] 刷新Token失败:', error);
      writeSession(null);
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export default {
  login,
  register,
  getCurrentUser,
  logout,
  getToken,
  isLoggedIn,
  getUser,
  isAdmin,
  verifyToken,
  sendVerificationCode,
  resetPassword,
  ensureAuthSession,
  refreshSession
};
