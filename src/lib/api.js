// frontend-next/src/lib/api.js
const DEFAULT_API_BASE = 'https://api-hi.moviefrost.com';
const DEFAULT_SITE_URL = 'https://hi.moviefrost.com';

const stripTrailingSlash = (value = '') =>
  String(value || '').replace(/\/+$/, '');

const ensureUrl = (value, fallback) => {
  let v = String(value || fallback || '').trim();

  if (!v) return fallback;

  if (!/^https?:\/\//i.test(v)) {
    const isLocal =
      v.startsWith('localhost') ||
      v.startsWith('127.0.0.1') ||
      v.startsWith('0.0.0.0');

    v = `${isLocal ? 'http' : 'https'}://${v.replace(/^\/+/, '')}`;
  }

  return stripTrailingSlash(v).replace(/\/api$/i, '');
};

const isLocalOrigin = (origin = '') => {
  try {
    const host = new URL(origin).hostname;
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0'
    );
  } catch {
    return false;
  }
};

const sameOrigin = (a = '', b = '') => {
  try {
    const ua = new URL(a);
    const ub = new URL(b);

    return ua.protocol === ub.protocol && ua.host === ub.host;
  } catch {
    return false;
  }
};

const getSafeApiBase = () => {
  const siteUrl = ensureUrl(
    process.env.NEXT_PUBLIC_SITE_URL,
    DEFAULT_SITE_URL
  );

  let apiBase = ensureUrl(
    process.env.NEXT_PUBLIC_API_BASE_URL,
    DEFAULT_API_BASE
  );

  // Production safety: never let SSR fetch localhost on Vercel.
  if (process.env.VERCEL && isLocalOrigin(apiBase)) {
    apiBase = DEFAULT_API_BASE;
  }

  // Safety: avoid frontend -> frontend recursion.
  if (sameOrigin(apiBase, siteUrl)) {
    apiBase = DEFAULT_API_BASE;
  }

  return apiBase;
};

const API_BASE = getSafeApiBase();
const API = `${API_BASE}/api`;

/**
 * Cache tags used for On-Demand Revalidation.
 */
export const CACHE_TAGS = {
  MOVIES: 'movies',
  HOME: 'home',
  CATEGORIES: 'categories',
  BROWSE_BY_DISTINCT: 'browseByDistinct',
  ACTORS: 'actors',
  BLOG: 'blog',
};

const uniq = (arr) => Array.from(new Set((arr || []).filter(Boolean)));

const movieTag = (idOrSlug) => `movie:${String(idOrSlug || '').trim()}`;
const relatedTag = (idOrSlug) => `related:${String(idOrSlug || '').trim()}`;
const actorTag = (slug) => `actor:${String(slug || '').trim()}`;
const blogTag = (slug) => `blog:${String(slug || '').trim()}`;
const blogCategoryTag = (slug) =>
  `blog-category:${String(slug || '').trim()}`;

const nextCache = (revalidate, tags = []) => ({
  next: { revalidate, tags: uniq(tags) },
});

const buildMoviesQueryString = (query = {}) => {
  const {
    type = '',
    category = '',
    time = '',
    language = '',
    rate = '',
    year = '',
    browseBy = '',
    search = '',
    pageNumber = 1,
    limit = '',
  } = query;

  const params = new URLSearchParams();

  if (type) params.set('type', type);
  if (category) params.set('category', category);
  if (time) params.set('time', time);
  if (language) params.set('language', language);
  if (rate) params.set('rate', rate);
  if (year) params.set('year', year);
  if (browseBy) params.set('browseBy', browseBy);
  if (search) params.set('search', search);
  if (limit) params.set('limit', String(limit));

  params.set('pageNumber', String(pageNumber || 1));

  return params.toString();
};

