"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import { useAtom } from "jotai";
import WidgetCard from "@components/cards/widget-card";
import SimpleBar from "@ui/simplebar";
import { useTranslation } from "@/app/i18n/client";
import { getClientLanguage } from "@/app/i18n/language-link";
import { api } from "@/trpc/react";
import { bmusAtom, selectedMetricAtom, selectedTimeRangeAtom } from "@/app/components/filter-selector";
import cn from "@utils/class-names";
import MetricCard from "@components/cards/metric-card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

// Import shared components and types
import { MetricOption } from "../../charts/utils/chart-types";
import useUserPermissions from "../../core/hooks/use-user-permissions";
import { generateColor, updateBmuColorRegistry, getSortedBmuList } from "../../charts/utils/chart-utils";
import { useIndividualFisherDataOnly } from "../../individual/hooks/use-individual-data";
import { normalizeBmuForDisplay, landingSiteMatchesQueryBmu } from "../../charts/utils/bmu-display-normalizer";

// Import time range filtering utilities
import { filterDataByTimeRange, getTimeRangeStartDate } from "../../core/utils/time-range-filter";

// Define METRIC_OPTIONS consistent with other components
const METRIC_OPTIONS: MetricOption[] = [
  {
    value: "mean_effort",
    label: "Effort",
    unit: "fishers/km²/day",
    category: "catch",
  },
  {
    value: "mean_cpue",
    label: "Catch Rate",
    unit: "kg/fisher/day",
    category: "catch",
  },
  {
    value: "mean_cpua",
    label: "Catch Density",
    unit: "kg/km²/day",
    category: "catch",
  },
  {
    value: "mean_rpue",
    label: "Fisher Revenue",
    unit: "KES/fisher/day",
    category: "revenue",
  },
  {
    value: "mean_rpua",
    label: "Area Revenue",
    unit: "KES/km²/day",
    category: "revenue",
  },
  {
    value: "mean_cost",
    label: "Trip Costs",
    unit: "KES/fisher/day",
    category: "revenue",
  },
  {
    value: "mean_profit",
    label: "Profit",
    unit: "KES/fisher/day",
    category: "revenue",
  },
];

const formatNumber = (value: number) => {
  if (value >= 1000) {
    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 0,
    }).format(value);
  }
  return value.toFixed(1);
};

interface BMURankingData {
  name: string;
  value: number;
  fill: string;
  rank: number;
  isIndividualFisher?: boolean;
  originalBmuName?: string; // Keep original BMU name for filtering
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
const CustomTooltip = ({ active, payload, selectedMetricOption }: any) => {
  const { t } = useTranslation("common");

  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
        <p className="text-sm font-medium text-gray-600 mb-2">
          #{data.rank} - {data.name}
        </p>
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: data.fill }}
          />
          <p className="text-sm">
            <span className="font-medium">{selectedMetricOption?.label}:</span>{" "}
            <span className="font-semibold">
              {data.value !== undefined && data.value !== null
                ? formatNumber(data.value)
                : t("text-na")}
            </span>
            {selectedMetricOption?.unit && (
              <span className="text-gray-500 ml-1">
                {selectedMetricOption.unit}
              </span>
            )}
          </p>
        </div>
      </div>
    );
  }
  return null;
};

// Custom Y-axis tick to highlight effective BMU and individual fisher data
const CustomYAxisTick = ({ x = 0, y = 0, payload = { value: '' }, effectiveBMU, isIndividualFisher }: any) => {
  const isEffectiveBMU =
    effectiveBMU && landingSiteMatchesQueryBmu(effectiveBMU, payload.value as string);
  const isYourPerformance = isIndividualFisher;

  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={-5}
        y={0}
        dy={4}
        textAnchor="end"
        className={cn(
          "text-xs",
          isYourPerformance ? "fill-blue-600 font-bold" : 
          isEffectiveBMU ? "fill-blue-600 font-semibold" : "fill-gray-500"
        )}
      >
        {payload.value}
      </text>
      {isEffectiveBMU && !isYourPerformance && (
        <text
          x={-5}
          y={0}
          dy={16}
          textAnchor="end"
          className="text-[10px] fill-blue-500"
        >
          (Your BMU)
        </text>
      )}
      {isYourPerformance && (
        <text
          x={-5}
          y={0}
          dy={16}
          textAnchor="end"
          className="text-[10px] fill-blue-600 font-medium"
        >
          (You)
        </text>
      )}
    </g>
  );
};

