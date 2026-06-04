// frontend-next/src/components/movie/VirtualMovieDetails.jsx
import Link from 'next/link';
import { FaPlay, FaRegClock, FaFolder } from 'react-icons/fa';
import { SiImdb, SiRottentomatoes } from 'react-icons/si';

import SafeImage from '../common/SafeImage';
import MovieTrailerSection from './MovieTrailerSection';

const clean = (value = '') => String(value ?? '').trim();

const formatTime = (minutes) => {
  const n = Number(minutes);
  if (!Number.isFinite(n) || n <= 0) return '';

  const hrs = Math.floor(n / 60);
  const mins = Math.round(n % 60);

  const parts = [];
  if (hrs > 0) parts.push(`${hrs}Hr`);
  if (mins > 0) parts.push(`${mins}Min`);

  return parts.join(' ');
};

function CastScroller({ casts = [] }) {
  const list = Array.isArray(casts)
    ? casts.filter((item) => item?.name).slice(0, 20)
    : [];

  if (!list.length) return null;

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-semibold text-sm">Cast</h3>
        <span className="text-xs text-dryGray">{list.length} shown</span>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {list.map((cast, idx) => {
          const slug = cast?.slug || '';

          const card = (
            <div className="min-w-[120px] max-w-[160px] bg-main border border-border rounded-lg p-2 hover:border-customPurple transitions">
              <div className="w-full aspect-[3/4] relative rounded-md overflow-hidden bg-black/40 border border-border">
                <SafeImage
                  src={cast?.image}
                  fallbackCandidates={['/images/placeholder.jpg']}
                  alt={cast?.name || 'Actor'}
                  fill
                  sizes="140px"
                  className="object-contain"
                />
              </div>

              <p className="mt-1 text-[11px] font-medium text-white/90 text-center line-clamp-2 leading-tight">
                {cast?.name}
              </p>
            </div>
          );

          if (!slug) return <div key={`${cast?.name}-${idx}`}>{card}</div>;

          return (
            <Link key={`${cast?.name}-${idx}`} href={`/actor/${slug}`}>
              {card}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function ExternalLinks({ movie }) {
  const imdbUrl = clean(movie?.externalRatings?.imdb?.url);
  const rtUrl = clean(movie?.externalRatings?.rottenTomatoes?.url);

  if (!imdbUrl && !rtUrl) return null;

  const badge =
    'inline-flex items-center gap-2 px-3 py-2 rounded bg-main border border-border text-sm text-white hover:border-customPurple transitions';

  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {imdbUrl ? (
        <a href={imdbUrl} target="_blank" rel="noopener noreferrer" className={badge}>
          <SiImdb className="text-[#f5c518]" />
          IMDb
        </a>
      ) : null}

      {rtUrl ? (
        <a href={rtUrl} target="_blank" rel="noopener noreferrer" className={badge}>
          <SiRottentomatoes className="text-[#fa320a]" />
          Rotten Tomatoes
        </a>
      ) : null}
    </div>
  );
}

export default function VirtualMovieDetails({ movie }) {
  const watchHref = movie?.watchHref || '#';
  const description = clean(movie?.desc);

  return (
    <div className="w-full text-white">
      <section className="bg-dry border border-border rounded-lg overflow-hidden">
        <div className="relative w-full min-h-[560px] bg-black">
          <SafeImage
            src={movie?.image}
            fallbackCandidates={[movie?.titleImage, '/images/MOVIEFROST.png']}
            alt={movie?.name || 'Movie'}
            fill
            priority
            fetchPriority="high"
            sizes="100vw"
            className="object-cover"
          />

          <div className="absolute inset-0 bg-main/90" />

          <div className="relative p-5 sm:p-8">
            <div className="grid lg:grid-cols-[320px_minmax(0,1fr)] gap-8 items-start">
              <div className="relative w-full max-w-[320px] mx-auto lg:mx-0 aspect-[2/3] rounded-lg overflow-hidden border border-border bg-main">
                <SafeImage
                  src={movie?.titleImage}
                  fallbackCandidates={[movie?.image, '/images/MOVIEFROST.png']}
                  alt={movie?.name || 'Movie poster'}
                  fill
                  sizes="320px"
                  className="object-cover"
                />
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap gap-2 mb-3">
                  <span className="px-3 py-1 rounded bg-main border border-border text-xs text-white">
                    {movie?.type === 'WebSeries' ? 'Web Series' : 'Movie'}
                  </span>
                </div>

                <h1 className="text-2xl sm:text-4xl font-bold leading-tight">
                  {movie?.name}
                  {movie?.year ? ` (${movie.year})` : ''}
                </h1>

                <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-dryGray">
                  {movie?.time ? (
                    <span className="inline-flex items-center gap-1">
                      <FaRegClock className="text-subMain" />
                      {formatTime(movie.time)}
                    </span>
                  ) : null}

                  {movie?.category ? (
                    <span className="inline-flex items-center gap-1">
                      <FaFolder className="text-subMain" />
                      {movie.category}
                    </span>
                  ) : null}

                  {movie?.language ? <span>{movie.language}</span> : null}
                </div>

                {movie?.director ? (
                  <p className="text-sm text-dryGray mt-3">
                    Director / Creator:{' '}
                    <span className="text-white">{movie.director}</span>
                  </p>
                ) : null}

                <div className="flex flex-wrap gap-3 mt-6">
                  <Link
                    href={watchHref}
                    className="bg-customPurple hover:bg-opacity-90 transition text-white px-8 py-3 rounded-lg font-semibold flex items-center gap-2"
                  >
                    <FaPlay className="text-sm" />
                    Watch
                  </Link>
                </div>

                <ExternalLinks movie={movie} />

                {description ? (
                  <div className="mt-8 bg-black/30 border border-border rounded-lg p-5">
                    <h2 className="font-semibold mb-3">Description</h2>
                    <p className="text-text text-sm leading-7 whitespace-pre-line">
                      {description}
                    </p>
                  </div>
                ) : null}

                <CastScroller casts={movie?.casts} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <MovieTrailerSection movie={movie} />
    </div>
  );
}
