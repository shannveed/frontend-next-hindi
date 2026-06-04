// frontend-next/src/app/watch/imdb/[imdbId]/page.jsx
import { notFound, redirect } from 'next/navigation';

import VirtualWatchClient from '@/components/watch/VirtualWatchClient';
import { SITE_URL, clean, truncate } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const normalizeApiBase = (raw = '') => {
  let value = String(raw || 'https://api-hi.moviefrost.com').trim();

  if (!/^https?:\/\//i.test(value)) {
    const isLocal =
      value.startsWith('localhost') ||
      value.startsWith('127.0.0.1') ||
      value.startsWith('0.0.0.0');

    value = `${isLocal ? 'http' : 'https'}://${value.replace(/^\/+/, '')}`;
  }

  return value.replace(/\/+$/, '').replace(/\/api$/i, '');
};

const API_BASE = normalizeApiBase(
  process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api-hi.moviefrost.com'
);

const normalizeImdbId = (value = '') => {
  const match = String(value || '').match(/tt\d{5,10}/i);
  return match ? match[0].toLowerCase() : '';
};

async function getVirtualMovie(imdbId) {
  const safe = normalizeImdbId(imdbId);
  if (!safe) return null;

  const res = await fetch(
    `${API_BASE}/api/movies/imdb/virtual/${encodeURIComponent(safe)}`,
    {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    }
  );

  if (res.status === 404) return null;

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(data?.message || 'Failed to load IMDb title');
  }

  return data;
}

export async function generateMetadata({ params }) {
  const imdbId = normalizeImdbId(params?.imdbId);
  const movie = await getVirtualMovie(imdbId).catch(() => null);

  if (!movie) {
    return {
      title: 'Title not found',
      robots: { index: false, follow: false },
    };
  }

  const canonical = `${SITE_URL}/watch/imdb/${imdbId}`;

  const title = `Watch ${clean(movie?.name || 'Movie')}${movie?.year ? ` (${movie.year})` : ''
    } | MovieFrost Hindi`;

  const description = truncate(
    movie?.desc || `Watch ${movie?.name || 'this title'} on MovieFrost Hindi.`,
    160
  );

  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    robots: {
      index: false,
      follow: true,
      googleBot: { index: false, follow: true },
    },
  };
}

export default async function ImdbWatchPage({ params }) {
  const imdbId = normalizeImdbId(params?.imdbId);
  const movie = await getVirtualMovie(imdbId).catch(() => null);

  if (!movie) notFound();

  if (movie?.source === 'local' && movie?.slug) {
    redirect(`/watch/${movie.slug}`);
  }

  return <VirtualWatchClient movie={movie} />;
}
