"use client";

import { ActionIcon } from "rizzui";
import cn from "@utils/class-names";
import ProfileMenu from "@/layouts/profile-menu";
import HamburgerButton from "@/layouts/hamburger-button";
import Logo from "@components/logo";
import KenyaFlag from "@components/icons/kenya-flag";
import {
  PiSun,
  PiMoon,
  PiMapPinDuotone,
  PiCaretDownBold,
  PiCalendarBlankDuotone,
} from "react-icons/pi";
import { useTheme } from "next-themes";
import HeaderMenuLeft from "@/layouts/lithium/lithium-menu";
import Sidebar from "@/layouts/hydrogen/sidebar";
import StickyHeader from "@/layouts/sticky-header";
import { FilterSelector, selectedMetricAtom, selectedTimeRangeAtom, type TimeRangeOption } from "@/app/components/filter-selector";
import { useSession } from "next-auth/react";
import type { TBmu } from "@repo/nosql/schema/bmu";
import LanguageLink, { getClientLanguage } from "@/app/i18n/language-link";
import { useAtom } from 'jotai';
import { METRIC_OPTIONS } from '@/app/shared/analytics/charts/utils/chart-types';
import { useState, useEffect } from 'react';
import { changeAppLanguage } from '@/app/i18n/language-switcher';
import { USFlag } from "@components/icons/language/USFlag";
import { SWFlag } from "@components/icons/language/SWFlag";
import { useTranslation } from "@/app/i18n/client";
import { useUserPermissions } from "@/app/shared/analytics/core/hooks/use-user-permissions";
import { usePathname } from "next/navigation";

type SerializedBmu = {
  _id: string;
  BMU: string;
  group: string;
}

type CustomSession = {
  user?: {
    bmus?: Omit<TBmu, "lat" | "lng" | "treatments">[];
    userBmu?: SerializedBmu;
  }
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  
  return (
    <ActionIcon
      aria-label="Toggle theme"
      variant="text"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className={cn(
        "h-[34px] w-[34px] shadow backdrop-blur-md dark:bg-gray-100 md:h-9 md:w-9",
        "relative rounded-full text-gray-700 hover:text-gray-1000"
      )}
    >
      {theme === "dark" ? (
        <PiSun className="h-[22px] w-auto" />
      ) : (
        <PiMoon className="h-[22px] w-auto" />
      )}
    </ActionIcon>
  );
}

function ReferenceBMU() {
  const { data: session } = useSession() as { data: CustomSession | null };
  const userBmu = session?.user?.userBmu?.BMU;

  if (!userBmu) return null;

  return (
    <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 rounded-full">
      <PiMapPinDuotone className="h-4 w-4 text-gray-600" />
      <span className="font-medium text-gray-900">{userBmu}</span>
    </div>
  );
}

