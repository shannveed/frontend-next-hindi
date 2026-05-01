// frontend-next/src/app/year/[year]/page.jsx
import { notFound } from 'next/navigation';

import MoviesClient from '../../../components/movies/MoviesClient';
import SeoLandingHero from '../../../components/movies/SeoLandingHero';

import {
  getBrowseByDistinct,
  getCategories,
  getMovies,
  hasListingPageContent,
} from '../../../lib/api';
import { resolveListingPageForRequest } from '../../../lib/server/adminListingPreview';
import { buildYearPageMeta } from '../../../lib/discoveryPages';
import { YearData } from '../../../data/filterData';

export const revalidate = 3600;
export const dynamic = 'auto';
export const dynamicParams = true;

const EMPTY_DATA = {
  movies: [],
  page: 1,
  pages: 1,
  totalMovies: 0,
};

const SUPPORTED_YEARS = YearData.map((item) =>
  String(item?.title || '').trim()
).filter((title) => /^\d{4}$/.test(title));

const isValidYear = (year = '') => /^\d{4}$/.test(String(year || '').trim());

export async function generateStaticParams() {
  return SUPPORTED_YEARS.map((year) => ({ year }));
}

export async function generateMetadata({ params }) {
  const year = String(params?.year || '').trim();

  if (!isValidYear(year)) {
    return {
      title: 'Year not found',
      robots: { index: false, follow: false },
    };
  }

  const meta = buildYearPageMeta(year);

  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: meta.canonical },
    robots: { index: true, follow: true },
  };
}

export default async function YearPage({ params }) {
  const year = String(params?.year || '').trim();
  if (!isValidYear(year)) notFound();

  const [categories, browseByDistinct, publicData] = await Promise.all([
    getCategories({ revalidate: 3600 }).catch(() => []),
    getBrowseByDistinct({ revalidate: 3600 }).catch(() => []),
    getMovies(
      {
        year,
        pageNumber: 1,
      },
      { revalidate: 300 }
    ).catch(() => EMPTY_DATA),
  ]);

  const { data } = await resolveListingPageForRequest(publicData, {
    year,
    pageNumber: 1,
  });

  if (!hasListingPageContent(data, 1)) {
    notFound();
  }

  const meta = buildYearPageMeta(year);
  const total = Number(data?.totalMovies || data?.movies?.length || 0);

  return (
    <>
      <SeoLandingHero
        eyebrow="Release Year Collection"
        title={meta.heading}
        description={meta.body}
        chips={[year, `${total} titles`, 'Release Year Landing Page']}
      />

      <MoviesClient
        initialQuery={{
          year,
          pageNumber: 1,
        }}
        initialData={data}
        categories={Array.isArray(categories) ? categories : []}
        browseByDistinct={Array.isArray(browseByDistinct) ? browseByDistinct : []}
      />
    </>
  );
}