export default function BMURanking({
  className,
  lang,
  bmu,
}: {
  className?: string;
  lang?: string;
  bmu?: string;
}) {
  // Use client language instead of lang prop
  const clientLang = getClientLanguage();
  const { t, i18n } = useTranslation(clientLang, "common");
  
  // Track current language with state
  const [currentLang, setCurrentLang] = useState(clientLang);
  
  const [rankingData, setRankingData] = useState<BMURankingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bmus] = useAtom(bmusAtom);
  const [selectedMetric] = useAtom(selectedMetricAtom);
  const [selectedTimeRange] = useAtom(selectedTimeRangeAtom);

  // Add refs to track initialization states
  const dataProcessed = useRef<boolean>(false);
  const previousMetric = useRef<string>(selectedMetric);
  const previousBmus = useRef<string[]>(bmus);
  const previousTimeRangeRef = useRef<string>(selectedTimeRange);

  // Use the centralized permissions hook
  const {
    userBMU,
    referenceBMU,
    isCiaUser,
    isAiaUser,
    isAdmin,
    getAccessibleBMUs,
    hasRestrictedAccess,
    shouldShowIndividualData,
    userFisherId,
  } = useUserPermissions();

  // Determine which BMU to use for highlighting - prefer passed prop, then reference BMU (for admins), then user's BMU
  const effectiveBMU = bmu || referenceBMU || userBMU;

  // Ensure bmus is always an array
  const safeBmus = useMemo(() => bmus || [], [bmus]);

  // Calculate date range based on selected time range for individual data
  const dateRange = useMemo(() => {
    const endDate = new Date();
    const startDate = getTimeRangeStartDate(selectedTimeRange, endDate);
    return { startDate, endDate };
  }, [selectedTimeRange]);

  // Fetch individual fisher data
  const { fisherData, isLoadingFisherData } = useIndividualFisherDataOnly(
    shouldShowIndividualData ? dateRange : undefined
  );

  // Helper function to check if current metric is compatible with individual fisher data
  const isMetricCompatibleWithIndividualData = useMemo(() => {
    // Individual fishers only have direct data for CPUE, RPUE, costs, and profit
    const compatibleMetrics = ['mean_cpue', 'mean_rpue', 'mean_cost', 'mean_profit'];
    return compatibleMetrics.includes(selectedMetric);
  }, [selectedMetric]);

  // Fetch aggregated monthly data for BMU ranking
  const { data: rawData, refetch } = api.aggregatedCatch.monthly.useQuery(
    { bmus: safeBmus },
    {
      refetchOnMount: true,
      refetchOnWindowFocus: false,
      retry: 3,
      enabled: safeBmus.length > 0,
    }
  );

  // Track selectedTimeRange changes and force data reprocessing
  useEffect(() => {
    if (previousTimeRangeRef.current !== selectedTimeRange) {
      previousTimeRangeRef.current = selectedTimeRange;
      setRankingData([]);
      dataProcessed.current = false;
      setLoading(true);
    }
  }, [selectedTimeRange]);

  // Force refetch when bmus changes
  useEffect(() => {
    if (JSON.stringify(previousBmus.current) !== JSON.stringify(safeBmus)) {
      dataProcessed.current = false;
      previousBmus.current = [...safeBmus];
      refetch();
    }
  }, [safeBmus, refetch]);

  // Listen for language changes
  useEffect(() => {
    const handleLanguageChange = (event: CustomEvent) => {
      setCurrentLang(event.detail.language);
      
      // Make sure i18n instance is updated
      if (i18n.language !== event.detail.language) {
        i18n.changeLanguage(event.detail.language);
      }
    };
    
    window.addEventListener('i18n-language-changed', handleLanguageChange as EventListener);
    return () => {
      window.removeEventListener('i18n-language-changed', handleLanguageChange as EventListener);
    };
  }, [i18n]);

  const selectedMetricOption = METRIC_OPTIONS.find(
    (m) => m.value === selectedMetric
  );

  useEffect(() => {
    if (!rawData) return;

    // Reset data processing flag if metric or time range has changed
    if (previousMetric.current !== selectedMetric) {
      dataProcessed.current = false;
      previousMetric.current = selectedMetric;
    }

    // Skip processing if already done and not changing key dependencies
    if (dataProcessed.current) return;

    // Wait for individual data to load if it should be shown and is loading
    if (shouldShowIndividualData && isMetricCompatibleWithIndividualData && isLoadingFisherData) {
      setLoading(true); // Ensure loading state is maintained
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Apply time range filtering to the data before processing
      const filteredRawData = filterDataByTimeRange(rawData, selectedTimeRange, 'date');

      // Group data by BMU and calculate averages
      const bmuAverages: Record<string, { total: number; count: number }> = {};

      filteredRawData.forEach((item: any) => {
        const bmuName = item.landing_site;
        const value = item[selectedMetric];

        if (value !== undefined && value !== null && typeof value === 'number') {
          if (!bmuAverages[bmuName]) {
            bmuAverages[bmuName] = { total: 0, count: 0 };
          }
          bmuAverages[bmuName].total += value;
          bmuAverages[bmuName].count += 1;
        }
      });

      // Get all BMU names and sort them consistently 
      const bmuNamesUnsorted = Object.keys(bmuAverages);
      const bmuNames = getSortedBmuList(bmuNamesUnsorted);
      updateBmuColorRegistry(bmuNames);

      const accessibleBMUsOriginal = hasRestrictedAccess
        ? getAccessibleBMUs(bmuNames)
        : bmuNames;

      // Calculate averages and create ranking data
      const newRankingData: BMURankingData[] = Object.entries(bmuAverages)
        .map(([bmuName, data]) => ({
          name: normalizeBmuForDisplay(bmuName),
          value: Number((data.total / data.count).toFixed(2)),
          fill: generateColor(0, bmuName, effectiveBMU),
          rank: 0, // Will be set after sorting
          isIndividualFisher: false,
          originalBmuName: bmuName, // Keep original for filtering
        }));

      // Add individual fisher data if available and compatible
      if (shouldShowIndividualData && isMetricCompatibleWithIndividualData && fisherData && fisherData.length > 0 && userFisherId) {
        // Filter individual data by the same time range used for BMU data
        const filteredFisherData = filterDataByTimeRange(fisherData, selectedTimeRange, 'date');
        
        // Calculate individual fisher average for the selected metric
        let individualTotal = 0;
        let individualCount = 0;
        
        filteredFisherData.forEach((record: any) => {
          let value: number | null = null;
          if (selectedMetric === "mean_cpue" && record.mean_cpue != null) {
            value = record.mean_cpue;
          } else if (selectedMetric === "mean_rpue" && record.mean_rpue != null) {
            value = record.mean_rpue;
          } else if (selectedMetric === "mean_cost" && record.mean_cost != null) {
            value = record.mean_cost;
          } else if (selectedMetric === "mean_profit" && record.mean_profit != null) {
            value = record.mean_profit;
          }
          
          if (value !== null) {
            individualTotal += value;
            individualCount++;
          }
        });
        
        if (individualCount > 0) {
          const individualAverage = Number((individualTotal / individualCount).toFixed(2));
          
          // Add individual fisher data to ranking
          newRankingData.push({
            name: t("text-your-performance") || "Your Performance",
            value: individualAverage,
            fill: "#F79F79", // Coral color consistent with other individual data components
            rank: 0, // Will be set after sorting
            isIndividualFisher: true,
          });
        }
      }

      // Sort all data (BMUs + individual) and assign ranks
      const sortedRankingData = newRankingData
        .sort((a, b) => b.value - a.value)
        .map((item, index) => ({
          ...item,
          rank: index + 1,
        }));

      // Filter based on user permissions using original BMU names
      const filteredRankingData = sortedRankingData.filter(item => {
        if (item.isIndividualFisher) return true;
        if (item.originalBmuName) {
          return accessibleBMUsOriginal.some(accessible =>
            landingSiteMatchesQueryBmu(accessible, item.originalBmuName!)
          );
        }
        return true;
      });

      setRankingData(filteredRankingData);
      dataProcessed.current = true;
      setError(null);
    } catch (error) {
      console.error("Error transforming BMU ranking data:", error);
      setError("Error processing data");
    } finally {
      setLoading(false);
    }
  }, [rawData, selectedMetric, selectedTimeRange, effectiveBMU, referenceBMU, hasRestrictedAccess, getAccessibleBMUs, shouldShowIndividualData, isMetricCompatibleWithIndividualData, fisherData, userFisherId, t, isLoadingFisherData]);

  // Reserve enough horizontal space for long BMU labels (Recharts clips ticks if YAxis width is too small)
  const yAxisWidth = useMemo(() => {
    if (!rankingData?.length) return 140;
    const maxPrimaryLen = Math.max(
      ...rankingData.map((r) => (r.name ?? "").length)
    );
    // ~6.5px per char for text-xs; cap keeps very wide containers reasonable on huge lists
    const fromLabels = Math.ceil(maxPrimaryLen * 6.5 + 28);
    return Math.min(340, Math.max(120, fromLabels));
  }, [rankingData]);

  // If in CIA or AIA mode, don't render the ranking as it doesn't make sense to show a comparison
  // ranking with just one BMU
  if (isCiaUser || isAiaUser) {
    return null;
  }

  if (loading) return <LoadingState />;
  if (error) return <LoadingState />;
  if (!rankingData || rankingData.length === 0) return <LoadingState />;

  // Dynamic title and description based on selected metric
  const getTitle = () => {
    if (selectedMetricOption?.category === 'revenue') {
      return t("text-bmu-ranking-title-revenue");
    }
    return t("text-bmu-ranking-title-catch");
  };

  const getDescription = () => {
    const metricLabel = selectedMetricOption?.label || t("text-selected-metric");
    const unit = selectedMetricOption?.unit || "";

    if (selectedMetricOption?.value === 'mean_effort') {
      return t("text-bmu-ranking-description-effort", { metric: metricLabel, unit: unit });
    }
    if (selectedMetricOption?.value === 'mean_cost') {
      return t("text-bmu-ranking-description-cost", { metric: metricLabel, unit: unit });
    }
    if (selectedMetricOption?.category === 'revenue') {
      return t("text-bmu-ranking-description-revenue", { metric: metricLabel, unit: unit });
    }
    return t("text-bmu-ranking-description-catch", { metric: metricLabel, unit: unit });
  };

  return (
    <WidgetCard
      title={
        <div className="flex flex-col sm:flex-row items-start sm:items-center w-full gap-3">
          <div className="hidden sm:block text-base font-medium text-gray-800 flex-1">
            <div className="text-center">
              {getTitle()}
            </div>
          </div>
        </div>
      }
      className={cn("h-full", className)}
    >
      {/* Mobile-only title - shows on small screens */}
      <div className="sm:hidden text-center mb-4">
        <div className="text-base font-medium text-gray-800">
          {getTitle()}
        </div>
      </div>

      <SimpleBar>
        <div className="w-full pt-4" style={{ height: Math.max(300, rankingData.length * 40 + 220) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={rankingData}
              margin={{ top: 20, right: 30, left: 12, bottom: 60 }}
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
                  value: selectedMetricOption?.value === "mean_effort" ? t('text-unit-fishers-km2-day') :
                         selectedMetricOption?.value === "mean_cpue" ? t('text-unit-kg-fisher-day') :
                         selectedMetricOption?.value === "mean_cpua" ? t('text-unit-kg-km2-day') :
                         selectedMetricOption?.value === "mean_rpue" ? t('text-unit-kes-fisher-day') :
                         selectedMetricOption?.value === "mean_rpua" ? t('text-unit-kes-km2-day') :
                         selectedMetricOption?.value === "mean_cost" ? t('text-unit-kes-fisher-day') :
                         selectedMetricOption?.value === "mean_profit" ? t('text-unit-kes-fisher-day') :
                         "Value",
                  position: 'insideBottom',
                  offset: -10,
                  style: {
                    fontSize: 14,
                    fill: "#475569",
                    fontWeight: 500
                  }
                }}
              />
              <YAxis
                dataKey="name"
                type="category"
                tick={(props) => <CustomYAxisTick 
                  {...props} 
                  effectiveBMU={effectiveBMU} 
                  isIndividualFisher={rankingData.find(item => item.name === props.payload?.value)?.isIndividualFisher || false}
                />}
                axisLine={false}
                tickLine={false}
                width={yAxisWidth}
              />
              <Tooltip
                content={(props) => <CustomTooltip {...props} selectedMetricOption={selectedMetricOption} />}
                wrapperStyle={{ outline: 'none' }}
              />
              <Bar
                dataKey="value"
                name={selectedMetricOption?.label || "Value"}
                radius={[0, 4, 4, 0]}
                isAnimationActive={false}
              >
                {rankingData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </SimpleBar>
    </WidgetCard>
  );
} 