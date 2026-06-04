// frontend-next/src/components/movie/MovieInfoServer.jsx
import Link from 'next/link';
import {
  FaFolder,
  FaRegClock,
  FaPlay,
  FaShareAlt,
  FaCloudDownloadAlt,
} from 'react-icons/fa';
import { personSlug } from '../../lib/seo';

import MovieAverageStars from './MovieAverageStars';
import MovieShareButtonClient from './MovieShareButtonClient';
import MovieTrailerSection from './MovieTrailerSection';
import SafeImage from '../common/SafeImage';

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

const toNumberOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null;

  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

function RatingTextLogo({ children, className = '' }) {
  return (
    <span
      className={`inline-flex items-center justify-center min-w-7 h-5 rounded text-[11px] font-black tracking-tight ${className}`}
    >
      {children}
    </span>
  );
}

function ExternalRatings({ movie }) {
  const imdb = movie?.externalRatings?.imdb || {};
  const rt = movie?.externalRatings?.rottenTomatoes || {};

  const imdbRating = toNumberOrNull(imdb.rating);
  const imdbVotes = toNumberOrNull(imdb.votes);

  const imdbUrl =
    clean(imdb.url) ||
    (movie?.imdbId ? `https://www.imdb.com/title/${clean(movie.imdbId)}/` : '') ||
    (movie?.name
      ? `https://www.imdb.com/find?q=${encodeURIComponent(movie.name)}`
      : '');

  const rtRating = toNumberOrNull(rt.rating);

  const rtUrl =
    clean(rt.url) ||
    (movie?.name
      ? `https://www.rottentomatoes.com/search?search=${encodeURIComponent(
        movie.name
      )}`
      : '');

  const badgeClass =
    'inline-flex items-center gap-2 px-3 py-2 rounded bg-main border border-border text-sm text-white hover:border-customPurple transitions';

  if (!imdbUrl && !rtUrl) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {imdbUrl ? (
        <a
          href={imdbUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={badgeClass}
          title={imdbRating !== null ? 'IMDb rating' : 'Open IMDb'}
        >
          <RatingTextLogo className="bg-[#f5c518] text-black">
            IMDb
          </RatingTextLogo>

          <span className="text-dryGray">
            {imdbRating !== null ? `${imdbRating.toFixed(1)}/10` : 'View'}
            {imdbRating !== null && imdbVotes !== null
              ? ` (${imdbVotes.toLocaleString()} votes)`
              : ''}
          </span>
        </a>
      ) : null}

      {rtUrl ? (
        <a
          href={rtUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={badgeClass}
          title={rtRating !== null ? 'Rotten Tomatoes score' : 'Search Rotten Tomatoes'}
        >
          <RatingTextLogo className="bg-[#fa320a] text-white">
            RT
          </RatingTextLogo>

          <span className="text-dryGray">
            {rtRating !== null ? `${rtRating}%` : 'Search'}
          </span>
        </a>
      ) : null}
    </div>
  );
}

function CastScroller({ casts = [] }) {
  const list = Array.isArray(casts)
    ? casts.filter((c) => c?.name).slice(0, 20)
    : [];

  if (!list.length) return null;

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-semibold text-sm">Cast</h3>
        <span className="text-xs text-dryGray">{list.length} shown</span>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {list.map((c, idx) => {
          const slug = c?.slug || personSlug(c?.name);
          const href = slug ? `/actor/${slug}` : '';

          const card = (
            <div className="min-w-[120px] max-w-[160px] bg-main border border-border rounded-lg p-2 hover:border-customPurple transitions">
              <div className="w-full aspect-[3/4] relative rounded-md overflow-hidden bg-black/40 border border-border">
                <SafeImage
                  src={c?.image}
                  fallbackCandidates={['/images/placeholder.jpg']}
                  alt={c?.name || 'Actor'}
                  fill
                  sizes="140px"
                  className="object-contain"
                />
              </div>

              <p className="mt-1 text-[11px] font-medium text-white/90 text-center line-clamp-2 leading-tight">
                {c?.name}
              </p>

              <p className="text-[10px] text-customPurple text-center mt-1">
                View profile
              </p>
            </div>
          );

          if (!href) {
            return <div key={`${c?.name || 'cast'}-${idx}`}>{card}</div>;
          }

          return (
            <Link
              key={`${c?.name || 'cast'}-${idx}`}
              href={href}
              className="block"
            >
              {card}
            </Link>
          );
        })}
      </div>
    </section>
  );
}


