// frontend-next/src/app/robots.js
import { SITE_URL } from '../lib/seo';

export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/dashboard',
          '/movieslist',
          '/addmovie',
          '/edit',
          '/bulk-create',
          '/get-movies',
          '/update-movies',
          '/preview',
          '/push-notification',
          '/categories',
          '/users',
          '/profile',
          '/password',
          '/favorites',
          '/api',

          // Crawl-budget cleanup
          '/actor',
          '/watch',
          '/search',
          '/login',
          '/signup',
          '/register',

          // Blog/admin tools
          '/blog-posts',
          '/blog-preview',
          '/get-blog-posts',
          '/update-blog-posts',
          '/bulk-create-blog-posts',
        ],
      },
    ],

    sitemap: [`${SITE_URL}/sitemap-index.xml`, `${SITE_URL}/sitemap.xml`],

    host: SITE_URL,
  };
}
