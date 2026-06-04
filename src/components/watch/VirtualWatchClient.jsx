// frontend-next/src/components/watch/VirtualWatchClient.jsx
'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BiArrowBack } from 'react-icons/bi';
import { FaPlay } from 'react-icons/fa';

import SafeImage from '../common/SafeImage';

import EffectiveGateNativeBanner, {
  EffectiveGateSquareAd,
} from '../ads/EffectiveGateNativeBanner';

const firstServerIndex = (servers = []) =>
  servers.findIndex((server) => String(server?.url || '').trim());

export default function VirtualWatchClient({ movie }) {
  const router = useRouter();

  const [play, setPlay] = useState(false);
  const [serverIndex, setServerIndex] = useState(0);

  const servers = useMemo(
    () => [
      { label: 'Server 1', url: movie?.videoUrl7 || '' },
      { label: 'Server 2', url: movie?.video || '' },
      { label: 'Server 3', url: movie?.videoUrl2 || '' },
      { label: 'Server 4', url: movie?.videoUrl3 || '' },
    ],
    [movie]
  );

  const activeVideoUrl =
    servers?.[serverIndex]?.url ||
    servers?.[firstServerIndex(servers)]?.url ||
    '';

  const handlePlay = () => {
    if (!activeVideoUrl) return;
    setPlay(true);
  };

  return (
    <div className="container mx-auto min-h-screen px-2 mobile:px-0 my-6 pb-24 sm:pb-8">
      <div className="bg-dry p-6 mobile:p-4 mb-12 rounded-lg">
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="sm:w-16 sm:h-16 w-10 h-10 flex-colo transitions hover:bg-customPurple rounded-md bg-main text-white flex-shrink-0"
            type="button"
          >
            <BiArrowBack className="sm:text-2xl text-lg" />
          </button>

          <div className="min-w-0 flex-1">
            <h1 className="sm:text-xl font-semibold truncate">
              {movie?.name}
              {movie?.year ? ` (${movie.year})` : ''}
            </h1>
          </div>

          <Link
            href={movie?.href || '/movies'}
            className="border border-border hover:border-customPurple rounded px-4 py-2 text-sm"
          >
            Details
          </Link>
        </div>

        <div className="flex flex-wrap gap-3 mb-4">
          {servers.map((server, idx) => {
            const enabled = !!server.url;
            const active = idx === serverIndex;

            return (
              <button
                key={server.label}
                type="button"
                disabled={!enabled}
                onClick={() => {
                  setServerIndex(idx);
                  setPlay(false);
                }}
                className={`px-4 py-2 rounded-md font-medium border transitions ${active
                    ? 'bg-customPurple text-white border-customPurple'
                    : 'bg-dry text-white border-border hover:border-customPurple'
                  } ${enabled ? '' : 'opacity-50 cursor-not-allowed'}`}
              >
                {server.label}
              </button>
            );
          })}
        </div>

        <div
          className="relative w-full overflow-hidden rounded-lg"
          style={{ paddingTop: '56.25%' }}
        >
          {play ? (
            <iframe
              key={`${movie?._id}:${serverIndex}:${activeVideoUrl}`}
              title="MovieFrost player"
              src={activeVideoUrl}
              frameBorder="0"
              allowFullScreen
              className="absolute top-0 left-0 w-full h-full rounded-lg"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            />
          ) : (
            <div className="absolute inset-0">
              <div className="w-full h-full rounded-lg overflow-hidden relative bg-main">
                <SafeImage
                  src={movie?.image}
                  fallbackCandidates={[movie?.titleImage, '/images/MOVIEFROST.png']}
                  alt={movie?.name || 'Movie'}
                  fill
                  priority
                  quality={75}
                  sizes="100vw"
                  className="object-cover"
                />

                <div className="absolute inset-0 flex-colo bg-black/45">
                  <button
                    onClick={handlePlay}
                    disabled={!activeVideoUrl}
                    className="bg-white text-customPurple flex-colo border border-customPurple rounded-full w-20 h-20 font-medium text-xl hover:bg-customPurple hover:text-white transitions disabled:opacity-50"
                    type="button"
                  >
                    <FaPlay />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {movie?.type === 'WebSeries' ? (
          <p className="text-[12.5px] text-orange-600 mt-3">
            Use the video player controls to select seasons and episodes when available.
          </p>
        ) : null}

        <EffectiveGateNativeBanner
          refreshKey={`watch-imdb-desktop-${movie?.imdbId}`}
        />

        <EffectiveGateSquareAd
          refreshKey={`watch-imdb-mobile-${movie?.imdbId}`}
          className="sm:hidden"
        />
      </div>
    </div>
  );
}
