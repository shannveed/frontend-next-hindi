// frontend-next/src/components/layout/NavBar.jsx
'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Image from 'next/image';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

import { CgUser } from 'react-icons/cg';
import { FaBell, FaHeart, FaSearch } from 'react-icons/fa';
import { IoClose } from 'react-icons/io5';

import { getUserInfo } from '../../lib/client/auth';
import { getFavoriteIdsCache } from '../../lib/client/favoritesCache';
import {
  FAVORITES_UPDATED_EVENT,
  OPEN_WATCH_REQUEST_POPUP,
  PUSH_RECEIVED_EVENT,
} from '../../lib/events';
import {
  INDUSTRY_PAGES,
  findIndustryByBrowseByQuery,
} from '../../lib/discoveryPages';

const DEFAULT_PROFILE_IMAGE = '/images/placeholder.jpg';

const BROWSEBY_CACHE_KEY = 'mf_browseByDistinct_cache_v1';
const BROWSEBY_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const readBrowseByCache = () => {
  if (typeof window === 'undefined') return { list: [], stale: true };

  try {
    const raw = sessionStorage.getItem(BROWSEBY_CACHE_KEY);
    if (!raw) return { list: [], stale: true };

    const parsed = JSON.parse(raw);
    const ts = Number(parsed?.ts || 0);
    const list = Array.isArray(parsed?.list) ? parsed.list : [];
    const stale = !ts || Date.now() - ts > BROWSEBY_CACHE_TTL_MS;

    return { list, stale };
  } catch {
    return { list: [], stale: true };
  }
};

const writeBrowseByCache = (list) => {
  if (typeof window === 'undefined') return;

  try {
    sessionStorage.setItem(
      BROWSEBY_CACHE_KEY,
      JSON.stringify({ ts: Date.now(), list })
    );
  } catch {
    // ignore
  }
};

const normalizeAvatarUrl = (value) => {
  const v = String(value ?? '').trim();
  if (!v) return '';
  const lower = v.toLowerCase();
  if (lower === 'null' || lower === 'undefined') return '';
  return v;
};

const normalizeKey = (value = '') => String(value || '').trim().toLowerCase();

const loadNotificationsApi = () => import('../../lib/client/notifications');
const loadWatchRequestApi = () => import('../../lib/client/watchRequests');
const loadPushApi = () => import('../../lib/client/pushNotifications');
const loadUsersApi = () => import('../../lib/client/users');

const industryPageToItem = (page) => ({
  label: page.label,
  href: `/industry/${page.slug}`,
});

const INDIAN_FALLBACK_SLUGS = new Set([
  'bollywood',
  'bollywood-web-series',
  'south-indian-hindi-dubbed',
  'punjabi-movies',
]);

const contactMenuItems = [
  { label: 'Contact Us', href: '/contact-us' },
  { label: 'DMCA', href: '/dmca' },
  { label: 'Privacy Policy', href: '/privacy-policy' },
  { label: 'Terms of Service', href: '/terms-of-service' },
];

