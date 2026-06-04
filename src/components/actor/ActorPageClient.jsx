// frontend-next/src/components/actor/ActorPageClient.jsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import SafeImage from '../common/SafeImage';
import MovieCard from '../movie/MovieCard';
import ExpandableText from '../common/ExpandableText';
import VisibleBreadcrumbs from '../seo/VisibleBreadcrumbs';

import EffectiveGateNativeBanner, {
  EffectiveGateSquareAd,
} from '../ads/EffectiveGateNativeBanner';

const ADS_ENABLED = process.env.NEXT_PUBLIC_ADS_ENABLED === 'true';

const ROLE_LABELS = {
  actor: 'Actor',
  director: 'Director',
};

const SORT_TABS = [
  { key: 'latest', label: 'Latest' },
  { key: 'best', label: 'Best' },
  { key: 'popular', label: 'Popular' },
];

const clean = (value = '') => String(value ?? '').trim();

const formatDate = (value) => {
  if (!value) return '';

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';

  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const movieDedupKey = (movie) => {
  const imdbId = clean(movie?.imdbId);

  if (imdbId) return `imdb:${imdbId}`;

  return String(movie?._id || `${movie?.name || ''}:${movie?.year || ''}`);
};

function InfoRow({ label, value }) {
  if (!value) return null;

  return (
    <div className="bg-main border border-border rounded-lg p-3">
      <p className="text-[11px] uppercase tracking-wide text-dryGray">{label}</p>
      <p className="text-sm text-white mt-1">{value}</p>
    </div>
  );
}

function ExternalLinks({ actor }) {
  const links = [
    actor?.imdbUrl ? { label: 'IMDb', href: actor.imdbUrl } : null,
  ].filter(Boolean);

  if (!links.length) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-4">
      {links.map((item) => (
        <a
          key={item.href}
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-2 rounded bg-main border border-border text-sm text-white hover:border-customPurple transition"
        >
          {item.label}
        </a>
      ))}
    </div>
  );
}