const buildBlogQueryString = (query = {}) => {
  const {
    categorySlug = '',
    templateType = '',
    trending = false,
    search = '',
    pageNumber = 1,
    limit = '',
  } = query;

  const params = new URLSearchParams();

  if (categorySlug) params.set('categorySlug', categorySlug);
  if (templateType) params.set('templateType', templateType);
  if (search) params.set('search', search);
  if (trending === true || trending === 'true') params.set('trending', 'true');
  if (limit) params.set('limit', String(limit));

  params.set('pageNumber', String(pageNumber || 1));

  return params.toString();
};

export const hasListingPageContent = (data, pageNumber = 1) => {
  const requestedPage = Number(pageNumber) || 1;
  const totalPages = Number(data?.pages || 1);

  return (
    Array.isArray(data?.movies) &&
    data.movies.length > 0 &&
    requestedPage <= totalPages
  );
};

async function fetchJson(url, init = {}, opts = {}) {
  const {
    nullOn404 = true,
    nullOn401 = false,
    nullOn403 = false,
    nullOn400MovieNotFound = true,
  } = opts;

  let res;

  try {
    res = await fetch(url, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.headers || {}),
      },
    });
  } catch (error) {
    throw new Error(
      `API fetch failed: ${error?.message || error || 'network_error'}`
    );
  }

  const text = await res.text().catch(() => '');
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (nullOn404 && res.status === 404) return null;
  if (nullOn401 && res.status === 401) return null;
  if (nullOn403 && res.status === 403) return null;

  if (!res.ok) {
    const msg =
      data?.message || (typeof data === 'string' ? data : res.statusText);

    if (
      nullOn400MovieNotFound &&
      res.status === 400 &&
      /movie not found/i.test(String(msg || ''))
    ) {
      return null;
    }

    throw new Error(msg || `API error ${res.status}`);
  }

  return data;
}

export async function getCategories({ revalidate = 3600 } = {}) {
  return fetchJson(
    `${API}/categories`,
    nextCache(revalidate, [CACHE_TAGS.CATEGORIES])
  );
}

export async function getBrowseByDistinct({ revalidate = 3600 } = {}) {
  return fetchJson(
    `${API}/movies/browseBy-distinct`,
    nextCache(revalidate, [CACHE_TAGS.BROWSE_BY_DISTINCT])
  );
}

export async function getMovieBySlug(slug, { revalidate = 3600 } = {}) {
  const raw = String(slug || '').trim();
  const safe = encodeURIComponent(raw);
  if (!safe) return null;

  return fetchJson(
    `${API}/movies/${safe}`,
    nextCache(revalidate, [CACHE_TAGS.MOVIES, movieTag(raw)])
  );
}

export async function getMovieBySlugAdmin(slug, token) {
  const raw = String(slug || '').trim();
  const safe = encodeURIComponent(raw);
  if (!safe || !token) return null;

  return fetchJson(
    `${API}/movies/admin/${safe}`,
    {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}` },
    },
    {
      nullOn404: true,
      nullOn401: true,
      nullOn403: true,
      nullOn400MovieNotFound: true,
    }
  );
}

export async function getMoviesAdminServer(query = {}, token) {
  const authToken = String(token || '').trim();
  if (!authToken) return null;

  return fetchJson(
    `${API}/movies/admin?${buildMoviesQueryString(query)}`,
    {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${authToken}` },
    },
    {
      nullOn404: true,
      nullOn401: true,
      nullOn403: true,
      nullOn400MovieNotFound: false,
    }
  );
}

export async function getMovies(query = {}, { revalidate = 60 } = {}) {
  return fetchJson(
    `${API}/movies?${buildMoviesQueryString(query)}`,
    nextCache(revalidate, [CACHE_TAGS.MOVIES])
  );
}

export async function getLatestMovies({ revalidate = 300 } = {}) {
  return fetchJson(
    `${API}/movies/latest`,
    nextCache(revalidate, [CACHE_TAGS.MOVIES, CACHE_TAGS.HOME])
  );
}

export async function getLatestNewMovies(
  limit = 100,
  { revalidate = 300 } = {}
) {
  return fetchJson(
    `${API}/movies/latest-new?limit=${encodeURIComponent(limit)}`,
    nextCache(revalidate, [CACHE_TAGS.MOVIES, CACHE_TAGS.HOME])
  );
}