export default function NavBar() {
  const router = useRouter();

  const [userInfo, setUserInfo] = useState(null);
  const token = userInfo?.token;
  const isAdmin = !!userInfo?.isAdmin;

  const [favoritesCount, setFavoritesCount] = useState(0);
  const [browseBy, setBrowseBy] = useState([]);

  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  const desktopSearchRef = useRef(null);

  const [notifyOpen, setNotifyOpen] = useState(false);
  const notifyRef = useRef(null);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const [replyOpenId, setReplyOpenId] = useState(null);
  const [replyLink, setReplyLink] = useState('');
  const [replyMessage, setReplyMessage] = useState('');
  const [replyLoading, setReplyLoading] = useState(false);

  useEffect(() => {
    setUserInfo(getUserInfo());
    const onStorage = () => setUserInfo(getUserInfo());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    const onDown = (e) => {
      if (
        desktopSearchRef.current &&
        !desktopSearchRef.current.contains(e.target)
      ) {
        setShowDropdown(false);
      }

      if (notifyRef.current && !notifyRef.current.contains(e.target)) {
        setNotifyOpen(false);
        setReplyOpenId(null);
        setReplyLink('');
        setReplyMessage('');
      }
    };

    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  useEffect(() => {
    const cached = readBrowseByCache();
    if (cached.list?.length) setBrowseBy(cached.list);

    const shouldFetch = cached.stale || !cached.list?.length;
    if (!shouldFetch) return;

    let cancelled = false;
    const controller = new AbortController();

    const run = async () => {
      try {
        const res = await fetch('/api/movies/browseBy-distinct', {
          cache: 'force-cache',
          signal: controller.signal,
        });

        const data = await res.json().catch(() => []);
        const list = Array.isArray(data) ? data : [];

        if (cancelled) return;

        setBrowseBy(list);
        writeBrowseByCache(list);
      } catch {
        // ignore
      }
    };

    let timerId = null;
    let idleId = null;

    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(() => {
        run().catch(() => { });
      }, { timeout: 1500 });
    } else {
      timerId = window.setTimeout(() => {
        run().catch(() => { });
      }, 800);
    }

    return () => {
      cancelled = true;
      controller.abort();

      if (timerId) window.clearTimeout(timerId);
      if (
        idleId !== null &&
        typeof window.cancelIdleCallback === 'function'
      ) {
        window.cancelIdleCallback(idleId);
      }
    };
  }, []);

  useEffect(() => {
    const syncFromCache = () => setFavoritesCount(getFavoriteIdsCache().length);

    syncFromCache();
    window.addEventListener(FAVORITES_UPDATED_EVENT, syncFromCache);

    return () => {
      window.removeEventListener(FAVORITES_UPDATED_EVENT, syncFromCache);
    };
  }, []);

  useEffect(() => {
    if (!token) {
      setFavoritesCount(0);
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        const { getFavorites } = await loadUsersApi();
        const favs = await getFavorites(token);

        if (cancelled) return;

        setFavoritesCount(
          Array.isArray(favs) ? favs.length : getFavoriteIdsCache().length
        );
      } catch {
        // ignore
      }
    };

    let timerId = null;
    let idleId = null;

    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(() => {
        run().catch(() => { });
      }, { timeout: 2000 });
    } else {
      timerId = window.setTimeout(() => {
        run().catch(() => { });
      }, 1200);
    }

    return () => {
      cancelled = true;

      if (timerId) window.clearTimeout(timerId);
      if (
        idleId !== null &&
        typeof window.cancelIdleCallback === 'function'
      ) {
        window.cancelIdleCallback(idleId);
      }
    };
  }, [token]);

  const refreshNotifications = useCallback(
    async (silent = true) => {
      if (!token) return;

      try {
        if (!silent) setNotifLoading(true);

        const { getNotifications } = await loadNotificationsApi();
        const data = await getNotifications(token, 50);

        setNotifications(data?.notifications || []);
        setUnreadCount(data?.unreadCount || 0);
      } catch (e) {
        if (!silent) toast.error(e?.message || 'Failed to load notifications');
      } finally {
        if (!silent) setNotifLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    if (!token) {
      setNotifications([]);
      setUnreadCount(0);
      setNotifyOpen(false);
      return;
    }

    let cancelled = false;
    let intervalId = null;
    let timerId = null;
    let idleId = null;

    const start = async () => {
      if (cancelled) return;

      await refreshNotifications(true);

      if (!cancelled) {
        intervalId = window.setInterval(() => {
          refreshNotifications(true);
        }, 30000);
      }
    };

    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(() => {
        start().catch(() => { });
      }, { timeout: 2000 });
    } else {
      timerId = window.setTimeout(() => {
        start().catch(() => { });
      }, 1200);
    }

    return () => {
      cancelled = true;

      if (intervalId) clearInterval(intervalId);
      if (timerId) window.clearTimeout(timerId);

      if (
        idleId !== null &&
        typeof window.cancelIdleCallback === 'function'
      ) {
        window.cancelIdleCallback(idleId);
      }
    };
  }, [token, refreshNotifications]);

  useEffect(() => {
    if (!token) return;

    const handler = () => {
      refreshNotifications(true).catch(() => { });
    };

    window.addEventListener(PUSH_RECEIVED_EVENT, handler);
    return () => window.removeEventListener(PUSH_RECEIVED_EVENT, handler);
  }, [token, refreshNotifications]);

  useEffect(() => {
    const term = search.trim();

    if (term.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    const controller = new AbortController();

    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/movies?search=${encodeURIComponent(term)}&pageNumber=1`,
          { signal: controller.signal }
        );

        const data = await res.json();
        const list = Array.isArray(data?.movies) ? data.movies : [];
        setSearchResults(list.slice(0, 5));
        setShowDropdown(true);
      } catch {
        // ignore
      }
    }, 200);

    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [search]);

  const openWatchRequestPopup = () => {
    setNotifyOpen(false);
    window.dispatchEvent(new Event(OPEN_WATCH_REQUEST_POPUP));
  };

  const maybePromptPush = useCallback(async () => {
    if (!token) return;

    try {
      const {
        isPushSupported,
        ensurePushSubscription,
        requestPermissionAndSubscribe,
      } = await loadPushApi();

      if (!isPushSupported()) return;

      if (Notification.permission === 'granted') {
        await ensurePushSubscription(token);
      } else if (Notification.permission === 'default') {
        const key = 'pushPermissionPrompted';
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, '1');
          await requestPermissionAndSubscribe(token);
        }
      }
    } catch (e) {
      console.warn('[push] enable failed:', e);
    }
  }, [token]);

  const onBellClick = async () => {
    if (!token) {
      toast.error('Please login to view notifications');
      router.push('/login');
      return;
    }

    await maybePromptPush();

    const next = !notifyOpen;
    setNotifyOpen(next);

    if (next) {
      await refreshNotifications(false);
    }
  };

  const handleNotificationClick = async (notif) => {
    try {
      if (!notif?.read && token) {
        const { markNotificationRead } = await loadNotificationsApi();
        await markNotificationRead(token, notif._id);
      }
    } catch {
      // ignore
    }

    const link = notif?.link;
    setNotifyOpen(false);

    if (!link) return;

    if (link.startsWith('http')) window.location.href = link;
    else router.push(link);
  };

  const handleRemoveNotification = async (id) => {
    if (!token) return;

    try {
      const { deleteNotification } = await loadNotificationsApi();
      await deleteNotification(token, id);
      await refreshNotifications(true);
    } catch (e) {
      toast.error(e?.message || 'Failed to remove');
    }
  };

  const handleClearAll = async () => {
    if (!token) return;

    try {
      const { clearNotifications } = await loadNotificationsApi();
      await clearNotifications(token);
      await refreshNotifications(true);
    } catch (e) {
      toast.error(e?.message || 'Failed to clear');
    }
  };

  const handleAdminReply = async (notif) => {
    const requestId = notif?.meta?.requestId;
    if (!requestId) return toast.error('Missing requestId');

    const link = replyLink.trim();
    if (!link) return toast.error('Paste movie link');

    try {
      setReplyLoading(true);

      const { replyToWatchRequest } = await loadWatchRequestApi();
      await replyToWatchRequest(token, requestId, {
        link,
        message: replyMessage.trim(),
      });

      toast.success('Reply sent');
      setReplyOpenId(null);
      setReplyLink('');
      setReplyMessage('');
      await refreshNotifications(true);
    } catch (e) {
      toast.error(e?.message || 'Reply failed');
    } finally {
      setReplyLoading(false);
    }
  };

  const hollywoodBrowseBy = useMemo(
    () =>
      (browseBy || []).filter((x) =>
        x ? String(x).toLowerCase().includes('hollywood') : false
      ),
    [browseBy]
  );

  const indianBrowseBy = useMemo(
    () =>
      (browseBy || []).filter((x) => {
        const v = String(x || '').toLowerCase();
        return v.includes('bollywood') || v.includes('indian');
      }),
    [browseBy]
  );

  const leftoverBrowseBy = useMemo(() => {
    const h = new Set(hollywoodBrowseBy);
    const i = new Set(indianBrowseBy);
    return (browseBy || []).filter((x) => x && !h.has(x) && !i.has(x));
  }, [browseBy, hollywoodBrowseBy, indianBrowseBy]);

  const buildBrowseMenuItems = useCallback((values = [], fallbackPages = []) => {
    const seen = new Set();
    const out = [];

    for (const raw of values || []) {
      const value = String(raw || '').trim();
      if (!value) continue;

      const industry = findIndustryByBrowseByQuery(value);
      const href = industry
        ? `/industry/${industry.slug}`
        : `/movies?browseBy=${encodeURIComponent(value)}`;
      const label = industry?.label || value;

      if (seen.has(href)) continue;
      seen.add(href);
      out.push({ label, href });
    }

    if (out.length) return out;

    return (fallbackPages || []).map(industryPageToItem);
  }, []);

  const hollywoodMenuItems = useMemo(
    () =>
      buildBrowseMenuItems(
        hollywoodBrowseBy,
        INDUSTRY_PAGES.filter((page) => page.slug.startsWith('hollywood'))
      ),
    [hollywoodBrowseBy, buildBrowseMenuItems]
  );

  const indianMenuItems = useMemo(
    () =>
      buildBrowseMenuItems(
        indianBrowseBy,
        INDUSTRY_PAGES.filter((page) => INDIAN_FALLBACK_SLUGS.has(page.slug))
      ),
    [indianBrowseBy, buildBrowseMenuItems]
  );

  const browseMenuItems = useMemo(
    () =>
      buildBrowseMenuItems(
        leftoverBrowseBy,
        INDUSTRY_PAGES.filter(
          (page) =>
            !page.slug.startsWith('hollywood') &&
            !INDIAN_FALLBACK_SLUGS.has(page.slug)
        )
      ),
    [leftoverBrowseBy, buildBrowseMenuItems]
  );

  const avatarSrc = useMemo(() => {
    return normalizeAvatarUrl(userInfo?.image) || DEFAULT_PROFILE_IMAGE;
  }, [userInfo?.image]);

  const hover = 'hover:text-customPurple transitions text-white';

  return (
    <div className="bg-main shadow-md sticky top-0 z-20 hidden lg:block">
      <div className="container py-6 above-1000:py-4 px-8 lg:grid gap-10 above-1000:gap-8 grid-cols-7 justify-between items-center">
        <div className="col-span-1">
          <Link
            href="/"
            className="inline-flex items-center min-h-[40px]"
            aria-label="MovieFrost Home"
          >
            <Image
              src="/images/MOVIEFROST.png"
              alt="MovieFrost"
              width={140}
              height={40}
              priority
              sizes="180px"
              className="h-8 w-auto max-w-[180px] object-contain"
            />
          </Link>
        </div>

        <div className="col-span-2 relative" ref={desktopSearchRef}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const term = search.trim();

              if (!term) {
                router.push('/movies');
                setShowDropdown(false);
                return;
              }

              router.push(`/movies?search=${encodeURIComponent(term)}`);
              setShowDropdown(false);
            }}
            className="w-full text-sm bg-black rounded flex-btn gap-4 border-2 border-customPurple"
          >
            <button
              type="submit"
              className="bg-customPurple w-10 flex-colo h-9 rounded-sm text-white"
              aria-label="Search movies"
            >
              <FaSearch />
            </button>

            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Movie Name"
              className="font-medium placeholder:text-border text-xs w-11/12 h-9 bg-transparent border-none px-2 text-white"
            />

            {search ? (
              <button
                type="button"
                className="pr-2 text-customPurple hover:text-white"
                onClick={() => {
                  setSearch('');
                  setSearchResults([]);
                  setShowDropdown(false);
                  router.push('/movies');
                }}
                aria-label="Clear search"
              >
                <IoClose size={20} />
              </button>
            ) : null}
          </form>

          {showDropdown && searchResults.length > 0 ? (
            <div className="absolute left-0 right-0 top-full mt-1 bg-dry border border-border rounded-md shadow-lg z-50 max-h-96 overflow-y-auto">
              {searchResults.map((m) => (
                <Link
                  key={m._id}
                  href={`/movie/${m.slug || m._id}`}
                  onClick={() => {
                    setShowDropdown(false);
                    setSearch('');
                  }}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-main transitions border-b border-border/50 last:border-b-0"
                >
                  <div className="w-10 h-14 flex-shrink-0 rounded overflow-hidden bg-main">
                    <img
                      src={m?.titleImage || '/images/placeholder.jpg'}
                      alt={m?.name || 'Movie'}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = '/images/placeholder.jpg';
                      }}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">
                      {m.name}
                    </p>
                    <p className="text-xs text-dryGray truncate">
                      {m.year} • {m.category}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : null}
        </div>

        <div className="col-span-4 font-medium text-xs xl:gap-6 2xl:gap-10 justify-between items-center hidden lg:flex">
          <Link href="/movies?type=Movie" className={hover}>
            Movies
          </Link>

          <Link href="/movies?type=WebSeries" className={hover}>
            Tv Shows
          </Link>

          <div className="relative group">
            <button className={`${hover} inline-flex items-center`} type="button">
              Hollywood
            </button>

            <div className="absolute left-0 top-full bg-black text-white min-w-[220px] p-2 rounded shadow-md opacity-0 group-hover:opacity-100 invisible group-hover:visible transition-all duration-200 z-50">
              {hollywoodMenuItems.length ? (
                hollywoodMenuItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="block px-3 py-1.5 hover:text-customPurple"
                  >
                    {item.label}
                  </Link>
                ))
              ) : (
                <p className="px-3 py-2 text-sm opacity-80">No Hollywood data</p>
              )}
            </div>
          </div>

          <div className="relative group">
            <button className={`${hover} inline-flex items-center`} type="button">
              Indian
            </button>

            <div className="absolute left-0 top-full bg-black text-white min-w-[220px] p-2 rounded shadow-md opacity-0 group-hover:opacity-100 invisible group-hover:visible transition-all duration-200 z-50">
              {indianMenuItems.length ? (
                indianMenuItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="block px-3 py-1.5 hover:text-customPurple"
                  >
                    {item.label}
                  </Link>
                ))
              ) : (
                <p className="px-3 py-2 text-sm opacity-80">No Indian data</p>
              )}
            </div>
          </div>

          <div className="relative group">
            <button className={`${hover} inline-flex items-center`} type="button">
              Browse By
            </button>

            <div className="absolute left-0 top-full bg-black text-white min-w-[220px] p-2 rounded shadow-md opacity-0 group-hover:opacity-100 invisible group-hover:visible transition-all duration-200 z-50">
              {browseMenuItems.length ? (
                browseMenuItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="block px-3 py-1.5 hover:text-customPurple"
                  >
                    {item.label}
                  </Link>
                ))
              ) : (
                <p className="px-3 py-2 text-sm opacity-80">No data</p>
              )}
            </div>
          </div>

          <Link href="/blog" className={hover}>
            Blog
          </Link>

          <div className="relative group">
            <button className={`${hover} inline-flex items-center`} type="button">
              Contact
            </button>

            <div className="absolute left-0 top-full bg-black text-white min-w-[220px] p-2 rounded shadow-md opacity-0 group-hover:opacity-100 invisible group-hover:visible transition-all duration-200 z-50">
              {contactMenuItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block px-3 py-1.5 hover:text-customPurple"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="relative" ref={notifyRef}>
            <button
              className="relative flex items-center justify-center"
              onClick={onBellClick}
              aria-label="Notifications"
              type="button"
            >
              <FaBell className="w-5 h-5 text-white" />
              {unreadCount > 0 ? (
                <span className="w-4 h-4 flex-colo rounded-full text-[11px] bg-customPurple text-white absolute -top-2 -right-2.5">
                  {unreadCount}
                </span>
              ) : null}
            </button>

            {notifyOpen ? (
              <div className="absolute right-0 mt-2 w-96 bg-black border border-customPurple rounded shadow-xl z-50 p-2 max-h-96 overflow-y-auto">
                <div className="flex items-center justify-between px-2 mb-2 gap-2">
                  <h4 className="text-sm font-semibold text-white">
                    Notifications
                  </h4>

                  <div className="flex items-center gap-3">
                    {!isAdmin ? (
                      <button
                        onClick={openWatchRequestPopup}
                        className="text-xs text-customPurple hover:underline"
                        type="button"
                      >
                        Request Movie
                      </button>
                    ) : null}

                    {notifications.length > 0 ? (
                      <button
                        onClick={handleClearAll}
                        className="text-xs text-subMain hover:underline"
                        type="button"
                      >
                        Clear all
                      </button>
                    ) : null}
                  </div>
                </div>

                {notifLoading ? (
                  <p className="text-xs text-border px-2 py-2">Loading...</p>
                ) : notifications.length === 0 ? (
                  <div className="px-2 py-2">
                    <p className="text-sm text-border mb-2">No notifications</p>

                    {!isAdmin ? (
                      <button
                        onClick={openWatchRequestPopup}
                        className="w-full border border-customPurple text-customPurple hover:bg-customPurple hover:text-white transitions rounded py-2 text-sm"
                        type="button"
                      >
                        Request a Movie / Web‑Series
                      </button>
                    ) : null}
                  </div>
                ) : (
                  [...notifications]
                    .sort(
                      (a, b) =>
                        new Date(b.createdAt || 0).getTime() -
                        new Date(a.createdAt || 0).getTime()
                    )
                    .map((notif) => (
                      <div
                        key={notif._id}
                        className={`text-sm text-white px-2 py-2 border-b border-gray-700 last:border-b-0 group ${!notif.read ? 'bg-gray-800/50' : ''
                          }`}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <button
                            type="button"
                            onClick={() => handleNotificationClick(notif)}
                            className={`text-left flex-grow ${notif.read ? 'opacity-70' : ''
                              }`}
                          >
                            {notif.title ? (
                              <p className="text-xs font-semibold text-white mb-1">
                                {notif.title}
                              </p>
                            ) : null}
                            <p className="text-sm">{notif.message}</p>
                          </button>

                          <button
                            onClick={() => handleRemoveNotification(notif._id)}
                            className="text-xs text-gray-500 hover:text-red-500 ml-2 pt-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            aria-label="Remove notification"
                            type="button"
                          >
                            <IoClose size={14} />
                          </button>
                        </div>

                        {isAdmin && notif.type === 'watch_request' ? (
                          <div className="mt-2">
                            <button
                              onClick={() => {
                                setReplyOpenId((prev) =>
                                  prev === notif._id ? null : notif._id
                                );
                                setReplyLink('');
                                setReplyMessage('');
                              }}
                              className="text-xs text-customPurple hover:underline"
                              type="button"
                            >
                              {replyOpenId === notif._id ? 'Close Reply' : 'Reply'}
                            </button>

                            {replyOpenId === notif._id ? (
                              <div className="mt-2 space-y-2">
                                <input
                                  value={replyLink}
                                  onChange={(e) => setReplyLink(e.target.value)}
                                  placeholder="Paste movie link (https://...)"
                                  className="w-full bg-main border border-border rounded px-2 py-2 text-xs outline-none focus:border-customPurple"
                                />
                                <input
                                  value={replyMessage}
                                  onChange={(e) =>
                                    setReplyMessage(e.target.value)
                                  }
                                  placeholder="Optional message to user"
                                  className="w-full bg-main border border-border rounded px-2 py-2 text-xs outline-none focus:border-customPurple"
                                />
                                <button
                                  onClick={() => handleAdminReply(notif)}
                                  className="w-full bg-customPurple text-white rounded py-2 text-xs disabled:opacity-60"
                                  disabled={replyLoading}
                                  type="button"
                                >
                                  {replyLoading ? 'Sending...' : 'Send'}
                                </button>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ))
                )}
              </div>
            ) : null}
          </div>

          <Link
            href={isAdmin ? '/dashboard' : token ? '/profile' : '/login'}
            className={hover}
            aria-label={token ? `${userInfo?.fullName || 'User'} profile` : 'Login'}
          >
            {token ? (
              <img
                src={avatarSrc}
                alt={userInfo?.fullName || 'Profile'}
                className="w-6 h-6 rounded-full border object-cover border-customPurple"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = DEFAULT_PROFILE_IMAGE;
                }}
              />
            ) : (
              <CgUser className="w-7 h-7" />
            )}
          </Link>

          <Link
            href="/favorites"
            className={`${hover} relative flex items-center justify-center`}
            aria-label="Favorites"
          >
            <FaHeart className="w-5 h-5" />
            <div className="w-4 h-4 flex-colo rounded-full text-[11px] bg-customPurple text-white absolute -top-3 -right-1.5">
              {favoritesCount}
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
