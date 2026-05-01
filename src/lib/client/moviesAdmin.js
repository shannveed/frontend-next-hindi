import { apiFetch } from './apiFetch';

const buildQuery = (q = {}) => {
  const p = new URLSearchParams();

  const set = (k, v) => {
    if (v === undefined || v === null || v === '') return;
    p.set(k, String(v));
  };

  set('type', q.type);
  set('category', q.category);
  set('time', q.time);
  set('language', q.language);
  set('rate', q.rate);
  set('year', q.year);
  set('browseBy', q.browseBy);
  set('search', q.search);
  set('limit', q.limit);
  set('pageNumber', q.pageNumber || 1);

  return p.toString();
};

// ADMIN: /api/movies/admin
export const getMoviesAdmin = (token, query = {}) =>
  apiFetch(`/api/movies/admin?${buildQuery(query)}`, { token });

// ADMIN: single movie by id OR slug
export const getMovieByIdAdmin = (token, idOrSlug) => {
  const safe = encodeURIComponent(String(idOrSlug || '').trim());
  if (!safe) return Promise.resolve(null);
  return apiFetch(`/api/movies/admin/${safe}`, { token });
};

// ADMIN: Latest New list
export const getLatestNewMoviesAdmin = (token, limit = 100) =>
  apiFetch(`/api/movies/admin/latest-new?limit=${encodeURIComponent(limit)}`, {
    token,
  });

export const setLatestNewMovies = (token, movieIds = [], value = true) =>
  apiFetch(`/api/movies/admin/latest-new`, {
    method: 'POST',
    token,
    body: { movieIds, value },
  });

export const reorderLatestNewMovies = (token, orderedIds = []) =>
  apiFetch(`/api/movies/admin/latest-new/reorder`, {
    method: 'POST',
    token,
    body: { orderedIds },
  });

// ADMIN: Banner list
export const getBannerMoviesAdmin = (token, limit = 10) =>
  apiFetch(`/api/movies/admin/banner?limit=${encodeURIComponent(limit)}`, {
    token,
  });

export const setBannerMovies = (token, movieIds = [], value = true) =>
  apiFetch(`/api/movies/admin/banner`, {
    method: 'POST',
    token,
    body: { movieIds, value },
  });

// ADMIN: reorder within page
export const reorderMoviesInPage = (token, pageNumber, orderedIds = [], query = {}) =>
  apiFetch(`/api/movies/admin/reorder-page`, {
    method: 'POST',
    token,
    body: { pageNumber, orderedIds, query },
  });

// ADMIN: move movies to page
export const moveMoviesToPage = (token, targetPage, movieIds = []) =>
  apiFetch(`/api/movies/admin/move-to-page`, {
    method: 'POST',
    token,
    body: { targetPage, movieIds },
  });

// ADMIN: related
export const getRelatedMoviesAdmin = (token, idOrSlug, limit = 20) => {
  const safe = encodeURIComponent(String(idOrSlug || '').trim());
  if (!safe) return Promise.resolve([]);
  return apiFetch(
    `/api/movies/admin/related/${safe}?limit=${encodeURIComponent(limit)}`,
    { token }
  );
};

/* ============================================================
   Create / Update / Delete / Bulk
   ============================================================ */

export const createMovieAdmin = (token, payload) =>
  apiFetch('/api/movies', {
    method: 'POST',
    token,
    body: payload,
  });

export const updateMovieAdmin = (token, movieId, payload) =>
  apiFetch(`/api/movies/${encodeURIComponent(movieId)}`, {
    method: 'PUT',
    token,
    body: payload,
  });

export const deleteMovieAdmin = (token, movieId) =>
  apiFetch(`/api/movies/${encodeURIComponent(movieId)}`, {
    method: 'DELETE',
    token,
  });

export const deleteAllMoviesAdmin = (token) =>
  apiFetch('/api/movies', {
    method: 'DELETE',
    token,
  });

export const bulkCreateMoviesAdmin = (token, movies = []) =>
  apiFetch('/api/movies/bulk', {
    method: 'POST',
    token,
    body: { movies },
  });

export const bulkExactUpdateMoviesAdmin = (token, movies = []) =>
  apiFetch('/api/movies/bulk-exact', {
    method: 'PUT',
    token,
    body: { movies },
  });
