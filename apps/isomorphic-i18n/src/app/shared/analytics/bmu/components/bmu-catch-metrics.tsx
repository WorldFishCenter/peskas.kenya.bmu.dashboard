"use client";

import WidgetCard from "@components/cards/widget-card";
import { useAtom } from "jotai";
import { useEffect, useState, useCallback, useRef, useMemo, createContext } from "react";

import { bmusAtom, selectedTimeRangeAtom } from "@/app/components/filter-selector";
import { useTranslation } from "@/app/i18n/client";
import { api } from "@/trpc/react";
import { useMedia } from "@hooks/use-media";
import SimpleBar from "@ui/simplebar";

import { 
  MetricKey, 
  METRIC_OPTIONS, 
  ChartDataPoint, 
  ApiDataPoint, 
  VisibilityState 
} from "../../charts/utils/chart-types";
import { generateColor, getAnnualData, getRecentData, updateBmuColorRegistry, getSortedBmuList } from "../../charts/utils/chart-utils";
import CustomLegend from "../../charts/base/custom-legend";
// Import the chart components
import TrendsChart from "../../charts/base/trends-chart";
import ComparisonChart from "../../charts/base/comparison-chart";
import AnnualChart from "../../charts/base/annual-chart";
import { getClientLanguage } from "@/app/i18n/language-link";
// Import shared permissions hook
import useUserPermissions from "../../core/hooks/use-user-permissions";
import { filterDataByTimeRange } from "../../core/utils/time-range-filter";
import { landingSiteMatchesQueryBmu } from "../../charts/utils/bmu-display-normalizer";
import { useIndividualFisherDataOnly, useIndividualYearlyData } from "../../individual/hooks/use-individual-data";
import { BASELINE_DATA, isIslandSite, getCpuaBaseline, getCpueBaseline, getEffortBaseline } from "../../charts/utils/site-config";

// Create a more robust language context that includes both the language code and translations
const LanguageContext = createContext<{
  lang: string | null;
  translations: Record<string, string>;
}>({
  lang: null,
  translations: {},
});

// Create a provider component with memoized values to prevent re-renders
const LanguageProvider = ({ lang, children }: { lang: string | undefined, children: React.ReactNode }) => {
  // Create a memoized value for the context to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    lang: lang || null,
    translations: {},
  }), [lang]);

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
};


