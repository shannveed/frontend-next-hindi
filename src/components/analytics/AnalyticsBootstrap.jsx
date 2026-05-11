'use client';

import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Script from 'next/script';
import { usePathname, useSearchParams } from 'next/navigation';

const RAW_GA_ID = String(process.env.NEXT_PUBLIC_GA_ID || '').trim();
const GA_ID_RE = /^G-[A-Z0-9]+$/i;
const GA_ID = GA_ID_RE.test(RAW_GA_ID) ? RAW_GA_ID.toUpperCase() : '';

const ENABLE_IN_DEV =
  String(process.env.NEXT_PUBLIC_GA_ENABLE_IN_DEV || '').toLowerCase() ===
  'true';

const GA_DEBUG =
  String(process.env.NEXT_PUBLIC_GA_DEBUG || '').toLowerCase() === 'true';

const SITE_VARIANT = String(
  process.env.NEXT_PUBLIC_GA_SITE_VARIANT ||
  process.env.NEXT_PUBLIC_SITE_LANG ||
  'hindi'
).trim();

const GA_COOKIE_DOMAIN = String(
  process.env.NEXT_PUBLIC_GA_COOKIE_DOMAIN || 'auto'
).trim();

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const SHOULD_RUN_BY_ENV =
  !!GA_ID && (IS_PRODUCTION || ENABLE_IN_DEV);

const escapeRegex = (value = '') =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const parseCsvList = (value = '') =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const hostFromUrl = (value = '') => {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';

  // Preserve wildcard patterns such as *.vercel.app
  if (raw.includes('*')) {
    return raw
      .replace(/^https?:\/\//i, '')
      .split('/')[0]
      .split(':')[0]
      .trim();
  }

  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return String(url.hostname || '').toLowerCase();
  } catch {
    return raw
      .replace(/^https?:\/\//i, '')
      .split('/')[0]
      .split(':')[0]
      .trim()
      .toLowerCase();
  }
};

const wildcardToRegex = (pattern = '') => {
  const escaped = escapeRegex(pattern).replace(/\\\*/g, '.*');
  return new RegExp(`^${escaped}$`, 'i');
};

const hostMatches = (pattern = '', host = '') => {
  const p = String(pattern || '').trim().toLowerCase();
  const h = String(host || '').trim().toLowerCase();

  if (!p || !h) return false;
  if (p === '*') return true;

  if (p.includes('*')) {
    return wildcardToRegex(p).test(h);
  }

  return p === h;
};

const DEFAULT_SITE_HOST = hostFromUrl(
  process.env.NEXT_PUBLIC_SITE_URL || 'https://hi.moviefrost.com'
);

const ENV_ALLOWED_HOSTS = parseCsvList(
  process.env.NEXT_PUBLIC_GA_ALLOWED_HOSTS || ''
).map(hostFromUrl);

const GA_ALLOWED_HOSTS = (
  ENV_ALLOWED_HOSTS.length ? ENV_ALLOWED_HOSTS : [DEFAULT_SITE_HOST]
).filter(Boolean);

const isRuntimeHostAllowed = () => {
  if (typeof window === 'undefined') return false;

  // In local dev, allow if explicitly enabled.
  if (!IS_PRODUCTION && ENABLE_IN_DEV) return true;

  if (!GA_ALLOWED_HOSTS.length) return true;

  const currentHost = hostFromUrl(window.location.hostname);
  return GA_ALLOWED_HOSTS.some((allowedHost) =>
    hostMatches(allowedHost, currentHost)
  );
};

const isCurrentRuntimeAllowed = () => {
  if (!SHOULD_RUN_BY_ENV) return false;
  return isRuntimeHostAllowed();
};

const useGaRuntimeAllowed = () => {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    setAllowed(isCurrentRuntimeAllowed());
  }, []);

  return allowed;
};

// Skip private/admin/auth/noindex-style pages
const EXCLUDED_PREFIXES = [
  '/dashboard',
  '/movieslist',
  '/addmovie',
  '/edit',
  '/bulk-create',
  '/get-movies',
  '/update-movies',
  '/push-notification',
  '/categories',
  '/users',
  '/blog-posts',
  '/blog-preview',
  '/get-blog-posts',
  '/bulk-create-blog-posts',
  '/update-blog-posts',
  '/api',
];

