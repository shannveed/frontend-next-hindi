'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FaAngleDown, FaCheck } from 'react-icons/fa';

import {
  LanguageData,
  RatesData,
  TimesData,
  YearData,
  browseByData,
  browseByMovieData,
  browseByWebSeriesData,
} from '../../data/filterData';
import { getDedicatedListingPath } from '../../lib/discoveryPages';

const digitsOnly = (value = '') => String(value || '').replace(/\D/g, '');
const normalizeKey = (value = '') => String(value || '').trim().toLowerCase();

const toStr = (v) => (v === undefined || v === null ? '' : String(v));

const getItemParamValue = (item) => String(item?.value ?? item?.title ?? '').trim();
const getItemTitle = (item) => String(item?.title ?? '').trim();

const findByParam = (items, queryValue, fallback) => {
  const q = normalizeKey(queryValue);
  if (!q) return fallback;

  return (
    items.find((it) => {
      const byValue = normalizeKey(getItemParamValue(it));
      const byTitle = normalizeKey(getItemTitle(it));
      return byValue === q || byTitle === q;
    }) || fallback
  );
};

const findByTitle = (items, title, fallback) => {
  const t = String(title || '');
  return items.find((i) => i?.title === t) || fallback;
};

const findByDigits = (items, digits, fallback) => {
  const d = String(digits || '');
  if (!d) return fallback;
  return items.find((i) => digitsOnly(i?.title) === d) || fallback;
};

const normalizeTypeForBrowse = (typeValue = '') => {
  const t = String(typeValue || '').trim().toLowerCase();
  if (!t) return '';
  if (t === 'movie' || t === 'movies') return 'Movie';
  if (
    t === 'webseries' ||
    t === 'web-series' ||
    t === 'web series' ||
    t === 'tvshows' ||
    t === 'tv-shows' ||
    t === 'tv shows'
  ) {
    return 'WebSeries';
  }
  return '';
};

