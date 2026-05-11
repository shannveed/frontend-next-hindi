'use client';

import React, { Suspense, useEffect, useMemo, useRef } from 'react';
import Script from 'next/script';
import { usePathname, useSearchParams } from 'next/navigation';

const GA_ID = String(process.env.NEXT_PUBLIC_GA_ID || '').trim();

const ENABLE_IN_DEV =
  String(process.env.NEXT_PUBLIC_GA_ENABLE_IN_DEV || '').toLowerCase() ===
  'true';

const GA_DEBUG =
  String(process.env.NEXT_PUBLIC_GA_DEBUG || '').toLowerCase() === 'true';

const SHOULD_RUN =
  !!GA_ID && (process.env.NODE_ENV === 'production' || ENABLE_IN_DEV);

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
  if (!SHOULD_RUN || typeof window === 'undefined') return;

  ensureGtagStub();

  if (typeof window.gtag !== 'function') return;

  window.gtag('event', 'page_view', {
    send_to: GA_ID,
    page_path: pagePath || window.location.pathname,
    page_location: window.location.href,
    page_title: document.title,
    ...(GA_DEBUG ? { debug_mode: true } : {}),
  });
};

function AnalyticsRouteTrackerInner() {
  const pathname = usePathname() || '/';
  const searchParams = useSearchParams();

  const pagePath = useMemo(
    () => buildPagePath(pathname, searchParams),
    [pathname, searchParams]
  );

  const lastSentRef = useRef('');

  useEffect(() => {
    if (!SHOULD_RUN) return;
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
  }, [pathname, pagePath]);

  return null;
}

export default function AnalyticsBootstrap() {
  if (!SHOULD_RUN) return null;

  const gaIdJson = JSON.stringify(GA_ID);
  const debugJson = JSON.stringify(GA_DEBUG);

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
            gtag('config', ${gaIdJson}, {
              send_page_view: false,
              anonymize_ip: true,
              transport_type: 'beacon',
              debug_mode: ${debugJson}
            });
          `,
        }}
      />

      <Suspense fallback={null}>
        <AnalyticsRouteTrackerInner />
      </Suspense>
    </>
  );
}
