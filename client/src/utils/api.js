const getApiUrl = () => {
  if (import.meta.env.DEV) {
    return 'http://localhost:3001/api';
  }
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  return `${protocol}//${hostname}:3001/api`;
};

export const API_BASE = getApiUrl();

/**
 * Perform a fetch request to the backend API.
 * @param {string} endpoint - Relative path (e.g. '/pedidos')
 * @param {object} options - Custom fetch options
 */
export async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const config = {
    ...options,
    headers
  };

  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }

  const response = await fetch(url, config);
  
  // Try to parse JSON. Fallback to text if error.
  let data;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    const text = await response.text();
    data = { error: text || 'Erro desconhecido' };
  }

  if (!response.ok) {
    throw new Error(data.error || `Erro de rede: ${response.status}`);
  }

  return data;
}
