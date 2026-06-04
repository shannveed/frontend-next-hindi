// frontend-next/src/app/movie/imdb/[imdbId]/page.jsx
import { notFound, redirect } from 'next/navigation';

import VirtualMovieDetails from '@/components/movie/VirtualMovieDetails';
import EffectiveGateNativeBanner, {
  EffectiveGateSquareAd,
} from '@/components/ads/EffectiveGateNativeBanner';
import VisibleBreadcrumbs from '@/components/seo/VisibleBreadcrumbs';

import { SITE_URL, absoluteUrl, clean, truncate } from '@/lib/seo';

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

  if (movie?.source === 'local' && movie?.slug) {
    return {
      title: movie.name || 'MovieFrost Hindi',
      robots: { index: false, follow: true },
    };
  }

  const canonical = `${SITE_URL}/movie/imdb/${imdbId}`;

  const title = `${clean(movie?.name || 'Movie')}${movie?.year ? ` (${movie.year})` : ''
    } | MovieFrost Hindi`;

  const description = truncate(
    movie?.seoDescription ||
    movie?.desc ||
    `Watch ${movie?.name || 'this title'} on MovieFrost Hindi.`,
    160
  );

  const image = absoluteUrl(
    movie?.titleImage || movie?.image || '/images/MOVIEFROST.png'
  );

  return {
    title: { absolute: title },
    description,
    alternates: { canonical },

    // Same safe approach as English virtual pages.
    robots: {
      index: false,
      follow: true,
      googleBot: { index: false, follow: true },
    },

    openGraph: {
      type: movie?.type === 'WebSeries' ? 'video.tv_show' : 'video.movie',
      url: canonical,
      title,
      description,
      images: image ? [image] : [],
    },

    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: image ? [image] : [],
    },
  };
}

export default async function ImdbMoviePage({ params }) {
  const imdbId = normalizeImdbId(params?.imdbId);
  const movie = await getVirtualMovie(imdbId).catch(() => null);

  if (!movie) notFound();

  if (movie?.source === 'local' && movie?.slug) {
    redirect(`/movie/${movie.slug}`);
  }

  return (
    <div className="container mx-auto min-h-screen px-2 mobile:px-0 my-6 pb-24 sm:pb-8">
      <VisibleBreadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'Movies', href: '/movies' },
          { label: movie?.name || 'Movie' },
        ]}
        className="mb-4"
      />

      <VirtualMovieDetails movie={movie} />

      <div className="mt-8">
        <EffectiveGateNativeBanner
          refreshKey={`imdb-movie-desktop-${movie?.imdbId}`}
        />
        <div className="sm:hidden mt-4">
          <EffectiveGateSquareAd
            refreshKey={`imdb-movie-mobile-${movie?.imdbId}`}
          />
        </div>
      </div>
    </div>
  );
}
