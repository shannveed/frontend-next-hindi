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

/**
 * Force dynamic prevents a bad ISR/static render from becoming a permanent 500
 * on movie pages. The page is still fully SEO-rendered on the server.
 */
export const dynamic = 'force-dynamic';
export const dynamicParams = true;
export const revalidate = 0;

const RELATED_MOVIES_LIMIT = 10;

const safeText = (value = '') => String(value ?? '').trim();

const getAdminPreviewToken = async () => {
  try {
    const storeMaybe = cookies();
    const store =
      typeof storeMaybe?.then === 'function' ? await storeMaybe : storeMaybe;

    return store?.get?.('mf_token')?.value || null;
  } catch {
    return null;
  }
};

const getPublicMovie = cache(async (slug) => {
  const raw = safeText(slug);
  if (!raw) return null;

  try {
    return await getMovieBySlug(raw, { revalidate: 0 });
  } catch (error) {
    console.error(
      `[movie-page] public movie fetch failed for "${raw}":`,
      error?.message || error
    );
    return null;
  }
});

async function getMovieForRequest(slug) {
  const raw = safeText(slug);
  if (!raw) return { movie: null, source: 'none', token: null };

  const publicMovie = await getPublicMovie(raw);
  if (publicMovie) {
    return { movie: publicMovie, source: 'public', token: null };
  }

  const token = await getAdminPreviewToken();
  if (!token) return { movie: null, source: 'none', token: null };

  try {
    const adminMovie = await getMovieBySlugAdmin(raw, token);
    if (adminMovie) {
      return { movie: adminMovie, source: 'admin', token };
    }
  } catch (error) {
    console.error(
      `[movie-page] admin movie fallback failed for "${raw}":`,
      error?.message || error
    );
  }

  return { movie: null, source: 'none', token: null };
}

const safeBuildGraphJsonLd = (movie) => {
  try {
    return buildMovieGraphJsonLd(movie);
  } catch (error) {
    console.error(
      '[movie-page] JSON-LD build failed:',
      error?.message || error
    );
    return null;
  }
};

const safeBuildMetadata = (movie, source, fallbackSlug) => {
  try {
    const seg = safeText(movie?.slug) || safeText(movie?._id) || fallbackSlug;
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
  } catch (error) {
    console.error(
      '[movie-page] metadata build failed:',
      error?.message || error
    );

    return {
      title: 'MovieFrost',
      robots: { index: false, follow: true },
    };
  }
};

const getRelatedForMovie = async ({ movie, source, token }) => {
  const seg = safeText(movie?.slug) || safeText(movie?._id);
  if (!seg) return [];

  try {
    if (source === 'admin' && token) {
      return await getRelatedMoviesAdmin(seg, token, RELATED_MOVIES_LIMIT);
    }

    return await getRelatedMovies(seg, RELATED_MOVIES_LIMIT, {
      revalidate: 0,
    });
  } catch (error) {
    console.warn(
      `[movie-page] related movies failed for "${seg}":`,
      error?.message || error
    );
    return [];
  }
};

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
      const seg = safeText(m?.slug) || safeText(m?._id);
      if (seg) set.add(seg);
    }

    return Array.from(set)
      .slice(0, 200)
      .map((slug) => ({ slug }));
  } catch (error) {
    console.warn(
      '[movie-page] generateStaticParams skipped:',
      error?.message || error
    );
    return [];
  }
}

export async function generateMetadata({ params }) {
  try {
    const slug = safeText(params?.slug);
    const { movie, source } = await getMovieForRequest(slug);

    if (!movie) {
      return {
        title: 'Movie not found',
        robots: { index: false, follow: false },
      };
    }

    return safeBuildMetadata(movie, source, slug);
  } catch (error) {
    console.error(
      '[movie-page] generateMetadata failed:',
      error?.message || error
    );

    return {
      title: 'MovieFrost',
      robots: { index: false, follow: true },
    };
  }
}

export default async function MoviePage({ params }) {
  const slug = safeText(params?.slug);

  const { movie, source, token } = await getMovieForRequest(slug);
  if (!movie) notFound();

  const savedSlug = safeText(movie?.slug);

  if (savedSlug && slug && slug !== savedSlug) {
    permanentRedirect(`/movie/${savedSlug}`);
  }

  const seg = savedSlug || safeText(movie?._id) || slug;

  const isDraftAdminPreview =
    source === 'admin' && movie?.isPublished === false;

  const related = await getRelatedForMovie({ movie, source, token });

  const graphLd = !isDraftAdminPreview ? safeBuildGraphJsonLd(movie) : null;

  const ADS_ENABLED = process.env.NEXT_PUBLIC_ADS_ENABLED === 'true';

  const breadcrumbItems = [
    { label: 'Home', href: '/' },
    { label: 'Movies', href: '/movies' },
    { label: buildMovieNameWithYear(movie) || movie?.name || 'Movie' },
  ];

  return (
    <>
      {graphLd ? <JsonLd data={graphLd} /> : null}

      <div className="container mx-auto min-h-screen px-2 mobile:px-0 my-6 pb-24 sm:pb-8">
        <VisibleBreadcrumbs items={breadcrumbItems} className="mb-4" />

        {isDraftAdminPreview ? (
          <div className="bg-main border border-customPurple rounded-lg p-4 mb-6">
            <p className="text-xs uppercase tracking-wide text-customPurple font-semibold">
              Admin Draft Preview
            </p>
            <p className="text-sm text-dryGray mt-2">
              This movie is currently saved as a draft and is visible only to
              logged-in admins.
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
          movies={Array.isArray(related) ? related : []}
          limit={RELATED_MOVIES_LIMIT}
        />

        <MovieFaqSection movie={movie} />
      </div>
    </>
  );
}