interface CatchMetricsChartProps {
  className?: string;
  lang?: string;
  selectedMetric: MetricKey;
  bmu?: string;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

const LoadingState = () => {
  const { t } = useTranslation("common");
  return (
    <WidgetCard title="">
      <div className="h-96 w-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
          <span className="text-sm text-gray-500">{t("text-loading")}</span>
        </div>
      </div>
    </WidgetCard>
  );
};

// Custom function to prepare data for CIA users' comparison view
const prepareDataForCiaComparison = (chartData: ChartDataPoint[], bmuName: string, selectedMetric?: string) => {
  if (!chartData.length) return [];
  

  const findBmuKey = (point: ChartDataPoint, targetBmu: string): string | null => {
    return Object.keys(point).find(key => 
      key !== 'date' && landingSiteMatchesQueryBmu(targetBmu, key)
    ) || null;
  };
  
  // First, filter to only the most recent 24 months
  const sortedData = [...chartData].sort((a, b) => b.date - a.date);
  const recentData = sortedData.slice(0, 24).reverse();
  
  // Determine the baseline to use based on the metric
  let baseline: number;
  
  if (selectedMetric === 'mean_cpua') {
    // For catch density, use BMU-specific baseline
    const cpuaBaseline = getCpuaBaseline(bmuName);
    baseline = cpuaBaseline !== null ? cpuaBaseline : 0;
  } else if (selectedMetric === 'mean_cpue') {
    // For CPUE, use BMU-specific baseline
    const cpueBaseline = getCpueBaseline(bmuName);
    baseline = cpueBaseline !== null ? cpueBaseline : 0;
  } else if (selectedMetric === 'mean_rpue') {
    // For fisher revenue, use living wage
    baseline = BASELINE_DATA.INCOME.LIVING_WAGE;
  } else if (selectedMetric === 'mean_effort') {
    // For effort, use BMU-specific baseline
    const effortBaseline = getEffortBaseline(bmuName);
    baseline = effortBaseline !== null ? effortBaseline : 0;
  } else if (selectedMetric === 'mean_profit') {
    // For profit, calculate 24-month average as baseline (same as other metrics)
    // Need at least 6 data points to calculate average
    if (recentData.length < 6) return recentData;
    
    // Calculate the average from the recent 24 months
    let sum = 0;
    let count = 0;
    
    for (let i = 0; i < recentData.length; i++) {
      const actualBmuKey = findBmuKey(recentData[i], bmuName);
      const value = actualBmuKey ? recentData[i][actualBmuKey] : undefined;
      if (value !== undefined && !isNaN(Number(value))) {
        sum += Number(value);
        count++;
      }
    }
    
    baseline = count > 0 ? sum / count : 0;
  } else if (selectedMetric === 'mean_cost') {
    // For costs, calculate 24-month average as baseline (same as profit logic)
    // Need at least 6 data points to calculate average
    if (recentData.length < 6) return recentData;
    
    // Calculate the average from the recent 24 months
    let sum = 0;
    let count = 0;
    
    for (let i = 0; i < recentData.length; i++) {
      const actualBmuKey = findBmuKey(recentData[i], bmuName);
      const value = actualBmuKey ? recentData[i][actualBmuKey] : undefined;
      if (value !== undefined && !isNaN(Number(value))) {
        sum += Number(value);
        count++;
      }
    }
    
    baseline = count > 0 ? sum / count : 0;
  } else {
    // For other metrics, calculate 24-month average
    // Need at least 6 data points to calculate average
    if (recentData.length < 6) return recentData;
    
    // Calculate the average from the recent 24 months
    let sum = 0;
    let count = 0;
    
    for (let i = 0; i < recentData.length; i++) {
      const actualBmuKey = findBmuKey(recentData[i], bmuName);
      const value = actualBmuKey ? recentData[i][actualBmuKey] : undefined;
      if (value !== undefined && !isNaN(Number(value))) {
        sum += Number(value);
        count++;
      }
    }
    
    baseline = count > 0 ? sum / count : 0;
  }
  
  // Create result array with the fixed baseline
  let result: ChartDataPoint[] = [];
  
  // Process each data point with the fixed baseline (only recent 24 months)
  for (const point of recentData) {
    // Clone the current point
    const currentPoint = { ...point };
    
    // Set the same baseline for all points (stored as historical_average for compatibility)
    currentPoint['historical_average'] = baseline;
    
    // Find the actual BMU key in the data point (handles naming variations)
    const actualBmuKey = findBmuKey(point, bmuName);
    
    // Calculate the difference from the baseline
    if (actualBmuKey && currentPoint[actualBmuKey] !== undefined) {
      const actualValue = Number(currentPoint[actualBmuKey]);
      const difference = actualValue - baseline;
      
      // Store the difference directly
      currentPoint['difference'] = difference;
      
      // Store whether this is above or below baseline (as a number 1/0)
      currentPoint['isAboveAverage'] = difference > 0 ? 1 : 0;
      
      // Also store the actual BMU value for reference
      currentPoint['actualValue'] = actualValue;
      
      result.push(currentPoint);
    }
  }
  
  // Sort the result by date for chronological display
  result = result.sort((a, b) => a.date - b.date);
  
  return result;
};

// Function to prepare baseline comparison data for multiple BMUs (WBCIA users)
const prepareMultiBMUBaselineComparison = (chartData: ChartDataPoint[], selectedMetric: string) => {
  if (!chartData.length) return [];
  

  const findBmuKey = (point: ChartDataPoint, targetBmu: string): string | null => {
    return Object.keys(point).find(key =>
      key !== 'date' && key !== 'average' && key !== 'historical_average' &&
      landingSiteMatchesQueryBmu(targetBmu, key)
    ) || null;
  };

  // Get the last 24 months of data
  const sortedData = [...chartData].sort((a, b) => b.date - a.date);
  const lastSixMonths = sortedData.slice(0, 24).reverse();
  
  // Process each data point
  return lastSixMonths.map(point => {
    const result: ChartDataPoint = { date: point.date };
    
    // Process each BMU
    Object.entries(point).forEach(([bmuName, value]) => {
      if (bmuName === 'date' || bmuName === 'average' || value === undefined || value === null) return;
      
      // Determine the baseline based on metric and BMU type
      let baseline: number;
      
      if (selectedMetric === 'mean_cpua') {
        // For catch density, use BMU-specific baseline
        const cpuaBaseline = getCpuaBaseline(bmuName);
        baseline = cpuaBaseline !== null ? cpuaBaseline : 0;
      } else if (selectedMetric === 'mean_cpue') {
        // For CPUE, use BMU-specific baseline
        const cpueBaseline = getCpueBaseline(bmuName);
        baseline = cpueBaseline !== null ? cpueBaseline : 0;
      } else if (selectedMetric === 'mean_rpue') {
        // For fisher revenue, use living wage
        baseline = BASELINE_DATA.INCOME.LIVING_WAGE;
      } else if (selectedMetric === 'mean_effort') {
        // For effort, use BMU-specific baseline
        const effortBaseline = getEffortBaseline(bmuName);
        baseline = effortBaseline !== null ? effortBaseline : 0;
      } else if (selectedMetric === 'mean_profit') {
        // For profit, calculate BMU's own average as baseline (same as CPUE logic)
        // Need to calculate this BMU's average across all time points
        const bmuValues: number[] = [];
        lastSixMonths.forEach(point => {
          const actualKey = findBmuKey(point, bmuName);
          if (actualKey && point[actualKey] !== undefined && point[actualKey] !== null) {
            bmuValues.push(point[actualKey] as number);
          }
        });
        baseline = bmuValues.length > 0 ? bmuValues.reduce((sum, val) => sum + val, 0) / bmuValues.length : 0;
      } else if (selectedMetric === 'mean_cost') {
        // For costs, calculate BMU's own average as baseline (same as profit logic)
        const bmuValues: number[] = [];
        lastSixMonths.forEach(point => {
          const actualKey = findBmuKey(point, bmuName);
          if (actualKey && point[actualKey] !== undefined && point[actualKey] !== null) {
            bmuValues.push(point[actualKey] as number);
          }
        });
        baseline = bmuValues.length > 0 ? bmuValues.reduce((sum, val) => sum + val, 0) / bmuValues.length : 0;
      } else {
        // For other metrics, we shouldn't be here, but default to value itself
        baseline = value as number;
      }
      
      // Calculate difference from baseline
      const difference = (value as number) - baseline;
      result[bmuName] = difference;
    });
    
    return result;
  });
};

export default function CatchMetricsChart({
  className,
  lang,
  selectedMetric,
  bmu,
  activeTab = 'standard', // Keep the original default for backwards compatibility
  onTabChange,
}: CatchMetricsChartProps) {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [fiveYearMarks, setFiveYearMarks] = useState<number[]>([]);
  const [visibilityState, setVisibilityState] = useState<VisibilityState>({});
  const [siteColors, setSiteColors] = useState<Record<string, string>>({});
  
  // Add refs to track initialization states
  const dataProcessed = useRef<boolean>(false);
  const prevTabRef = useRef<string | null>(null);
  const previousBmus = useRef<string[]>([]);
  const previousMetricRef = useRef<string>(selectedMetric);
  const previousTimeRangeRef = useRef<string>('all');

  // Map old tab names to new ones for backwards compatibility
  const getNewTabName = useCallback((oldTab: string) => {
    if (oldTab === 'standard') return 'trends';
    if (oldTab === 'recent') return 'comparison';
    return oldTab;
  }, []);

  // Initialize with mapped value to handle both old and new tab names
  const [localActiveTab, setLocalActiveTab] = useState(() => getNewTabName(activeTab));
  const [annualData, setAnnualData] = useState<ChartDataPoint[]>([]);
  const [recentData, setRecentData] = useState<ChartDataPoint[]>([]);
  const [ciaComparisonData, setCiaComparisonData] = useState<ChartDataPoint[]>([]);
  const [selectedTimeRange] = useAtom(selectedTimeRangeAtom);

  const isTablet = useMedia("(max-width: 800px)", false);
  
  // Use client language instead of lang prop
  const clientLang = getClientLanguage();
  const { t, i18n } = useTranslation(clientLang);
  
  // Track current language with state
  const [currentLang, setCurrentLang] = useState(clientLang);
  
  // Listen for language changes
  useEffect(() => {
    const handleLanguageChange = (event: CustomEvent) => {
      setCurrentLang(event.detail.language);
      
      // Make sure i18n instance is updated
      if (i18n.language !== event.detail.language) {
        i18n.changeLanguage(event.detail.language);
      }
      
      // Trigger a refresh without changing active tab - but only if not already loading
      if (!loading) {
      setLoading(true);
        const timer = setTimeout(() => setLoading(false), 50);
        return () => clearTimeout(timer);
      }
    };
    
    window.addEventListener('i18n-language-changed', handleLanguageChange as EventListener);
    return () => {
      window.removeEventListener('i18n-language-changed', handleLanguageChange as EventListener);
    };
  }, [i18n, loading]);

  const [bmus] = useAtom(bmusAtom);
  
  // Use centralized permissions hook
  const {
    userBMU,
    isCiaUser,
    isAiaUser,
    isWbciaUser,
    isAdmin,
    getAccessibleBMUs,
    hasRestrictedAccess,
    shouldShowAggregated,
    canCompareWithOthers,
    shouldShowIndividualData,
    userFisherId
  } = useUserPermissions();

  // Determine which BMU to use for filtering - prefer passed prop, then user's BMU
  const effectiveBMU = bmu || userBMU;
  
  // Ensure bmus is always an array - memoized to prevent unnecessary re-renders
  const safeBmus = useMemo(() => {
    return bmus || [];
  }, [bmus]);
  
  // Fetch monthly data
  const { data: monthlyData, refetch, error: queryError } = api.aggregatedCatch.monthly.useQuery(
    { bmus: safeBmus },
    {
      refetchOnMount: true,
      refetchOnWindowFocus: false,
      retry: 3,
      enabled: safeBmus.length > 0,
    }
  );


  // Fetch individual fisher data for admin-fishers
  const dateRange = useMemo(() => {
    const endDate = new Date();
    let startDate: Date;
    
    switch (selectedTimeRange) {
      case '3months':
        startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      case '6months':
        startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 6);
        break;
      case '1year':
        startDate = new Date();
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        // For annual view, limit to 3 years instead of all time to improve performance
        startDate = new Date();
        if (localActiveTab === 'annual') {
          startDate.setFullYear(startDate.getFullYear() - 3);
        } else {
          startDate = new Date('2020-01-01'); // All time for other views
        }
        break;
    }
    
    return { startDate, endDate };
  }, [selectedTimeRange, localActiveTab]);

