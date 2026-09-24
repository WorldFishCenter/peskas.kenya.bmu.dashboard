"use client";

import WidgetCard from "@components/cards/widget-card";
import { useAtom } from "jotai";
import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { bmusAtom, selectedMetricAtom, selectedTimeRangeAtom } from "@/app/components/filter-selector";
import { useTranslation } from "@/app/i18n/client";
import { api } from "@/trpc/react";
import cn from "@utils/class-names";
import { useSession } from "next-auth/react";
// Import shared permissions hook
import useUserPermissions from "../../core/hooks/use-user-permissions";
// Import shared color function
import { generateColor, updateBmuColorRegistry, getSortedBmuList } from "../../charts/utils/chart-utils";
import { MetricKey, MetricOption } from "../../charts/utils/chart-types";
// Import site configuration
// Import time range filtering utilities
import { getTimeRangeStartDate } from "../../core/utils/time-range-filter";
import { landingSiteMatchesQueryBmu, normalizeBmuForDisplay } from "../../charts/utils/bmu-display-normalizer";
import { useIndividualData } from "../../individual/hooks/use-individual-data";

interface RadarData {
  month: string;
  monthDisplay?: string;
  [key: string]: number | string | undefined;
}

interface MetricInfo {
  translationKey: string;
  unit: string;
}

interface VisibilityState {
  [key: string]: { opacity: number };
}

const METRIC_INFO: Record<MetricKey, MetricInfo> = {
  mean_effort: { translationKey: "text-metrics-effort", unit: "fisher days" },
  mean_cpue: { translationKey: "text-metrics-catch-rate", unit: "kg/fisher/day" },
  mean_cpua: { translationKey: "text-metrics-catch-density", unit: "kg/km²/day" },
  mean_rpue: { translationKey: "text-metrics-fisher-revenue", unit: "KSH/fisher/day" },
  mean_rpua: { translationKey: "text-metrics-area-revenue", unit: "KSH/km²/day" },
  mean_cost: { translationKey: "text-metrics-trip-costs", unit: "KES/fisher/day" },
  mean_profit: { translationKey: "text-metrics-profit", unit: "KES/fisher/day" },
};

const getMetricLabel = (metric: string, t: any): string => {
  const metricKey = metric as MetricKey;
  // Use specific radar translation for effort metric
  if (metricKey === "mean_effort") {
    return t("text-metrics-effort-radar");
  }
  const translationKey = METRIC_INFO[metricKey]?.translationKey || "text-metrics-catch";
  return t(translationKey);
};

