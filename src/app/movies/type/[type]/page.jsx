// frontend-next/src/app/movies/type/[type]/page.jsx
import { notFound } from 'next/navigation';

import MoviesClient from '@/components/movies/MoviesClient';
import SeoLandingHero from '@/components/movies/SeoLandingHero';

import {
  getBrowseByDistinct,
  getCategories,
  getMovies,
  hasListingPageContent,
} from '@/lib/api';
import { resolveListingPageForRequest } from '@/lib/server/adminListingPreview';
import {
  TYPE_PAGES,
  buildTypePageMeta,
  getTypePageBySlug,
} from '@/lib/discoveryPages';

export const revalidate = 3600;
export const dynamic = 'auto';
export const dynamicParams = true;

const EMPTY_DATA = {
  movies: [],
  page: 1,
  pages: 1,
  totalMovies: 0,
};

export async function generateStaticParams() {
  return TYPE_PAGES.map((page) => ({ type: page.slug }));
}

export async function generateMetadata({ params }) {
  const typePage = getTypePageBySlug(params?.type);

  if (!typePage) {
    return {
      title: 'Type not found',
      robots: { index: false, follow: false },
    };
  }

  const meta = buildTypePageMeta(typePage, 1);

  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: meta.canonical },
    robots: { index: true, follow: true },
  };
}

export default async function MoviesTypePage({ params }) {
  const typePage = getTypePageBySlug(params?.type);
  if (!typePage) notFound();

  const [categories, browseByDistinct, publicData] = await Promise.all([
    getCategories({ revalidate: 3600 }).catch(() => []),
    getBrowseByDistinct({ revalidate: 3600 }).catch(() => []),
    getMovies(
      {
        type: typePage.type,
        pageNumber: 1,
      },
      { revalidate: 300 }
    ).catch(() => EMPTY_DATA),
  ]);

  const { data } = await resolveListingPageForRequest(publicData, {
    type: typePage.type,
    pageNumber: 1,
  });

  if (!hasListingPageContent(data, 1)) {
    notFound();
  }

  const meta = buildTypePageMeta(typePage, 1);
  const total = Number(data?.totalMovies || data?.movies?.length || 0);

  return (
    <>
      <SeoLandingHero
        eyebrow="Type Collection"
        title={meta.heading}
        description={meta.body}
        chips={[typePage.label, `${total} titles`, 'Type Landing Page']}
      />

      <MoviesClient
        initialQuery={{
          type: typePage.type,
          pageNumber: 1,
        }}
        initialData={data}
        categories={Array.isArray(categories) ? categories : []}
        browseByDistinct={Array.isArray(browseByDistinct) ? browseByDistinct : []}
      />
    </>
  );
}