  // Helper function to check if current metric is compatible with individual fisher data
  const isMetricCompatibleWithIndividualData = useMemo(() => {
    // Individual fishers only have direct data for CPUE, RPUE, costs, and profit (not area-based metrics)
    const compatibleMetrics = ['mean_cpue', 'mean_rpue', 'mean_cost', 'mean_profit'];
    return compatibleMetrics.includes(selectedMetric);
  }, [selectedMetric]);

  // Only fetch individual data when needed and compatible
  const shouldFetchIndividualData = useMemo(() => 
    shouldShowIndividualData && isMetricCompatibleWithIndividualData,
    [shouldShowIndividualData, isMetricCompatibleWithIndividualData]
  );
  
  const shouldFetchYearlyData = useMemo(() => 
    shouldFetchIndividualData && localActiveTab === 'annual',
    [shouldFetchIndividualData, localActiveTab]
  );

  // Only destructure the specific data we need to avoid waiting for all queries
  const { fisherData, isLoadingFisherData } = useIndividualFisherDataOnly(
    shouldFetchIndividualData ? dateRange : undefined
  );
  
  // Fetch pre-aggregated yearly data for annual charts
  const { yearlyData, isLoadingYearlyData } = useIndividualYearlyData(
    shouldFetchYearlyData ? dateRange : undefined
  );

  // Memoize fisher data to prevent re-renders while loading
  const memoizedFisherData = useMemo(() => {
    // Only pass fisher data if it's loaded and should be fetched
    if (!isLoadingFisherData && shouldFetchIndividualData) {
      return fisherData;
    }
    return undefined;
  }, [fisherData, isLoadingFisherData, shouldFetchIndividualData]);