const MONTH_ORDER = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const CustomTooltip = ({ active, payload, metric, t }: any) => {
  if (active && payload && payload.length) {
    const metricInfo = METRIC_INFO[metric as MetricKey];
    return (
      <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
        <p className="text-sm font-medium text-gray-600 mb-2">
          {payload[0]?.payload?.monthDisplay || 
            payload[0]?.payload?.month || ""}
        </p>
        <div className="space-y-1.5">
          {payload.map((entry: any) => {
            // Check if the value is undefined, null, or 0 when it should be N/A
            const isValidValue = entry.value !== undefined && entry.value !== null;
            const displayValue = isValidValue ? entry.value.toFixed(1) : t("text-na");
            
            return (
              <div key={entry.dataKey} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <p className="text-sm">
                  <span className="font-medium">{entry.name}:</span>{" "}
                  <span className="font-semibold">{displayValue}</span>
                </p>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return null;
};

const LoadingState = ({ t }: { t: any }) => {
  return (
    <WidgetCard title="" className="h-full">
      <div className="h-96 w-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
          <span className="text-sm text-gray-500">{t("text-loading-chart")}</span>
        </div>
      </div>
    </WidgetCard>
  );
};

const CustomLegend = ({ payload, visibilityState, handleLegendClick, siteColors, localActiveTab }: any) => {
  // Helper function to safely get the site key from an entry
  const getSiteKey = (entry: any): string => {
    return entry.dataKey || entry.value || entry.name || '';
  };
  
  // Helper function to safely get opacity - make legend more readable
  const getOpacity = (entry: any): number => {
    const key = getSiteKey(entry);
    const chartOpacity = visibilityState[key]?.opacity ?? 1;
    // For legend readability, use higher minimum opacity (0.4 instead of 0.05)
    return chartOpacity === 1 ? 1 : 0.4;
  };

  return (
    <div className="flex flex-wrap gap-2 justify-center mt-2">
      {payload?.map((entry: any) => {
        const siteKey = getSiteKey(entry);
        const chartOpacity = visibilityState[siteKey]?.opacity ?? 1;
        const legendOpacity = getOpacity(entry);
        
        return (
          <div
            key={siteKey || entry.value || Math.random().toString()}
            className="flex items-center gap-2 cursor-pointer select-none transition-all duration-200"
            onClick={() => handleLegendClick(siteKey)}
            style={{ opacity: legendOpacity }}
          >
            <div
              className="w-3 h-3 rounded-full transition-all duration-200"
              style={{ 
                backgroundColor: entry.color,
                opacity: chartOpacity === 1 ? 1 : 0.6, // Make color indicator more visible than text
              }}
            />
            <span 
              className={`text-sm font-medium transition-all duration-200 ${
                chartOpacity === 1 ? 'text-gray-900' : 'text-gray-500'
              }`}
            >
              {entry.value}
            </span>
          </div>
        );
      })}
    </div>
  );
};

interface CatchRadarChartProps {
  className?: string;
  lang?: string;
  bmu?: string;
  activeTab?: string;
}

export default function CatchRadarChart({
  className,
  lang,
  bmu,
  activeTab = 'standard',
}: CatchRadarChartProps) {
  const { t } = useTranslation(lang!, "common");
  const [bmus] = useAtom(bmusAtom);
  const [selectedMetric] = useAtom(selectedMetricAtom);
  const [selectedTimeRange] = useAtom(selectedTimeRangeAtom);
  
  // Use centralized permissions hook
  const {
    userBMU,
    isCiaUser,
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

  const [data, setData] = useState<RadarData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visibilityState, setVisibilityState] = useState<VisibilityState>({});
  const [siteColors, setSiteColors] = useState<Record<string, string>>({});
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Add ref to track bmus changes
  const previousBmus = useRef<string[]>([]);
  const previousMetric = useRef<string>(selectedMetric);
  const previousActiveTab = useRef<string>(activeTab);
  const previousTimeRange = useRef<string>(selectedTimeRange);

  // Force refetch when bmus or metric changes - optimized with memoized dependency string
  const bmsDependencyString = useMemo(() => JSON.stringify(bmus), [bmus]);
  
  // Use the selected metric directly for API calls
  const apiMetric = selectedMetric;
  
  // Calculate time range dates for individual fisher data
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
        startDate = new Date('2020-01-01'); // All time - start from reasonable date
        break;
    }
    
    return { startDate, endDate };
  }, [selectedTimeRange]);

  // Fetch individual fisher data for admin-fishers
  const { fisherData, isLoadingFisherData } = useIndividualData(
    shouldShowIndividualData ? dateRange : undefined
  );

  // Helper function to check if current metric is compatible with individual fisher data
  const isMetricCompatibleWithIndividualData = useMemo(() => {
    // Individual fishers only have direct data for CPUE, RPUE, costs, and profit (not area-based metrics)
    const compatibleMetrics = ['mean_cpue', 'mean_rpue', 'mean_cost', 'mean_profit'];
    return compatibleMetrics.includes(selectedMetric);
  }, [selectedMetric]);
  
  // Calculate time range dates for API call
  const queryParams = useMemo(() => {
    const startDate = getTimeRangeStartDate(selectedTimeRange);
    
          const params: any = {
        bmus,
        metric: apiMetric
      };
    
    if (startDate) {
      const endDate = new Date();
      endDate.setHours(23, 59, 59, 999);
      
      params.startDate = startDate.toISOString();
      params.endDate = endDate.toISOString();
    }
    
    return params;
  }, [bmus, apiMetric, selectedTimeRange]);

  const { data: meanCatch, isLoading: isFetching, error: queryError, refetch } =
    api.aggregatedCatch.meanCatchRadar.useQuery(
      queryParams,
      {
        refetchOnMount: true,
        refetchOnWindowFocus: false,
        retry: 3,
        enabled: bmus.length > 0,
        staleTime: 1000 * 60 * 5, // Cache for 5 minutes
      }
    );

  // Force refetch when bmus or metric changes - more efficient check
  useEffect(() => {
    // Save current scroll position
    const scrollPosition = window.scrollY || document.documentElement.scrollTop;
    
    // Check if bmus array, metric, or time range has changed
    const bmusChanged = JSON.stringify(previousBmus.current) !== bmsDependencyString;
    const metricChanged = previousMetric.current !== selectedMetric;
    const timeRangeChanged = previousTimeRange.current !== selectedTimeRange;
    const tabChanged = previousActiveTab.current !== activeTab;
    
    if (bmusChanged || metricChanged || timeRangeChanged) {
      setData([]);
      setIsInitialLoad(true);
      previousBmus.current = [...bmus];
      previousMetric.current = selectedMetric;
      previousTimeRange.current = selectedTimeRange;
      previousActiveTab.current = activeTab;
      refetch();
    } else if (tabChanged) {
      // Just update the tab reference without refetching
      previousActiveTab.current = activeTab;
      setIsInitialLoad(true);
    }
    
    // Restore scroll position
    setTimeout(() => {
      window.scrollTo(0, scrollPosition);
    }, 10);
  }, [bmsDependencyString, selectedMetric, selectedTimeRange, activeTab, refetch, bmus]);

  // Handle query errors
  useEffect(() => {
    if (queryError) {
      console.error('Error fetching radar data:', queryError);
      setError(t('text-failed-to-fetch-data'));
      setLoading(false);
    }
  }, [queryError, t]);

  // Memoize data processing logic to avoid unnecessary recalculations
  const processedData = useMemo(() => {
    // Return early if conditions aren't met for processing
    if (isFetching || !meanCatch || bmus.length === 0) {
      return { data: [], error: null, siteColors: {}, visibilityState: {} };
    }
    
    try {
      if (!Array.isArray(meanCatch) || meanCatch.length === 0) {
        return { data: [], error: t("text-no-data-available"), siteColors: {}, visibilityState: {} };
      }

      // Extract unique BMUs from all data points
      const uniqueSitesSet = meanCatch.reduce((sites, item) => {
        Object.keys(item).forEach((key) => {
          if (key !== "month") sites.add(key);
        });
        return sites;
      }, new Set<string>());
      
      // Sort BMUs consistently across all charts
      const uniqueSites: string[] = getSortedBmuList(Array.from(uniqueSitesSet));

      // If no sites found, show error
      if (uniqueSites.length === 0) {
        return { data: [], error: t("text-no-bmu-data-available"), siteColors: {}, visibilityState: {} };
      }

      // Apply user permissions to filter BMUs
      const accessibleSites = hasRestrictedAccess 
        ? getAccessibleBMUs(uniqueSites) 
        : uniqueSites;

      // Update the global BMU color registry to ensure unique colors
      updateBmuColorRegistry(uniqueSites);

      const newSiteColors = uniqueSites.reduce<Record<string, string>>(
        (acc: Record<string, string>, site: string, index: number) => {
          acc[site] = generateColor(index, site, effectiveBMU);
          return acc;
        },
        {}
      );

      // Add individual fisher color if data is available
      if (shouldShowIndividualData && isMetricCompatibleWithIndividualData && fisherData && fisherData.length > 0) {
        const yourPerformanceLabel = t("text-your-performance") || "Your Performance";
        newSiteColors[yourPerformanceLabel] = "#F79F79"; // Same color as in other charts
      }



      const newVisibilityState: VisibilityState =
        uniqueSites.reduce<VisibilityState>(
          (acc: VisibilityState, site: string) => ({
            ...acc,
            [site]: { 
              opacity: hasRestrictedAccess
                ? accessibleSites.some(a => landingSiteMatchesQueryBmu(a, site)) ? 1 : 0.05
                : (effectiveBMU && landingSiteMatchesQueryBmu(effectiveBMU, site) ? 1 : 0.05)
            },
          }),
          {}
        );

      // Add individual fisher visibility if data is available
      if (shouldShowIndividualData && isMetricCompatibleWithIndividualData && fisherData && fisherData.length > 0) {
        const yourPerformanceLabel = t("text-your-performance") || "Your Performance";
        newVisibilityState[yourPerformanceLabel] = { opacity: 1 };
      }



      // Use the data as-is since the API call already applied the time range filter
      const filteredMeanCatch = meanCatch;

      // Create a map to track which sites have data for which months
      const dataMap: Record<string, Record<string, number | string>> = {};
      
      // First pass: collect all available data from filtered data
      filteredMeanCatch.forEach((item) => {
        const month = item.month;
        if (!dataMap[month]) {
          dataMap[month] = { month, monthDisplay: month };
        }
        
        // Add any data values present in this item
        Object.entries(item).forEach(([key, value]) => {
          if (key !== 'month' && key !== 'monthDisplay' && value !== undefined && value !== null) {
            dataMap[month][key] = value as string | number;
          }
        });
      });
      
      // Process and sort the data by month
      let processedData = MONTH_ORDER
        .filter(month => dataMap[month])
        .map(month => {
          const completeItem: RadarData = { 
            month, 
            monthDisplay: month 
          };
          
          // For each site, use the value from dataMap if available, otherwise undefined
          // Using undefined instead of 0 ensures proper gaps in visualizations
          uniqueSites.forEach(site => {
            completeItem[site] = dataMap[month][site] !== undefined 
              ? dataMap[month][site] 
              : undefined; // Use undefined instead of 0 to show gaps
          });
          
          // Add individual fisher data if available
          if (shouldShowIndividualData && isMetricCompatibleWithIndividualData && fisherData && fisherData.length > 0) {
            // Find matching month in fisher data
            const fisherMonthData = fisherData.find(record => {
              const recordDate = new Date(record.date);
              const monthName = recordDate.toLocaleDateString('en-US', { month: 'short' });
              return monthName === month;
            });
            
            if (fisherMonthData) {
              // Map BMU metrics to individual fisher metrics
              let fisherValue: number | undefined;
              if (selectedMetric === "mean_cpue" && fisherMonthData.mean_cpue != null) {
                fisherValue = fisherMonthData.mean_cpue;
              } else if (selectedMetric === "mean_rpue" && fisherMonthData.mean_rpue != null) {
                fisherValue = fisherMonthData.mean_rpue;
              } else if (selectedMetric === "mean_cost" && fisherMonthData.mean_cost != null) {
                fisherValue = fisherMonthData.mean_cost;
              } else if (selectedMetric === "mean_profit" && fisherMonthData.mean_profit != null) {
                fisherValue = fisherMonthData.mean_profit;
              } else if (selectedMetric === "mean_cpua" && fisherMonthData.mean_cpue != null) {
                // For BMU catch density, show individual fisher CPUE as approximation
                fisherValue = fisherMonthData.mean_cpue;
              } else if (selectedMetric === "mean_rpua" && fisherMonthData.mean_rpue != null) {
                // For BMU area revenue, show individual fisher RPUE as approximation
                fisherValue = fisherMonthData.mean_rpue;
              }
              
              if (fisherValue !== undefined) {
                const yourPerformanceLabel = t("text-your-performance") || "Your Performance";
                completeItem[yourPerformanceLabel] = fisherValue;
              }
            }
          }
          
          return completeItem;
        });

      // Calculate differenced data if needed
      if (activeTab === 'differenced' && effectiveBMU) {
        processedData = processedData.map(item => {
          const userValue = Number(item[effectiveBMU]);
          // Only calculate difference if the BMU has data for this month
          if (isNaN(userValue) || userValue === 0) {
            return {
              month: item.month,
              [effectiveBMU]: 0
            };
          }

          const otherBMUs = uniqueSites.filter(site => 
            site !== effectiveBMU && 
            !isNaN(Number(item[site])) && 
            Number(item[site]) !== 0
          );

          // Only calculate average if there are other BMUs with data
          if (otherBMUs.length === 0) {
            return {
              month: item.month,
              [effectiveBMU]: 0
            };
          }

          const otherAverage = otherBMUs.reduce((sum, site) => {
            return sum + Number(item[site] || 0);
          }, 0) / otherBMUs.length;

          return {
            month: item.month,
            [effectiveBMU]: userValue - otherAverage
          };
        }).filter(item => Number(item[effectiveBMU]) !== 0); // Remove months with no valid difference
      }

      return { 
        data: processedData, 
        error: null,
        siteColors: newSiteColors,
        visibilityState: newVisibilityState,
      };
    } catch (e) {
      console.error("Error processing data:", e);
      return { 
        data: [], 
        error: t("text-error-processing-data"),
        siteColors: {},
        visibilityState: {}
      };
    }
  }, [meanCatch, activeTab, effectiveBMU, hasRestrictedAccess, getAccessibleBMUs, t, isFetching, bmus.length, fisherData, isMetricCompatibleWithIndividualData, selectedMetric, shouldShowIndividualData]);

  // Update state based on memoized processed data
  useEffect(() => {
    // Skip if we're still loading and have no changes
    if (!isInitialLoad && !isFetching && bmus.length > 0 && 
        JSON.stringify(previousBmus.current) === bmsDependencyString &&
        previousMetric.current === selectedMetric &&
        previousTimeRange.current === selectedTimeRange &&
        previousActiveTab.current === activeTab) return;
    
    setLoading(true);
    
    // If not actively fetching, update states with processed data
    if (!isFetching) {
      setData(processedData.data);
      setError(processedData.error);
      
      // Only update site colors and visibility if they've changed
      if (Object.keys(processedData.siteColors).length > 0) {
        setSiteColors(processedData.siteColors);
      }
      
      if (Object.keys(processedData.visibilityState).length > 0) {
        setVisibilityState(processedData.visibilityState);
      }
      
      setLoading(false);
      setIsInitialLoad(false);
    }
  }, [bmsDependencyString, selectedMetric, selectedTimeRange, activeTab, processedData, isFetching, isInitialLoad, bmus.length]);

  // Memoize legend click handler
  const handleLegendClick = useCallback((site: string) => {
    // Save current scroll position
    const scrollPosition = window.scrollY || document.documentElement.scrollTop;
    
    setVisibilityState((prev) => ({
      ...prev,
      [site]: {
        opacity: prev[site]?.opacity === 1 ? 0.05 : 1,
      },
    }));
    
    // Restore scroll position after DOM updates
    setTimeout(() => {
      window.scrollTo(0, scrollPosition);
    }, 10);
  }, []);

  // Memoize the custom legend component
  const MemoizedCustomLegend = useCallback((props: any) => (
    <CustomLegend
      {...props}
      visibilityState={visibilityState}
      handleLegendClick={handleLegendClick}
      siteColors={siteColors}
      localActiveTab={activeTab}
      isCiaUser={isCiaUser}
    />
  ), [visibilityState, handleLegendClick, siteColors, activeTab, isCiaUser]);

  // Memoize the tooltip component
  const MemoizedCustomTooltip = useCallback((props: any) => (
    <CustomTooltip {...props} metric={selectedMetric} t={t} />
  ), [selectedMetric, t]);

  if (loading || isFetching) return <LoadingState t={t} />;

  if (error) {
    return (
      <WidgetCard title={getMetricLabel(selectedMetric, t)} className={cn("h-full", className)}>
        <div className="h-96 w-full flex items-center justify-center">
          <span className="text-sm text-gray-500">{t("text-error")}: {error}</span>
        </div>
      </WidgetCard>
    );
  }

  if (!data || data.length === 0) {
    return (
      <WidgetCard title={getMetricLabel(selectedMetric, t)} className={cn("h-full", className)}>
        <div className="h-96 w-full flex items-center justify-center">
          <span className="text-sm text-gray-500">{t("text-no-data-available")}</span>
        </div>
      </WidgetCard>
    );
  }

  return (
    <WidgetCard
      title={getMetricLabel(selectedMetric, t)}
      className={cn("h-full", className)}
    >
      <div className="h-96 w-full flex items-center justify-center">
        {/* Render chart if data is available */}
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart
            data={data}
            margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
            className="w-full h-full"
            outerRadius="95%"
            cx="50%"
            cy="47%"
          >
            <PolarGrid 
              gridType="polygon" 
              strokeWidth={0.5} 
              stroke="#e2e8f0" 
              strokeDasharray="3 3"
            />
            <PolarAngleAxis
              dataKey="month"
              tick={{ fill: "#64748b", fontSize: 11, fontWeight: 400 }}
              tickLine={false}
              stroke="#cbd5e1"
              strokeWidth={0.5}
            />
            <PolarRadiusAxis
              angle={90}
              domain={activeTab === 'differenced' ? ['auto', 'auto'] : [0, 'auto']}
              tick={{ fill: "#64748b", fontSize: 10 }}
              tickCount={5}
              axisLine={false}
              stroke="#cbd5e1"
              strokeDasharray="3 3"
              strokeWidth={0.5}
            />
            {Object.entries(siteColors).map(([site, color]) => {
              const displayName = normalizeBmuForDisplay(site);
              
              // In differenced mode, only show the selected BMU
              if (activeTab === 'differenced' && site !== effectiveBMU) {
                return null;
              }
              const opacity = visibilityState[site]?.opacity ?? 1;
              return (
                <Radar
                  key={site}
                  name={displayName}
                  dataKey={site}
                  stroke={activeTab === 'differenced' ? "#fc3468" : color}
                  fill={activeTab === 'differenced' ? "#fc3468" : color}
                  fillOpacity={opacity * 0.05}
                  strokeOpacity={opacity}
                  strokeWidth={2}
                  dot
                  activeDot={{ r: 6, strokeWidth: 0 }}
                  isAnimationActive={false}
                  connectNulls={false}
                />
              );
            })}
            

            <Tooltip content={MemoizedCustomTooltip} wrapperStyle={{ outline: 'none' }} />
            {activeTab !== 'differenced' && (
              <Legend
                content={MemoizedCustomLegend}
                verticalAlign="bottom"
                align="center"
                wrapperStyle={{ position: 'absolute', bottom: '-15px', left: 0, right: 0 }}
              />
            )}
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </WidgetCard>
  );
}