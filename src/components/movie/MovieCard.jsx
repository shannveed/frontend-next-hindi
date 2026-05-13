'use client';

import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FaGripVertical, FaHeart } from 'react-icons/fa';
import { TbChevronDown } from 'react-icons/tb';
import toast from 'react-hot-toast';

import SafeImage from '../common/SafeImage';
import { getUserInfo } from '../../lib/client/auth';
import { likeMovie } from '../../lib/client/users';
import { FAVORITES_UPDATED_EVENT } from '../../lib/events';
import { isFavoriteId } from '../../lib/client/favoritesCache';

const ADMIN_CONTROL_SELECTOR =
  '[data-admin-control="true"], button, input, select, textarea, [role="button"]';

const isAdminControlTarget = (target) => {
  if (!target || typeof target.closest !== 'function') return false;
  return !!target.closest(ADMIN_CONTROL_SELECTOR);
};

const isPrimaryPointer = (event) => {
  if (!event) return false;

  if (typeof event.button === 'number') return event.button === 0;

  return true;
};

function MovieCard({
  movie,

  showLike = true,
  className = '',

  showAdminControls = false,
  isSelected = false,
  onSelectToggle,

  totalPages,
  onMoveToPageClick,
  onMoveToLatestNewClick,
  onMoveToBannerClick,

  adminDraggable = false,
  onAdminDragStart,
  onAdminDragEnter,
  onAdminDragEnd,

  onAdminSelectPointerDown,
  onAdminSelectPointerEnter,
}) {
  const router = useRouter();

  const [liking, setLiking] = useState(false);
  const [liked, setLiked] = useState(false);

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const seg = movie?.slug || movie?._id;
  const href = seg ? `/movie/${seg}` : '/movies';

  const didPrefetchRef = useRef(false);
  const prefetchThis = useCallback(() => {
    if (!href) return;
    if (didPrefetchRef.current) return;
    didPrefetchRef.current = true;
    router.prefetch(href);
  }, [router, href]);

  const pagesList = useMemo(() => {
    const n = Number(totalPages);
    if (!Number.isFinite(n) || n <= 1) return [];
    return Array.from({ length: n }, (_, i) => i + 1);
  }, [totalPages]);

  const canShowDropdown =
    typeof onMoveToBannerClick === 'function' ||
    typeof onMoveToLatestNewClick === 'function' ||
    pagesList.length > 0;

  useEffect(() => {
    if (!dropdownOpen) return;

    const onDown = (e) => {
      if (!dropdownRef.current) return;
      if (!dropdownRef.current.contains(e.target)) setDropdownOpen(false);
    };

    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [dropdownOpen]);

  useEffect(() => {
    if (!movie?._id) return;

    const update = () => setLiked(isFavoriteId(movie._id));

    update();
    window.addEventListener(FAVORITES_UPDATED_EVENT, update);
    return () => window.removeEventListener(FAVORITES_UPDATED_EVENT, update);
  }, [movie?._id]);

  const handleLike = useCallback(
    async (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (!movie?._id) return;

      const ui = getUserInfo();
      const token = ui?.token;

      if (!token) {
        toast.error('Please login to add to favorites');
        return;
      }

      if (liked || liking) return;

      try {
        setLiking(true);
        await likeMovie(token, { movieId: movie._id });
        setLiked(true);
        toast.success('Added to your favorites');
      } catch (err) {
        toast.error(err?.message || 'Failed to add to favorites');
      } finally {
        setLiking(false);
      }
    },
    [movie?._id, liked, liking]
  );

  const handleSelectToggle = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onSelectToggle?.(movie?._id);
  };

  const toggleDropdown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDropdownOpen((p) => !p);
  };

  const pickBanner = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDropdownOpen(false);
    onMoveToBannerClick?.(movie?._id);
  };

  const pickLatestNew = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDropdownOpen(false);
    onMoveToLatestNewClick?.(movie?._id);
  };

  const pickPage = (e, p) => {
    e.preventDefault();
    e.stopPropagation();
    setDropdownOpen(false);
    onMoveToPageClick?.(movie?._id, p);
  };

  const handleAdminDragPointerDown = (e) => {
    if (!adminDraggable) return;
    if (!isPrimaryPointer(e)) return;

    e.preventDefault();
    e.stopPropagation();

    onAdminDragStart?.(e, movie?._id);
  };

  const handleCardPointerDown = (e) => {
    if (!showAdminControls) return;
    if (typeof onAdminSelectPointerDown !== 'function') return;
    if (!isPrimaryPointer(e)) return;
    if (isAdminControlTarget(e.target)) return;

    e.preventDefault();
    e.stopPropagation();

    onAdminSelectPointerDown(e, movie?._id);
  };

  const handleCardPointerEnter = (e) => {
    if (adminDraggable) {
      onAdminDragEnter?.(e, movie?._id);
    }

    if (showAdminControls && typeof onAdminSelectPointerEnter === 'function') {
      onAdminSelectPointerEnter(e, movie?._id);
    }
  };

  const handleCardPointerUp = (e) => {
    if (adminDraggable) {
      onAdminDragEnd?.(e);
    }
  };

  const handleLinkClick = (e) => {
    if (showAdminControls) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  if (!movie) return null;

  const badgeTopClass = adminDraggable ? 'top-12' : 'top-2';

  return (
    <article
      className={[
        // z-0 creates a local stacking context so card badges/overlays cannot cover sticky navbar.
        'relative z-0 border border-border p-2 mobile:p-2 hover:scale-95 transitions rounded mobile:rounded-md overflow-hidden group',
        adminDraggable ? 'select-none touch-none' : '',
        showAdminControls ? 'select-none' : '',
        isSelected ? 'ring-2 ring-customPurple' : '',
        className,
      ].join(' ')}
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
      onPointerDown={handleCardPointerDown}
      onPointerEnter={handleCardPointerEnter}
      onPointerUp={handleCardPointerUp}
      onPointerCancel={handleCardPointerUp}
    >
      {adminDraggable ? (
        <button
          data-admin-control="true"
          type="button"
          onPointerDown={handleAdminDragPointerDown}
          className="absolute top-2 left-2 z-30 w-9 h-9 flex items-center justify-center rounded-md bg-customPurple/90 hover:bg-customPurple text-white border border-white/10 shadow cursor-grab active:cursor-grabbing"
          title="Drag to reorder"
          aria-label="Drag to reorder"
        >
          <FaGripVertical className="text-sm" />
        </button>
      ) : null}

      {showAdminControls && (
        <div
          data-admin-control="true"
          className="absolute top-2 right-2 z-30 flex items-center gap-1"
        >
          <input
            data-admin-control="true"
            type="checkbox"
            checked={!!isSelected}
            onChange={handleSelectToggle}
            onClick={(e) => e.stopPropagation()}
            className="w-4 h-4 accent-customPurple cursor-pointer"
            title="Select for bulk action"
          />

          {canShowDropdown && (
            <div data-admin-control="true" className="relative" ref={dropdownRef}>
              <button
                data-admin-control="true"
                type="button"
                onClick={toggleDropdown}
                className="w-7 h-7 flex items-center justify-center bg-main/80 hover:bg-customPurple rounded text-white text-xs border border-border"
                title="Move / Add"
              >
                <TbChevronDown
                  className={`transition-transform ${dropdownOpen ? 'rotate-180' : ''
                    }`}
                />
              </button>

              {dropdownOpen && (
                <div
                  data-admin-control="true"
                  className="absolute right-0 top-full mt-1 bg-dry border border-border rounded shadow-lg z-40 min-w-[150px] max-h-56 overflow-y-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  {typeof onMoveToBannerClick === 'function' && (
                    <>
                      <button
                        data-admin-control="true"
                        type="button"
                        onClick={pickBanner}
                        className="block w-full text-left text-xs px-3 py-2 hover:bg-customPurple text-white transitions"
                      >
                        Banner
                      </button>
                      <div className="border-t border-border" />
                    </>
                  )}

                  {typeof onMoveToLatestNewClick === 'function' && (
                    <>
                      <button
                        data-admin-control="true"
                        type="button"
                        onClick={pickLatestNew}
                        className="block w-full text-left text-xs px-3 py-2 hover:bg-customPurple text-white transitions"
                      >
                        Latest New
                      </button>
                      <div className="border-t border-border" />
                    </>
                  )}

                  {pagesList.length > 0 &&
                    pagesList.map((p) => (
                      <button
                        data-admin-control="true"
                        key={p}
                        type="button"
                        onClick={(e) => pickPage(e, p)}
                        className="block w-full text-left text-xs px-3 py-2 hover:bg-customPurple text-white transitions"
                      >
                        Page {p}
                      </button>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {movie?.thumbnailInfo ? (
        <div
          className={`absolute ${badgeTopClass} left-2 bg-customPurple text-white text-[10px] px-2 py-0.5 rounded-sm font-semibold z-20 max-w-[90%] truncate whitespace-nowrap overflow-hidden`}
          title={movie.thumbnailInfo}
        >
          {movie.thumbnailInfo}
        </div>
      ) : null}

      <Link
        href={href}
        prefetch={false}
        draggable={false}
        onClick={handleLinkClick}
        onMouseEnter={prefetchThis}
        onTouchStart={prefetchThis}
        className="block"
      >
        <div className="relative w-full aspect-[2/3] mobile:aspect-[100/154] bg-black rounded-sm overflow-hidden">
          <SafeImage
            src={movie?.titleImage}
            fallbackCandidates={[movie?.image, '/images/placeholder.jpg']}
            alt={movie?.name || 'Movie poster'}
            fill
            quality={65}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            className="object-cover"
            draggable={false}
          />
        </div>

        <div className="absolute flex items-center justify-between gap-2 bottom-0 right-0 left-0 bg-main/60 text-white px-4 mobile:px-1 py-2 h-12">
          <h3
            className="font-semibold text-xs mobile:pl-1 mobile:text-[11px] line-clamp-2 flex-grow mr-2"
            title={movie?.name}
          >
            {movie?.name}
          </h3>

          {showLike ? (
            <button
              data-admin-control="true"
              onClick={handleLike}
              disabled={liked || liking}
              className={`mobile:hidden h-7 w-7 flex-colo border-2 border-customPurple rounded px-2 py-1 text-white transitions flex-shrink-0 ${liked
                  ? 'bg-transparent'
                  : 'bg-customPurple hover:bg-transparent'
                } ${liking ? 'opacity-60 cursor-wait' : ''}`}
              type="button"
              aria-label={liked ? 'Already in favorites' : 'Add to favorites'}
              title={liked ? 'In favorites' : 'Add to favorites'}
            >
              {liking ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <FaHeart className="w-3 h-3" />
              )}
            </button>
          ) : null}
        </div>
      </Link>
    </article>
  );
}

export default memo(MovieCard);
