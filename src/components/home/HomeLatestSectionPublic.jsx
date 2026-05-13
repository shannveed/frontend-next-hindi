// src/components/home/HomeLatestSectionPublic.jsx
import Link from 'next/link';
import { RiMovie2Line } from 'react-icons/ri';

import MovieCard from '../movie/MovieCard';
import EffectiveGateNativeBanner, {
  EffectiveGateSquareAd,
} from '../ads/EffectiveGateNativeBanner';

const HOME_LATEST_LIMIT = 40;

function EmptyState() {
  return (
    <div className="w-full gap-6 flex-colo py-12">
      <div className="flex-colo w-24 h-24 p-5 mb-4 rounded-full bg-dry text-customPurple text-4xl">
        <RiMovie2Line />
      </div>
      <p className="text-border text-sm">No New Releases yet.</p>
    </div>
  );
}

export default function HomeLatestSectionPublic({ movies = [] }) {
  const list = Array.isArray(movies)
    ? movies.filter(Boolean).slice(0, HOME_LATEST_LIMIT)
    : [];

  if (!list.length) return <EmptyState />;

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mobile:gap-2">
        {list.map((movie) => (
          <MovieCard key={movie?._id} movie={movie} />
        ))}
      </div>

      <div className="flex justify-center mt-10">
        <Link
          href="/movies"
          className="bg-customPurple hover:bg-transparent border-2 border-customPurple text-white px-10 py-3 rounded-md font-semibold text-base transitions"
        >
          Show More
        </Link>
      </div>

      <EffectiveGateNativeBanner refreshKey="home-public-newreleases" />
      <EffectiveGateSquareAd
        refreshKey="home-public-newreleases-square"
        className="px-0"
      />
    </>
  );
}
