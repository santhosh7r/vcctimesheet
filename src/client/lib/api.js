import { supabaseFetch } from './supabaseApi';

export function getToken() {
  return localStorage.getItem('vcc_vendor_token');
}

export function setToken(token) {
  localStorage.setItem('vcc_vendor_token', token);
}

export function clearToken() {
  localStorage.removeItem('vcc_vendor_token');
}

async function request(method, path, body) {
  try {
    const result = await supabaseFetch(method, `/api${path}`, body);
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
  del: (path) => request('DELETE', path),
};
