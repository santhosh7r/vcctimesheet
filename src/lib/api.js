import { mockFetch } from './mockApi';
import { supabaseFetch } from './supabaseApi';
import { supabase, supabaseAuth } from './supabase';

const useSupabase = import.meta.env.VITE_USE_SUPABASE === 'true' && supabase !== null;

export function getToken() {
  return localStorage.getItem('vcc_token');
}

export function setToken(token) {
  localStorage.setItem('vcc_token', token);
}

export function clearToken() {
  localStorage.removeItem('vcc_token');
}

const apiFetch = useSupabase ? supabaseFetch : mockFetch;

async function request(method, path, body, isFormData = false) {
  try {
    const result = await apiFetch(method, `/api${path}`, isFormData ? Object.fromEntries(body) : body);
    return result;
  } catch (err) {
    if (err.message === 'Unauthorized') {
      clearToken();
      window.location.href = '/login';
    }
    throw err;
  }
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  patch: (path, body) => request('PATCH', path, body),
  del: (path) => request('DELETE', path),
  delete: (path) => request('DELETE', path),
  upload: (path, formData) => request('POST', path, formData, true),
};

// Resolve a stored file reference into an openable URL.
// The 'documents' bucket is private, so we mint a short-lived signed URL on
// demand. Accepts either a bare storage path ("invoices/x.pdf"), a Supabase
// public URL (".../object/public/documents/invoices/x.pdf"), a data: URL, or
// any external http(s) URL. Falls back to the original value if signing fails.
export async function getFileUrl(stored, expiresIn = 3600) {
  if (!stored) return null;
  if (stored.startsWith('data:')) return stored;

  const marker = '/object/public/documents/';
  const idx = stored.indexOf(marker);
  let path = null;
  if (idx !== -1) {
    path = stored.slice(idx + marker.length);
  } else if (/^https?:\/\//i.test(stored)) {
    return stored; // external URL, not in our bucket — open as-is
  } else {
    path = stored; // bare object path inside the bucket
  }

  if (!supabase || !path) return stored;
  try {
    const { data, error } = await supabase.storage.from('documents').createSignedUrl(path, expiresIn);
    if (error || !data?.signedUrl) return stored;
    return data.signedUrl;
  } catch {
    return stored;
  }
}

// Export for components that need direct Supabase access (storage, auth)
export { supabase, supabaseAuth, useSupabase };