function Dropdown({ selected, items, onSelect }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
  const closeTimerRef = useRef(null);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const openNow = useCallback(() => {
    clearCloseTimer();
    setOpen(true);
  }, [clearCloseTimer]);

  const closeSoon = useCallback(() => {
    clearCloseTimer();

    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false);
      closeTimerRef.current = null;
    }, 160);
  }, [clearCloseTimer]);

  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        clearCloseTimer();
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handler);

    return () => {
      document.removeEventListener('mousedown', handler);
      clearCloseTimer();
    };
  }, [clearCloseTimer]);

  return (
    <div
      ref={wrapperRef}
      className="relative w-full"
      onMouseEnter={openNow}
      onMouseLeave={closeSoon}
      onFocus={openNow}
    >
      <button
        type="button"
        onClick={() => {
          clearCloseTimer();
          setOpen((p) => !p);
        }}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 bg-dry border border-border rounded px-4 py-3 above-1000:py-2.5 mobile:py-2 text-white text-xs above-1000:text-xs hover:border-customPurple transitions"
      >
        <span className="truncate">{selected?.title || ''}</span>
        <FaAngleDown className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 w-full pt-1 z-[80]">
          <div className="w-full bg-dry border border-border rounded shadow-lg overflow-hidden max-h-72 overflow-y-auto">
            {items.map((item, i) => {
              const active = item?.title === selected?.title;

              return (
                <button
                  type="button"
                  key={`${item?.title || 'item'}-${i}`}
                  onClick={() => {
                    clearCloseTimer();
                    onSelect(item);
                    setOpen(false);
                  }}
                  className={`w-full text-left text-xs py-2 above-1000:py-1.5 mobile:py-1.5 pl-10 above-1000:pl-8 mobile:pl-6 pr-4 above-1000:pr-3 mobile:pr-2 relative transition
                    ${active
                      ? 'font-semibold bg-customPurple text-white'
                      : 'font-normal hover:bg-main/70 text-white'
                    }`}
                >
                  {item?.title}
                  {active && (
                    <span className="absolute left-3 top-1/2 -translate-y-1/2">
                      <FaCheck className="text-white" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function MoviesFilters({ categories = [], browseByDistinct = [], query = {} }) {
  const router = useRouter();

  const typeKey = useMemo(() => normalizeTypeForBrowse(query?.type), [query?.type]);

  const categoryItems = useMemo(() => {
    const cats = Array.isArray(categories) ? categories : [];
    if (!cats.length) return [{ title: 'No category found' }];
    return [{ title: 'All Categories' }, ...cats.map((c) => ({ title: c.title }))];
  }, [categories]);

  const browseItems = useMemo(() => {
    if (typeKey === 'WebSeries') return browseByWebSeriesData;
    if (typeKey === 'Movie') return browseByMovieData;

    const distinct = Array.isArray(browseByDistinct) ? browseByDistinct : [];
    const staticTitles = Array.isArray(browseByData)
      ? browseByData.map((b) => b.title).filter(Boolean)
      : ['Browse By'];

    const seen = new Set(staticTitles.map((s) => normalizeKey(s)));
    const extras = distinct
      .map((s) => String(s || '').trim())
      .filter(Boolean)
      .filter((s) => !seen.has(normalizeKey(s)));

    const titles = [...staticTitles, ...extras];

    const placeholder = 'Browse By';
    const without = titles.filter((t) => t !== placeholder);

    return [{ title: placeholder }, ...without.map((t) => ({ title: t }))];
  }, [typeKey, browseByDistinct]);

  const [category, setCategory] = useState(categoryItems[0] || { title: 'All Categories' });
  const [browseBy, setBrowseBy] = useState(browseItems[0] || { title: 'Browse By' });
  const [language, setLanguage] = useState(LanguageData[0]);
  const [year, setYear] = useState(YearData[0]);
  const [times, setTimes] = useState(TimesData[0]);
  const [rates, setRates] = useState(RatesData[0]);

  const queryKey = useMemo(() => JSON.stringify(query || {}), [query]);

  useEffect(() => {
    const qCategory = toStr(query?.category);
    const qBrowse = toStr(query?.browseBy);
    const qLanguage = toStr(query?.language);
    const qYear = toStr(query?.year);
    const qTime = toStr(query?.time);
    const qRate = toStr(query?.rate);

    setCategory(qCategory ? findByTitle(categoryItems, qCategory, categoryItems[0]) : categoryItems[0]);
    setBrowseBy(qBrowse ? findByParam(browseItems, qBrowse, browseItems[0]) : browseItems[0]);
    setLanguage(qLanguage ? findByTitle(LanguageData, qLanguage, LanguageData[0]) : LanguageData[0]);

    setYear(findByDigits(YearData, qYear, YearData[0]));
    setTimes(findByDigits(TimesData, qTime, TimesData[0]));
    setRates(findByDigits(RatesData, qRate, RatesData[0]));
  }, [queryKey, categoryItems, browseItems]);

  const buildBaseParams = useCallback(() => {
    const params = new URLSearchParams();

    const set = (k, v) => {
      const val = toStr(v).trim();
      if (!val) return;
      params.set(k, val);
    };

    set('type', query?.type);
    set('category', query?.category);
    set('browseBy', query?.browseBy);
    set('language', query?.language);
    set('year', query?.year);
    set('time', query?.time);
    set('rate', query?.rate);
    set('search', query?.search);

    const pn = Number(query?.pageNumber) || 1;
    if (pn > 1) params.set('pageNumber', String(pn));

    return params;
  }, [query]);

  const pushParams = useCallback(
    (mutate) => {
      const params = buildBaseParams();

      params.delete('pageNumber');

      mutate(params);

      const qs = params.toString();
      router.push(qs ? `/movies?${qs}` : '/movies');
      if (typeof window !== 'undefined') window.scrollTo(0, 0);
    },
    [router, buildBaseParams]
  );

  const navigateWithMaybeLandingPage = useCallback(
    (nextPartialQuery, mutateParams) => {
      const nextQuery = {
        ...query,
        ...nextPartialQuery,
        pageNumber: 1,
      };

      const dedicatedPath = getDedicatedListingPath(nextQuery);

      if (dedicatedPath) {
        router.push(dedicatedPath);
        if (typeof window !== 'undefined') window.scrollTo(0, 0);
        return;
      }

      pushParams(mutateParams);
    },
    [query, router, pushParams]
  );

  const selectBrowseBy = (item) => {
    setBrowseBy(item);

    const title = getItemTitle(item);
    const value = getItemParamValue(item);
    const nextBrowseBy = !value || title === 'Browse By' ? '' : value;

    navigateWithMaybeLandingPage(
      { browseBy: nextBrowseBy },
      (params) => {
        if (!nextBrowseBy) params.delete('browseBy');
        else params.set('browseBy', nextBrowseBy);
      }
    );
  };

  const selectCategory = (item) => {
    setCategory(item);

    const t = String(item?.title || '');
    const nextCategory =
      !t || t === 'All Categories' || t === 'No category found' ? '' : t;

    navigateWithMaybeLandingPage(
      { category: nextCategory },
      (params) => {
        if (!nextCategory) params.delete('category');
        else params.set('category', nextCategory);
      }
    );
  };

  const selectLanguage = (item) => {
    setLanguage(item);

    const t = String(item?.title || '');
    const nextLanguage = !t || t === 'Sort By Language' ? '' : t;

    navigateWithMaybeLandingPage(
      { language: nextLanguage },
      (params) => {
        if (!nextLanguage) params.delete('language');
        else params.set('language', nextLanguage);
      }
    );
  };

  const selectYear = (item) => {
    setYear(item);

    const nextYear = digitsOnly(item?.title);

    navigateWithMaybeLandingPage(
      { year: nextYear || '' },
      (params) => {
        if (!nextYear) params.delete('year');
        else params.set('year', nextYear);
      }
    );
  };

  const selectTimes = (item) => {
    setTimes(item);

    const nextTime = digitsOnly(item?.title);

    navigateWithMaybeLandingPage(
      { time: nextTime || '' },
      (params) => {
        if (!nextTime) params.delete('time');
        else params.set('time', nextTime);
      }
    );
  };

  const selectRates = (item) => {
    setRates(item);

    const nextRate = digitsOnly(item?.title);

    navigateWithMaybeLandingPage(
      { rate: nextRate || '' },
      (params) => {
        if (!nextRate) params.delete('rate');
        else params.set('rate', nextRate);
      }
    );
  };

  const filters = [
    { key: 'browseBy', selected: browseBy, items: browseItems, onSelect: selectBrowseBy },
    { key: 'category', selected: category, items: categoryItems, onSelect: selectCategory },
    { key: 'language', selected: language, items: LanguageData, onSelect: selectLanguage },
    { key: 'year', selected: year, items: YearData, onSelect: selectYear },
    { key: 'time', selected: times, items: TimesData, onSelect: selectTimes },
    { key: 'rate', selected: rates, items: RatesData, onSelect: selectRates },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 above-1000:grid-cols-6 gap-3">
      {filters.map((f) => (
        <Dropdown key={f.key} selected={f.selected} items={f.items} onSelect={f.onSelect} />
      ))}
    </div>
  );
}
