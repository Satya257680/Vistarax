// VistaraX - Axios API client
// Attaches the JWT to every request and redirects to /login on 401 so an
// expired/invalid session never keeps hitting protected endpoints.
import axios from 'axios';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const client = axios.create({ baseURL: `${API_URL}/api` });

// "Remember me" (see AuthContext) can put the session in localStorage or
// sessionStorage - check both so an unchecked "remember me" session still
// authenticates its requests for the rest of that tab's life.
function getToken() {
  return localStorage.getItem('vistarax_token') || sessionStorage.getItem('vistarax_token');
}

client.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('vistarax_token');
      localStorage.removeItem('vistarax_user');
      sessionStorage.removeItem('vistarax_token');
      sessionStorage.removeItem('vistarax_user');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default client;
