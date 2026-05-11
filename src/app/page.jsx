// src/app/page.jsx
import HomeClient from '../components/home/HomeClient';
import {
  getBannerMovies,
  getLatestMovies,
  getLatestNewMovies,
  getTopRatedMovies,
} from '../lib/api';

import { buildHreflangAlternatesForPath } from '../lib/hreflang';

import HomeBannerSectionPublic from '../components/home/HomeBannerSectionPublic';
import HomeTrendingSectionPublic from '../components/home/HomeTrendingSectionPublic';
import HomeLatestSectionPublic from '../components/home/HomeLatestSectionPublic';
import HomeBrowseContentPublic from '../components/home/HomeBrowseContentPublic';

export const revalidate = 60;

export const metadata = {
  alternates: buildHreflangAlternatesForPath('/'),
};

export default async function HomePage() {
  const [banner, latestNew, latestMovies, topRated] = await Promise.all([
    getBannerMovies(6, { revalidate: 300 }).catch(() => []),
    getLatestNewMovies(30, { revalidate: 300 }).catch(() => []),
    getLatestMovies({ revalidate: 300 }).catch(() => []),
    getTopRatedMovies({ revalidate: 600 }).catch(() => []),
  ]);

  const bannerList = Array.isArray(banner) ? banner : [];
  const latestNewList = Array.isArray(latestNew) ? latestNew : [];
  const latestMoviesList = Array.isArray(latestMovies) ? latestMovies : [];
  const topRatedList = Array.isArray(topRated) ? topRated : [];

  return (
    <HomeClient
      initialBanner={bannerList}
      initialLatestNew={latestNewList}
      initialLatestMovies={latestMoviesList}
      initialTopRated={topRatedList}
      publicBannerNode={
        <HomeBannerSectionPublic
          bannerMovies={bannerList}
          latestMovies={latestMoviesList}
        />
      }
      publicTrendingNode={<HomeTrendingSectionPublic movies={latestNewList} />}
      publicLatestNode={<HomeLatestSectionPublic movies={latestMoviesList} />}
      publicBrowseNode={<HomeBrowseContentPublic topRated={topRatedList} />}
    />
  );
}