  // Memoize yearly data for annual charts
  const memoizedYearlyData = useMemo(() => {
    // Only pass yearly data if it's loaded and should be fetched
    if (!isLoadingYearlyData && shouldFetchYearlyData) {
      return yearlyData;
    }
    return undefined;
  }, [yearlyData, isLoadingYearlyData, shouldFetchYearlyData]);

  // Track selectedMetric changes and force data reprocessing
  useEffect(() => {
    if (previousMetricRef.current !== selectedMetric) {
      previousMetricRef.current = selectedMetric;
      setChartData([]);
      setRecentData([]);
      setAnnualData([]);
      setCiaComparisonData([]);
      dataProcessed.current = false;
      setLoading(true);
    }
  }, [selectedMetric]);

  // Track selectedTimeRange changes and force data reprocessing
  useEffect(() => {
    if (previousTimeRangeRef.current !== selectedTimeRange) {
      previousTimeRangeRef.current = selectedTimeRange;
      setChartData([]);
      setRecentData([]);
      setAnnualData([]);
      setCiaComparisonData([]);
      dataProcessed.current = false;
      setLoading(true);
    }
  }, [selectedTimeRange]);

  // Force refetch when bmus changes
  useEffect(() => {
    // Check if bmus array has changed
    if (JSON.stringify(previousBmus.current) !== JSON.stringify(safeBmus)) {
      dataProcessed.current = false;
      refetch();
      // Note: previousBmus.current will be updated in the data processing useEffect
    }
  }, [safeBmus, refetch]);

  // Keep in sync with parent component, handling old tab names too
  useEffect(() => {
    const newTabName = getNewTabName(activeTab);
    if (localActiveTab !== newTabName) {
      setLocalActiveTab(newTabName);
      // Update the ref to track tab changes
      prevTabRef.current = newTabName;
    }
  }, [activeTab, getNewTabName, localActiveTab]);

  const handleLegendClick = useCallback((site: string) => {
    // Don't toggle visibility for the average line or special CIA comparison lines
    if (site === "average" || site === "historical_average") return;
    
    setVisibilityState((prev) => {
      // Create a copy of the previous state
      const newState = { ...prev };
      
      // Get current opacity, defaulting to 1 if not set
      const currentOpacity = prev[site]?.opacity ?? 1;
      
      // Toggle the clicked site - if it's visible (opacity >= 1), hide it (set to 0.05), otherwise show it (set to 1)
      newState[site] = {
        opacity: currentOpacity >= 1 ? 0.05 : 1,
      };
      
      // For Comparison tab, we need to handle the Positive/Negative variants too
      if ((localActiveTab === 'comparison' || localActiveTab === 'recent')) {
        // Also update the positive and negative variants
        const positiveKey = `${site}Positive`;
        const negativeKey = `${site}Negative`;
        
        newState[positiveKey] = { opacity: newState[site].opacity };
        newState[negativeKey] = { opacity: newState[site].opacity };
      }
      
      return newState;
    });
  }, [localActiveTab]);

  // Handle tab changes while preserving language state
  const handleTabChange = useCallback((tab: string) => {
    // Don't process if it's the same tab
    if (prevTabRef.current === tab) return;
    
    // Language is handled through client-side events
    
    // Update tab reference
    prevTabRef.current = tab;
    
    // Update local tab state
    setLocalActiveTab(tab);
    
    // Map back to old names when calling parent callback for backwards compatibility
    const oldTabName = tab === 'trends' ? 'standard' : tab === 'comparison' ? 'recent' : tab;
    
    // Call parent's onTabChange handler if provided
    if (onTabChange) {
      onTabChange(oldTabName);
    }
  }, [onTabChange]);

  // Update visibility state when changing tabs - but only once per tab change
  useEffect(() => {
    // Skip if we've already processed visibility for this tab change
    if (
      !Object.keys(siteColors).length ||
      !(localActiveTab === 'comparison' || localActiveTab === 'recent') ||
      !canCompareWithOthers
    ) {
      return;
    }

    // Skip if visibilityState is already initialized for needed keys
    const needsInitialization = Object.keys(siteColors).some(site => 
      site !== 'average' && 
      site !== 'historical_average' && 
      !visibilityState[site]
    );

    if (!needsInitialization) return;

    setVisibilityState(prev => {
      const newState = { ...prev };
      
      Object.keys(siteColors).forEach(site => {
        if (site !== 'average' && site !== 'historical_average' && !newState[site]) {
          const matchesEffectiveBMU = effectiveBMU && landingSiteMatchesQueryBmu(effectiveBMU, site);
          newState[site] = { opacity: matchesEffectiveBMU ? 1 : 0.05 };
          
          // Also set positive/negative variants for comparison view
          const positiveKey = `${site}Positive`;
          const negativeKey = `${site}Negative`;
          newState[positiveKey] = { opacity: newState[site].opacity };
          newState[negativeKey] = { opacity: newState[site].opacity };
        }
      });
      
      return newState;
    });
  }, [localActiveTab, canCompareWithOthers, siteColors, effectiveBMU, visibilityState]);

