// frontend-next/src/app/movie/[slug]/page.jsx
import { cache } from 'react';
import { cookies } from 'next/headers';
import { notFound, permanentRedirect } from 'next/navigation';

import {
  getBannerMovies,
  getLatestNewMovies,
  getMovies,
  getMovieBySlug,
  getMovieBySlugAdmin,
  getRelatedMovies,
  getRelatedMoviesAdmin,
  getTopRatedMovies,
} from '../../../lib/api';

import {
  buildMovieDescription,
  buildMovieTitle,
  movieCanonical,
  buildMovieGraphJsonLd,
  buildMovieNameWithYear,
} from '../../../lib/seo';

import { buildHreflangAlternatesForPath } from '../../../lib/hreflang';

import JsonLd from '../../../components/seo/JsonLd';
import VisibleBreadcrumbs from '../../../components/seo/VisibleBreadcrumbs';
import MovieInfoServer from '../../../components/movie/MovieInfoServer';
import RelatedMoviesServer from '../../../components/movie/RelatedMoviesServer';

import MovieRatingsStrip from '../../../components/movie/MovieRatingsStrip';
import EffectiveGateNativeBanner, {
  EffectiveGateSquareAd,
} from '../../../components/ads/EffectiveGateNativeBanner';

import MovieFaqSection from '../../../components/movie/MovieFaqSection';

export const dynamic = 'auto';
export const dynamicParams = true;
export const revalidate = 3600;

const RELATED_MOVIES_LIMIT = 10;

const getPublicMovie = cache((slug) => getMovieBySlug(slug, { revalidate }));

async function getMovieForRequest(slug) {
  const pub = await getPublicMovie(slug);
  if (pub) return { movie: pub, source: 'public', token: null };

  const token = cookies().get('mf_token')?.value || null;
  if (!token) return { movie: null, source: 'none', token: null };

  const adminMovie = await getMovieBySlugAdmin(slug, token);
  if (adminMovie) return { movie: adminMovie, source: 'admin', token };

  return { movie: null, source: 'none', token: null };
}

export async function generateStaticParams() {
  try {
    const [banner, latestNew, topRated, page1] = await Promise.all([
      getBannerMovies(10, { revalidate: 60 }).catch(() => []),
      getLatestNewMovies(120, { revalidate: 60 }).catch(() => []),
      getTopRatedMovies({ revalidate: 60 }).catch(() => []),
      getMovies({ pageNumber: 1 }, { revalidate: 60 }).catch(() => ({
        movies: [],
      })),
    ]);

    const all = [
      ...(Array.isArray(banner) ? banner : []),
      ...(Array.isArray(latestNew) ? latestNew : []),
      ...(Array.isArray(topRated) ? topRated : []),
      ...(Array.isArray(page1?.movies) ? page1.movies : []),
    ];

    const set = new Set();

    for (const m of all) {
      const seg = m?.slug || m?._id;
      if (seg) set.add(String(seg));
    }

    return Array.from(set)
      .slice(0, 200)
      .map((slug) => ({ slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }) {
  const slug = params?.slug;
  const { movie, source } = await getMovieForRequest(slug);

  if (!movie) {
    return {
      title: 'Movie not found',
      robots: { index: false, follow: false },
    };
  }

  const seg = movie?.slug || movie?._id || slug;
  const publicPath = `/movie/${seg}`;

  const canonical = movieCanonical(movie);
  const title = buildMovieTitle(movie, { maxLen: 100 });
  const description = buildMovieDescription(movie);

  const isDraftAdminPreview =
    source === 'admin' && movie?.isPublished === false;

  return {
    title: { absolute: title },
    description,

    alternates: buildHreflangAlternatesForPath(publicPath, {
      canonical,
    }),

    robots: isDraftAdminPreview
      ? {
        index: false,
        follow: false,
        googleBot: { index: false, follow: false },
      }
      : { index: true, follow: true },

    openGraph: {
      type: movie?.type === 'WebSeries' ? 'video.tv_show' : 'video.movie',
      url: canonical,
      title,
      description,
      images: [movie?.titleImage || movie?.image].filter(Boolean),
    },

    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [movie?.titleImage || movie?.image].filter(Boolean),
    },
  };
}

export default async function MoviePage({ params }) {
  const slug = params?.slug;

  const { movie, source, token } = await getMovieForRequest(slug);
  if (!movie) notFound();

  if (movie?.slug && slug !== movie.slug) {
    permanentRedirect(`/movie/${movie.slug}`);
  }

  const seg = movie.slug || movie._id;
  const isDraftAdminPreview = source === 'admin' && movie?.isPublished === false;

  const related =
    source === 'admin' && token
      ? await getRelatedMoviesAdmin(seg, token, RELATED_MOVIES_LIMIT).catch(
        () => []
      )
      : await getRelatedMovies(seg, RELATED_MOVIES_LIMIT, {
        revalidate: 3600,
      }).catch(() => []);

  const graphLd = buildMovieGraphJsonLd(movie);
  const ADS_ENABLED = process.env.NEXT_PUBLIC_ADS_ENABLED === 'true';

  const breadcrumbItems = [
    { label: 'Home', href: '/' },
    { label: 'Movies', href: '/movies' },
    { label: buildMovieNameWithYear(movie) || movie?.name || 'Movie' },
  ];

  return (
    <>
      {!isDraftAdminPreview ? <JsonLd data={graphLd} /> : null}

      <div className="container mx-auto min-h-screen px-2 mobile:px-0 my-6 pb-24 sm:pb-8">
        <VisibleBreadcrumbs items={breadcrumbItems} className="mb-4" />

        {isDraftAdminPreview ? (
          <div className="bg-main border border-customPurple rounded-lg p-4 mb-6">
            <p className="text-xs uppercase tracking-wide text-customPurple font-semibold">
              Admin Draft Preview
            </p>
            <p className="text-sm text-dryGray mt-2">
              This movie is currently saved as a draft and is visible only to logged-in admins.
            </p>
          </div>
        ) : null}

        <MovieInfoServer movie={movie} />

        {ADS_ENABLED ? (
          <div className="my-6">
            <EffectiveGateNativeBanner
              refreshKey={`movie-desktop-before-ratings:${seg}`}
            />

            <div className="sm:hidden mt-4">
              <EffectiveGateSquareAd
                refreshKey={`movie-mobile-before-ratings:${seg}`}
              />
            </div>
          </div>
        ) : null}

        <div className="my-6">
          <MovieRatingsStrip movieIdOrSlug={seg} />
        </div>

        <RelatedMoviesServer
          currentId={movie._id}
          movies={related}
          limit={RELATED_MOVIES_LIMIT}
        />

        <MovieFaqSection movie={movie} />
      </div>
    </>
  );
}