function SortTabs({ sort, onChange, disabled }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {SORT_TABS.map((tab) => {
        const active = sort === tab.key;

        return (
          <button
            key={tab.key}
            type="button"
            disabled={disabled}
            onClick={() => onChange(tab.key)}
            className={`rounded-lg border px-4 py-3 text-sm font-semibold transitions disabled:opacity-60 ${active
                ? 'bg-customPurple border-customPurple text-white'
                : 'bg-dry border-border text-white hover:border-customPurple'
              }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export default function ActorPageClient({
  slug,
  initialActor,
  initialMovies = [],
  initialPage = 1,
  initialPages = 1,
  initialTotal = 0,
  initialSort = 'latest',
  initialLimit = 20,
  localTotal = 0,
  imdbTotal = 0,
}) {
  const [actor, setActor] = useState(initialActor || null);

  const [movies, setMovies] = useState(
    Array.isArray(initialMovies) ? initialMovies : []
  );

  const [page, setPage] = useState(Number(initialPage) || 1);
  const [pages, setPages] = useState(Number(initialPages) || 1);
  const [total, setTotal] = useState(Number(initialTotal || 0));
  const [sort, setSort] = useState(initialSort || 'latest');
  const [limit, setLimit] = useState(Number(initialLimit || 20));

  const [loadingSort, setLoadingSort] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    setActor(initialActor || null);
    setMovies(Array.isArray(initialMovies) ? initialMovies : []);
    setPage(Number(initialPage) || 1);
    setPages(Number(initialPages) || 1);
    setTotal(Number(initialTotal || 0));
    setSort(initialSort || 'latest');
    setLimit(Number(initialLimit || 20));
    setLoadingMore(false);
    setLoadingSort(false);
    setFilter('all');
    setSearch('');
  }, [
    slug,
    initialActor,
    initialMovies,
    initialPage,
    initialPages,
    initialTotal,
    initialSort,
    initialLimit,
  ]);

  const fetchActorPage = async ({ nextSort, nextPage, append = false }) => {
    const safeSlug = encodeURIComponent(slug);

    const params = new URLSearchParams();
    params.set('sort', nextSort || 'latest');
    params.set('page', String(nextPage || 1));
    params.set('limit', String(limit || 20));

    const res = await fetch(`/api/actors/${safeSlug}?${params.toString()}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(data?.message || 'Failed to load actor titles');
    }

    if (data?.actor) setActor(data.actor);

    const nextMovies = Array.isArray(data?.movies) ? data.movies : [];

    setMovies((prev) => {
      if (!append) return nextMovies;

      const map = new Map();

      [...(prev || []), ...nextMovies].forEach((movie) => {
        const key = movieDedupKey(movie);
        if (!key) return;
        map.set(key, movie);
      });

      return Array.from(map.values());
    });

    setPage(Number(data?.page || nextPage || 1));
    setPages(Number(data?.pages || 1));
    setTotal(Number(data?.total || 0));
    setSort(data?.sort || nextSort || 'latest');
    setLimit(Number(data?.limit || limit || 20));

    return data;
  };

  const changeSort = async (nextSort) => {
    if (!nextSort || nextSort === sort || loadingSort) return;

    try {
      setLoadingSort(true);
      setSearch('');
      setFilter('all');

      await fetchActorPage({
        nextSort,
        nextPage: 1,
        append: false,
      });
    } catch (e) {
      toast.error(e?.message || 'Failed to switch actor tab');
    } finally {
      setLoadingSort(false);
    }
  };

  const loadMore = async () => {
    if (loadingMore || page >= pages) return;

    try {
      setLoadingMore(true);

      await fetchActorPage({
        nextSort: sort,
        nextPage: page + 1,
        append: true,
      });
    } catch (e) {
      toast.error(e?.message || 'Failed to load more');
    } finally {
      setLoadingMore(false);
    }
  };

  const roles =
    Array.isArray(actor?.roles) && actor.roles.length ? actor.roles : ['actor'];

  const roleLabel =
    actor?.roleLabel ||
    roles.map((role) => ROLE_LABELS[role] || role).join(' • ');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    return (movies || []).filter((movie) => {
      if (filter !== 'all' && movie.type !== filter) return false;

      if (!term) return true;

      return String(movie?.name || '').toLowerCase().includes(term);
    });
  }, [movies, filter, search]);

  const hasVisibleMovies = filtered.length > 0;

  if (!actor) return null;

  const birthday = formatDate(actor?.birthday);
  const deathday = formatDate(actor?.deathday);

  const localCount = Number(localTotal || actor?.localCreditsCount || 0);
  const expandedCount = Number(imdbTotal || 0);

  return (
    <div className="container mx-auto min-h-screen px-2 mobile:px-0 my-6 pb-24 sm:pb-8">
      <VisibleBreadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'Movies', href: '/movies' },
          { label: actor?.name || 'Actor' },
        ]}
        className="mb-4"
      />

      <section className="bg-dry border border-border rounded-lg p-5 sm:p-6">
        <div className="grid md:grid-cols-[220px_minmax(0,1fr)] gap-6">
          <div>
            <div className="relative w-full max-w-[220px] mx-auto md:mx-0 aspect-[3/4] rounded-xl overflow-hidden border border-border bg-black">
              <SafeImage
                src={actor?.image || '/images/placeholder.jpg'}
                fallbackCandidates={['/images/placeholder.jpg']}
                alt={actor?.name || 'Actor'}
                fill
                priority
                fetchPriority="high"
                sizes="220px"
                className="object-cover"
              />
            </div>
          </div>

          <div className="min-w-0">
            <p className="text-customPurple text-xs font-semibold uppercase tracking-wide">
              {roleLabel}
            </p>

            <h1 className="text-2xl sm:text-4xl font-bold text-white mt-2 leading-tight">
              {actor?.name} Movies, Biography & Filmography
            </h1>

            <div className="flex flex-wrap gap-2 mt-4">
              {roles.map((role) => (
                <span
                  key={role}
                  className="px-3 py-1 rounded bg-main border border-border text-xs text-white"
                >
                  {ROLE_LABELS[role] || role}
                </span>
              ))}

              <span className="px-3 py-1 rounded bg-main border border-border text-xs text-white">
                {localCount.toLocaleString()} local credits
              </span>

              {expandedCount ? (
                <span className="px-3 py-1 rounded bg-main border border-border text-xs text-white">
                  Expanded filmography available
                </span>
              ) : null}
            </div>

            <ExternalLinks actor={actor} />

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-5">
              <InfoRow label="Birthday" value={birthday} />
              <InfoRow label="Deathday" value={deathday} />
              <InfoRow label="Birthplace" value={actor?.placeOfBirth} />
              <InfoRow label="IMDb ID" value={actor?.imdbId} />
            </div>
          </div>
        </div>

        {actor?.biography ? (
          <div className="bg-main border border-border rounded-lg p-5 mt-6">
            <h2 className="text-white text-lg font-semibold mb-3">
              Biography
            </h2>

            <ExpandableText
              text={actor.biography}
              wordLimit={130}
              textClassName="text-text text-sm sm:text-base leading-8 whitespace-pre-line"
              buttonClassName="mt-3 text-customPurple hover:underline text-sm font-semibold"
              moreLabel="Read full biography"
              lessLabel="Show less"
            />
          </div>
        ) : (
          <div className="bg-main border border-border rounded-lg p-5 mt-6">
            <h2 className="text-white text-lg font-semibold mb-2">
              Biography
            </h2>

            <p className="text-text text-sm leading-7">
              Biography information is currently unavailable. You can still browse related titles below.
            </p>
          </div>
        )}
      </section>

      <section className="mt-8">
        <div className="bg-dry border border-border rounded-lg p-5">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-white">
                  {actor?.name} Movies & Web Series
                </h2>

                <p className="text-dryGray text-sm mt-1">
                  Local MovieFrost Hindi titles are shown first when they match the same IMDb title.
                </p>
              </div>

              <div className="lg:min-w-[420px]">
                <SortTabs
                  sort={sort}
                  onChange={changeSort}
                  disabled={loadingSort}
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search this filmography..."
                className="flex-1 bg-main border border-border rounded px-3 py-3 text-sm text-white outline-none focus:border-customPurple"
              />

              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="bg-main border border-border rounded px-3 py-3 text-sm text-white outline-none focus:border-customPurple"
              >
                <option value="all">All</option>
                <option value="Movie">Movies</option>
                <option value="WebSeries">Web Series</option>
              </select>
            </div>
          </div>
        </div>

        {loadingSort ? (
          <div className="mt-6 bg-dry border border-border rounded-lg p-8 text-center">
            <div className="animate-spin rounded-full border-4 border-customPurple border-t-transparent w-10 h-10 mx-auto" />
            <p className="text-dryGray text-sm mt-3">Loading titles...</p>
          </div>
        ) : hasVisibleMovies ? (
          <div className="mt-6 grid grid-cols-2 md:grid-cols-3 above-1000:grid-cols-5 gap-4">
            {filtered.map((movie) => (
              <MovieCard
                key={movieDedupKey(movie)}
                movie={movie}
                showLike
              />
            ))}
          </div>
        ) : (
          <div className="mt-6 bg-dry border border-border rounded-lg p-6">
            <p className="text-dryGray text-sm">
              No titles match your current filter.
            </p>
          </div>
        )}

        {page < pages ? (
          <div className="flex justify-center mt-10">
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="bg-customPurple hover:bg-opacity-90 transition text-white px-8 py-3 rounded font-semibold disabled:opacity-60"
            >
              {loadingMore ? 'Loading...' : 'Load more'}
            </button>
          </div>
        ) : null}
      </section>

      {ADS_ENABLED && hasVisibleMovies ? (
        <div className="my-10">
          <EffectiveGateNativeBanner refreshKey={`actor-desktop-bottom-${slug}-${sort}`} />
          <div className="sm:hidden mt-4">
            <EffectiveGateSquareAd refreshKey={`actor-mobile-bottom-${slug}-${sort}`} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
