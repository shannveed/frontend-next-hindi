// frontend-next/src/lib/hreflang.js
import { SITE_URL, clean } from './seo';

const normalizeOrigin = (value = '', fallback = '') => {
  let v = String(value || fallback || '').trim();

  if (!v) return '';

  if (!/^https?:\/\//i.test(v)) {
    v = `https://${v.replace(/^\/+/, '')}`;
  }

  return v.replace(/\/+$/, '');
};

const normalizePath = (path = '/') => {
  const p = clean(path);
  if (!p) return '/';

  // Never allow absolute URL here.
  if (/^https?:\/\//i.test(p)) {
    try {
      const u = new URL(p);
      return u.pathname || '/';
    } catch {
      return '/';
    }
  }

  return p.startsWith('/') ? p : `/${p}`;
};

export const ENGLISH_SITE_URL = normalizeOrigin(
  process.env.NEXT_PUBLIC_ENGLISH_SITE_URL,
  'https://www.moviefrost.com'
);

export const HINDI_SITE_URL = normalizeOrigin(
  process.env.NEXT_PUBLIC_HINDI_SITE_URL,
  'https://hi.moviefrost.com'
);

/**
 * For Hindi/India subdomain.
 *
 * Use:
 * - hi-IN if UI/content is Hindi or Hindi-targeted.
 * - en-IN if content is mainly English but targeted to India.
 */
export const INDIA_HREFLANG =
  clean(process.env.NEXT_PUBLIC_HINDI_HREFLANG) || 'hi-IN';

/**
 * Returns Next.js metadata alternates:
 *
 * canonical: current Hindi site URL
 * en: main English site
 * hi-IN/en-IN: Hindi/India subdomain
 * x-default: main English site
 */
export const buildHreflangAlternatesForPath = (
  path = '/',
  { canonical = '' } = {}
) => {
  const p = normalizePath(path);

  return {
    canonical: clean(canonical) || `${SITE_URL}${p}`,
    languages: {
      en: `${ENGLISH_SITE_URL}${p}`,
      [INDIA_HREFLANG]: `${HINDI_SITE_URL}${p}`,
      'x-default': `${ENGLISH_SITE_URL}${p}`,
    },
  };
};
