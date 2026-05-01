// frontend-next/src/components/dashboard/MovieEditorClient.jsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

import RequireAdmin from '../auth/RequireAdmin';
import SideBarShell from './SideBarShell';
import Loader from '../common/Loader';
import Uploader from '../common/Uploader';

import {
  parseDurationToMinutes,
  formatMinutesToDuration,
} from '../../lib/client/duration';
import {
  getCategoriesClient,
  getBrowseByDistinctClient,
} from '../../lib/client/catalog';
import {
  createMovieAdmin,
  getMovieByIdAdmin,
  moveMoviesToPage,
  updateMovieAdmin,
} from '../../lib/client/moviesAdmin';

const PREDEFINED_BROWSEBY = [
  'Hollywood (English)',
  'Hollywood (Hindi Dubbed)',
  'Bollywood',
  'South Indian (Hindi Dubbed)',
  'Korean (English)',
  'Korean (Hindi Dubbed)',
  'Chinease Drama',
  'Japanese Anime',
  'Indian Punjabi Movies',
  'Hollywood Web Series (English)',
  'Hollywood Web Series (Hindi Dubbed)',
  'Bollywood Web Series',
  'WWE Wrestling',
];

const MAX_FAQS = 5;

const emptyEpisode = (episodeNumber = 1) => ({
  _id: undefined,
  seasonNumber: 1,
  episodeNumber,
  title: '',
  duration: '',
  desc: '',
  video: '',
  videoUrl2: '',
  videoUrl3: '',
});

const emptyCast = () => ({
  name: '',
  image: '',
});

const emptyFaq = () => ({
  question: '',
  answer: '',
});

const emptyForm = {
  type: 'Movie',
  name: '',
  time: '',
  language: '',
  year: '',
  category: '',
  browseBy: '',
  thumbnailInfo: '',
  desc: '',

  director: '',
  imdbId: '',

  // trailer + FAQ
  trailerUrl: '',
  faqs: [],

  seoTitle: '',
  seoDescription: '',
  seoKeywords: '',

  video: '',
  videoUrl2: '',
  videoUrl3: '',
  videoUrl7: '',
  downloadUrl: '',

  episodes: [],

  latest: false,
  previousHit: false,
  isPublished: false,
};

const isLikelyObjectId = (v) => /^[a-f\d]{24}$/i.test(String(v || ''));

const isValidImdbId = (v) => /^tt\d{5,10}$/i.test(String(v || '').trim());

const isValidHttpUrlOrEmpty = (v) => {
  const s = String(v || '').trim();
  if (!s) return true;
  return /^https?:\/\//i.test(s);
};

export default function MovieEditorClient({ mode = 'create', movieId = null }) {
  return (
    <RequireAdmin>
      {(user) => (
        <EditorInner mode={mode} movieId={movieId} token={user.token} />
      )}
    </RequireAdmin>
  );
}