  // Process main data when monthlyData changes
  useEffect(() => {
    
    if (!monthlyData || !safeBmus || safeBmus.length === 0) return;
    
    // Reset processing flag if metric or time range changed
    if (previousMetricRef.current !== selectedMetric || previousTimeRangeRef.current !== selectedTimeRange) {
      dataProcessed.current = false;
      previousMetricRef.current = selectedMetric;
      previousTimeRangeRef.current = selectedTimeRange;
    }
    
    // Check if BMUs have changed
    const bmusChanged = JSON.stringify(previousBmus.current) !== JSON.stringify(safeBmus);
    
    // Prevent re-processing data unnecessarily UNLESS BMUs have changed
    const shouldSkipProcessing = (chartData.length > 0 && !loading && 
        !bmusChanged && 
        previousMetricRef.current === selectedMetric &&
        previousTimeRangeRef.current === selectedTimeRange);
    
    
    if (shouldSkipProcessing) return;
    
    // Update tracking after we decide to process
    if (bmusChanged) {
      previousBmus.current = [...safeBmus];
      dataProcessed.current = false;
    }

    try {
      // Get unique sites that have data for the selected metric (like radar chart)
      const uniqueSitesSet = Array.from(
        new Set(
          monthlyData
            .filter((item: ApiDataPoint) => {
              const value = item[selectedMetric];
              return value !== undefined && value !== null;
            })
            .map((item: ApiDataPoint) => item.landing_site)
        )
      );
      
      // Sort BMUs consistently across all charts
      const uniqueSites = getSortedBmuList(uniqueSitesSet);
      
      // Apply user permissions
      const accessibleSites = hasRestrictedAccess 
        ? getAccessibleBMUs(uniqueSites as string[])
        : uniqueSites;

      // Update the global BMU color registry to ensure unique colors
      updateBmuColorRegistry(uniqueSites as string[]);

      // Create color mapping for sites
      const newSiteColors = uniqueSites.reduce<Record<string, string>>(
        (acc, site, index) => ({
          ...acc,
          [site as string]: generateColor(index, site, effectiveBMU),
        }),
        {}
      );
      
      // Add special colors for averages - only include average for multi-BMU users, historical_average only for CIA users
      if (!(isCiaUser || isAiaUser)) {
        newSiteColors["average"] = "#64748b"; // Standard average color - only for multi-BMU users
      }
      if (isCiaUser) {
        newSiteColors["historical_average"] = "#94a3b8"; // Only add for CIA users
      }
      
      setSiteColors(newSiteColors);

      // Set visibility state based on user's BMU
      const initialVisibility = uniqueSites.reduce<VisibilityState>(
        (acc, site) => ({
          ...acc,
          [site as string]:           {
            opacity: hasRestrictedAccess
              ? (accessibleSites.some(a => landingSiteMatchesQueryBmu(a, site as string)) ? 1 : 0.05)
              : (effectiveBMU && landingSiteMatchesQueryBmu(effectiveBMU, site as string) ? 1 : 0.05)
          },
        }),
        {}
      );
      
      // For Comparison tab, add visibility for positive and negative variants
      if ((localActiveTab === 'comparison' || localActiveTab === 'recent')) {
        uniqueSites.forEach(site => {
          initialVisibility[`${site}Positive`] = { opacity: initialVisibility[site as string].opacity };
          initialVisibility[`${site}Negative`] = { opacity: initialVisibility[site as string].opacity };
        });
      }
      
      // Show average lines only for multi-BMU users
      if (!(isCiaUser || isAiaUser)) {
        initialVisibility["average"] = { opacity: 1 };
      }
      
      // Only add historical_average visibility for CIA users
      if (isCiaUser) {
        initialVisibility["historical_average"] = { opacity: 1 };
      }
      
      // Add individual fisher data to visibility state if applicable
      if (shouldFetchIndividualData) {
        initialVisibility["individualFisher"] = { opacity: 1 };
      }
      
      // Always update visibility state when BMUs change to ensure proper muted/unmuted state
      setVisibilityState(initialVisibility);

      // Apply time range filter instead of hardcoded 2023 filter
      const filteredData = filterDataByTimeRange(monthlyData as ApiDataPoint[], selectedTimeRange);

      // Get all dates in the range
      const dates = filteredData.map((item: ApiDataPoint) => new Date(item.date));
      const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
      const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));

      // Create an array with all months in the range
      const allMonths: number[] = [];
      const currentDate = new Date(minDate);
      // Ensure date is set to the first day of the month for consistent comparisons
      currentDate.setDate(1);
      currentDate.setHours(0, 0, 0, 0);

      while (currentDate <= maxDate) {
        allMonths.push(new Date(currentDate).getTime());
        currentDate.setMonth(currentDate.getMonth() + 1); // Move to next month
      }

      // Create a map to track which sites have data for which months
      const dataMap: Record<string, Record<string, number>> = {};

      // Process the raw data first to ensure we don't miss any values
      filteredData.forEach((item: ApiDataPoint) => {
        const value = item[selectedMetric];
        if (value === undefined || value === null) return;
        
        // Normalize the date to first day of month
        const date = new Date(item.date);
        date.setDate(1);
        date.setHours(0, 0, 0, 0);
        const timestamp = date.getTime();
        
        // Initialize the month entry if needed
        if (!dataMap[timestamp]) {
          dataMap[timestamp] = {};
        }
        
        // Store the value
        dataMap[timestamp][item.landing_site] = value;
      });
      
      // Initialize groupedData with all months in the range
      const groupedData: Record<string, ChartDataPoint> = {};
      allMonths.forEach(timestamp => {
        groupedData[timestamp] = {
          date: timestamp,
          ...uniqueSites.reduce((sites, site) => {
            // Use the stored value if available, otherwise undefined  
            const monthData = dataMap[timestamp];
            return { 
              ...sites, 
              [site as string]: monthData ? monthData[site as string] : undefined 
            };
          }, {}),
        };
      });

      // Calculate average value for each date point
      // For CIA and AIA users, don't calculate multi-BMU average since they only have access to one BMU
      if (!(isCiaUser || isAiaUser)) {
        Object.keys(groupedData).forEach(dateKey => {
          const dateData = groupedData[dateKey];
          const values = Object.entries(dateData)
            .filter(([key, value]) => key !== "date" && value !== undefined)
            .map(([_, value]) => value as number);
          
          if (values.length > 0) {
            const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
            groupedData[dateKey].average = parseFloat(avg.toFixed(2));
          } else {
            // Set to undefined instead of 0 to create a gap in the chart
            groupedData[dateKey].average = undefined;
          }
        });
      }

      const processedData = Object.values(groupedData).sort(
        (a, b) => a.date - b.date
      );

      const allYears = processedData.map((item: ChartDataPoint) =>
        new Date(item.date).getFullYear()
      );
      const minYear = Math.min(...allYears);
      const maxYear = Math.max(...allYears);
      const startYear = Math.floor(minYear / 5) * 5;
      const marks: number[] = [];

      for (let year = startYear; year <= maxYear; year += 5) {
        marks.push(new Date(`${year}-01-01`).getTime());
      }

      setFiveYearMarks(marks);
      setChartData(processedData);
      
    } catch (error) {
      console.error("Error transforming data:", error);
    } finally {
      setLoading(false);
    }
    // visibilityState is written here and never read; as a dep it feeds the effect its
    // own output, which spins forever when the metric yields no rows (chartData empty,
    // so shouldSkipProcessing never trips).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- visibilityState is write-only here and would infinite-loop
  }, [monthlyData, selectedMetric, effectiveBMU, hasRestrictedAccess, getAccessibleBMUs, safeBmus, isCiaUser, isAiaUser, localActiveTab, selectedTimeRange, shouldFetchIndividualData, chartData.length, loading]);

  // Calculate derived data when chartData changes
  useEffect(() => {
    if (chartData.length === 0) return;
    
    // Check if we need to recalculate based on key changes
    const needsRecalculation = 
      recentData.length === 0 || 
      annualData.length === 0 || 
      ((isCiaUser || isAiaUser) && ciaComparisonData.length === 0) ||
      previousMetricRef.current !== selectedMetric;
    
    if (!needsRecalculation) return;
    
    // Process data based on user type
    if (isWbciaUser && (selectedMetric === 'mean_cpua' || selectedMetric === 'mean_cpue' || selectedMetric === 'mean_rpue' || selectedMetric === 'mean_effort' || selectedMetric === 'mean_profit' || selectedMetric === 'mean_cost')) {
      // For WBCIA users viewing catch density, fisher revenue, or profit, use baseline comparison
      setRecentData(prepareMultiBMUBaselineComparison(chartData, selectedMetric));
    } else if (canCompareWithOthers) {
      // For other non-CIA users, use standard comparison
      setRecentData(getRecentData(chartData, false) as ChartDataPoint[]);
    } else if ((isCiaUser || isAiaUser) && effectiveBMU) {
      // For CIA and AIA users, create comparison against historical average if they have a BMU
      setCiaComparisonData(prepareDataForCiaComparison(chartData, effectiveBMU, selectedMetric));
    }
    
    // Annual data is the same for all users
    setAnnualData(getAnnualData(chartData, !canCompareWithOthers, siteColors));
    
  }, [chartData, canCompareWithOthers, isCiaUser, isAiaUser, isWbciaUser, effectiveBMU, siteColors, selectedMetric, recentData.length, annualData.length, ciaComparisonData.length]);

  // Find the selected metric option
  const selectedMetricOption = METRIC_OPTIONS.find(
    (m) => m.value === selectedMetric
  );

  // Get appropriate tab title and description based on user role
  const getTabTitle = (tab: string): string => {
    // Special titles for CIA, AIA and WBCIA users
    if (isCiaUser || isAiaUser || isWbciaUser) {
      switch(tab) {
        case 'trends':
        case 'standard':
          return t("text-monthly-trends-over-time");
        case 'comparison':
        case 'recent':
          // Title varies by metric for both CIA and WBCIA users
          if (selectedMetric === 'mean_cpua') {
            return t("text-performance-vs-msy") || "Performance vs MSY";
          } else if (selectedMetric === 'mean_cpue') {
            return t("text-performance-vs-cpue-baseline") || "Performance vs CPUE Baseline";
          } else if (selectedMetric === 'mean_rpue') {
            return t("text-performance-vs-living-wage") || "Performance vs Living Wage";
          } else if (selectedMetric === 'mean_effort') {
            return t("text-performance-vs-effort-baseline") || "Performance vs Effort Baseline";
          } else {
            // Get time range label for dynamic baseline description
            const getTimeRangeLabel = (timeRange: string): string => {
              switch (timeRange) {
                case '3months':
                  return t('text-last-3-months') || 'Last 3 months';
                case '6months':
                  return t('text-last-6-months') || 'Last 6 months';
                case '1year':
                  return t('text-last-year') || 'Last year';
                case 'all':
                  return t('text-all-time') || 'All time';
                default:
                  return t('text-all-time') || 'All time';
              }
            };
            const timeRangeLabel = getTimeRangeLabel(selectedTimeRange);
            return t("text-performance-vs-selected-average", { timeRange: timeRangeLabel }) || `Performance vs ${timeRangeLabel} Average`;
          }
        case 'annual':
          return t("text-yearly-summary");
        default:
          return t("text-monthly-trends-over-time");
      }
    }
    
    // Standard titles for other users
    switch(tab) {
      case 'trends':
      case 'standard':
        return t("text-monthly-trends-over-time");
      case 'comparison':
      case 'recent':
        return t("text-performance-vs-average");
      case 'annual':
        return t("text-yearly-summary");
      default:
        return t("text-monthly-trends-over-time");
    }
  };
  
  const getTabDescription = (tab: string): string => {
    // Special descriptions for CIA, AIA and WBCIA users
    if (isCiaUser || isAiaUser || isWbciaUser) {
      switch(tab) {
        case 'trends':
        case 'standard':
          return t("text-trends-explanation");
        case 'comparison':
        case 'recent':
          // Description varies by metric for both CIA and WBCIA users
          if (selectedMetric === 'mean_cpua') {
            return t("text-cia-msy-comparison-explanation") || "Shows values compared to the Maximum Sustainable Yield baseline";
          } else if (selectedMetric === 'mean_cpue') {
            return t("text-cia-cpue-comparison-explanation") || "Shows values compared to each BMU's recommended CPUE baseline";
          } else if (selectedMetric === 'mean_rpue') {
            return t("text-cia-living-wage-comparison-explanation") || "Shows values compared to the national living wage";
          } else if (selectedMetric === 'mean_effort') {
            return t("text-cia-effort-comparison-explanation") || "Shows values compared to each BMU's recommended effort baseline";
          } else {
            // Get time range label for dynamic baseline description
            const getTimeRangeLabel = (timeRange: string): string => {
              switch (timeRange) {
                case '3months':
                  return t('text-last-3-months') || 'Last 3 months';
                case '6months':
                  return t('text-last-6-months') || 'Last 6 months';
                case '1year':
                  return t('text-last-year') || 'Last year';
                case 'all':
                  return t('text-all-time') || 'All time';
                default:
                  return t('text-all-time') || 'All time';
              }
            };
            const timeRangeLabel = getTimeRangeLabel(selectedTimeRange);
            
            if (selectedMetric === 'mean_profit' || selectedMetric === 'mean_cost') {
              return t("text-cia-selected-time-comparison-explanation", { timeRange: timeRangeLabel }) || "Shows values compared to each entity's own average";
            } else {
              return t("text-cia-selected-time-comparison-explanation", { timeRange: timeRangeLabel }) || `Shows values compared to your ${timeRangeLabel} average`;
            }
          }
        case 'annual':
          return t("text-yearly-explanation");
        default:
          return t("text-trends-explanation");
      }
    }
    
    // Standard descriptions for other users
    switch(tab) {
      case 'trends':
      case 'standard':
        return t("text-trends-explanation");
      case 'comparison':
      case 'recent':
        return t("text-comparison-explanation");
      case 'annual':
        return t("text-yearly-explanation");
      default:
        return t("text-trends-explanation");
    }
  };

  // Show loading only when main data is loading and individual data isn't expected to load
  const isWaitingForData = loading || (shouldFetchIndividualData && isLoadingFisherData) || (shouldFetchYearlyData && isLoadingYearlyData);
  if (isWaitingForData) return <LoadingState />;
  if (!chartData || chartData.length === 0) {
    return (
      <WidgetCard title={t("text-metrics-catch")}>
        <div className="h-96 w-full flex items-center justify-center">
          <span className="text-sm text-gray-500">{t("text-no-data")}</span>
        </div>
      </WidgetCard>
    );
  }

  return (
    <WidgetCard
      title={
        <div className="flex flex-col sm:flex-row items-start sm:items-center w-full gap-3">
          <div className="hidden sm:block text-base font-medium text-gray-800 flex-1">
            <div className="text-center">
              {getTabTitle(localActiveTab)}
            </div>
            <div className="text-xs text-gray-500 text-center mt-1">
              {getTabDescription(localActiveTab)}
            </div>
          </div>
          {/* Show tabs for all users, but handle them differently based on permissions */}
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto sm:flex-shrink-0">
              <button
                className={`px-4 py-2 text-sm rounded-md transition duration-200 ${localActiveTab === 'trends' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'} w-full sm:w-auto`}
                onClick={() => handleTabChange('trends')}
              >
                {t("text-trends-tab")}
              </button>
              <button
                className={`px-4 py-2 text-sm rounded-md transition duration-200 ${localActiveTab === 'annual' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'} w-full sm:w-auto`}
                onClick={() => handleTabChange('annual')}
              >
                {t("text-annual-tab")}
              </button>
              <button
                className={`px-4 py-2 text-sm rounded-md transition duration-200 ${localActiveTab === 'comparison' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'} w-full sm:w-auto`}
                onClick={() => handleTabChange('comparison')}
              >
                {t("text-comparison-tab")}
              </button>
            </div>
        </div>
      }
      className="h-full"
    >
      {/* Mobile-only title - shows on small screens */}
      <div className="sm:hidden text-center mb-4">
        <div className="text-base font-medium text-gray-800">
          {getTabTitle(localActiveTab)}
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {getTabDescription(localActiveTab)}
        </div>
      </div>
      
      {/* Wrap all chart components in LanguageProvider */}
      <LanguageProvider lang={lang}>
        {/* Trends Chart */}
        {(localActiveTab === 'trends' || localActiveTab === 'standard') && (
          <SimpleBar>
            <TrendsChart
              chartData={chartData.map(point => {
                // Create a new object without average for AIA users and historical_average for non-CIA users
                if (isAiaUser) {
                  const { average, historical_average, ...rest } = point;
                  return rest;
                } else if (!isCiaUser) {
                  const { historical_average, ...rest } = point;
                  return rest;
                }
                return point;
              })}
              selectedMetricOption={selectedMetricOption}
              siteColors={(() => {
                if (isCiaUser) return siteColors;
                if (isAiaUser) return Object.fromEntries(
                  Object.entries(siteColors).filter(([key]) => key !== 'historical_average' && key !== 'average')
                );
                return Object.fromEntries(
                  Object.entries(siteColors).filter(([key]) => key !== 'historical_average')
                );
              })()}
              visibilityState={visibilityState}
              isCiaUser={!!isCiaUser}
              isAiaUser={!!isAiaUser}
              isTablet={isTablet}
              fiveYearMarks={fiveYearMarks}
              selectedMetric={selectedMetric}
              individualFisherData={memoizedFisherData}
              userFisherId={userFisherId}
              userBMU={effectiveBMU}
              CustomLegend={(props) => (
                <CustomLegend 
                  {...props} 
                  handleLegendClick={handleLegendClick} 
                  siteColors={siteColors}
                  visibilityState={visibilityState}
                  isCiaUser={!!isCiaUser}
                  isAiaUser={!!isAiaUser}
                  localActiveTab={localActiveTab}
                />
              )}
            />
          </SimpleBar>
        )}
        
        {/* Comparison Chart - special handling for CIA users */}
        {(localActiveTab === 'comparison' || localActiveTab === 'recent') && (
          <SimpleBar>
            {canCompareWithOthers ? (
              // Standard comparison chart for users who can see multiple BMUs
            <ComparisonChart
              chartData={recentData.map(point => {
                // Create a new object without average for AIA users and historical_average for non-CIA users
                if (isAiaUser) {
                  const { average, historical_average, ...rest } = point;
                  return rest;
                } else if (!isCiaUser) {
                  const { historical_average, ...rest } = point;
                  return rest;
                }
                return point;
              })}
              originalChartData={chartData}
              selectedMetricOption={selectedMetricOption}
              siteColors={(() => {
                if (isCiaUser) return siteColors;
                if (isAiaUser) return Object.fromEntries(
                  Object.entries(siteColors).filter(([key]) => key !== 'historical_average' && key !== 'average')
                );
                return Object.fromEntries(
                  Object.entries(siteColors).filter(([key]) => key !== 'historical_average')
                );
              })()}
              visibilityState={visibilityState}
              isTablet={isTablet}
              selectedMetric={selectedMetric}
              selectedTimeRange={selectedTimeRange}
              isCiaHistoricalMode={isWbciaUser && (selectedMetric === 'mean_cpua' || selectedMetric === 'mean_cpue' || selectedMetric === 'mean_rpue' || selectedMetric === 'mean_effort' || selectedMetric === 'mean_profit' || selectedMetric === 'mean_cost')}
              individualFisherData={memoizedFisherData}
              userFisherId={userFisherId}
              CustomLegend={(props) => (
                <CustomLegend 
                  {...props} 
                  handleLegendClick={handleLegendClick} 
                  siteColors={siteColors}
                  visibilityState={visibilityState}
                  isCiaUser={!!isCiaUser}
                  isAiaUser={!!isAiaUser}
                  localActiveTab={localActiveTab}
                />
              )}
            />
            ) : (
              // CIA users see comparison against their historical average
              <ComparisonChart
                chartData={ciaComparisonData}
                originalChartData={chartData}
                selectedMetricOption={selectedMetricOption}
                siteColors={siteColors}
                visibilityState={visibilityState}
                isTablet={isTablet}
                isCiaHistoricalMode={true}
                historicalBmuName={effectiveBMU}
                selectedMetric={selectedMetric}
                selectedTimeRange={selectedTimeRange}
                individualFisherData={memoizedFisherData}
                userFisherId={userFisherId}
                CustomLegend={(props) => (
                  <CustomLegend 
                    {...props} 
                    handleLegendClick={handleLegendClick} 
                    siteColors={siteColors}
                    visibilityState={visibilityState}
                    isCiaUser={!!isCiaUser}
                    isAiaUser={!!isAiaUser}
                    localActiveTab={localActiveTab}
                    historicalMode={true}
                  />
                )}
              />
            )}
          </SimpleBar>
        )}
        
        {/* Annual Chart */}
        {localActiveTab === 'annual' && (
          <SimpleBar>
            <AnnualChart
              chartData={(() => {
                // Only show the latest year if time range is '1year'
                let filtered = annualData;
                if (selectedTimeRange === '1year' && annualData.length > 0) {
                  const latestYear = Math.max(...annualData.map(point => new Date(point.date).getFullYear()));
                  filtered = annualData.filter(point => new Date(point.date).getFullYear() === latestYear);
                }
                return filtered.map(point => {
                  // Always filter out historical_average for annual chart, and average for AIA users
                  if (isAiaUser) {
                    const { average, historical_average, ...rest } = point;
                    return rest;
                  } else {
                    const { historical_average, ...rest } = point;
                    return rest;
                  }
                });
              })()}
              selectedMetricOption={selectedMetricOption}
              siteColors={(() => {
                if (isAiaUser) return Object.fromEntries(
                  Object.entries(siteColors).filter(([key]) => key !== 'historical_average' && key !== 'average')
                );
                return Object.fromEntries(
                  Object.entries(siteColors).filter(([key]) => key !== 'historical_average')
                );
              })()}
              visibilityState={visibilityState}
              isCiaUser={!!isCiaUser}
              isTablet={isTablet}
              selectedMetric={selectedMetric}
              individualFisherData={memoizedFisherData}
              individualYearlyData={memoizedYearlyData}
              userFisherId={userFisherId}
              userBMU={effectiveBMU}
              CustomLegend={(props) => (
                <CustomLegend 
                  {...props} 
                  handleLegendClick={handleLegendClick} 
                  siteColors={siteColors}
                  visibilityState={visibilityState}
                  isCiaUser={!!isCiaUser}
                  isAiaUser={!!isAiaUser}
                  localActiveTab={localActiveTab}
                />
              )}
            />
          </SimpleBar>
        )}
      </LanguageProvider>
    </WidgetCard>
  );
} 