export async function getBannerMovies(limit = 10, { revalidate = 300 } = {}) {
  return fetchJson(
    `${API}/movies/banner?limit=${encodeURIComponent(limit)}`,
    nextCache(revalidate, [CACHE_TAGS.MOVIES, CACHE_TAGS.HOME])
  );
}

export async function getTopRatedMovies({ revalidate = 600 } = {}) {
  return fetchJson(
    `${API}/movies/rated/top`,
    nextCache(revalidate, [CACHE_TAGS.MOVIES, CACHE_TAGS.HOME])
  );
}

export async function getRelatedMovies(
  idOrSlug,
  limit = 20,
  { revalidate = 600 } = {}
) {
  const raw = String(idOrSlug || '').trim();
  const safe = encodeURIComponent(raw);
  if (!safe) return [];

  const data = await fetchJson(
    `${API}/movies/related/${safe}?limit=${encodeURIComponent(limit)}`,
    nextCache(revalidate, [CACHE_TAGS.MOVIES, relatedTag(raw)])
  );

  return Array.isArray(data) ? data : [];
}

export async function getRelatedMoviesAdmin(idOrSlug, token, limit = 20) {
  const raw = String(idOrSlug || '').trim();
  const safe = encodeURIComponent(raw);
  if (!safe || !token) return [];

  const data = await fetchJson(
    `${API}/movies/admin/related/${safe}?limit=${encodeURIComponent(limit)}`,
    {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}` },
    },
    { nullOn401: true, nullOn403: true, nullOn404: true }
  );

  return Array.isArray(data) ? data : [];
}

export async function getActorBySlug(slug, { revalidate = 30 } = {}) {
  const raw = String(slug || '').trim();
  const safe = encodeURIComponent(raw);
  if (!safe) return null;

  return fetchJson(
    `${API}/actors/${safe}`,
    nextCache(revalidate, [CACHE_TAGS.MOVIES, CACHE_TAGS.ACTORS, actorTag(raw)])
  );
}

/* ============================================================
   BLOG
   ============================================================ */

export async function getBlogCategories({ revalidate = 3600 } = {}) {
  return fetchJson(
    `${API}/blog/categories`,
    nextCache(revalidate, [CACHE_TAGS.BLOG])
  );
}

export async function getBlogPosts(query = {}, { revalidate = 300 } = {}) {
  const categorySlug = String(query?.categorySlug || '').trim();
  const isTrending = query?.trending === true || query?.trending === 'true';

  return fetchJson(
    `${API}/blog?${buildBlogQueryString(query)}`,
    nextCache(revalidate, [
      CACHE_TAGS.BLOG,
      categorySlug ? blogCategoryTag(categorySlug) : '',
      isTrending ? 'blog-trending' : '',
    ])
  );
}

export async function getTrendingBlogPosts(
  limit = 6,
  { revalidate = 300 } = {}
) {
  return getBlogPosts({ trending: true, limit, pageNumber: 1 }, { revalidate });
}

export async function getBlogTopViewedThisMonth(
  limit = 5,
  { revalidate = 300 } = {}
) {
  const data = await fetchJson(
    `${API}/blog/top-viewed-this-month?limit=${encodeURIComponent(limit)}`,
    nextCache(revalidate, [CACHE_TAGS.BLOG, 'blog-top-viewed-month'])
  );

  return Array.isArray(data?.posts) ? data.posts : [];
}

export async function getBlogPost(categorySlug, slug, { revalidate = 300 } = {}) {
  const category = String(categorySlug || '').trim();
  const postSlug = String(slug || '').trim();

  if (!category || !postSlug) return null;

  return fetchJson(
    `${API}/blog/${encodeURIComponent(category)}/${encodeURIComponent(postSlug)}`,
    nextCache(revalidate, [
      CACHE_TAGS.BLOG,
      blogCategoryTag(category),
      blogTag(postSlug),
    ])
  );
}
