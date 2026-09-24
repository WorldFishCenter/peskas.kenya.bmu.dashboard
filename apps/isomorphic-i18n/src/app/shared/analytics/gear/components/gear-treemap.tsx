import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useAtom } from "jotai";
import WidgetCard from "@components/cards/widget-card";
import SimpleBar from "@ui/simplebar";
import { useTranslation } from "@/app/i18n/client";
import { api } from "@/trpc/react";
import { bmusAtom, selectedMetricAtom, selectedTimeRangeAtom } from "@/app/components/filter-selector";
import cn from "@utils/class-names";
import MetricCard from "@components/cards/metric-card";
import { getClientLanguage } from "@/app/i18n/language-link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Treemap
} from "recharts";

// Import shared MetricSelector component
import { METRIC_OPTIONS } from "../../charts/utils/chart-types";
import { generateColor, updateBmuColorRegistry, getSortedBmuList } from "../../charts/utils/chart-utils";
import { landingSiteMatchesQueryBmu } from "../../charts/utils/bmu-display-normalizer";
import useUserPermissions from "../../core/hooks/use-user-permissions";
// Import time range filtering utilities
import { getTimeRangeStartDate } from "../../core/utils/time-range-filter";
// Import individual gear data hook
import useIndividualGearData from "../../individual/hooks/use-individual-gear-data";
// Import gear translation utilities
import { getGearTypeLabel } from "../utils/gear-translations";

// Colors for gear types (consistent set)
const GEAR_COLORS = [
  "#4C51BF", // Indigo
  "#00B4D8", // Bright Cyan
  "#14B8A6", // Teal
  "#FB7185", // Pink
  "#FFB800", // Amber
  "#F97316", // Orange
  "#8B5CF6", // Purple
  "#10B981", // Emerald
  "#D946EF", // Fuchsia
  "#EC4899", // Hot Pink
  "#EF4444", // Red
  "#6366F1", // Blue
];

const formatNumber = (value: number) => {
  if (value >= 1000) {
    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 0,
    }).format(value);
  }
  return value.toFixed(1);
};

// Use the centralized gear translation utility
// const capitalizeGearType function removed - now using getGearTypeLabel from gear-translations

interface GearData {
  BMU: string;
  gear: string;
  mean_cpue?: number;
  mean_rpue?: number;
  mean_trip_catch?: number;
  mean_effort?: number;
  mean_cpua?: number;
  mean_rpua?: number;
  date?: Date;
  [key: string]: any;
}

interface VisibilityState {
  [key: string]: { opacity: number };
}

interface RankingDataItem {
  name: string;
  value: number;
  fill: string;
  percentage?: string;
}

const LoadingState = () => {
  const { t } = useTranslation("common");
  return (
    <MetricCard
      title=""
      metric=""
      rounded="lg"
      chart={
        <div className="h-24 w-24 @[16.25rem]:h-28 @[16.25rem]:w-32 @xs:h-32 @xs:w-36 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-4 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
            <span className="text-sm text-gray-500">{t("text-loading")}</span>
          </div>
        </div>
      }
      chartClassName="flex flex-col w-auto h-auto text-center justify-center"
      className="min-w-[292px] w-full max-w-full flex flex-col items-center justify-center"
    />
  );
};

// Custom tooltip consistent with other charts
const CustomTooltip = ({ active, payload, label, selectedMetricOption }: any) => {
  const { t } = useTranslation("common");
  
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
        <p className="text-sm font-medium text-gray-600 mb-2">{label}</p>
        <div className="space-y-1.5">
          {payload
            // Don't filter out undefined values anymore
            .sort((a: any, b: any) => {
              // Handle sorting when values could be undefined/null
              if (a.value === undefined || a.value === null) return 1;
              if (b.value === undefined || b.value === null) return -1;
              return b.value - a.value;
            })
            .map((entry: any, index: number) => (
              <div key={index} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <p className="text-sm">
                  <span className="font-medium">{entry.name}:</span>{" "}
                  <span className="font-semibold">
                    {entry.value !== undefined && entry.value !== null 
                      ? formatNumber(entry.value) 
                      : t("text-na")}
                  </span>
                </p>
              </div>
            ))}
        </div>
      </div>
    );
  }
  return null;
};