function EditorInner({ mode, movieId, token }) {
  const router = useRouter();
  const isEdit = mode === 'edit';

  const [booting, setBooting] = useState(true);
  const [saving, setSaving] = useState(false);

  const [categories, setCategories] = useState([]);
  const [browseByDistinct, setBrowseByDistinct] = useState([]);

  const [posterImage, setPosterImage] = useState('');
  const [titleImage, setTitleImage] = useState('');

  // real DB _id for update calls even when URL param is slug
  const [dbId, setDbId] = useState(null);

  // show + use slug
  const [currentSlug, setCurrentSlug] = useState('');

  const [form, setForm] = useState({ ...emptyForm });
  const [originalFlags, setOriginalFlags] = useState({
    isPublished: false,
    latest: false,
    previousHit: false,
  });

  const hasVideoUrl7 = useMemo(
    () => !!String(form.videoUrl7 || '').trim(),
    [form.videoUrl7]
  );

  const browseByOptions = useMemo(() => {
    const distinct = Array.isArray(browseByDistinct)
      ? browseByDistinct.filter((x) => String(x || '').trim())
      : [];
    return Array.from(new Set([...distinct, ...PREDEFINED_BROWSEBY]));
  }, [browseByDistinct]);

  const setField = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const setType = (nextType) => {
    setForm((p) => {
      const base = { ...p, type: nextType };

      if (nextType === 'WebSeries') {
        return {
          ...base,
          video: '',
          videoUrl2: '',
          videoUrl3: '',
          downloadUrl: '',
          episodes: p.episodes?.length ? p.episodes : [emptyEpisode(1)],
        };
      }

      return {
        ...base,
        episodes: [],
      };
    });
  };

  // Cast helpers
  const updateCast = (idx, key, value) => {
    setForm((p) => {
      const casts = Array.isArray(p.casts) ? [...p.casts] : [];
      const cur = casts[idx] || emptyCast();
      casts[idx] = { ...cur, [key]: value };
      return { ...p, casts };
    });
  };

  const addCast = () => {
    setForm((p) => {
      const casts = Array.isArray(p.casts) ? [...p.casts] : [];
      casts.push(emptyCast());
      return { ...p, casts };
    });
  };

  const removeCast = (idx) => {
    setForm((p) => ({
      ...p,
      casts: (p.casts || []).filter((_, i) => i !== idx),
    }));
  };

  // Episode helpers
  const updateEpisode = (idx, k, v) => {
    setForm((p) => {
      const eps = Array.isArray(p.episodes) ? [...p.episodes] : [];
      eps[idx] = { ...(eps[idx] || emptyEpisode(idx + 1)), [k]: v };
      return { ...p, episodes: eps };
    });
  };

  const addEpisode = () => {
    setForm((p) => {
      const eps = Array.isArray(p.episodes) ? [...p.episodes] : [];
      eps.push(emptyEpisode(eps.length + 1));
      return { ...p, episodes: eps };
    });
  };

  const removeEpisode = (idx) => {
    setForm((p) => ({
      ...p,
      episodes: (p.episodes || []).filter((_, i) => i !== idx),
    }));
  };

  // FAQ helpers
  const updateFaq = (idx, k, v) => {
    setForm((p) => {
      const faqs = Array.isArray(p.faqs) ? [...p.faqs] : [];
      const cur = faqs[idx] || emptyFaq();
      faqs[idx] = { ...cur, [k]: v };
      return { ...p, faqs };
    });
  };

  const addFaq = () => {
    setForm((p) => {
      const faqs = Array.isArray(p.faqs) ? [...p.faqs] : [];
      if (faqs.length >= MAX_FAQS) return p;
      faqs.push(emptyFaq());
      return { ...p, faqs };
    });
  };

  const removeFaq = (idx) => {
    setForm((p) => ({
      ...p,
      faqs: (p.faqs || []).filter((_, i) => i !== idx),
    }));
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        setBooting(true);

        const [cats, browse] = await Promise.all([
          getCategoriesClient().catch(() => []),
          getBrowseByDistinctClient().catch(() => []),
        ]);

        if (cancelled) return;

        setCategories(Array.isArray(cats) ? cats : []);
        setBrowseByDistinct(Array.isArray(browse) ? browse : []);

        if (!isEdit) {
          setForm({ ...emptyForm });
          setPosterImage('');
          setTitleImage('');
          setDbId(null);
          setCurrentSlug('');
          setOriginalFlags({
            isPublished: false,
            latest: false,
            previousHit: false,
          });
          return;
        }

        const m = await getMovieByIdAdmin(token, movieId);

        if (!m) {
          toast.error('Movie not found');
          window.location.href = '/movieslist';
          return;
        }

        setDbId(m._id || null);

        const slug = String(m.slug || '').trim();
        setCurrentSlug(slug);

        if (slug && isLikelyObjectId(movieId) && slug !== movieId) {
          router.replace(`/edit/${slug}`, { scroll: false });
        }

        setOriginalFlags({
          isPublished:
            typeof m.isPublished === 'boolean' ? m.isPublished : true,
          latest: !!m.latest,
          previousHit: !!m.previousHit,
        });

        setPosterImage(m.image || '');
        setTitleImage(m.titleImage || '');

        const formattedEpisodes =
          m.type === 'WebSeries' && Array.isArray(m.episodes)
            ? m.episodes.map((ep) => ({
              _id: ep._id,
              seasonNumber: ep.seasonNumber || 1,
              episodeNumber: ep.episodeNumber || 1,
              title: ep.title || '',
              duration: ep.duration ? formatMinutesToDuration(ep.duration) : '',
              desc: ep.desc || '',
              video: ep.video || '',
              videoUrl2: ep.videoUrl2 || '',
              videoUrl3: ep.videoUrl3 || '',
            }))
            : [];

        const formattedCasts = Array.isArray(m.casts)
          ? m.casts.map((c) => ({
            name: c?.name || '',
            image: c?.image || '',
          }))
          : [];

        const formattedFaqs = Array.isArray(m.faqs)
          ? m.faqs.map((f) => ({
            question: String(f?.question || ''),
            answer: String(f?.answer || ''),
          }))
          : [];

        setForm({
          ...emptyForm,
          type: m.type || 'Movie',
          name: m.name || '',
          time: m.time ? formatMinutesToDuration(m.time) : '',
          language: m.language || '',
          year: m.year || '',
          category: m.category || '',
          browseBy: m.browseBy || '',
          thumbnailInfo: m.thumbnailInfo || '',
          desc: m.desc || '',

          director: m.director || '',
          imdbId: m.imdbId || '',
          casts: formattedCasts,

          trailerUrl: m.trailerUrl || '',
          faqs: formattedFaqs,

          seoTitle: m.seoTitle || '',
          seoDescription: m.seoDescription || '',
          seoKeywords: m.seoKeywords || '',

          video: m.video || '',
          videoUrl2: m.videoUrl2 || '',
          videoUrl3: m.videoUrl3 || '',
          videoUrl7: m.videoUrl7 || '',
          downloadUrl: m.downloadUrl || '',

          episodes: formattedEpisodes,

          latest: !!m.latest,
          previousHit: !!m.previousHit,
          isPublished:
            typeof m.isPublished === 'boolean' ? m.isPublished : true,
        });

        if (m.type === 'WebSeries' && formattedEpisodes.length === 0) {
          setForm((p) => ({ ...p, episodes: [emptyEpisode(1)] }));
        }
      } catch (e) {
        toast.error(e?.message || 'Failed to load editor');
      } finally {
        if (!cancelled) setBooting(false);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [isEdit, token, movieId, router]);

  const validateAndBuildPayload = () => {
    if (!posterImage || !titleImage) {
      toast.error('Please upload both Poster Image and Title Image.');
      return null;
    }

    const totalMinutes = parseDurationToMinutes(form.time);
    if (totalMinutes === null) {
      toast.error('Invalid duration format. Use e.g. 2Hr 35Min');
      return null;
    }

    const year = Number(form.year);
    if (!Number.isFinite(year) || year < 1888) {
      toast.error('Please enter a valid year (>= 1888).');
      return null;
    }

    if (!form.name.trim() || !form.desc.trim() || !form.language.trim()) {
      toast.error('Name, Description and Language are required.');
      return null;
    }

    if (!form.category) {
      toast.error('Please select category.');
      return null;
    }

    if (!form.browseBy) {
      toast.error('Please select Browse By.');
      return null;
    }

    if (form.latest && form.previousHit) {
      toast.error('Latest and PreviousHit cannot both be selected.');
      return null;
    }

    const imdbId = String(form.imdbId || '').trim();
    if (imdbId && !isValidImdbId(imdbId)) {
      toast.error('IMDb ID must look like: tt1630029');
      return null;
    }

    const trailerUrl = String(form.trailerUrl || '').trim();
    if (!isValidHttpUrlOrEmpty(trailerUrl)) {
      toast.error('Trailer URL must start with http:// or https://');
      return null;
    }
    if (trailerUrl.length > 2048) {
      toast.error('Trailer URL is too long');
      return null;
    }

    const faqsRaw = Array.isArray(form.faqs) ? form.faqs : [];
    const faqClean = faqsRaw
      .map((f) => ({
        question: String(f?.question || '').trim(),
        answer: String(f?.answer || '').trim(),
      }))
      .filter((f) => f.question || f.answer);

    const faqPartial = faqClean.some(
      (f) => (f.question && !f.answer) || (!f.question && f.answer)
    );
    if (faqPartial) {
      toast.error('Each FAQ must have BOTH question and answer (or remove it).');
      return null;
    }

    const faqs = faqClean
      .filter((f) => f.question && f.answer)
      .slice(0, MAX_FAQS)
      .map((f) => ({
        question: f.question.substring(0, 200),
        answer: f.answer.substring(0, 800),
      }));

    const castsRaw = Array.isArray(form.casts) ? form.casts : [];
    const normalizedCasts = castsRaw.map((c) => ({
      name: String(c?.name || '').trim(),
      image: String(c?.image || '').trim(),
    }));

    const hasPartial = normalizedCasts.some(
      (c) => (c.name || c.image) && !(c.name && c.image)
    );
    if (hasPartial) {
      toast.error('Each cast must have BOTH name and image (or remove it).');
      return null;
    }

    const casts = normalizedCasts.filter((c) => c.name && c.image);

    const base = {
      type: form.type,
      name: form.name.trim(),
      desc: form.desc.trim(),
      image: posterImage,
      titleImage: titleImage,

      category: form.category,
      browseBy: form.browseBy,
      thumbnailInfo: String(form.thumbnailInfo || '').trim(),

      language: form.language.trim(),
      year,
      time: totalMinutes,
      videoUrl7: String(form.videoUrl7 || '').trim(),

      director: String(form.director || '').trim(),
      imdbId,
      casts,

      trailerUrl,
      faqs,

      seoTitle: String(form.seoTitle || '').trim(),
      seoDescription: String(form.seoDescription || '').trim(),
      seoKeywords: String(form.seoKeywords || '').trim(),

      latest: !!form.latest,
      previousHit: !!form.previousHit,
      isPublished: !!form.isPublished,
    };

    if (form.type === 'Movie') {
      if (!String(form.video || '').trim())
        return toast.error('Server 1 URL is required'), null;
      if (!String(form.videoUrl2 || '').trim())
        return toast.error('Server 2 URL is required'), null;
      if (!String(form.videoUrl3 || '').trim())
        return toast.error('Server 3 URL is required'), null;

      return {
        ...base,
        video: String(form.video || '').trim(),
        videoUrl2: String(form.videoUrl2 || '').trim(),
        videoUrl3: String(form.videoUrl3 || '').trim(),
        downloadUrl: String(form.downloadUrl || '').trim() || null,
        episodes: undefined,
      };
    }

    const eps = Array.isArray(form.episodes) ? form.episodes : [];
    if (!eps.length) {
      toast.error('Please add at least one episode.');
      return null;
    }

    const normalizedEpisodes = eps.map((ep, idx) => {
      const epMinutes = parseDurationToMinutes(ep.duration);
      if (epMinutes === null) {
        throw new Error(
          `Episode ${idx + 1}: invalid duration (use e.g. 45Min)`
        );
      }

      const seasonNumber = Math.max(1, Number(ep.seasonNumber) || 1);
      const episodeNumber = Number(ep.episodeNumber);

      if (!Number.isFinite(episodeNumber) || episodeNumber < 1) {
        throw new Error(`Episode ${idx + 1}: episodeNumber must be >= 1`);
      }

      const v1 = String(ep.video || '').trim();
      const v2 = String(ep.videoUrl2 || '').trim();
      const v3 = String(ep.videoUrl3 || '').trim();

      if (!v1 || !v2 || !v3) {
        throw new Error(`Episode ${episodeNumber}: all 3 servers are required`);
      }

      return {
        ...(ep._id ? { _id: ep._id } : {}),
        seasonNumber,
        episodeNumber,
        title: String(ep.title || ''),
        duration: epMinutes,
        desc: String(ep.desc || ''),
        video: v1,
        videoUrl2: v2,
        videoUrl3: v3,
      };
    });

    return {
      ...base,
      episodes: normalizedEpisodes,
      video: undefined,
      videoUrl2: undefined,
      videoUrl3: undefined,
      downloadUrl: undefined,
    };
  };

  const copyToClipboard = async (value) => {
    const text = String(value || '').trim();
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied');
    } catch {
      toast.error('Copy failed (browser blocked clipboard)');
    }
  };

  const autoPlaceOnFirstPage = async (movieId) => {
    const safeId = String(movieId || '').trim();
    if (!safeId || !token) return false;

    await moveMoviesToPage(token, 1, [safeId]);
    return true;
  };

  const onSubmit = async (e) => {
    e.preventDefault();

    let payload;
    try {
      payload = validateAndBuildPayload();
      if (!payload) return;
    } catch (err) {
      toast.error(err?.message || 'Invalid episode data');
      return;
    }

    try {
      setSaving(true);

      if (isEdit) {
        const targetId = dbId || movieId;

        const updated = await updateMovieAdmin(token, targetId, payload);

        let autoPlaced = false;
        const shouldAutoPlaceDraft =
          !originalFlags.previousHit &&
          !originalFlags.latest &&
          originalFlags.isPublished === false &&
          !payload.previousHit &&
          !payload.latest;

        if (shouldAutoPlaceDraft) {
          try {
            await autoPlaceOnFirstPage(updated?._id || targetId);
            autoPlaced = true;
          } catch (e2) {
            console.warn(
              '[movie-editor] auto place after update failed:',
              e2?.message || e2
            );
          }
        }

        const nextSlug = String(updated?.slug || '').trim();
        if (nextSlug) {
          setCurrentSlug(nextSlug);
          if (nextSlug !== movieId) {
            router.replace(`/edit/${nextSlug}`, { scroll: false });
          }
        }

        setOriginalFlags({
          isPublished:
            typeof updated?.isPublished === 'boolean'
              ? updated.isPublished
              : !!payload.isPublished,
          latest:
            autoPlaced
              ? true
              : typeof updated?.latest === 'boolean'
                ? updated.latest
                : !!payload.latest,
          previousHit:
            autoPlaced
              ? false
              : typeof updated?.previousHit === 'boolean'
                ? updated.previousHit
                : !!payload.previousHit,
        });

        if (autoPlaced) {
          setForm((prev) => ({
            ...prev,
            latest: true,
            previousHit: false,
          }));
          toast.success('Updated successfully and moved to page 1');
        } else {
          toast.success('Updated successfully');
        }
      } else {
        const created = await createMovieAdmin(token, payload);

        let autoPlaced = false;
        const shouldAutoPlaceNew =
          !payload.previousHit && !payload.latest && created?._id;

        if (shouldAutoPlaceNew) {
          try {
            await autoPlaceOnFirstPage(created._id);
            autoPlaced = true;
          } catch (e2) {
            console.warn(
              '[movie-editor] auto place after create failed:',
              e2?.message || e2
            );
          }
        }

        toast.success(
          autoPlaced
            ? 'Created successfully and moved to page 1'
            : 'Created successfully'
        );

        setForm({ ...emptyForm });
        setPosterImage('');
        setTitleImage('');
        setDbId(null);
        setCurrentSlug('');
        setOriginalFlags({
          isPublished: false,
          latest: false,
          previousHit: false,
        });
      }
    } catch (err) {
      toast.error(err?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    'w-full bg-main border border-border rounded px-3 py-3 text-sm text-white outline-none focus:border-customPurple';

  if (booting) {
    return (
      <SideBarShell>
        <Loader />
      </SideBarShell>
    );
  }

  return (
    <SideBarShell>
      <h2 className="text-xl font-bold mb-6">
        {isEdit ? 'Edit Movie / Web Series' : 'Create Movie / Web Series'}
      </h2>

      {isEdit && currentSlug ? (
        <div className="bg-main border border-border rounded-lg p-4 mb-6">
          <h3 className="font-semibold mb-2">Slug</h3>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              className={`${inputClass}`}
              value={currentSlug}
              readOnly
              spellCheck={false}
            />
            <button
              type="button"
              onClick={() => copyToClipboard(currentSlug)}
              className="bg-customPurple hover:bg-opacity-90 transition text-white px-4 py-3 rounded font-semibold"
            >
              Copy
            </button>
          </div>

          <div className="text-xs text-dryGray mt-2">
            Public:{' '}
            <a
              href={`/movie/${currentSlug}`}
              target="_blank"
              rel="noreferrer"
              className="text-customPurple hover:underline"
            >
              /movie/{currentSlug}
            </a>{' '}
            •{' '}
            <a
              href={`/watch/${currentSlug}`}
              target="_blank"
              rel="noreferrer"
              className="text-customPurple hover:underline"
            >
              /watch/{currentSlug}
            </a>
          </div>
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-6">
        <div>
          <label className="text-sm text-border font-semibold">Type</label>
          <select
            value={form.type}
            onChange={(e) => setType(e.target.value)}
            className={`${inputClass} mt-2`}
          >
            <option value="Movie">Movie</option>
            <option value="WebSeries">Web Series</option>
          </select>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-border font-semibold">Name</label>
            <input
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              className={`${inputClass} mt-2`}
              placeholder="Movie/Series name"
            />
          </div>

          <div>
            <label className="text-sm text-border font-semibold">
              Total Duration
            </label>
            <input
              value={form.time}
              onChange={(e) => setField('time', e.target.value)}
              className={`${inputClass} mt-2`}
              placeholder="e.g. 2Hr 35Min"
            />
          </div>

          <div>
            <label className="text-sm text-border font-semibold">Language</label>
            <input
              value={form.language}
              onChange={(e) => setField('language', e.target.value)}
              className={`${inputClass} mt-2`}
              placeholder="English"
            />
          </div>

          <div>
            <label className="text-sm text-border font-semibold">Year</label>
            <input
              value={form.year}
              onChange={(e) => setField('year', e.target.value)}
              className={`${inputClass} mt-2`}
              placeholder="2024"
              type="number"
            />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-main border border-border rounded-lg p-4">
            <p className="text-sm font-semibold mb-2">
              Poster Image (without text)
            </p>
            <Uploader
              setImageUrl={setPosterImage}
              compression={{
                targetSizeKB: 70,
                maxWidth: 1920,
                maxHeight: 1920,
                mimeType: 'image/webp',
              }}
            />
            {posterImage ? (
              <img
                src={posterImage}
                alt="poster"
                className="mt-3 w-full max-w-xs rounded border border-border"
              />
            ) : null}
          </div>

          <div className="bg-main border border-border rounded-lg p-4">
            <p className="text-sm font-semibold mb-2">Title Image (with text)</p>
            <Uploader
              setImageUrl={setTitleImage}
              compression={{
                targetSizeKB: 50,
                maxWidth: 1600,
                maxHeight: 1600,
                mimeType: 'image/webp',
              }}
            />
            {titleImage ? (
              <img
                src={titleImage}
                alt="title"
                className="mt-3 w-full max-w-xs rounded border border-border"
              />
            ) : null}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-border font-semibold">Category</label>
            <select
              value={form.category}
              onChange={(e) => setField('category', e.target.value)}
              className={`${inputClass} mt-2`}
            >
              <option value="">Select Category...</option>
              {categories.map((c) => (
                <option key={c._id} value={c.title}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm text-border font-semibold">Browse By</label>
            <select
              value={form.browseBy}
              onChange={(e) => setField('browseBy', e.target.value)}
              className={`${inputClass} mt-2`}
            >
              <option value="">Select Browse By...</option>
              {browseByOptions.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-border font-semibold">
              Thumbnail Info
            </label>
            <input
              value={form.thumbnailInfo}
              onChange={(e) => setField('thumbnailInfo', e.target.value)}
              className={`${inputClass} mt-2`}
              placeholder="e.g. HD / S01"
            />
          </div>

          <div>
            <label className="text-sm text-border font-semibold">
              Director (optional)
            </label>
            <input
              value={form.director}
              onChange={(e) => setField('director', e.target.value)}
              className={`${inputClass} mt-2`}
              placeholder="Director name"
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-sm text-border font-semibold">
              IMDb ID (optional)
            </label>
            <input
              value={form.imdbId}
              onChange={(e) => setField('imdbId', e.target.value)}
              className={`${inputClass} mt-2`}
              placeholder="tt1630029"
              spellCheck={false}
            />
            <p className="text-xs text-dryGray mt-1">
              Tip: Add correct IMDb ID to improve IMDb/RottenTomatoes matching.
            </p>
          </div>
        </div>

        <div>
          <label className="text-sm text-border font-semibold">Description</label>
          <textarea
            value={form.desc}
            onChange={(e) => setField('desc', e.target.value)}
            className={`${inputClass} mt-2 min-h-[140px]`}
            placeholder="Movie description..."
          />
        </div>

        <div className="bg-main border border-border rounded-lg p-4 space-y-4">
          <h3 className="font-semibold">Trailer & FAQ (optional)</h3>

          <div>
            <label className="text-sm text-border font-semibold">
              Trailer URL (YouTube/Vimeo)
            </label>
            <input
              value={form.trailerUrl}
              onChange={(e) => setField('trailerUrl', e.target.value)}
              className={`${inputClass} mt-2`}
              placeholder="https://www.youtube.com/watch?v=VIDEO_ID"
              spellCheck={false}
            />
            <p className="text-xs text-dryGray mt-1">
              Leave empty to hide Trailer section on the Movie page.
            </p>
          </div>

          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between gap-3">
              <h4 className="font-semibold">FAQ (max {MAX_FAQS})</h4>

              <button
                type="button"
                onClick={addFaq}
                disabled={(form.faqs?.length || 0) >= MAX_FAQS}
                className="px-4 py-2 rounded bg-green-600 hover:bg-green-700 transition text-white text-sm font-semibold disabled:opacity-60"
              >
                Add Question
              </button>
            </div>

            {!form.faqs?.length ? (
              <p className="text-sm text-border mt-3">No FAQs added.</p>
            ) : (
              <div className="space-y-4 mt-4">
                {form.faqs.map((f, idx) => (
                  <div
                    key={idx}
                    className="border border-border rounded-lg p-4 bg-dry"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-sm">Question {idx + 1}</p>
                      <button
                        type="button"
                        onClick={() => removeFaq(idx)}
                        className="text-red-400 hover:text-red-300 text-sm"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4 mt-3">
                      <div>
                        <label className="text-sm text-border font-semibold">
                          Question *
                        </label>
                        <input
                          value={f?.question || ''}
                          onChange={(e) =>
                            updateFaq(idx, 'question', e.target.value)
                          }
                          className={`${inputClass} mt-2`}
                          placeholder="e.g. Is this movie available in HD?"
                        />
                      </div>

                      <div>
                        <label className="text-sm text-border font-semibold">
                          Answer *
                        </label>
                        <textarea
                          value={f?.answer || ''}
                          onChange={(e) =>
                            updateFaq(idx, 'answer', e.target.value)
                          }
                          className={`${inputClass} mt-2 min-h-[90px]`}
                          placeholder="Write the answer..."
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <p className="text-xs text-dryGray mt-3">
              The FAQ section shows only when at least 1 complete Q/A exists.
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-border font-semibold">
              SEO Title (optional)
            </label>
            <input
              value={form.seoTitle}
              onChange={(e) => setField('seoTitle', e.target.value)}
              className={`${inputClass} mt-2`}
              placeholder="Max 100 chars"
            />
          </div>
          <div>
            <label className="text-sm text-border font-semibold">
              SEO Keywords (optional)
            </label>
            <input
              value={form.seoKeywords}
              onChange={(e) => setField('seoKeywords', e.target.value)}
              className={`${inputClass} mt-2`}
              placeholder="comma,separated,keywords"
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm text-border font-semibold">
              SEO Description (optional)
            </label>
            <input
              value={form.seoDescription}
              onChange={(e) => setField('seoDescription', e.target.value)}
              className={`${inputClass} mt-2`}
              placeholder="Max 300 chars"
            />
          </div>
        </div>

        <div className="bg-main border border-border rounded-lg p-4">
          <h3 className="font-semibold mb-3">Visibility & Flags</h3>

          <label className="flex items-center gap-2 mb-3">
            <input
              type="checkbox"
              checked={!!form.isPublished}
              onChange={(e) => setField('isPublished', e.target.checked)}
              className="accent-customPurple"
            />
            <span className="text-sm">
              {form.isPublished
                ? 'Published (visible to users)'
                : 'Draft (hidden from users)'}
            </span>
          </label>

          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!form.latest}
                onChange={(e) => setField('latest', e.target.checked)}
                className="accent-customPurple"
              />
              <span className="text-sm">Latest</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!form.previousHit}
                onChange={(e) => setField('previousHit', e.target.checked)}
                className="accent-customPurple"
              />
              <span className="text-sm">Previous Hit</span>
            </label>
          </div>
        </div>

        <div className="bg-main border border-border rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold">Casts (optional)</h3>
            <button
              type="button"
              onClick={addCast}
              className="px-4 py-2 rounded bg-green-600 hover:bg-green-700 transition text-white text-sm font-semibold"
            >
              Add Cast
            </button>
          </div>

          {!form.casts?.length ? (
            <p className="text-sm text-border">No casts added.</p>
          ) : (
            <div className="space-y-4">
              {form.casts.map((c, idx) => (
                <div
                  key={idx}
                  className="border border-border rounded-lg p-4 bg-dry"
                >
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-semibold">Cast {idx + 1}</p>
                    <button
                      type="button"
                      onClick={() => removeCast(idx)}
                      className="text-red-400 hover:text-red-300 text-sm"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-border font-semibold">
                        Name *
                      </label>
                      <input
                        value={c?.name || ''}
                        onChange={(e) =>
                          updateCast(idx, 'name', e.target.value)
                        }
                        className={`${inputClass} mt-2`}
                        placeholder="Actor name"
                      />
                    </div>

                    <div>
                      <label className="text-sm text-border font-semibold">
                        Image URL *
                      </label>
                      <input
                        value={c?.image || ''}
                        onChange={(e) =>
                          updateCast(idx, 'image', e.target.value)
                        }
                        className={`${inputClass} mt-2`}
                        placeholder="https://cdn..."
                      />
                    </div>
                  </div>

                  <div className="mt-3">
                    <Uploader
                      setImageUrl={(url) => updateCast(idx, 'image', url)}
                      compression={{
                        targetSizeKB: 40,
                        maxWidth: 700,
                        maxHeight: 700,
                        mimeType: 'image/webp',
                      }}
                      buttonText="Upload Cast Image"
                    />
                  </div>

                  {c?.image ? (
                    <img
                      src={c.image}
                      alt={c.name || 'cast'}
                      className="mt-3 w-24 h-24 object-cover rounded border border-border"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = '/images/placeholder.jpg';
                      }}
                    />
                  ) : null}
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-dryGray">
            Cast names automatically generate <code>/actor/&lt;slug&gt;</code>{' '}
            pages.
          </p>
        </div>

        {form.type === 'Movie' ? (
          <div className="bg-main border border-border rounded-lg p-4 space-y-4">
            <h3 className="font-semibold">Movie Servers</h3>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-border font-semibold">
                  {hasVideoUrl7 ? 'Server 2 URL *' : 'Server 1 URL *'}
                </label>
                <input
                  value={form.video}
                  onChange={(e) => setField('video', e.target.value)}
                  className={`${inputClass} mt-2`}
                  placeholder="https://..."
                />
              </div>

              <div>
                <label className="text-sm text-border font-semibold">
                  {hasVideoUrl7 ? 'Server 3 URL *' : 'Server 2 URL *'}
                </label>
                <input
                  value={form.videoUrl2}
                  onChange={(e) => setField('videoUrl2', e.target.value)}
                  className={`${inputClass} mt-2`}
                  placeholder="https://..."
                />
              </div>

              <div>
                <label className="text-sm text-border font-semibold">
                  {hasVideoUrl7 ? 'Server 4 URL *' : 'Server 3 URL *'}
                </label>
                <input
                  value={form.videoUrl3}
                  onChange={(e) => setField('videoUrl3', e.target.value)}
                  className={`${inputClass} mt-2`}
                  placeholder="https://..."
                />
              </div>

              <div>
                <label className="text-sm text-border font-semibold">
                  Download URL (optional)
                </label>
                <input
                  value={form.downloadUrl}
                  onChange={(e) => setField('downloadUrl', e.target.value)}
                  className={`${inputClass} mt-2`}
                  placeholder="https://..."
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-sm text-border font-semibold">
                  Server 1 URL (videoUrl7) (optional)
                </label>
                <input
                  value={form.videoUrl7}
                  onChange={(e) => setField('videoUrl7', e.target.value)}
                  className={`${inputClass} mt-2`}
                  placeholder="https://..."
                />
                <p className="text-xs text-dryGray mt-1">
                  If provided, Watch page will show this as Server 1 and shift the other servers to Server 2/3/4.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {form.type === 'WebSeries' ? (
          <div className="bg-main border border-border rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Episodes *</h3>
              <button
                type="button"
                onClick={addEpisode}
                className="px-4 py-2 rounded bg-green-600 hover:bg-green-700 transition text-white text-sm font-semibold"
              >
                Add Episode
              </button>
            </div>

            <div className="bg-dry border border-border rounded-lg p-4">
              <label className="text-sm text-border font-semibold">
                Server 1 URL (videoUrl7) (optional)
              </label>
              <input
                value={form.videoUrl7}
                onChange={(e) => setField('videoUrl7', e.target.value)}
                className={`${inputClass} mt-2`}
                placeholder="https://..."
              />
              <p className="text-xs text-dryGray mt-1">
                If provided, Watch page hides the episode list when Server 1 is selected.
              </p>
            </div>

            {form.episodes.length === 0 ? (
              <p className="text-sm text-border">No episodes yet.</p>
            ) : (
              <div className="space-y-4">
                {form.episodes.map((ep, idx) => (
                  <div
                    key={ep._id || idx}
                    className="border border-border rounded-lg p-4 bg-dry"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <p className="font-semibold">Episode {idx + 1}</p>
                      <button
                        type="button"
                        onClick={() => removeEpisode(idx)}
                        className="text-red-400 hover:text-red-300 text-sm"
                        disabled={form.episodes.length <= 1}
                      >
                        Remove
                      </button>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm text-border font-semibold">
                          Season *
                        </label>
                        <input
                          type="number"
                          value={ep.seasonNumber}
                          onChange={(e) =>
                            updateEpisode(idx, 'seasonNumber', e.target.value)
                          }
                          className={`${inputClass} mt-2`}
                        />
                      </div>

                      <div>
                        <label className="text-sm text-border font-semibold">
                          Episode Number *
                        </label>
                        <input
                          type="number"
                          value={ep.episodeNumber}
                          onChange={(e) =>
                            updateEpisode(idx, 'episodeNumber', e.target.value)
                          }
                          className={`${inputClass} mt-2`}
                        />
                      </div>

                      <div>
                        <label className="text-sm text-border font-semibold">
                          Title (optional)
                        </label>
                        <input
                          value={ep.title}
                          onChange={(e) =>
                            updateEpisode(idx, 'title', e.target.value)
                          }
                          className={`${inputClass} mt-2`}
                        />
                      </div>

                      <div>
                        <label className="text-sm text-border font-semibold">
                          Duration *
                        </label>
                        <input
                          value={ep.duration}
                          onChange={(e) =>
                            updateEpisode(idx, 'duration', e.target.value)
                          }
                          className={`${inputClass} mt-2`}
                          placeholder="e.g. 45Min"
                        />
                      </div>

                      <div>
                        <label className="text-sm text-border font-semibold">
                          {hasVideoUrl7 ? 'Server 2 *' : 'Server 1 *'}
                        </label>
                        <input
                          value={ep.video}
                          onChange={(e) =>
                            updateEpisode(idx, 'video', e.target.value)
                          }
                          className={`${inputClass} mt-2`}
                          placeholder="https://..."
                        />
                      </div>

                      <div>
                        <label className="text-sm text-border font-semibold">
                          {hasVideoUrl7 ? 'Server 3 *' : 'Server 2 *'}
                        </label>
                        <input
                          value={ep.videoUrl2}
                          onChange={(e) =>
                            updateEpisode(idx, 'videoUrl2', e.target.value)
                          }
                          className={`${inputClass} mt-2`}
                          placeholder="https://..."
                        />
                      </div>

                      <div>
                        <label className="text-sm text-border font-semibold">
                          {hasVideoUrl7 ? 'Server 4 *' : 'Server 3 *'}
                        </label>
                        <input
                          value={ep.videoUrl3}
                          onChange={(e) =>
                            updateEpisode(idx, 'videoUrl3', e.target.value)
                          }
                          className={`${inputClass} mt-2`}
                          placeholder="https://..."
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="text-sm text-border font-semibold">
                          Description (optional)
                        </label>
                        <textarea
                          value={ep.desc}
                          onChange={(e) =>
                            updateEpisode(idx, 'desc', e.target.value)
                          }
                          className={`${inputClass} mt-2 min-h-[90px]`}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-customPurple hover:bg-opacity-90 transition text-white py-3 rounded font-semibold disabled:opacity-60"
        >
          {saving ? 'Saving…' : isEdit ? 'Update' : 'Publish'}
        </button>
      </form>
    </SideBarShell>
  );
}
