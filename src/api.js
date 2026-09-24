export const SB = 'https://zxvnkroukqwqivlttwio.supabase.co';
export const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4dm5rcm91a3F3cWl2bHR0d2lvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyMzA5NjQsImV4cCI6MjEwNTgwNjk2NH0.3aZ_Gs6OYCL9zcIbSi_vwQFpk7IRxu21hRkL_TlA2dU';

let session = null;

export function getSession() {
  return session;
}

export function setSession(nextSession) {
  session = nextSession;
  try {
    if (session) {
      localStorage.setItem('gs_ses', JSON.stringify(session));
    } else {
      localStorage.removeItem('gs_ses');
    }
  } catch (error) {}
}

export function clearSession() {
  setSession(null);
}

export async function auth(grantType, body) {
  const response = await fetch(SB + '/auth/v1/token?grant_type=' + grantType, {
    method: 'POST',
    headers: {
      apikey: KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const json = await response.json();

  if (!response.ok) {
    throw new Error(json.error_description || json.msg || 'Sign-in failed');
  }

  const nextSession = {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_at: json.expires_at || Math.floor(Date.now() / 1000) + json.expires_in
  };

  setSession(nextSession);
  return nextSession;
}

export async function fresh(force = false) {
  const current = getSession();

  if (current && (force || current.expires_at * 1000 - Date.now() < 60000)) {
    await auth('refresh_token', { refresh_token: current.refresh_token });
  }

  return getSession();
}

export async function api(method, path, body, extraHeaders = {}) {
  await fresh();

  const current = getSession();
  const response = await fetch(SB + path, {
    method,
    headers: {
      apikey: KEY,
      Authorization: 'Bearer ' + (current ? current.access_token : KEY),
      'Content-Type': 'application/json',
      ...extraHeaders
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await response.text();

  if (!response.ok) {
    const error = new Error(text);
    error.code = response.status;
    throw error;
  }

  return text ? JSON.parse(text) : null;
}