// Custom legend component consistent with other charts
const CustomLegend = ({ payload, visibilityState, handleLegendClick }: any) => {
  return (
    <div className="flex flex-wrap gap-2 justify-center mt-2">
      {payload?.map((entry: any) => {
        const key = entry.dataKey || entry.value;
        const chartOpacity = visibilityState[key]?.opacity ?? 1;
        // For legend readability, use higher minimum opacity (0.4 instead of 0.05)
        const legendOpacity = chartOpacity === 1 ? 1 : 0.4;
        
        return (
          <div
            key={key}
            className="flex items-center gap-2 cursor-pointer select-none transition-all duration-200"
            onClick={() => handleLegendClick(key)}
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

// Custom treemap tooltip for ranking view
const TreemapTooltip = ({ active, payload, selectedMetricOption }: any) => {
  const { t } = useTranslation("common");
  
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const isValidValue = data.value !== undefined && data.value !== null;
    
    return (
      <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
        <p className="text-sm font-medium text-gray-600 mb-2">{data.name}</p>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: data.fill }}
            />
            <p className="text-sm">
              <span className="font-medium">{selectedMetricOption?.label || t("text-value")}:</span>{" "}
              <span className="font-semibold">
                {isValidValue ? formatNumber(data.value) : t("text-na")}
              </span>
              {isValidValue && selectedMetricOption?.unit && (
                <span className="text-gray-500 ml-1">{selectedMetricOption.unit}</span>
              )}
            </p>
          </div>
          {isValidValue && data.percentage && (
            <p className="text-sm text-gray-600">
              <span className="font-medium">{t("text-share-of-total")}:</span>{" "}
              <span className="font-semibold">{data.percentage}%</span>
            </p>
          )}
          <p className="text-xs text-gray-500 italic">
            {t("text-treemap-explanation")}
          </p>
        </div>
      </div>
    );
  }
  return null;
};

// Custom treemap content component to handle visibility state and labels
const CustomizedTreemapContent = (props: any) => {
  const { x, y, width, height, name, value, fill, percentage } = props;
  
  // Only show text if the rectangle is big enough
  const showLabel = width > 60 && height > 30;
  const showPercentage = width > 70 && height > 40;
  
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fill}
        strokeWidth={2}
        stroke="#ffffff"
        strokeOpacity={0.8}
        rx={6}
        ry={6}
        style={{ filter: 'drop-shadow(0px 2px 3px rgba(0, 0, 0, 0.1))' }}
      />
      {showLabel && (
        <>
        <text
          x={x + width / 2}
          y={y + height / 2 - (showPercentage ? 8 : 0)}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={Math.min(width / 8, 16)}
          fontWeight="600"
          fontFamily="'Inter', sans-serif"
          fill="#ffffff"
        >
          {name}
        </text>
          {showPercentage && percentage && (
            <text
              x={x + width / 2}
              y={y + height / 2 + 12}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={Math.min(width / 6, 24)}
              fontWeight="700"
              fontFamily="'Inter', sans-serif"
              fill="#ffffff"
              fillOpacity={0.95}
            >
              {percentage}%
            </text>
          )}
        </>
      )}
    </g>
  );
};

export default function GearHeatmap({
  className,
  lang,
  bmu,
}: {
  className?: string;
  lang?: string;
  bmu?: string;
}) {
  const [barData, setBarData] = useState<any[]>([]);
  const [rankingData, setRankingData] = useState<RankingDataItem[]>([]);
  const [comparisonData, setComparisonData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use client language for translations
  const clientLang = getClientLanguage();

  // Track current language with state
  const [currentLang, setCurrentLang] = useState(clientLang);

  // Use currentLang for translation so it updates when language changes
  const { t, i18n } = useTranslation(currentLang, "common");
  
  const [bmus] = useAtom(bmusAtom);
  const [selectedMetric] = useAtom(selectedMetricAtom);
  const [selectedTimeRange] = useAtom(selectedTimeRangeAtom);
  const [siteColors, setSiteColors] = useState<Record<string, string>>({});
  const [visibilityState, setVisibilityState] = useState<VisibilityState>({});
  const [activeTab, setActiveTab] = useState('ranking');
  
  // Add refs to track initialization states
  const dataProcessed = useRef<boolean>(false);
  const previousMetric = useRef<string>(selectedMetric);
  const previousBmus = useRef<string[]>(bmus);
  const previousTimeRangeRef = useRef<string>(selectedTimeRange);
  const previousIndividualGearDataRef = useRef<unknown>(null);
  
  // Listen for language changes
  useEffect(() => {
    const handleLanguageChange = (event: CustomEvent) => {
      setCurrentLang(event.detail.language);

      // Make sure i18n instance is updated
      if (i18n.language !== event.detail.language) {
        i18n.changeLanguage(event.detail.language);
      }

      // Force data reprocessing to apply new translations
      dataProcessed.current = false;
      setBarData([]);
      setRankingData([]);
      setComparisonData([]);
    };

    window.addEventListener('i18n-language-changed', handleLanguageChange as EventListener);
    return () => {
      window.removeEventListener('i18n-language-changed', handleLanguageChange as EventListener);
    };
  }, [i18n]);

  // Use the centralized permissions hook
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
  
  // Ensure bmus is always an array - memoize to prevent new references
  const safeBmus = useMemo(() => bmus || [], [bmus]);
  
  // Calculate time range dates for API call - memoize to prevent infinite loops
  const queryParams = useMemo(() => {
    const startDate = getTimeRangeStartDate(selectedTimeRange);
    
    // Only include date filters if we have a valid startDate (not "all time")
    const params: any = {
      bmus: safeBmus,
    };
    
    if (startDate) {
      // Use a stable end date - set to end of current day
      const endDate = new Date();
      endDate.setHours(23, 59, 59, 999);
      
      params.startDate = startDate.toISOString();
      params.endDate = endDate.toISOString();
    }
    
    return params;
  }, [safeBmus, selectedTimeRange]); // Only recalculate when BMUs or time range actually changes

  // Helper function to check if current metric is compatible with individual gear data
  const isMetricCompatibleWithIndividualData = useMemo(() => {
    // Individual fishers have direct data for CPUE, RPUE, costs, and profit (not area-based metrics)
    const compatibleMetrics = ['mean_cpue', 'mean_rpue', 'mean_cost', 'mean_profit'];
    return compatibleMetrics.includes(selectedMetric);
  }, [selectedMetric]);

  // Only fetch individual data when needed and compatible
  const shouldFetchIndividualGearData = useMemo(() => 
    shouldShowIndividualData && isMetricCompatibleWithIndividualData,
    [shouldShowIndividualData, isMetricCompatibleWithIndividualData]
  );

  // Calculate date range for individual gear data
  const dateRange = useMemo(() => {
    const startDate = getTimeRangeStartDate(selectedTimeRange);
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    return { startDate, endDate };
  }, [selectedTimeRange]);

  // Fetch individual gear data for users who should see individual data
  const {
    processedGearData: individualGearData,
    processedBmuAverageData: bmuGearAverageData,
    isLoading: isLoadingIndividualGear,
    hasError: hasIndividualGearError
  } = useIndividualGearData(shouldFetchIndividualGearData ? dateRange : undefined);
  
  // Force refetch when bmus or time range changes by adding bmus and time range to the query key
  const { data: rawData, refetch, isLoading: isQueryLoading, isError: isQueryError, error: queryError } = api.gear.summaries.useQuery(
    queryParams,
    {
      refetchOnMount: true,
      refetchOnWindowFocus: false,
      retry: 3,
      enabled: safeBmus.length > 0,
      // Add staleTime to prevent unnecessary refetches
      staleTime: 5000, // 5 seconds
    }
  );
  
  // Handle query errors
  if (isQueryError) {
    console.error('Gear query error:', queryError?.message);
  }


  // Track selectedTimeRange changes and force data reprocessing
  useEffect(() => {
    if (previousTimeRangeRef.current !== selectedTimeRange) {

      previousTimeRangeRef.current = selectedTimeRange;
      setBarData([]);
      setRankingData([]);
      setComparisonData([]);
      dataProcessed.current = false;
      setLoading(true);
      setError(null);
    }
  }, [selectedTimeRange]);

  // Force refetch when bmus changes
  useEffect(() => {
    // Check if bmus array has changed
    if (JSON.stringify(previousBmus.current) !== JSON.stringify(safeBmus)) {
      dataProcessed.current = false;
      previousBmus.current = [...safeBmus];
      // No need to manually refetch - the query will automatically refetch when queryParams change
    }
  }, [safeBmus]);

  const selectedMetricOption = METRIC_OPTIONS.find(
    (m) => m.value === selectedMetric
  );

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
  }, []);

  const handleLegendClick = useCallback((site: string) => {
    setVisibilityState((prev) => ({
      ...prev,
      [site]: {
        opacity: prev[site]?.opacity === 1 ? 0.05 : 1,
      },
    }));
  }, []);

  // Reset to distribution tab if CIA or AIA user somehow gets to comparison tab
  useEffect(() => {
    if ((isCiaUser || isAiaUser) && activeTab === 'comparison') {
      setActiveTab('distribution');
    }
  }, [isCiaUser, isAiaUser, activeTab]);

  useEffect(() => {
    if (!rawData) {
      return;
    }
    
    // Reset data processing flag if metric, time range, or individual gear data has changed
    const shouldResetProcessing = 
      previousMetric.current !== selectedMetric || 
      previousTimeRangeRef.current !== selectedTimeRange;
    
    // Only treat individual data as "changed" when the query result identity changes
    const individualDataChanged = shouldFetchIndividualGearData && (
      !dataProcessed.current ||
      previousIndividualGearDataRef.current !== individualGearData
    );
    
    if (shouldResetProcessing || individualDataChanged) {
      dataProcessed.current = false;
      previousMetric.current = selectedMetric;
      previousTimeRangeRef.current = selectedTimeRange;
      previousIndividualGearDataRef.current = individualGearData;
      setLoading(true);
    }
    
    // For individual data users, wait for individual data to load before processing
    if (shouldFetchIndividualGearData && isLoadingIndividualGear) {
      return;
    }
    
    // Skip processing if already done and no changes
    if (dataProcessed.current && !shouldResetProcessing && !individualDataChanged) {
      return;
    }

    try {
      setError(null);
      
      // Check if rawData is empty
      if (rawData.length === 0) {
        setError('No gear data available for the selected time range and BMUs. Try selecting "All time" or a different time range.');
        setLoading(false);
        dataProcessed.current = true;
        return;
      }

      // Map metric names to gear summary API fields
      const mapMetricField = (metric: string): string | null => {
        switch (metric) {
          case 'mean_cpue':
            return 'mean_cpue';
          case 'mean_rpue':
            return 'mean_rpue';
          case 'mean_cost':
            return 'mean_cost';
          case 'mean_profit':
            return 'mean_profit';
          case 'mean_effort':
            return 'mean_effort';
          case 'mean_cpua':
            return 'mean_cpua';
          case 'mean_rpua':
            return 'mean_rpua';
          default:
            return null; // Unknown metric
        }
      };
      
      const mappedMetricField = mapMetricField(selectedMetric);
      

      
      // Check if the selected metric is available
      if (!mappedMetricField) {
        setError(`The metric "${selectedMetric}" is not available for gear analysis. Please select a different metric.`);
        setLoading(false);
        dataProcessed.current = true;
        return;
      }

      // Extract unique BMUs that have data for the selected metric
      const uniqueBMUsSet = Array.from(
        new Set(
          rawData
            .filter((d: GearData) => {
              const value = (d as any)[mappedMetricField];
              return value !== undefined && value !== null;
            })
            .map((d: GearData) => d.BMU)
        )
      );
      
      // Sort BMUs consistently across all charts
      const uniqueBMUs = getSortedBmuList(uniqueBMUsSet);
      
      // Filter BMUs based on user permissions - use direct logic instead of function dependency
      const accessibleBMUs = hasRestrictedAccess 
        ? (effectiveBMU ? [effectiveBMU] : uniqueBMUs)
        : uniqueBMUs;

      // Update the global BMU color registry to ensure unique colors
      updateBmuColorRegistry(uniqueBMUs);

      // Create color mapping for BMUs
      const newSiteColors = uniqueBMUs.reduce<Record<string, string>>(
        (acc, site, index) => ({
          ...acc,
          [site]: generateColor(index, site, effectiveBMU),
        }),
        {}
      );

        
        setSiteColors(newSiteColors);

      // Only set initial visibility state if it's empty or BMUs have changed, or if individual data has been added
      const currentVisibilityKeys = Object.keys(visibilityState);
      const shouldShowIndividualInVisibility = shouldFetchIndividualGearData && userFisherId && individualGearData && individualGearData.length > 0;
      
      const needsVisibilityUpdate = currentVisibilityKeys.length === 0 || 
        !uniqueBMUs.every(bmu => currentVisibilityKeys.includes(bmu)) ||
        !currentVisibilityKeys.every(key => uniqueBMUs.includes(key) || key === "individualFisher") ||
        (shouldShowIndividualInVisibility && !currentVisibilityKeys.includes("individualFisher"));
        
      if (needsVisibilityUpdate) {
        const initialVisibility = uniqueBMUs.reduce<VisibilityState>(
          (acc, site) => ({
            ...acc,
            [site]: { 
              opacity: hasRestrictedAccess 
                ? (accessibleBMUs.some(a => landingSiteMatchesQueryBmu(a, site)) ? 1 : 0.05) 
                : (effectiveBMU && landingSiteMatchesQueryBmu(effectiveBMU, site) ? 1 : 0.05) 
            },
          }),
          {}
        );
        // Add individual fisher visibility if showing individual data and metric is compatible
        if (shouldShowIndividualInVisibility) {
          initialVisibility["individualFisher"] = { opacity: 1 }; // Always show individual fisher data
        }
        
        setVisibilityState(initialVisibility);
      }

      // Extract unique gear types and sort by total metric value
      const gearTypes = Array.from(
        new Set(rawData.map((d: GearData) => d.gear).filter(gear => gear !== null && gear !== undefined && gear !== ''))
      ).sort((a, b) => {
        const aValue = rawData.reduce(
          (sum, curr) => {
            // Only add values that are actually numbers and not null/undefined
            const value = (curr as any)[mappedMetricField];
            if (curr.gear === a && value !== undefined && value !== null) {
              return sum + (typeof value === "number" ? value : 0);
            }
            return sum;
          },
          0
        );
        const bValue = rawData.reduce(
          (sum, curr) => {
            // Only add values that are actually numbers and not null/undefined
            const value = (curr as any)[mappedMetricField];
            if (curr.gear === b && value !== undefined && value !== null) {
              return sum + (typeof value === "number" ? value : 0);
            }
            return sum;
          },
          0
        );
        return bValue - aValue;
      });

      // Format data for the distribution bar chart
      const transformedData = gearTypes.map((gear) => {
        const gearData: any = {
          name: getGearTypeLabel((gear || '').replace(/_/g, " "), t),
        };

        // First initialize all BMUs with undefined
        uniqueBMUs.forEach(bmu => {
          gearData[bmu] = undefined;
        });

        // Add data for each BMU that has values
        rawData.forEach((d: GearData) => {
          if (d.gear === gear && d[mappedMetricField] !== undefined && d[mappedMetricField] !== null) {
            gearData[d.BMU] = Number(d[mappedMetricField].toFixed(2));
          }
        });

        // Add individual fisher gear data if available and metric is compatible
        if (shouldFetchIndividualGearData && individualGearData && userFisherId) {
          const individualGearEntry = individualGearData.find(item => item.gear === gear);
          if (individualGearEntry) {
            const value = (individualGearEntry as any)[mappedMetricField];
            if (value !== undefined && value !== null) {
              gearData["individualFisher"] = Number(value.toFixed(2));
            }
          }
        }

        return gearData;
      });

      setBarData(transformedData);

      // Format data for the ranking chart
      // Filter data based on user permissions
      const filteredRankingData = rawData.filter((d: GearData) => {
        if (hasRestrictedAccess) {
          return !!effectiveBMU && landingSiteMatchesQueryBmu(effectiveBMU, d.BMU);
        } else if (isWbciaUser && effectiveBMU) {
          return landingSiteMatchesQueryBmu(effectiveBMU, d.BMU);
        }
        return true;
      });
      
      const rankingData: RankingDataItem[] = gearTypes.map((gear, index) => {
        // Calculate total value for this gear (filtered for BMU if applicable)
        const totalValue = filteredRankingData
          .filter(d => d.gear === gear)
          .reduce((sum, curr) => {
            const value = (curr as any)[mappedMetricField];
            return sum + (typeof value === "number" ? value : 0);
          }, 0);

        return {
          name: getGearTypeLabel((gear || '').replace(/_/g, " "), t),
          value: Number(totalValue.toFixed(2)),
          fill: GEAR_COLORS[index % GEAR_COLORS.length]
        };
      }).sort((a, b) => b.value - a.value);

      // Add percentage values
      const totalSum = rankingData.reduce((sum, item) => sum + item.value, 0);
      rankingData.forEach(item => {
        item.percentage = ((item.value / totalSum) * 100).toFixed(1);
      });

      setRankingData(rankingData);

      // Format data for the comparison chart
      // For the user's BMU compared to average of others
      // Only generate for users who can compare with others (not CIA or AIA users)
      if (effectiveBMU && !isCiaUser && !isAiaUser) {
        const comparisonData = gearTypes.map((gear, index) => {
          const bmuValue = rawData.find(
            d => landingSiteMatchesQueryBmu(effectiveBMU, d.BMU) && d.gear === gear && typeof (d as any)[mappedMetricField] === "number"
          )?.[mappedMetricField as keyof typeof rawData[0]] || 0;

          const otherBMUs = uniqueBMUs.filter(b => !landingSiteMatchesQueryBmu(effectiveBMU, b));
          let otherBMUsTotal = 0;
          let otherBMUsCount = 0;

          otherBMUs.forEach(otherBMU => {
            const value = rawData.find(
              d => landingSiteMatchesQueryBmu(otherBMU, d.BMU) && d.gear === gear && typeof (d as any)[mappedMetricField] === "number"
            )?.[mappedMetricField as keyof typeof rawData[0]];

            if (value) {
              otherBMUsTotal += value;
              otherBMUsCount++;
            }
          });

          const otherBMUsAvg = otherBMUsCount > 0 
            ? otherBMUsTotal / otherBMUsCount 
            : 0;

          // Difference (for sorting)
          const diff = bmuValue - otherBMUsAvg;

          const result: any = {
            name: getGearTypeLabel((gear || '').replace(/_/g, " "), t),
            [effectiveBMU]: Number(bmuValue.toFixed(2)),
            average: Number(otherBMUsAvg.toFixed(2)),
            diff: diff,
            color: GEAR_COLORS[index % GEAR_COLORS.length]
          };

          // Add individual fisher data if available and metric is compatible
          if (shouldFetchIndividualGearData && individualGearData && userFisherId) {
            const individualGearEntry = individualGearData.find(item => item.gear === gear);
            if (individualGearEntry) {
              const value = (individualGearEntry as any)[mappedMetricField];
              if (value !== undefined && value !== null) {
                result["individualFisher"] = Number(value.toFixed(2));
              }
            }
          }

          return result;
        }).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

        setComparisonData(comparisonData);
      }

      dataProcessed.current = true;
      setError(null);
    } catch (error) {
      console.error("Error transforming gear data:", error);
      setError("Error processing data");
      dataProcessed.current = true;
    } finally {
      setLoading(false);
    }
    // visibilityState is read for conditional init but must not be a dependency —
    // this effect writes it, and individualGearData stays truthy so a dep would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- visibilityState would infinite-loop
  }, [rawData, selectedMetric, selectedTimeRange, effectiveBMU, hasRestrictedAccess, isWbciaUser, isCiaUser, isAiaUser, safeBmus, individualGearData, shouldFetchIndividualGearData, userFisherId, isLoadingIndividualGear, t]);

  const getTabTitle = (tab: string): string => {
    // Custom titles for CIA and AIA users who can only see their own BMU
    if ((isCiaUser || isAiaUser) && hasRestrictedAccess) {
      switch (tab) {
        case 'distribution':
          return t("text-distribution-tab-title-cia") || `Fishing Gear Performance in ${effectiveBMU}`;
        case 'ranking':
          return t("text-ranking-tab-title-cia") || `Gear Type Importance in ${effectiveBMU}`;
        default:
          return t("text-distribution-tab-title-cia") || `Fishing Gear Performance in ${effectiveBMU}`;
      }
    }
    
    // Standard titles for users who can see multiple BMUs
    switch (tab) {
      case 'distribution':
        return t("text-distribution-tab-title");
      case 'comparison':
        return t("text-comparison-tab-title");
      case 'ranking':
        return hasRestrictedAccess ? 
          t("text-ranking-tab-title") + ` (${effectiveBMU})` :
          t("text-ranking-tab-title-all");
      default:
        return t("text-distribution-tab-title");
    }
  };

  const getTabDescription = (tab: string): string => {
    // Custom descriptions for CIA and AIA users who can only see their own BMU
    if ((isCiaUser || isAiaUser) && hasRestrictedAccess) {
      switch (tab) {
        case 'distribution':
          return t("text-distribution-tab-description-cia") || 
            `Shows performance metrics for different fishing gear types in your BMU (${effectiveBMU})`;
        case 'ranking':
          return t("text-ranking-tab-description-cia") || 
            `Shows the relative importance of different fishing gear types in your BMU (${effectiveBMU})`;
        default:
          return t("text-distribution-tab-description-cia") || 
            `Shows performance metrics for different fishing gear types in your BMU (${effectiveBMU})`;
      }
    }
    
    // Standard descriptions for users who can see multiple BMUs
    switch (tab) {
      case 'distribution':
        return t("text-distribution-tab-description");
      case 'comparison':
        return effectiveBMU ? 
          t("text-comparison-tab-description") + ` (${effectiveBMU})` : 
          t("text-comparison-tab-description");
      case 'ranking':
        if (hasRestrictedAccess) {
          return t("text-ranking-tab-description") + ` (${effectiveBMU})`;
        } else if (effectiveBMU) {
          return t("text-ranking-tab-description") + ` (${effectiveBMU})`;
        } else {
          return t("text-ranking-tab-description-all");
        }
      default:
        return t("text-distribution-tab-description");
    }
  };

  // Show loading state if query is loading, component is processing data, or individual gear data is loading
  const isWaitingForData = isQueryLoading || loading || (shouldFetchIndividualGearData && isLoadingIndividualGear);
  if (isWaitingForData) return <LoadingState />;
  
  // Show error state for individual gear data errors (but allow showing BMU data if available)
  if (shouldFetchIndividualGearData && hasIndividualGearError && !rawData) {
    return (
      <WidgetCard title="Gear Analysis" className={cn("h-full", className)}>
        <div className="h-96 w-full flex items-center justify-center">
          <span className="text-sm text-gray-500">
            Error loading individual gear data. Please try again or contact support.
          </span>
        </div>
      </WidgetCard>
    );
  }
  
  // Show error state for query errors
  if (isQueryError) {
    console.error('Query error:', queryError);
    return (
      <WidgetCard title="Gear Analysis" className={cn("h-full", className)}>
        <div className="h-96 w-full flex items-center justify-center">
          <span className="text-sm text-gray-500">
            Error loading gear data: {queryError?.message || 'Unknown error'}
          </span>
        </div>
      </WidgetCard>
    );
  }
  
  // Show error state for processing errors
  if (error) {
    return (
      <WidgetCard title="Gear Analysis" className={cn("h-full", className)}>
        <div className="h-96 w-full flex items-center justify-center">
          <span className="text-sm text-gray-500">{error}</span>
        </div>
      </WidgetCard>
    );
  }
  
  // Show empty state if no data
  if (!barData || barData.length === 0) {
    return (
      <WidgetCard title="Gear Analysis" className={cn("h-full", className)}>
        <div className="h-96 w-full flex items-center justify-center">
          <span className="text-sm text-gray-500">No gear data available for the selected filters</span>
        </div>
      </WidgetCard>
    );
  }

  // Get unique BMUs for rendering bars
  const uniqueBMUs = Object.keys(siteColors);

  return (
    <WidgetCard
      title={
        <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between w-full gap-3">
          <div className="w-full sm:w-auto">
          </div>
          <div className="hidden sm:block text-base font-medium text-gray-800 mx-auto">
            <div className="text-center">
              {getTabTitle(activeTab)}
            </div>
            <div className="text-xs text-gray-500 text-center mt-1">
              {getTabDescription(activeTab)}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <button
              className={`px-4 py-2 text-sm rounded-md transition duration-200 ${activeTab === 'distribution' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'} w-full sm:w-auto`}
              onClick={() => handleTabChange('distribution')}
            >
              {t("text-distribution-tab")}
            </button>
            {/* Only show comparison tab for non-CIA and non-AIA users */}
            {effectiveBMU && !isCiaUser && !isAiaUser && (
              <button
                className={`px-4 py-2 text-sm rounded-md transition duration-200 ${activeTab === 'comparison' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'} w-full sm:w-auto`}
                onClick={() => handleTabChange('comparison')}
              >
                {t("text-comparison-tab")}
              </button>
            )}
            <button
              className={`px-4 py-2 text-sm rounded-md transition duration-200 ${activeTab === 'ranking' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'} w-full sm:w-auto`}
              onClick={() => handleTabChange('ranking')}
            >
              {t("text-ranking-tab")}
            </button>
          </div>
        </div>
      }
      className={cn("h-full", className)}
    >
      {/* Mobile-only title - shows on small screens */}
      <div className="sm:hidden text-center mb-4">
        <div className="text-base font-medium text-gray-800">
          {getTabTitle(activeTab)}
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {getTabDescription(activeTab)}
        </div>
      </div>
      
      <SimpleBar>
        {/* Distribution View (default) - Bar chart showing distribution by BMU */}
        {activeTab === 'distribution' && (
          <div className="w-full h-96 pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={barData}
                margin={{ top: 20, right: 30, left: 20, bottom: 70 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  angle={-45} 
                  textAnchor="end" 
                  height={70}
                  tick={{ fontSize: 12, fill: "#64748b" }}
                  interval={0}
                  axisLine={{ stroke: "#cbd5e1", strokeWidth: 1 }}
                  tickLine={{ stroke: "#cbd5e1" }}
                />
                <YAxis
                  tickFormatter={(value) => formatNumber(value)}
                  tick={{ fontSize: 12, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                  label={{ 
                    value: selectedMetric === "mean_cpue" ? t('text-unit-kg-fisher-day') : 
                           selectedMetric === "mean_cpua" ? t('text-unit-kg-km2-day') : 
                           selectedMetric === "mean_rpue" ? t('text-unit-kes-fisher-day') : 
                           selectedMetric === "mean_rpua" ? t('text-unit-kes-km2-day') : 
                           selectedMetric === "mean_cost" ? t('text-unit-kes-fisher-day') : 
                           selectedMetric === "mean_profit" ? t('text-unit-kes-fisher-day') : 
                           selectedMetric === "mean_effort" ? t('text-unit-fishers-km2-day') : "",
                    angle: -90,
                    position: 'insideLeft',
                    style: { textAnchor: 'middle', fontSize: 15, fill: '#666' }
                  }}
                  width={80}
                />
                <Tooltip 
                  content={(props) => <CustomTooltip {...props} selectedMetricOption={selectedMetricOption} />} 
                  wrapperStyle={{ outline: 'none' }}
                />
                <Legend 
                  content={(props) => (
                    <CustomLegend
                      {...props}
                      visibilityState={visibilityState}
                      handleLegendClick={handleLegendClick}
                    />
                  )}
                  verticalAlign="bottom"
                  align="center"
                  wrapperStyle={{ position: 'relative', marginTop: '10px' }}
                />
                
                {Object.entries(siteColors).map(([key, color]) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    name={key}
                    fill={color}
                    stroke={color}
                    fillOpacity={(visibilityState[key]?.opacity || 1) * 0.85}
                    strokeOpacity={visibilityState[key]?.opacity || 1}
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={false}
                  />
                ))}
                
                {/* Add individual fisher bar if data is available - after BMU bars for consistent legend order */}
                {shouldFetchIndividualGearData && userFisherId && individualGearData && individualGearData.length > 0 && (
                  <Bar
                    dataKey="individualFisher"
                    name={t("text-your-performance") || "Your Performance"}
                    fill="#F79F79"
                    stroke="#F79F79"
                    fillOpacity={(visibilityState["individualFisher"]?.opacity || 1) * 0.85}
                    strokeOpacity={visibilityState["individualFisher"]?.opacity || 1}
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={false}
                  />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Comparison View - Selected BMU vs Average of Others */}
        {activeTab === 'comparison' && effectiveBMU && (
          <div className="w-full h-[600px] pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={comparisonData}
                margin={{ top: 20, right: 30, left: 20, bottom: 70 }}
                layout="vertical"
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis 
                  type="number"
                  tickFormatter={(value) => formatNumber(value)}
                  tick={{ fontSize: 12, fill: "#64748b" }}
                  axisLine={{ stroke: "#cbd5e1", strokeWidth: 1 }}
                  tickLine={{ stroke: "#cbd5e1" }}
                  label={{ 
                    value: selectedMetric === "mean_cpue" ? t('text-unit-kg-fisher-day') : 
                           selectedMetric === "mean_cpua" ? t('text-unit-kg-km2-day') : 
                           selectedMetric === "mean_rpue" ? t('text-unit-kes-fisher-day') : 
                           selectedMetric === "mean_rpua" ? t('text-unit-kes-km2-day') : 
                           selectedMetric === "mean_cost" ? t('text-unit-kes-fisher-day') : 
                           selectedMetric === "mean_profit" ? t('text-unit-kes-fisher-day') : 
                           selectedMetric === "mean_effort" ? t('text-unit-fishers-km2-day') : "",
                    position: 'insideBottom',
                    offset: -10,
                    style: { textAnchor: 'middle', fontSize: 15, fill: '#666' }
                  }}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={{ fontSize: 12, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                  width={120}
                />
                <Tooltip 
                  content={(props) => <CustomTooltip {...props} selectedMetricOption={selectedMetricOption} />} 
                  wrapperStyle={{ outline: 'none' }}
                />
                <Legend 
                  content={(props) => (
                    <CustomLegend
                      {...props}
                      visibilityState={visibilityState}
                      handleLegendClick={handleLegendClick}
                    />
                  )}
                  verticalAlign="bottom"
                  align="center"
                  wrapperStyle={{ position: 'relative', marginTop: '10px' }}
                />
                
                <Bar
                  dataKey={effectiveBMU}
                  name={effectiveBMU}
                  fill={siteColors[effectiveBMU] || "#fc3468"}
                  radius={[0, 4, 4, 0]}
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="average"
                  name={t("text-average-of-other-bmus")}
                  fill="#94a3b8"
                  radius={[0, 4, 4, 0]}
                  isAnimationActive={false}
                />
                {/* Individual fisher bar if data is available and metric is compatible */}
                {shouldFetchIndividualGearData && userFisherId && individualGearData && individualGearData.length > 0 && (
                  <Bar
                    dataKey="individualFisher"
                    name={t("text-your-performance") || "Your Performance"}
                    fill="#F79F79"
                    radius={[0, 4, 4, 0]}
                    isAnimationActive={false}
                  />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Ranking View - Treemap with improved visualization */}
        {activeTab === 'ranking' && (
          <div className="w-full h-[600px] pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <Treemap
                data={rankingData.filter(item => (visibilityState[item.name]?.opacity || 1) > 0.05)}
                dataKey="value"
                aspectRatio={1.6}
                stroke="#ffffff"
                isAnimationActive={false}
                content={<CustomizedTreemapContent />}
              >
                <Tooltip 
                  content={(props) => <TreemapTooltip {...props} selectedMetricOption={selectedMetricOption} />} 
                  wrapperStyle={{ outline: 'none' }}
                />
              </Treemap>
            </ResponsiveContainer>
          </div>
        )}
      </SimpleBar>
    </WidgetCard>
  );
}

