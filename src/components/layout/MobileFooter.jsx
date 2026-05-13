'use client';

import React, { Suspense, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';

import { BsCollectionPlay } from 'react-icons/bs';
import { CgMenuBoxed } from 'react-icons/cg';
import { BiHomeAlt, BiCategory } from 'react-icons/bi';
import { IoClose } from 'react-icons/io5';
import { MdLiveTv } from 'react-icons/md';
import { FaRegNewspaper } from 'react-icons/fa';

import { SidebarContext } from '../../context/DrawerContext';
import { getUserInfo } from '../../lib/client/auth';

import {
  OPEN_NOTIFICATIONS_PANEL,
  OPEN_WATCH_REQUEST_POPUP,
  PUSH_RECEIVED_EVENT,
} from '../../lib/events';

const MenuDrawer = dynamic(() => import('../drawer/MenuDrawer'), {
  ssr: false,
});

const loadNotificationsApi = () => import('../../lib/client/notifications');
const loadWatchRequestsApi = () => import('../../lib/client/watchRequests');
const loadPushApi = () => import('../../lib/client/pushNotifications');

function MobileFooterInner() {
  const router = useRouter();
  const pathname = usePathname() || '/';
  const searchParams = useSearchParams();

  const typeParam = String(searchParams?.get('type') || '')
    .toLowerCase()
    .replace(/[-\s]+/g, '');

  const isWebSeriesTypePage = pathname.startsWith('/movies/type/web-series');

  const isTvShowsType =
    isWebSeriesTypePage ||
    typeParam === 'webseries' ||
    typeParam === 'tvshows' ||
    typeParam === 'series';

  const {
    mobileDrawer,
    toggleDrawer,
    closeDrawer,

    activeMobileTab,
    setActiveMobileTab,
    setActiveMobileHomeTab,
  } = useContext(SidebarContext);

  const [userInfo, setUserInfoState] = useState(null);
  const token = userInfo?.token || null;
  const isAdmin = !!userInfo?.isAdmin;

  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);

  const [replyOpenId, setReplyOpenId] = useState(null);
  const [replyLink, setReplyLink] = useState('');
  const [replyMessage, setReplyMessage] = useState('');
  const [replyLoading, setReplyLoading] = useState(false);

  const isHomePage = pathname === '/';
  const isMoviesPage = pathname.startsWith('/movies');
  const isBlogPage = pathname === '/blog' || pathname.startsWith('/blog/');

  useEffect(() => {
    setUserInfoState(getUserInfo());
    const onStorage = () => setUserInfoState(getUserInfo());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const closeNotifications = useCallback(() => {
    setNotifyOpen(false);
    setReplyOpenId(null);
    setReplyLink('');
    setReplyMessage('');
  }, []);

  const closeAllOverlays = useCallback(() => {
    closeNotifications();
    closeDrawer?.();
  }, [closeDrawer, closeNotifications]);

  useEffect(() => {
    if (!notifyOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [notifyOpen]);

  useEffect(() => {
    if (!token) closeNotifications();
  }, [token, closeNotifications]);

  const refreshNotifications = useCallback(
    async (silent = true) => {
      if (!token) return;

      try {
        if (!silent) setNotifLoading(true);

        const { getNotifications } = await loadNotificationsApi();
        const data = await getNotifications(token, 50);

        setNotifications(data?.notifications || []);
      } catch (e) {
        if (!silent) toast.error(e?.message || 'Failed to load notifications');
      } finally {
        if (!silent) setNotifLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    if (!token || !notifyOpen) return;

    const handler = () => {
      refreshNotifications(true).catch(() => { });
    };

    window.addEventListener(PUSH_RECEIVED_EVENT, handler);
    return () => window.removeEventListener(PUSH_RECEIVED_EVENT, handler);
  }, [token, notifyOpen, refreshNotifications]);

  const openWatchRequestPopup = () => {
    closeAllOverlays();
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

  useEffect(() => {
    const handler = async () => {
      if (mobileDrawer) closeDrawer?.();

      if (!token) {
        toast.error('Please login to view notifications');
        router.push('/login');
        return;
      }

      await maybePromptPush();
      setNotifyOpen(true);
      await refreshNotifications(false);
    };

    window.addEventListener(OPEN_NOTIFICATIONS_PANEL, handler);
    return () => window.removeEventListener(OPEN_NOTIFICATIONS_PANEL, handler);
  }, [token, mobileDrawer, closeDrawer, maybePromptPush, refreshNotifications, router]);

  const handleClearNotifications = async () => {
    if (!token) return;

    try {
      const { clearNotifications } = await loadNotificationsApi();
      await clearNotifications(token);
      await refreshNotifications(true);
      closeNotifications();
    } catch (e) {
      toast.error(e?.message || 'Failed to clear notifications');
    }
  };

  const handleRemoveSingleNotification = async (id) => {
    if (!token) return;

    try {
      const { deleteNotification } = await loadNotificationsApi();
      await deleteNotification(token, id);
      await refreshNotifications(true);
    } catch (e) {
      toast.error(e?.message || 'Failed to remove notification');
    }
  };

  const handleNotificationClick = async (notif) => {
    if (!notif) return;

    try {
      if (!notif.read && token) {
        const { markNotificationRead } = await loadNotificationsApi();
        await markNotificationRead(token, notif._id);
      }
    } catch {
      // ignore
    }

    const link = notif.link;
    closeNotifications();

    if (link) {
      if (link.startsWith('http')) window.location.href = link;
      else router.push(link);
    }
  };

  const handleAdminReplyRequest = async (notif) => {
    const requestId = notif?.meta?.requestId;
    if (!requestId) return toast.error('Missing requestId');

    const link = replyLink.trim();
    if (!link) return toast.error('Please paste the movie/web-series link');

    try {
      setReplyLoading(true);

      const { replyToWatchRequest } = await loadWatchRequestsApi();
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

  const sortedNotifications = useMemo(() => {
    return [...(notifications || [])].sort(
      (a, b) =>
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
  }, [notifications]);

  const active = 'bg-customPurple text-white';
  const inActive =
    'transition duration-300 text-lg flex-colo text-white hover:bg-customPurple hover:text-white rounded-md px-2 py-1.5';

  const isHomeActive = isHomePage && activeMobileTab !== 'browseBy';
  const isBrowseByActive = isHomePage && activeMobileTab === 'browseBy';

  const isTvShowsActive = isMoviesPage && isTvShowsType;
  const isMoviesActive = isMoviesPage && !isTvShowsActive;

  const isBlogActive = isBlogPage;

  const handleHomeClick = (e) => {
    e.preventDefault();
    closeAllOverlays();

    setActiveMobileHomeTab('latestNew');
    setActiveMobileTab('home');

    if (isHomePage) {
      window.scrollTo(0, 0);
    } else {
      router.push('/');
    }
  };

  const handleBrowseByClick = (e) => {
    e.preventDefault();
    closeAllOverlays();

    setActiveMobileTab('browseBy');

    if (isHomePage) {
      window.scrollTo(0, 0);
    } else {
      router.push('/');
    }
  };

  const handleMoviesClick = (e) => {
    e.preventDefault();
    closeAllOverlays();
    router.push('/movies?type=Movie');
  };

  const handleTvShowsClick = (e) => {
    e.preventDefault();
    closeAllOverlays();
    router.push('/movies?type=WebSeries');
  };

  const handleBlogClick = (e) => {
    e.preventDefault();
    closeAllOverlays();
    router.push('/blog');
  };

  const handleMenuClick = () => {
    closeNotifications();
    toggleDrawer?.();
  };

  return (
    <>
      {mobileDrawer ? (
        <MenuDrawer drawerOpen={mobileDrawer} toggleDrawer={toggleDrawer} />
      ) : null}

      {notifyOpen ? (
        <div className="fixed inset-0 z-[60]" onClick={closeNotifications} aria-modal="true" role="dialog">
          <div className="absolute inset-0 bg-black/60" />

          <div
            className="absolute left-2 right-2 bottom-20 bg-black border border-customPurple rounded-lg shadow-xl z-[61] p-2 max-h-[70vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-2 py-1 gap-2">
              <h4 className="text-sm font-semibold text-white">Notifications</h4>

              <div className="flex items-center gap-2 flex-wrap justify-end">
                {!isAdmin ? (
                  <button
                    onClick={openWatchRequestPopup}
                    className="text-xs text-customPurple hover:underline"
                    type="button"
                  >
                    Request Movie
                  </button>
                ) : null}

                {sortedNotifications.length > 0 ? (
                  <button
                    onClick={handleClearNotifications}
                    className="text-xs text-subMain hover:underline"
                    type="button"
                  >
                    Clear all
                  </button>
                ) : null}

                <button
                  onClick={closeNotifications}
                  className="text-gray-300 hover:text-white"
                  aria-label="Close notifications"
                  type="button"
                >
                  <IoClose size={18} />
                </button>
              </div>
            </div>

            {notifLoading ? (
              <p className="text-xs text-border px-2 py-2">Loading...</p>
            ) : null}

            {!notifLoading && sortedNotifications.length === 0 ? (
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
            ) : null}

            {!notifLoading &&
              sortedNotifications.map((notif) => (
                <div
                  key={notif._id}
                  className={`text-white px-2 py-2 border border-gray-700 rounded-md mb-2 last:mb-0 ${!notif.read ? 'bg-gray-800/50' : 'bg-transparent'
                    }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <button
                      type="button"
                      onClick={() => handleNotificationClick(notif)}
                      className={`text-left flex-1 ${notif.read ? 'opacity-70' : ''}`}
                    >
                      {notif.title ? (
                        <p className="text-xs font-semibold mb-1">{notif.title}</p>
                      ) : null}
                      <p className="text-sm">{notif.message}</p>
                    </button>

                    <button
                      onClick={() => handleRemoveSingleNotification(notif._id)}
                      className="p-1 text-gray-300 hover:text-red-500"
                      title="Remove notification"
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
                          setReplyOpenId((prev) => (prev === notif._id ? null : notif._id));
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
                            onChange={(e) => setReplyMessage(e.target.value)}
                            placeholder="Optional message to user"
                            className="w-full bg-main border border-border rounded px-2 py-2 text-xs outline-none focus:border-customPurple"
                          />
                          <button
                            onClick={() => handleAdminReplyRequest(notif)}
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
              ))}
          </div>
        </div>
      ) : null}

      <footer className="lg:hidden fixed z-50 bottom-0 w-full px-1">
        <div className="bg-dry rounded-md flex-btn w-full p-1">
          <button
            onClick={handleHomeClick}
            className={isHomeActive ? `${active} ${inActive}` : inActive}
            aria-label="Home"
            type="button"
          >
            <div className="flex flex-col items-center">
              <BiHomeAlt className="text-lg" />
              <span className="text-[9px] mt-0.5">Home</span>
            </div>
          </button>

          <button
            onClick={handleBrowseByClick}
            className={isBrowseByActive ? `${active} ${inActive}` : inActive}
            aria-label="Browse By"
            type="button"
          >
            <div className="flex flex-col items-center">
              <BiCategory className="text-lg" />
              <span className="text-[9px] mt-0.5">BrowseBy</span>
            </div>
          </button>

          <button
            onClick={handleMoviesClick}
            className={isMoviesActive ? `${active} ${inActive}` : inActive}
            aria-label="Movies"
            type="button"
          >
            <div className="flex flex-col items-center">
              <BsCollectionPlay className="text-lg" />
              <span className="text-[9px] mt-0.5">Movies</span>
            </div>
          </button>

          <button
            onClick={handleTvShowsClick}
            className={isTvShowsActive ? `${active} ${inActive}` : inActive}
            aria-label="Tv Shows"
            type="button"
          >
            <div className="flex flex-col items-center">
              <MdLiveTv className="text-lg" />
              <span className="text-[9px] mt-0.5">Tv Shows</span>
            </div>
          </button>

          <button
            onClick={handleBlogClick}
            className={isBlogActive ? `${active} ${inActive}` : inActive}
            aria-label="Blog"
            type="button"
          >
            <div className="flex flex-col items-center">
              <FaRegNewspaper className="text-lg" />
              <span className="text-[9px] mt-0.5">Blog</span>
            </div>
          </button>

          <button
            onClick={handleMenuClick}
            className={inActive}
            aria-label="Menu"
            type="button"
          >
            <div className="flex flex-col items-center">
              <CgMenuBoxed className="text-lg" />
              <span className="text-[9px] mt-0.5">Menu</span>
            </div>
          </button>
        </div>
      </footer>
    </>
  );
}

export default function MobileFooter() {
  return (
    <Suspense fallback={null}>
      <MobileFooterInner />
    </Suspense>
  );
}
