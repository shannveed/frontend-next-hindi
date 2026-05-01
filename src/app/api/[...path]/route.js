// frontend-next/src/app/api/[...path]/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_BACKEND_ORIGIN = 'https://api-hi.moviefrost.com';
const DEFAULT_FRONTEND_ORIGIN = 'https://hi.moviefrost.com';

const PROXY_TIMEOUT_MS = Number(process.env.API_PROXY_TIMEOUT_MS || 30000);

const stripTrailingSlash = (value = '') => String(value || '').replace(/\/+$/, '');

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

const getBackendOrigin = () => {
  const raw =
    process.env.API_BASE_URL ||
    process.env.BACKEND_PUBLIC_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    DEFAULT_BACKEND_ORIGIN;

  let apiOrigin = ensureUrl(raw, DEFAULT_BACKEND_ORIGIN);

  const frontendOrigin = ensureUrl(
    process.env.NEXT_PUBLIC_SITE_URL,
    DEFAULT_FRONTEND_ORIGIN
  );

  // Safety: production me API galti se localhost set ho jaye.
  if (process.env.VERCEL && isLocalOrigin(apiOrigin)) {
    apiOrigin = DEFAULT_BACKEND_ORIGIN;
  }

  // Safety: agar API galti se frontend domain set ho jaye, recursion avoid karo.
  if (sameOrigin(apiOrigin, frontendOrigin)) {
    apiOrigin = DEFAULT_BACKEND_ORIGIN;
  }

  return apiOrigin;
};

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
]);

const RESPONSE_STRIP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',

  // Upstream body stream may already be decoded by fetch.
  'content-encoding',
  'content-length',
]);

const buildForwardHeaders = (req) => {
  const headers = new Headers(req.headers);

  for (const key of HOP_BY_HOP_HEADERS) {
    headers.delete(key);
  }

  const reqUrl = new URL(req.url);

  headers.set('x-forwarded-host', req.headers.get('host') || '');
  headers.set('x-forwarded-proto', reqUrl.protocol.replace(':', '') || 'https');

  return headers;
};

const buildResponseHeaders = (upstreamHeaders) => {
  const headers = new Headers(upstreamHeaders);

  for (const key of RESPONSE_STRIP_HEADERS) {
    headers.delete(key);
  }

  // API responses should not be cached by browser/CDN accidentally.
  headers.set('Cache-Control', 'no-store');
  headers.set('X-Robots-Tag', 'noindex, nofollow');

  return headers;
};

async function proxyRequest(req, { params }) {
  const backendOrigin = getBackendOrigin();

  const pathParts = Array.isArray(params?.path) ? params.path : [];
  const apiPath = pathParts.map((p) => encodeURIComponent(p)).join('/');

  const incomingUrl = new URL(req.url);
  const targetUrl = `${backendOrigin}/api/${apiPath}${incomingUrl.search || ''}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);

  try {
    const method = String(req.method || 'GET').toUpperCase();

    const body =
      method === 'GET' || method === 'HEAD'
        ? undefined
        : await req.arrayBuffer();

    const upstream = await fetch(targetUrl, {
      method,
      headers: buildForwardHeaders(req),
      body,
      redirect: 'manual',
      cache: 'no-store',
      signal: controller.signal,
    });

    const responseHeaders = buildResponseHeaders(upstream.headers);

    const responseBody =
      upstream.status === 204 || upstream.status === 304 ? null : upstream.body;

    const response = new Response(responseBody, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });

    // Preserve Set-Cookie correctly when available.
    const setCookies =
      typeof upstream.headers.getSetCookie === 'function'
        ? upstream.headers.getSetCookie()
        : [];

    const singleSetCookie = upstream.headers.get('set-cookie');

    if (setCookies.length) {
      response.headers.delete('set-cookie');
      for (const cookie of setCookies) {
        response.headers.append('set-cookie', cookie);
      }
    } else if (singleSetCookie) {
      response.headers.set('set-cookie', singleSetCookie);
    }

    return response;
  } catch (error) {
    const isAbort = error?.name === 'AbortError';

    return Response.json(
      {
        message: isAbort ? 'API proxy timeout' : 'API proxy failed',
        error: String(error?.message || error || 'Unknown proxy error'),
        backendOrigin,
      },
      {
        status: 502,
        headers: {
          'Cache-Control': 'no-store',
          'X-Robots-Tag': 'noindex, nofollow',
        },
      }
    );
  } finally {
    clearTimeout(timeout);
  }
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      Allow: 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