// Compact Language Switcher
function CompactLanguageSwitcher() {
  const [currentLang, setCurrentLang] = useState(() => getClientLanguage());
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    const handleLanguageChange = (event: CustomEvent) => {
      setCurrentLang(event.detail.language);
    };
    
    window.addEventListener('i18n-language-changed', handleLanguageChange as EventListener);
    return () => {
      window.removeEventListener('i18n-language-changed', handleLanguageChange as EventListener);
    };
  }, []);

  const handleLanguageChange = (newLang: string) => {
    if (newLang === currentLang) return;
    
    // Use client-side only language change (no router needed)
    changeAppLanguage(newLang);
    setCurrentLang(newLang);
    setIsOpen(false);
  };

  if (!mounted) return null;

  const languages = [
    { code: 'en', name: 'EN', icon: <USFlag className="w-4 h-3" /> },
    { code: 'sw', name: 'SW', icon: <SWFlag className="w-4 h-3" /> }
  ];

  const currentLanguage = languages.find(lang => lang.code === currentLang) || languages[0];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 px-2.5 py-1.5 text-sm font-medium rounded-md transition-colors",
          "border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
        )}
      >
        <span className="w-4 h-3 overflow-hidden flex items-center justify-center">
          {currentLanguage.icon}
        </span>
        <span className="hidden sm:inline">{currentLanguage.name}</span>
        <PiCaretDownBold className={cn("h-3 w-3 transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-[1000]" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-900 rounded-md shadow-lg border border-gray-200 dark:border-gray-600 z-[1001] min-w-[100px]">
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors first:rounded-t-md last:rounded-b-md",
                  currentLang === lang.code
                    ? "bg-blue-50 dark:bg-blue-800 text-blue-900 dark:text-blue-200"
                    : "text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                )}
              >
                <span className="w-4 h-3 overflow-hidden flex items-center justify-center">
                  {lang.icon}
                </span>
                <span>{lang.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Time Range Selector
function TimeRangeSelector({ lang }: { lang?: string }) {
  const [selectedTimeRange, setSelectedTimeRange] = useAtom(selectedTimeRangeAtom);
  const [isOpen, setIsOpen] = useState(false);
  
  const clientLang = getClientLanguage();
  const { t, i18n } = useTranslation(clientLang, "common");
  const [currentLang, setCurrentLang] = useState(clientLang);
  
  useEffect(() => {
    const handleLanguageChange = (event: CustomEvent) => {
      setCurrentLang(event.detail.language);
      
      if (i18n.language !== event.detail.language) {
        i18n.changeLanguage(event.detail.language);
      }
    };
    
    window.addEventListener('i18n-language-changed', handleLanguageChange as EventListener);
    return () => {
      window.removeEventListener('i18n-language-changed', handleLanguageChange as EventListener);
    };
  }, [i18n]);

  const timeRangeOptions: { value: TimeRangeOption; label: string; description: string }[] = [
    { value: 'currentMonth', label: t('text-current-month'), description: t('text-current-month-desc') || 'Show data for the current month' },
    { value: '3months', label: t('text-last-3-months'), description: t('text-last-3-months-desc') || 'Show data from the last 3 months' },
    { value: '6months', label: t('text-last-6-months'), description: t('text-last-6-months-desc') || 'Show data from the last 6 months' },
    { value: '1year', label: t('text-last-year'), description: t('text-last-year-desc') || 'Show data from the last 12 months' },
    { value: 'all', label: t('text-all-time'), description: t('text-all-time-desc') || 'Show all available data' },
  ];

  const currentOption = timeRangeOptions.find(opt => opt.value === selectedTimeRange) || timeRangeOptions[2];

  const handleTimeRangeChange = (newRange: TimeRangeOption) => {
    setSelectedTimeRange(newRange);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 px-2.5 py-1.5 text-sm font-medium rounded-md transition-colors",
          "border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
        )}
      >
        <PiCalendarBlankDuotone className="h-4 w-4 text-gray-500" />
        <span className="hidden sm:inline text-gray-700 dark:text-gray-300">{currentOption.label}</span>
        <PiCaretDownBold className={cn("h-3 w-3 transition-transform text-gray-500", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-[1000]" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-900 rounded-md shadow-lg border border-gray-200 dark:border-gray-600 z-[1001] w-64">
            {timeRangeOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => handleTimeRangeChange(option.value)}
                className={cn(
                  "w-full flex flex-col items-start gap-0.5 px-3 py-2 text-sm transition-colors first:rounded-t-md last:rounded-b-md",
                  selectedTimeRange === option.value
                    ? "bg-blue-50 dark:bg-blue-800"
                    : "hover:bg-gray-50 dark:hover:bg-gray-800"
                )}
              >
                <span className={cn(
                  "font-medium",
                  selectedTimeRange === option.value
                    ? "text-blue-900 dark:text-blue-200"
                    : "text-gray-700 dark:text-gray-200"
                )}>
                  {option.label}
                </span>
                <span className={cn(
                  "text-xs",
                  selectedTimeRange === option.value
                    ? "text-blue-700 dark:text-blue-300"
                    : "text-gray-500 dark:text-gray-400"
                )}>
                  {option.description}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Header-optimized metric selector component
function HeaderMetricSelector({ isMobile = false }: { isMobile?: boolean }) {
  const [selectedMetric, setSelectedMetric] = useAtom(selectedMetricAtom);
  const [isMetricOpen, setIsMetricOpen] = useState(false);
  
  const clientLang = getClientLanguage();
  const { t } = useTranslation(clientLang, "common");
  const { isIiaUser } = useUserPermissions();
  
  const selectedMetricOption = METRIC_OPTIONS.find(
    (m) => m.value === selectedMetric
  );
  
  // Filter out area-based metrics for IIA users (they don't make sense for individual fishers)
  const availableMetrics = isIiaUser 
    ? METRIC_OPTIONS.filter((m) => !["mean_effort", "mean_cpua", "mean_rpua"].includes(m.value))
    : METRIC_OPTIONS;
  
  const groupedMetrics = {
    catch: availableMetrics.filter((m) => m.category === "catch"),
    revenue: availableMetrics.filter((m) => m.category === "revenue"),
  };

  // Auto-switch IIA users to a valid metric if they have an invalid one selected
  useEffect(() => {
    if (isIiaUser && ["mean_effort", "mean_cpua", "mean_rpua"].includes(selectedMetric)) {
      // Switch to the first available metric (mean_cpue)
      setSelectedMetric("mean_cpue");
    }
  }, [isIiaUser, selectedMetric, setSelectedMetric]);

  const getDisplayLabel = (option: any) => {
      switch(option.value) {
        case 'mean_effort': return t('text-metrics-effort');
        case 'mean_cpue': return t('text-metrics-catch-rate');
        case 'mean_cpua': return t('text-metrics-catch-density');
        case 'mean_rpue': return t('text-metrics-fisher-revenue');
        case 'mean_rpua': return t('text-metrics-area-revenue');
        case 'mean_cost': return t('text-metrics-trip-costs');
        case 'mean_profit': return t('text-metrics-profit');
        default: return option.label;
      }
    };

    const getUnitDisplay = (unit: string) => {
      // Keep units as they are since they're technical/standard units
      return unit;
    };

    return (
      <div className="relative">
        <button
          onClick={() => setIsMetricOpen(!isMetricOpen)}
          className={cn(
            "flex items-center gap-1 sm:gap-2 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors",
            isMobile ? "px-1.5" : "px-2 sm:px-2.5",
            "border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700",
            selectedMetric === "mean_rpue" || selectedMetric === "mean_rpua" || selectedMetric === "mean_cost" || selectedMetric === "mean_profit"
              ? "text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/50"
              : "text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/50"
          )}
        >
          <span className="truncate">
            {selectedMetricOption ? (isMobile ? getDisplayLabel(selectedMetricOption).split(' ')[0] : getDisplayLabel(selectedMetricOption)) : t('text-metrics-catch')}
          </span>
          <PiCaretDownBold className={cn("h-3 w-3 transition-transform flex-shrink-0", isMetricOpen && "rotate-180")} />
        </button>

        {isMetricOpen && (
          <>
            <div 
              className="fixed inset-0 z-[1000]" 
              onClick={() => setIsMetricOpen(false)}
            />
            <div className={cn(
              "absolute top-full mt-1 bg-white dark:bg-gray-900 rounded-md shadow-lg border border-gray-200 dark:border-gray-600 z-[1001] max-h-96 overflow-y-auto",
              isMobile 
                ? "left-0 w-72" 
                : "left-1/2 sm:left-auto sm:right-0 w-80 sm:w-64 -translate-x-1/2 sm:translate-x-0"
            )}>
              <div className="p-2">
                {/* Catch Metrics */}
                <div className="mb-3">
                  <div className="flex items-center gap-2 px-2 py-1 mb-1">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-xs font-semibold text-gray-900 dark:text-gray-200">{t('text-metrics-catch')}</span>
                  </div>
                  <div className="space-y-0.5">
                    {groupedMetrics.catch.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setSelectedMetric(option.value);
                          setIsMetricOpen(false);
                        }}
                        className={cn(
                          "w-full px-2 py-1.5 text-left text-sm rounded transition-colors",
                          "flex flex-col items-start gap-0.5",
                          selectedMetric === option.value
                            ? "bg-blue-50 dark:bg-blue-800 text-blue-900 dark:text-blue-200"
                            : "text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                        )}
                      >
                        <span className="font-medium">{getDisplayLabel(option)}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {getUnitDisplay(option.unit)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Revenue Metrics */}
                <div>
                  <div className="flex items-center gap-2 px-2 py-1 mb-1">
                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className="text-xs font-semibold text-gray-900 dark:text-gray-200">{t('text-metrics-revenue')}</span>
                  </div>
                  <div className="space-y-0.5">
                    {groupedMetrics.revenue.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setSelectedMetric(option.value);
                          setIsMetricOpen(false);
                        }}
                        className={cn(
                          "w-full px-2 py-1.5 text-left text-sm rounded transition-colors",
                          "flex flex-col items-start gap-0.5",
                          selectedMetric === option.value
                            ? "bg-amber-50 dark:bg-amber-800 text-amber-900 dark:text-amber-200"
                            : "text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                        )}
                      >
                        <span className="font-medium">{getDisplayLabel(option)}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {getUnitDisplay(option.unit)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    );
}

function HeaderMenuRight({ lang, isCatchCompositionPage }: { lang?: string; isCatchCompositionPage?: boolean }) {
  const { isIiaUser } = useUserPermissions();

  return (
    <div className="ms-auto flex shrink-0 items-center gap-1 text-gray-700 xs:gap-1 md:gap-2 xl:gap-3">
      {/* <ReferenceBMU /> */}
      {/* Show HeaderMetricSelector for all users except on catch composition page - hidden on mobile as it's in left section */}
      {!isCatchCompositionPage && (
        <div className="hidden sm:block">
          <HeaderMetricSelector />
        </div>
      )}
      <TimeRangeSelector lang={lang} />
      {/* Only show FilterSelector if not IIA user and not on catch composition page - hidden on mobile */}
      {!isIiaUser && !isCatchCompositionPage && (
        <div className="hidden sm:block">
          <FilterSelector />
        </div>
      )}
      <CompactLanguageSwitcher />
      {/* <ThemeToggle /> */}
      <ProfileMenu
        buttonClassName="w-auto sm:w-auto p-1 border border-gray-300"
        avatarClassName="!w-7 !h-7 sm:!h-8 sm:!w-8"
        lang={lang}
      />
    </div>
  );
}

export default function Header({ lang }: { lang?: string }) {
  const pathname = usePathname();
  const { isIiaUser } = useUserPermissions();
  
  // Hide metric selector on catch composition page
  const isCatchCompositionPage = pathname?.includes('/catch_composition');

  return (
    <StickyHeader
      className={"z-[990] justify-between 2xl:py-5 2xl:pl-6 3xl:px-8"}
    >
      <div className="hidden items-center gap-3 xl:flex">
        {/* One link home that reads "Peskas Kenya BMU": the logo, the product name dropped 0.15em
            onto the wordmark's baseline, and the flag. Spaced tightly enough that the Swahili
            menu still fits on one line at 1280px. */}
        <LanguageLink
          href="/"
          className="me-4 hidden shrink-0 items-center gap-2 xl:flex"
        >
          <Logo className="h-7 w-auto" />
          <span className="translate-y-[0.15em] text-base font-medium text-gray-500">
            Kenya BMU
          </span>
          <KenyaFlag className="h-4 w-auto" />
        </LanguageLink>
        <HeaderMenuLeft lang={lang} />
      </div>
      <div className="flex w-full items-center gap-1 sm:gap-3 md:gap-5 xl:w-auto 3xl:gap-6">
        <div className="flex w-full max-w-2xl items-center xl:w-auto">
          <HamburgerButton
            view={<Sidebar className="static w-full 2xl:w-full" lang={lang} />}
            customSize="90%"
          />
          {/* The same link below xl. Below lg the filters leave no room for the logo and the name
              (the bar already overflows in Swahili at 360px and 640px), so the mark, 24px tall
              like the old "PSK", stands alone and the name is only read out. */}
          <LanguageLink
            href="/"
            className="me-2 flex shrink-0 items-center gap-2 sm:me-3 lg:me-5 xl:hidden"
          >
            <Logo className="hidden h-7 w-auto lg:block" />
            <Logo iconOnly={true} className="h-6 w-auto lg:hidden" />
            <span className="sr-only text-base font-medium text-gray-500 lg:not-sr-only lg:translate-y-[0.15em]">
              Kenya BMU
            </span>
          </LanguageLink>
          {/* Mobile controls */}
          {!isCatchCompositionPage && (
            <div className="flex items-center gap-1 sm:hidden">
              <HeaderMetricSelector isMobile={true} />
              {!isIiaUser && <FilterSelector />}
            </div>
          )}
        </div>
        <HeaderMenuRight lang={lang} isCatchCompositionPage={isCatchCompositionPage} />
      </div>
    </StickyHeader>
  );
}
