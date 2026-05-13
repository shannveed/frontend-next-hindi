'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

import MovieCard from '../movie/MovieCard';
import MoviesFilters from './Filters';
import Pagination from './Pagination';

import EffectiveGateNativeBanner, {
  EffectiveGateSquareAd,
} from '../ads/EffectiveGateNativeBanner';

import { getUserInfo } from '../../lib/client/auth';
import {
  getMoviesAdmin,
  moveMoviesToPage,
  reorderMoviesInPage,
  setBannerMovies,
  setLatestNewMovies,
} from '../../lib/client/moviesAdmin';
import { getDedicatedListingPath } from '../../lib/discoveryPages';

const toNum = (v, fallback = 1) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export default function MoviesClient({
  initialQuery = {},
  initialData = {},
  categories = [],
  browseByDistinct = [],
}) {
  const router = useRouter();

  const [userInfo, setUserInfo] = useState(null);
  const token = userInfo?.token || null;
  const isAdmin = !!userInfo?.isAdmin;

  // visible data
  const [movies, setMovies] = useState(() =>
    Array.isArray(initialData?.movies) ? initialData.movies : []
  );
  const [page, setPage] = useState(() => toNum(initialData?.page, 1));
  const [pages, setPages] = useState(() => toNum(initialData?.pages, 1));

  // admin mode
  const [adminMode, setAdminMode] = useState(false);
  const [localOrder, setLocalOrder] = useState([]);
  const [draggedId, setDraggedId] = useState(null);
  const [pendingReorder, setPendingReorder] = useState(false);
  const [saving, setSaving] = useState(false);

  const [selectedIds, setSelectedIds] = useState([]);

  // refs for smooth pointer interactions
  const localOrderRef = useRef([]);
  const dragStateRef = useRef({ active: false, id: null });
  const lastDragTargetRef = useRef('');

  const selectionPaintRef = useRef({ active: false, mode: 'select' });
  const selectedIdsRef = useRef([]);
  const bodyUserSelectRef = useRef('');
  const userSelectLockedRef = useRef(false);

  const lockUserSelect = useCallback(() => {
    if (typeof document === 'undefined') return;

    if (!userSelectLockedRef.current) {
      bodyUserSelectRef.current = document.body.style.userSelect || '';
      document.body.style.userSelect = 'none';
      userSelectLockedRef.current = true;
    }
  }, []);

  const unlockUserSelect = useCallback(() => {
    if (typeof document === 'undefined') return;

    if (userSelectLockedRef.current) {
      document.body.style.userSelect = bodyUserSelectRef.current;
      userSelectLockedRef.current = false;
    }
  }, []);

  useEffect(() => {
    selectedIdsRef.current = selectedIds;
  }, [selectedIds]);

  useEffect(() => {
    localOrderRef.current = localOrder;
  }, [localOrder]);

  // update userInfo from localStorage
  useEffect(() => {
    setUserInfo(getUserInfo());
    const onStorage = () => setUserInfo(getUserInfo());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // when server props change (navigation)
  useEffect(() => {
    setMovies(Array.isArray(initialData?.movies) ? initialData.movies : []);
    setPage(toNum(initialData?.page, 1));
    setPages(toNum(initialData?.pages, 1));

    setAdminMode(false);
    setLocalOrder([]);
    localOrderRef.current = [];

    setPendingReorder(false);
    setDraggedId(null);
    setSelectedIds([]);

    dragStateRef.current = { active: false, id: null };
    lastDragTargetRef.current = '';
    selectionPaintRef.current = { active: false, mode: 'select' };
  }, [initialData]);

  // admin sees drafts too (client-side replace list)
  const queryKey = useMemo(() => JSON.stringify(initialQuery || {}), [
    initialQuery,
  ]);

  useEffect(() => {
    if (!isAdmin || !token) return;

    let cancelled = false;

    (async () => {
      try {
        const data = await getMoviesAdmin(token, initialQuery);
        if (cancelled) return;

        setMovies(Array.isArray(data?.movies) ? data.movies : []);
        setPage(toNum(data?.page, 1));
        setPages(toNum(data?.pages, 1));
      } catch {
        // keep public list on failure
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAdmin, token, queryKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // admin reorder list sync
  useEffect(() => {
    if (isAdmin && adminMode) {
      const next = [...movies];
      setLocalOrder(next);
      localOrderRef.current = next;
      setPendingReorder(false);
    } else {
      setLocalOrder([]);
      localOrderRef.current = [];
      setPendingReorder(false);
      setDraggedId(null);
      dragStateRef.current = { active: false, id: null };
      lastDragTargetRef.current = '';
    }
  }, [isAdmin, adminMode, movies]);

  const finishSelectionPaint = useCallback(() => {
    selectionPaintRef.current = { active: false, mode: 'select' };
    unlockUserSelect();

    if (typeof window !== 'undefined') {
      window.removeEventListener('pointerup', finishSelectionPaint);
      window.removeEventListener('pointercancel', finishSelectionPaint);
      window.removeEventListener('blur', finishSelectionPaint);
    }
  }, [unlockUserSelect]);

  const applyPaintSelection = useCallback((id, mode = 'select') => {
    const safeId = String(id || '').trim();
    if (!safeId) return;

    setSelectedIds((prev) => {
      const next = new Set(prev);

      if (mode === 'deselect') next.delete(safeId);
      else next.add(safeId);

      return Array.from(next);
    });
  }, []);

  const startSelectionPaint = useCallback(
    (event, id) => {
      if (!isAdmin || !adminMode) return;
      if (!id) return;
      if (dragStateRef.current.active) return;

      const mode = event?.ctrlKey || event?.metaKey ? 'deselect' : 'select';

      selectionPaintRef.current = { active: true, mode };
      applyPaintSelection(id, mode);
      lockUserSelect();

      if (typeof window !== 'undefined') {
        window.addEventListener('pointerup', finishSelectionPaint, {
          once: true,
        });
        window.addEventListener('pointercancel', finishSelectionPaint, {
          once: true,
        });
        window.addEventListener('blur', finishSelectionPaint, { once: true });
      }
    },
    [
      isAdmin,
      adminMode,
      applyPaintSelection,
      lockUserSelect,
      finishSelectionPaint,
    ]
  );

  const continueSelectionPaint = useCallback(
    (event, id) => {
      const state = selectionPaintRef.current;
      if (!state.active) return;

      // If mouse button is no longer down, stop painting.
      if (typeof event?.buttons === 'number' && event.buttons === 0) {
        finishSelectionPaint();
        return;
      }

      const mode = event?.ctrlKey || event?.metaKey ? 'deselect' : state.mode;
      applyPaintSelection(id, mode);
    },
    [applyPaintSelection, finishSelectionPaint]
  );

  const finishAdminDrag = useCallback(() => {
    dragStateRef.current = { active: false, id: null };
    lastDragTargetRef.current = '';
    setDraggedId(null);
    unlockUserSelect();

    if (typeof window !== 'undefined') {
      window.removeEventListener('pointerup', finishAdminDrag);
      window.removeEventListener('pointercancel', finishAdminDrag);
      window.removeEventListener('blur', finishAdminDrag);
    }
  }, [unlockUserSelect]);

  const onAdminDragStart = useCallback(
    (event, id) => {
      if (!isAdmin || !adminMode) return;

      const safeId = String(id || '').trim();
      if (!safeId) return;

      event?.preventDefault?.();
      event?.stopPropagation?.();

      // Make sure local order exists before drag begins.
      if (!localOrderRef.current.length) {
        const next = [...movies];
        localOrderRef.current = next;
        setLocalOrder(next);
      }

      dragStateRef.current = { active: true, id: safeId };
      lastDragTargetRef.current = '';
      setDraggedId(safeId);
      lockUserSelect();

      if (typeof window !== 'undefined') {
        window.addEventListener('pointerup', finishAdminDrag, { once: true });
        window.addEventListener('pointercancel', finishAdminDrag, {
          once: true,
        });
        window.addEventListener('blur', finishAdminDrag, { once: true });
      }
    },
    [isAdmin, adminMode, movies, lockUserSelect, finishAdminDrag]
  );

  const onAdminDragEnter = useCallback(
    (event, targetId) => {
      const target = String(targetId || '').trim();
      const dragged = dragStateRef.current.id;

      if (!dragStateRef.current.active) return;
      if (!dragged || !target) return;

      // If mouse button is released outside window, stop drag.
      if (typeof event?.buttons === 'number' && event.buttons === 0) {
        finishAdminDrag();
        return;
      }

      if (dragged === target) return;
      if (lastDragTargetRef.current === target) return;

      lastDragTargetRef.current = target;

      setLocalOrder((prev) => {
        const source = prev.length ? prev : localOrderRef.current;
        const from = source.findIndex((m) => String(m?._id) === dragged);
        const to = source.findIndex((m) => String(m?._id) === target);

        if (from < 0 || to < 0 || from === to) return prev;

        const next = [...source];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);

        localOrderRef.current = next;

        return next;
      });

      setPendingReorder(true);
    },
    [finishAdminDrag]
  );

  useEffect(() => {
    if (!adminMode) {
      finishSelectionPaint();
      finishAdminDrag();
    }
  }, [adminMode, finishSelectionPaint, finishAdminDrag]);

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('pointerup', finishSelectionPaint);
        window.removeEventListener('pointercancel', finishSelectionPaint);
        window.removeEventListener('blur', finishSelectionPaint);

        window.removeEventListener('pointerup', finishAdminDrag);
        window.removeEventListener('pointercancel', finishAdminDrag);
        window.removeEventListener('blur', finishAdminDrag);
      }

      unlockUserSelect();
    };
  }, [finishSelectionPaint, finishAdminDrag, unlockUserSelect]);

  const displayMovies =
    isAdmin && adminMode && localOrder.length ? localOrder : movies;

  const buildQueryUrl = useCallback((nextQuery = {}) => {
    const q = { ...nextQuery };

    const params = new URLSearchParams();
    const set = (k, v) => {
      const val = String(v ?? '').trim();
      if (!val) return;
      params.set(k, val);
    };

    set('type', q.type);
    set('category', q.category);
    set('browseBy', q.browseBy);
    set('language', q.language);
    set('year', q.year);
    set('time', q.time);
    set('rate', q.rate);
    set('search', q.search);

    const pn = toNum(q.pageNumber ?? 1, 1);
    if (pn > 1) params.set('pageNumber', String(pn));

    const qs = params.toString();
    return qs ? `/movies?${qs}` : '/movies';
  }, []);

  const onPageChange = (p) => {
    const nextQuery = {
      ...initialQuery,
      pageNumber: p,
    };

    const dedicatedPath = getDedicatedListingPath(nextQuery);
    router.push(dedicatedPath || buildQueryUrl(nextQuery));

    if (typeof window !== 'undefined') {
      window.scrollTo(0, 0);
    }
  };

  // selection
  const toggleSelect = (id) => {
    const safeId = String(id || '').trim();
    if (!safeId) return;

    setSelectedIds((prev) =>
      prev.includes(safeId)
        ? prev.filter((x) => x !== safeId)
        : [...prev, safeId]
    );
  };

  const clearSelection = () => setSelectedIds([]);
  const bulkOrSingle = (baseId) =>
    selectedIds.length ? selectedIds : [baseId];

  const saveOrder = async () => {
    if (!isAdmin || !token) return;

    try {
      setSaving(true);

      await reorderMoviesInPage(
        token,
        page,
        localOrder.map((m) => m._id),
        initialQuery
      );

      toast.success('Order saved for this page');
      setPendingReorder(false);
      router.refresh();
    } catch (e) {
      toast.error(e?.message || 'Failed to save order');
    } finally {
      setSaving(false);
    }
  };

  const addToTrending = async (baseId) => {
    if (!isAdmin || !token) return;

    try {
      await setLatestNewMovies(token, bulkOrSingle(baseId), true);
      toast.success('Added to Latest New');
      clearSelection();
    } catch (e) {
      toast.error(e?.message || 'Failed');
    }
  };

  const addToBanner = async (baseId) => {
    if (!isAdmin || !token) return;

    try {
      await setBannerMovies(token, bulkOrSingle(baseId), true);
      toast.success('Added to Banner');
      clearSelection();
    } catch (e) {
      toast.error(e?.message || 'Failed');
    }
  };

  const moveToAnyPage = async (baseId, targetPage) => {
    if (!isAdmin || !token) return;

    const tp = toNum(targetPage, 1);

    try {
      await moveMoviesToPage(token, tp, bulkOrSingle(baseId));
      toast.success(`Moved to page ${tp}`);
      clearSelection();
      router.refresh();
    } catch (e) {
      toast.error(e?.message || 'Failed');
    }
  };

  const showAds = displayMovies.length > 0;

  return (
    <section className="container py-6">
      <MoviesFilters
        categories={categories}
        browseByDistinct={browseByDistinct}
        query={initialQuery}
      />

      {isAdmin && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setAdminMode((p) => !p);
              clearSelection();
              setPendingReorder(false);
              setDraggedId(null);
              dragStateRef.current = { active: false, id: null };
              selectionPaintRef.current = { active: false, mode: 'select' };
            }}
            className={`px-4 py-2 text-sm rounded border transitions ${adminMode
                ? 'bg-customPurple border-customPurple text-white'
                : 'border-customPurple text-white hover:bg-customPurple'
              }`}
          >
            {adminMode ? 'Exit Admin Mode' : 'Enter Admin Mode'}
          </button>

          {adminMode && selectedIds.length > 0 && (
            <div className="text-sm text-white">
              <span className="font-semibold">{selectedIds.length}</span>{' '}
              selected
              <button
                type="button"
                onClick={clearSelection}
                className="ml-3 underline text-customPurple hover:text-white transitions"
              >
                Clear Selection
              </button>
            </div>
          )}

          {adminMode && pendingReorder && (
            <button
              type="button"
              onClick={saveOrder}
              disabled={saving}
              className="px-4 py-2 text-sm rounded bg-customPurple text-white disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Order'}
            </button>
          )}

          {adminMode ? (
            <p className="basis-full text-xs text-dryGray">
              Selection: left-click and move over cards to select. Hold Ctrl/Cmd
              and move over cards to deselect. Reorder: drag from the green grip
              icon on each card.
            </p>
          ) : null}
        </div>
      )}

      <p className="text-md font-medium my-4 mobile:px-4">
        Total{' '}
        <span className="font-bold text-customPurple">
          {displayMovies ? displayMovies.length : 0}
        </span>{' '}
        Items Found On This Page
      </p>

      {displayMovies.length ? (
        <>
          <div className="mt-6 grid grid-cols-2 md:grid-cols-3 above-1000:grid-cols-5 gap-4">
            {displayMovies.map((m) => (
              <MovieCard
                key={m._id}
                movie={m}
                className={draggedId === m._id ? 'opacity-80' : ''}
                showAdminControls={isAdmin && adminMode}
                isSelected={selectedIds.includes(String(m._id))}
                onSelectToggle={toggleSelect}
                totalPages={pages}
                onMoveToPageClick={(movieId, p) => moveToAnyPage(movieId, p)}
                onMoveToLatestNewClick={(movieId) => addToTrending(movieId)}
                onMoveToBannerClick={(movieId) => addToBanner(movieId)}
                adminDraggable={isAdmin && adminMode}
                onAdminDragStart={onAdminDragStart}
                onAdminDragEnter={onAdminDragEnter}
                onAdminDragEnd={finishAdminDrag}
                onAdminSelectPointerDown={startSelectionPaint}
                onAdminSelectPointerEnter={continueSelectionPaint}
              />
            ))}
          </div>

          {pages > 1 && (
            <div className="mt-10 flex justify-center">
              <Pagination page={page} pages={pages} onChange={onPageChange} />
            </div>
          )}

          {showAds && (
            <div className="mt-8 space-y-6">
              <EffectiveGateNativeBanner refreshKey={`movies-${page}`} />
              <EffectiveGateSquareAd refreshKey={`movies-square-${page}`} />
            </div>
          )}
        </>
      ) : (
        <div className="mt-10 text-center text-gray-300">No movies found.</div>
      )}
    </section>
  );
}