export default function MovieInfoServer({ movie }) {
  if (!movie) return null;

  const seg = clean(movie?.slug) || clean(movie?._id);

  const category = clean(movie?.category);
  const language = clean(movie?.language);
  const browseBy = clean(movie?.browseBy);
  const directorName = clean(movie?.director);
  const descriptionText = clean(movie?.desc);

  const categoryHref = category
    ? `/movies?category=${encodeURIComponent(category)}`
    : '/movies';

  const languageHref = language
    ? `/movies?language=${encodeURIComponent(language)}`
    : '/movies';

  const browseByHref = browseBy
    ? `/movies?browseBy=${encodeURIComponent(browseBy)}`
    : '/movies';

  const yearHref = movie?.year
    ? `/movies?year=${encodeURIComponent(String(movie.year))}`
    : '/movies';

  return (
    <div className="w-full text-white">
      {/* MOBILE */}
      <section className="sm:hidden px-4 mt-4">
        <div className="relative w-full h-[60vh] rounded-xl overflow-hidden border border-border bg-main">
          <SafeImage
            src={movie?.titleImage}
            fallbackCandidates={[movie?.image, '/images/MOVIEFROST.png']}
            alt={movie?.name || 'Movie'}
            fill
            priority
            fetchPriority="high"
            sizes="(max-width: 639px) 100vw, 0px"
            className="object-cover"
          />
        </div>

        <div className="mt-3 bg-dry border border-border rounded-xl p-4">
          <h2 className="text-lg font-bold leading-snug">{movie?.name}</h2>

          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-dryGray">
            {movie?.time ? (
              <span className="inline-flex items-center gap-1">
                <FaRegClock className="text-subMain w-3 h-3" />
                {formatTime(movie.time)}
              </span>
            ) : null}

            {movie?.year ? (
              <Link href={yearHref} className="hover:text-customPurple transitions">
                {movie.year}
              </Link>
            ) : null}

            {category ? (
              <Link
                href={categoryHref}
                className="inline-flex items-center gap-1 hover:text-customPurple transitions"
              >
                <FaFolder className="text-subMain w-3 h-3" />
                {category}
              </Link>
            ) : null}

            {language ? (
              <Link href={languageHref} className="hover:text-customPurple transitions">
                {language}
              </Link>
            ) : null}

            {browseBy ? (
              <Link href={browseByHref} className="hover:text-customPurple transitions">
                {browseBy}
              </Link>
            ) : null}
          </div>

          {directorName ? (
            <div className="mt-2 text-xs text-dryGray">
              Director: <span className="text-white">{directorName}</span>
            </div>
          ) : null}

          <div className="mt-4 flex gap-2">
            <Link
              href={`/watch/${seg}`}
              className="flex-1 bg-customPurple hover:bg-opacity-90 transition text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2"
            >
              <FaPlay className="text-sm" />
              Watch
            </Link>

            <MovieShareButtonClient
              movieName={movie?.name || ''}
              buttonClassName="w-12 h-12 rounded-lg border border-border bg-main hover:border-customPurple transition flex items-center justify-center"
            >
              <FaShareAlt />
            </MovieShareButtonClient>
          </div>
        </div>

        {descriptionText ? (
          <div className="mt-4 bg-dry border border-border rounded-xl p-4">
            <h2 className="text-sm font-semibold mb-2">Description</h2>
            <p className="text-sm text-text leading-6 whitespace-pre-line">
              {descriptionText}
            </p>
          </div>
        ) : null}
      </section>

      {/* DESKTOP / TABLET */}
      <section className="hidden sm:block">
        <div className="relative w-full min-h-[720px] lg:min-h-[calc(100vh-120px)] overflow-hidden rounded border border-border bg-black">
          <SafeImage
            src={movie?.image}
            fallbackCandidates={[movie?.titleImage, '/images/MOVIEFROST.png']}
            alt={movie?.name || 'Movie background'}
            fill
            priority
            fetchPriority="high"
            sizes="(max-width: 639px) 0px, 100vw"
            className="object-cover"
          />

          <div className="absolute inset-0 bg-main/95" />

          <div className="relative container mx-auto px-8 py-10 lg:py-14">
            <div className="grid grid-cols-3 gap-8 items-start">
              <div className="col-span-1">
                <div className="w-full rounded-md overflow-hidden border border-border bg-dry">
                  <SafeImage
                    src={movie?.titleImage}
                    fallbackCandidates={[movie?.image, '/images/MOVIEFROST.png']}
                    alt={movie?.name || 'Movie'}
                    width={520}
                    height={780}
                    sizes="(max-width: 639px) 0px, (max-width: 1024px) 33vw, 520px"
                    fetchPriority="low"
                    className="w-full h-auto object-cover"
                  />
                </div>
              </div>

              <div className="col-span-2">
                <h1 className="text-3xl lg:text-4xl font-bold leading-tight">
                  {movie?.name}
                </h1>

                <div className="mt-3 flex flex-wrap items-center gap-4 text-dryGray text-sm">
                  {movie?.time ? (
                    <span className="inline-flex items-center gap-1">
                      <FaRegClock className="text-subMain w-3 h-3" />
                      {formatTime(movie.time)}
                    </span>
                  ) : null}

                  {movie?.year ? (
                    <Link href={yearHref} className="hover:text-customPurple transitions">
                      {movie.year}
                    </Link>
                  ) : null}

                  {category ? (
                    <Link
                      href={categoryHref}
                      className="inline-flex items-center gap-1 hover:text-customPurple transitions"
                    >
                      <FaFolder className="text-subMain w-3 h-3" />
                      {category}
                    </Link>
                  ) : null}

                  {language ? (
                    <Link href={languageHref} className="hover:text-customPurple transitions">
                      {language}
                    </Link>
                  ) : null}

                  {browseBy ? (
                    <Link href={browseByHref} className="hover:text-customPurple transitions">
                      {browseBy}
                    </Link>
                  ) : null}

                  {directorName ? (
                    <span className="inline-flex items-center gap-1">
                      <span className="text-subMain">Director:</span>
                      <span className="text-white">{directorName}</span>
                    </span>
                  ) : null}
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <Link
                    href={`/watch/${seg}`}
                    className="bg-customPurple hover:bg-opacity-90 transition text-white px-8 py-3 rounded-lg font-semibold flex items-center gap-2"
                  >
                    <FaPlay className="text-sm" />
                    Watch
                  </Link>

                  <MovieShareButtonClient
                    movieName={movie?.name || ''}
                    buttonClassName="px-6 py-3 rounded-lg border border-border bg-black/30 hover:border-customPurple transition flex items-center gap-2"
                  >
                    <FaShareAlt />
                    Share
                  </MovieShareButtonClient>

                  {movie?.type === 'Movie' && movie?.downloadUrl ? (
                    <a
                      href={movie.downloadUrl}
                      className="px-6 py-3 rounded-lg border border-customPurple bg-black/30 hover:bg-customPurple hover:text-white transition flex items-center gap-2"
                    >
                      <FaCloudDownloadAlt />
                      Download
                    </a>
                  ) : null}
                </div>

                <div className="mt-6 bg-black/30 border border-border rounded-lg p-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <p className="text-white font-semibold text-sm">Rating</p>
                    <p className="text-xs text-dryGray">
                      {Number(movie?.numberOfReviews || 0).toLocaleString()}{' '}
                      reviews
                    </p>
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <MovieAverageStars
                      movieIdOrSlug={seg}
                      fallback={movie?.rate || 0}
                    />
                    <span className="text-sm text-dryGray">
                      {Number(movie?.rate || 0).toFixed(1)}/5
                    </span>
                  </div>

                  <ExternalRatings movie={movie} />
                </div>

                <CastScroller casts={movie?.casts} />
              </div>
            </div>

            {descriptionText ? (
              <div className="mt-8 bg-black/30 border border-border rounded-lg p-6">
                <h2 className="text-white font-semibold mb-3">Description</h2>
                <p className="text-text text-sm leading-7 whitespace-pre-line">
                  {descriptionText}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <MovieTrailerSection movie={movie} />

      {/* MOBILE rating + cast below trailer */}
      <section className="sm:hidden px-4">
        <div className="mt-4 bg-dry border border-border rounded-xl p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-white font-semibold text-sm">Rating</p>
            <p className="text-xs text-dryGray">
              {Number(movie?.numberOfReviews || 0).toLocaleString()} reviews
            </p>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <MovieAverageStars movieIdOrSlug={seg} fallback={movie?.rate || 0} />
            <span className="text-sm text-dryGray">
              {Number(movie?.rate || 0).toFixed(1)}/5
            </span>
          </div>

          <ExternalRatings movie={movie} />
        </div>

        <CastScroller casts={movie?.casts} />
      </section>
    </div>
  );
}
