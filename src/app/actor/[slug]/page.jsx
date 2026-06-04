// frontend-next/src/app/actor/[slug]/page.jsx
import { notFound } from 'next/navigation';

import ActorPageClient from '../../../components/actor/ActorPageClient';
import JsonLd from '../../../components/seo/JsonLd';

import { getActorBySlug } from '../../../lib/api';
import {
  absoluteUrl,
  buildActorGraphJsonLd,
  clean,
  SITE_URL,
  truncate,
} from '../../../lib/seo';

export const revalidate = 3600;
export const dynamicParams = true;

const INITIAL_LIMIT = 20;
const INITIAL_SORT = 'latest';

const decodeParam = (value = '') => {
  try {
    return decodeURIComponent(String(value || '').trim());
  } catch {
    return String(value || '').trim();
  }
};

const buildActorCanonical = (actor, slug) =>
  `${SITE_URL}/actor/${clean(actor?.slug || slug)}`;

const buildActorTitle = (actor) => {
  const name = clean(actor?.name || 'Actor');
  const roleLabel = clean(actor?.roleLabel || actor?.knownForDepartment || 'Actor');

  return `${name} Movies, Biography, Career & ${roleLabel} Info | MovieFrost Hindi`;
};

const buildActorDescription = (actor) => {
  const name = clean(actor?.name || 'Actor');
  const roleLabel = clean(actor?.roleLabel || actor?.knownForDepartment || 'Actor');

  return truncate(
    `Explore ${name} biography, IMDb profile, career info, and MovieFrost Hindi movies/web series where ${name} appears as ${roleLabel.toLowerCase()}.`,
    160
  );
};

export async function generateMetadata({ params }) {
  const slug = decodeParam(params?.slug);

  const data = await getActorBySlug(slug, {
    revalidate,
    page: 1,
    limit: INITIAL_LIMIT,
    sort: INITIAL_SORT,
  }).catch(() => null);

  if (!data?.actor) {
    return {
      title: 'Actor not found',
      robots: { index: false, follow: false },
    };
  }

  const actor = data.actor;
  const canonical = buildActorCanonical(actor, slug);
  const title = buildActorTitle(actor);
  const description = buildActorDescription(actor);
  const image = absoluteUrl(actor?.image || '/images/placeholder.jpg');

  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true },
    },
    openGraph: {
      type: 'profile',
      url: canonical,
      title,
      description,
      images: image ? [image] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: image ? [image] : [],
    },
  };
}

export default async function ActorPage({ params }) {
  const slug = decodeParam(params?.slug);

  const data = await getActorBySlug(slug, {
    revalidate,
    page: 1,
    limit: INITIAL_LIMIT,
    sort: INITIAL_SORT,
  }).catch(() => null);

  if (!data?.actor) notFound();

  const graph = buildActorGraphJsonLd({
    actor: data.actor,
    movies: Array.isArray(data.movies)
      ? data.movies.filter((item) => !item?.isImdbVirtual)
      : [],
  });

  return (
    <>
      <JsonLd data={graph} />

      <ActorPageClient
        slug={data.actor.slug || slug}
        initialActor={data.actor}
        initialMovies={Array.isArray(data.movies) ? data.movies : []}
        initialPage={Number(data.page || 1)}
        initialPages={Number(data.pages || 1)}
        initialTotal={Number(data.total || 0)}
        initialSort={data.sort || INITIAL_SORT}
        initialLimit={Number(data.limit || INITIAL_LIMIT)}
        localTotal={Number(data.localTotal || 0)}
        imdbTotal={Number(data.imdbTotal || 0)}
      />
    </>
  );
}
