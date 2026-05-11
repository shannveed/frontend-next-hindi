// frontend-next/src/app/layout.js
import './globals.css';
import { Poppins } from 'next/font/google';

import { SITE_URL } from '../lib/seo';
import {
  ENGLISH_SITE_URL,
  HINDI_SITE_URL,
  INDIA_HREFLANG,
} from '../lib/hreflang';

import Providers from './providers';
import SiteChrome from '../components/layout/SiteChrome';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  preload: true,
});

const SITE_LANG = process.env.NEXT_PUBLIC_SITE_LANG || 'hi';
const SITE_DIR = process.env.NEXT_PUBLIC_SITE_DIR || 'ltr';

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || 'MovieFrost Hindi';

const SITE_TITLE =
  process.env.NEXT_PUBLIC_SITE_TITLE ||
  'MovieFrost Hindi — Watch Hindi Movies & Web Series Online';

const SITE_DESCRIPTION =
  process.env.NEXT_PUBLIC_SITE_DESCRIPTION ||
  'Watch Hindi movies and web series online in HD on MovieFrost Hindi.';

const SITE_LOCALE =
  process.env.NEXT_PUBLIC_SITE_LOCALE ||
  (SITE_LANG.startsWith('hi') ? 'hi_IN' : 'en_IN');

const LOGO_URL = `${SITE_URL}/images/MOVIEFROST.png`;

const buildVerification = () => {
  const v = {};
  const other = {};

  const google = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION;
  const yandex = process.env.NEXT_PUBLIC_YANDEX_VERIFICATION;
  const bing = process.env.NEXT_PUBLIC_BING_VERIFICATION;

  if (google) v.google = google;
  if (yandex) v.yandex = yandex;
  if (bing) other['msvalidate.01'] = bing;

  if (Object.keys(other).length) v.other = other;

  return Object.keys(v).length ? v : undefined;
};

const safeJsonLdStringify = (data) => {
  try {
    return JSON.stringify(data)
      .replace(/</g, '\\u003c')
      .replace(/>/g, '\\u003e')
      .replace(/&/g, '\\u0026')
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029');
  } catch {
    return '';
  }
};

const sameAs = String(process.env.NEXT_PUBLIC_SITE_SAME_AS || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

const siteJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}#organization`,
      name: SITE_NAME,
      alternateName: ['MovieFrost', 'MovieFrost Hindi'],
      url: SITE_URL,
      logo: {
        '@type': 'ImageObject',
        url: LOGO_URL,
      },
      ...(sameAs.length ? { sameAs } : {}),
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}#website`,
      name: SITE_NAME,
      alternateName: ['MovieFrost Hindi', 'Hindi MovieFrost'],
      url: SITE_URL,
      inLanguage: INDIA_HREFLANG,
      publisher: {
        '@id': `${SITE_URL}#organization`,
      },
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${SITE_URL}/movies?search={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
    },
  ],
};

export const metadata = {
  metadataBase: new URL(SITE_URL),

  applicationName: SITE_NAME,
  generator: 'Next.js',
  category: 'entertainment',
  referrer: 'strict-origin-when-cross-origin',

  title: {
    default: SITE_TITLE,
    template: `%s | ${SITE_NAME}`,
  },

  description: SITE_DESCRIPTION,

  keywords: [
    'MovieFrost Hindi',
    'Hindi movies online',
    'Hindi web series',
    'Hindi dubbed movies',
    'Bollywood movies',
    'South Indian Hindi dubbed movies',
    'Korean drama Hindi dubbed',
    'watch movies online',
    'watch web series online',
  ],

  alternates: {
    canonical: `${SITE_URL}/`,
    languages: {
      en: `${ENGLISH_SITE_URL}/`,
      [INDIA_HREFLANG]: `${HINDI_SITE_URL}/`,
      'x-default': `${ENGLISH_SITE_URL}/`,
    },
  },

  openGraph: {
    type: 'website',
    locale: SITE_LOCALE,
    alternateLocale: ['en_US'],
    siteName: SITE_NAME,
    url: SITE_URL,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: LOGO_URL,
        width: 512,
        height: 512,
        alt: SITE_NAME,
      },
    ],
  },

  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [LOGO_URL],
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },

  manifest: '/manifest.json',

  icons: {
    icon: [{ url: '/images/favicon1.png', type: 'image/png' }],
    shortcut: ['/images/favicon1.png'],
    apple: [{ url: '/images/MOVIEFROST.png', type: 'image/png' }],
  },

  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: SITE_NAME,
  },

  other: {
    'mobile-web-app-capable': 'yes',
  },

  verification: buildVerification(),
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#080A1A',
};

export default function RootLayout({ children }) {
  const jsonLd = safeJsonLdStringify(siteJsonLd);

  return (
    <html lang={SITE_LANG} dir={SITE_DIR} suppressHydrationWarning>
      <body
        className={`${poppins.className} bg-main text-white min-h-screen`}
        suppressHydrationWarning
      >
        {jsonLd ? (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: jsonLd }}
          />
        ) : null}

        <Providers>
          <SiteChrome>{children}</SiteChrome>
        </Providers>
      </body>
    </html>
  );
}