const EXCLUDED_EXACT = [
  '/login',
  '/register',
  '/signup',
  '/profile',
  '/password',
  '/favorites',
];

const buildPagePath = (pathname, searchParams) => {
  const qs = searchParams?.toString?.() || '';
  const path = pathname || '/';
  return qs ? `${path}?${qs}` : path;
};

const shouldSkipAnalyticsForPath = (pathname = '') => {
  const path = String(pathname || '').trim();
  if (!path) return false;

  if (EXCLUDED_EXACT.includes(path)) return true;
  return EXCLUDED_PREFIXES.some((prefix) => path.startsWith(prefix));
};

const ensureGtagStub = () => {
  if (typeof window === 'undefined') return;

  window.dataLayer = window.dataLayer || [];

  if (typeof window.gtag !== 'function') {
    window.gtag = function gtag() {
      window.dataLayer.push(arguments);
    };
  }
};

const sendPageView = (pagePath) => {
  if (!isCurrentRuntimeAllowed()) return;
  if (typeof window === 'undefined') return;

  ensureGtagStub();

  if (typeof window.gtag !== 'function') return;

  window.gtag('event', 'page_view', {
    send_to: GA_ID,
    page_path: pagePath || window.location.pathname,
    page_location: window.location.href,
    page_title: document.title,

    // Useful in GA4 explorations/custom dimensions
    site_variant: SITE_VARIANT,
    site_hostname: window.location.hostname,

    ...(GA_DEBUG ? { debug_mode: true } : {}),
  });
};

function AnalyticsRouteTrackerInner({ runtimeAllowed = false }) {
  const pathname = usePathname() || '/';
  const searchParams = useSearchParams();

  const pagePath = useMemo(
    () => buildPagePath(pathname, searchParams),
    [pathname, searchParams]
  );

  const lastSentRef = useRef('');

  useEffect(() => {
    if (!SHOULD_RUN_BY_ENV) return;
    if (!runtimeAllowed) return;
    if (shouldSkipAnalyticsForPath(pathname)) return;
    if (!pagePath) return;
    if (lastSentRef.current === pagePath) return;

    /**
     * Small timeout lets Next update document.title before page_view.
     */
    const timer = window.setTimeout(() => {
      sendPageView(pagePath);
      lastSentRef.current = pagePath;
    }, 0);

    return () => window.clearTimeout(timer);
  }, [pathname, pagePath, runtimeAllowed]);

  return null;
}

export default function AnalyticsBootstrap() {
  const runtimeAllowed = useGaRuntimeAllowed();

  useEffect(() => {
    if (RAW_GA_ID && !GA_ID && process.env.NODE_ENV !== 'production') {
      console.warn(
        '[ga4] NEXT_PUBLIC_GA_ID is invalid. It must look like G-XXXXXXXXXX.'
      );
    }
  }, []);

  if (!SHOULD_RUN_BY_ENV || !runtimeAllowed) return null;

  const gaIdJson = JSON.stringify(GA_ID);

  const gaConfig = {
    send_page_view: false,
    anonymize_ip: true,
    transport_type: 'beacon',
    cookie_domain: GA_COOKIE_DOMAIN || 'auto',
    ...(GA_DEBUG ? { debug_mode: true } : {}),
  };

  const gaConfigJson = JSON.stringify(gaConfig);

  return (
    <>
      <Script
        id="mf-ga4-script"
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(
          GA_ID
        )}`}
        strategy="afterInteractive"
      />

      <Script
        id="mf-ga4-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            window.gtag = window.gtag || gtag;

            gtag('js', new Date());
            gtag('config', ${gaIdJson}, ${gaConfigJson});
          `,
        }}
      />

      <Suspense fallback={null}>
        <AnalyticsRouteTrackerInner runtimeAllowed={runtimeAllowed} />
      </Suspense>
    </>
  );
}
