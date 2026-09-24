import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  Cell
} from "recharts";
import { format } from "date-fns";
import { ChartDataPoint, MetricOption, VisibilityState } from "../utils/chart-types";
import { CustomYAxisTick } from "../utils/chart-components";
import { useTranslation } from "@/app/i18n/client";
import React, { useCallback, useEffect, useRef, useMemo } from "react";
import { BASELINE_DATA, isIslandSite } from "../utils/site-config";
import { normalizeBmuForDisplay } from "../utils/bmu-display-normalizer";
import { filterDataByTimeRange } from "../../core/utils/time-range-filter";
import { TimeRangeOption } from "@/app/components/filter-selector";

interface ComparisonChartProps {
  chartData: ChartDataPoint[];
  originalChartData?: ChartDataPoint[];
  selectedMetricOption?: MetricOption;
  siteColors: Record<string, string>;
  visibilityState: VisibilityState;
  isTablet: boolean;
  isCiaHistoricalMode?: boolean;
  historicalBmuName?: string;
  CustomLegend: (props: any) => React.ReactElement;
  selectedMetric?: string;
  selectedTimeRange?: TimeRangeOption;
  individualFisherData?: any[];
  userFisherId?: string;
}

export default function ComparisonChart({
  chartData,
  originalChartData,
  selectedMetricOption,
  siteColors,
  visibilityState,
  isTablet,
  isCiaHistoricalMode = false,
  historicalBmuName,
  CustomLegend,
  selectedMetric,
  selectedTimeRange = 'all',
  individualFisherData,
  userFisherId,
}: ComparisonChartProps) {
  const contextLang = document.documentElement.getAttribute('data-language');
  const isLangReady = document.documentElement.getAttribute('data-language-ready') === 'true';
  const { t, i18n } = useTranslation("common");
  
  // Keep a reference to translation state
  const translationsRef = useRef<Record<string, string>>({});
  
  // Keep chart data as-is to preserve color mappings
  
  // Helper function to get time range label for translations
  const getTimeRangeLabel = useCallback((timeRange: TimeRangeOption): string => {
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
  }, [t]);

  // Pre-load critical translations to avoid flicker
  useEffect(() => {
    if (contextLang) {
      const averageText = t("text-average-of-all-bmus");
      const performanceVsMsy = t("text-performance-vs-msy");
      const ciaMsyExplanation = t("text-cia-msy-comparison-explanation");
      const performanceVsMinWage = t("text-performance-vs-minimum-wage");
      const ciaMinWageExplanation = t("text-cia-minimum-wage-comparison-explanation");

      const timeRangeLabel = getTimeRangeLabel(selectedTimeRange);
      const performanceVsSelected = t("text-performance-vs-selected-average", { timeRange: timeRangeLabel });
      const ciaSelectedExplanation = t("text-cia-selected-time-comparison-explanation", { timeRange: timeRangeLabel });
      
      translationsRef.current = {
        ...translationsRef.current,
        "text-average-of-all-bmus": averageText,
        "text-performance-vs-msy": performanceVsMsy,
        "text-cia-msy-comparison-explanation": ciaMsyExplanation,
        "text-performance-vs-minimum-wage": performanceVsMinWage,
        "text-cia-minimum-wage-comparison-explanation": ciaMinWageExplanation,

        "text-performance-vs-selected-average": performanceVsSelected,
        "text-cia-selected-time-comparison-explanation": ciaSelectedExplanation,
      };
    }
  }, [contextLang, t, selectedTimeRange, getTimeRangeLabel]);
  
  // Sync with the parent language if needed
  useEffect(() => {
    if (contextLang && isLangReady && i18n.language !== contextLang) {
      i18n.changeLanguage(contextLang);
    }
  }, [contextLang, i18n, isLangReady]);
  
  // Helper to get cached translation or fall back to t function
  const getTranslation = useCallback((key: string) => {
    return translationsRef.current[key] || t(key);
  }, [t]);
  
  // Process individual fisher data for overlay
  const individualFisherChartData = useMemo(() => {
    if (!individualFisherData || !userFisherId || individualFisherData.length === 0) return [];
    
    // Apply time range filtering
    const filteredIndividualData = filterDataByTimeRange(individualFisherData, selectedTimeRange);
    
    // Convert daily fisher data to monthly aggregates
    const monthlyAggregates: Record<string, { 
      sum: number; 
      count: number; 
      date: number;
    }> = {};
    
    filteredIndividualData.forEach((record: any) => {
      const date = new Date(record.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyAggregates[monthKey]) {
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
        monthlyAggregates[monthKey] = {
          sum: 0,
          count: 0,
          date: monthStart.getTime()
        };
      }
      
      // Map BMU metrics to individual fisher metrics
      let value: number | null = null;
      if (selectedMetric === "mean_cpue" && record.mean_cpue != null) {
        value = record.mean_cpue;
      } else if (selectedMetric === "mean_rpue" && record.mean_rpue != null) {
        value = record.mean_rpue;
      } else if (selectedMetric === "mean_cpua" && record.mean_cpue != null) {
        // For BMU catch density, use individual fisher CPUE as approximation
        value = record.mean_cpue;
      } else if (selectedMetric === "mean_rpua" && record.mean_rpue != null) {
        // For BMU area revenue, use individual fisher RPUE as approximation
        value = record.mean_rpue;
      } else if (selectedMetric === "mean_cost" && record.mean_cost != null) {
        value = record.mean_cost;
      } else if (selectedMetric === "mean_profit" && record.mean_profit != null) {
        value = record.mean_profit;
      }
      
      if (value !== null) {
        monthlyAggregates[monthKey].sum += value;
        monthlyAggregates[monthKey].count++;
      }
    });
    
    // Convert to array format with absolute values
    const absoluteValues = Object.values(monthlyAggregates)
      .filter(agg => agg.count > 0)
      .map(agg => ({
        date: agg.date,
        absoluteValue: agg.sum / agg.count
      }))
      .sort((a, b) => a.date - b.date);

    // Check if we're in baseline comparison mode (CIA or WBCIA users viewing baseline data)
    const isBaselineComparisonMode = isCiaHistoricalMode ||
      (selectedMetric === 'mean_cpua' || selectedMetric === 'mean_cpue' || selectedMetric === 'mean_rpue' || selectedMetric === 'mean_effort' || selectedMetric === 'mean_profit' || selectedMetric === 'mean_cost');
    
    
    // For baseline comparison mode, calculate difference from appropriate baseline
    if (isBaselineComparisonMode) {
      let baseline: number;
      
      if (selectedMetric === 'mean_cpue' || selectedMetric === 'mean_cpua' || selectedMetric === 'mean_profit' || selectedMetric === 'mean_cost') {
        // For catch metrics, profit, and costs, use individual fisher's own average as baseline
        const individualFisherSum = absoluteValues.reduce((sum, item) => sum + item.absoluteValue, 0);
        baseline = individualFisherSum / absoluteValues.length;
      } else if (selectedMetric === 'mean_rpue') {
        // For fisher revenue, use living wage baseline (same as BMU data)
        baseline = BASELINE_DATA.INCOME.LIVING_WAGE;
      } else {
        // For other metrics, use the absolute value itself (no baseline comparison)
        return absoluteValues.map(item => ({
          date: item.date,
          individualFisher: parseFloat(item.absoluteValue.toFixed(2))
        }));
      }
      
      // Calculate difference from appropriate baseline
      return absoluteValues.map(item => ({
        date: item.date,
        individualFisher: parseFloat((item.absoluteValue - baseline).toFixed(2))
      }));
    }
    
    // For non-baseline comparison mode, return absolute values
    return absoluteValues.map(item => ({
      date: item.date,
      individualFisher: parseFloat(item.absoluteValue.toFixed(2))
    }));
  }, [individualFisherData, userFisherId, selectedMetric, selectedTimeRange, isCiaHistoricalMode]);
  
  // Check for data format - moved before mergedChartData to avoid linter error
  const hasNewDataFormat = chartData.some(point => 'difference' in point);
  
  
  // Merge BMU data with individual fisher data
  const mergedChartData = useMemo(() => {
    if (!individualFisherChartData.length) return chartData;
    
    // Create a map of individual fisher data by date
    const fisherDataMap = new Map(
      individualFisherChartData.map(item => [item.date, item.individualFisher])
    );
    
    // Check if we're in baseline comparison mode (CIA or WBCIA users viewing baseline data)
    const isBaselineComparisonMode = isCiaHistoricalMode ||
      (selectedMetric === 'mean_cpua' || selectedMetric === 'mean_cpue' || selectedMetric === 'mean_rpue' || selectedMetric === 'mean_effort' || selectedMetric === 'mean_profit' || selectedMetric === 'mean_cost');
    
    
    // Merge with BMU data
    return chartData.map(bmuPoint => {
      const fisherValue = fisherDataMap.get(bmuPoint.date);
      
      // For baseline comparison modes, always use a separate dataKey for individual fisher data
      // This applies to both CIA (difference format) and WBCIA (BMU key format) baseline comparisons
      if (isBaselineComparisonMode) {
        return {
          ...bmuPoint,
          individualFisher: fisherValue // Keep using individualFisher for consistency
        };
      }
      
      // For non-baseline comparison mode, use the standard individualFisher key
      return {
        ...bmuPoint,
        individualFisher: fisherValue
      };
    });
  }, [chartData, individualFisherChartData, isCiaHistoricalMode, selectedMetric]);
  
  // Format date for X-axis ticks
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return format(date, "MMM yyyy");
  };

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, selectedMetricOption, selectedMetric }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const formattedDate = formatDate(data.date);
      
      // Sort payload by value in descending order
      const sortedPayload = [...payload].sort((a, b) => {
        const valueA = a.value ?? -Infinity;
        const valueB = b.value ?? -Infinity;
        return valueB - valueA;
      });
      
      return (
        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
          <p className="text-sm font-medium text-gray-600 mb-2">{formattedDate}</p>
          <div className="space-y-1.5">
            {sortedPayload.map((entry: any) => (
              <div key={entry.dataKey} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <p className="text-sm">
                  <span className="font-medium">
                    {entry.dataKey === "individualFisher" ? (t("text-your-performance") || "Your Performance") : entry.name}:
                  </span>{" "}
                  <span className="font-semibold">
                    {entry.value !== undefined ? entry.value.toFixed(1) : "N/A"}
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

  // Generate bars for each BMU (for non-CIA mode)
  const renderBars = () => {
    const sites = Object.keys(siteColors)
      .filter(site => site !== "average" && site !== "historical_average")
      .filter(site => visibilityState[site]?.opacity !== 0);
    
    if (sites.length === 0) return null;
    
    return sites.flatMap((site) => {
      const displayName = normalizeBmuForDisplay(site);
      
      // Check if we're in baseline comparison mode for WBCIA users
      const isBaselineComparison = isCiaHistoricalMode && (selectedMetric === 'mean_cpua' || selectedMetric === 'mean_rpue');
      
      if (isBaselineComparison) {
        // For baseline comparisons, use regular BMU colors
        // The position above/below zero line indicates positive/negative performance
        return (
          <Bar
            key={`${site}Bar`}
            dataKey={site}
            name={displayName}
            fill={siteColors[site]}
            stroke={siteColors[site]}
            fillOpacity={(visibilityState[site]?.opacity || 1) * 0.85}
            strokeOpacity={visibilityState[site]?.opacity || 1}
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
          />
        );
      }
      
      // Regular bars for non-baseline comparison
      return (
      <Bar
        key={`${site}Bar`}
        dataKey={site}
        name={displayName}
        fill={siteColors[site]}
        stroke={siteColors[site]}
        fillOpacity={(visibilityState[site]?.opacity || 1) * 0.85}
        strokeOpacity={visibilityState[site]?.opacity || 1}
        radius={[4, 4, 0, 0]}
        stackId={site}
        isAnimationActive={false}
      />
      );
    });
  };

  // Custom Legend for difference data
  const renderCustomLegend = (props: any) => {
    if (!CustomLegend) return null;
    
    // For CIA historical mode, use simple legend with BMU and individual fisher
    if (isCiaHistoricalMode) {
      // For single BMU comparison (CIA users with 'difference' data)
      if (hasNewDataFormat) {
        // Create simple payload with BMU and individual fisher
        const customPayload = [
          {
            value: historicalBmuName || 'BMU',
            type: 'rect',
            color: '#fc3468', // BMU color
            id: 'bmu-data'
          }
        ];
        
        // Add individual fisher legend if data is available
        if (individualFisherData && userFisherId) {
          customPayload.push({
            value: t("text-your-performance") || "Your Performance",
            type: 'rect',
            color: '#F79F79',
            id: 'individual-fisher'
          });
        }
      
        return <CustomLegend {...props} payload={customPayload} />;
      }
      
      // For WBCIA/admin users with multiple BMUs, use default legend to show BMU names
      return <CustomLegend {...props} />;
    }
    
    // Use default legend for other cases
    return <CustomLegend {...props} />;
  };

  if (!chartData.length) return null;

  // Validate if we have any CIA data to display
  const hasValidCiaData = () => {
    if (!isCiaHistoricalMode) return true;
    
    // For WBCIA users with baseline comparisons
    if (selectedMetric === 'mean_cpua' || selectedMetric === 'mean_cpue' || selectedMetric === 'mean_rpue' || selectedMetric === 'mean_effort' || selectedMetric === 'mean_profit' || selectedMetric === 'mean_cost') {
      // Check if we have any BMU data (excluding date)
      return chartData.some(point => {
        const keys = Object.keys(point).filter(k => k !== 'date');
        return keys.length > 0 && keys.some(k => point[k] !== undefined);
      });
    }
    
    if (hasNewDataFormat) {
      return chartData.some(point => point.difference !== undefined);
    }
    
    if (historicalBmuName) {
      return chartData.some(point => point[historicalBmuName] !== undefined);
    }
    
    return false;
  };
  
  // Show a message if no data is available for CIA mode
  if (isCiaHistoricalMode && !hasValidCiaData()) {
    return (
      <div className="h-96 w-full pt-9 flex items-center justify-center">
        <p className="text-gray-500">{t('text-no-comparison-data-available') || 'No comparison data available'}</p>
      </div>
    );
  }

  // Calculate Y-axis domain with a proper range for negative values
  const calculateYDomain = () => {
    let minValue = 0;
    let maxValue = 0;
    
    if (isCiaHistoricalMode && hasNewDataFormat) {
      // Extract all difference values, which can be positive or negative
      const values = mergedChartData
        .map(item => (item as any).difference)
        .filter(value => value !== undefined) as number[];
      
      if (values.length > 0) {
        minValue = Math.min(0, ...values); // Ensure we include 0
        maxValue = Math.max(0, ...values); // Ensure we include 0
      } else {
        return [-10, 10]; // Default domain if no values
      }
    } else {
      // For non-CIA users or legacy format - use merged data to include individual fisher data
      const allValues: number[] = [];
      
      mergedChartData.forEach(item => {
        Object.entries(item).forEach(([key, value]) => {
          if (key !== 'date' && value !== undefined && typeof value === 'number') {
            allValues.push(value);
          }
        });
      });
      
      if (allValues.length > 0) {
        minValue = Math.min(0, ...allValues);
        maxValue = Math.max(0, ...allValues);
      } else {
        return [0, 10]; // Default domain for non-CIA mode
      }
    }
    
    // Add padding for better visualization
    const padding = Math.max(Math.abs(minValue), Math.abs(maxValue)) * 0.2;
    
    return [
      minValue - (minValue < 0 ? padding : 0), 
      maxValue + padding
    ] as [number, number];
  };

  const yDomain = calculateYDomain();

  return (
    <div className="h-96 w-full pt-9">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={mergedChartData}
          margin={{ top: 10, right: 30, left: 10, bottom: 0 }}
          barCategoryGap="30%"
          barSize={20}
        >
          <CartesianGrid 
            strokeDasharray="3 3" 
            vertical={false}
            stroke="#e2e8f0" 
            strokeOpacity={0.7}
          />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            axisLine={false}
            tick={{ fontSize: 12 }}
            minTickGap={15}
            padding={{ left: 20, right: 20 }}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={(value) => value.toFixed(1)}
            axisLine={false}
            tick={(props) => <CustomYAxisTick {...props} metric={selectedMetric} />}
            width={80}
            domain={yDomain}
            label={{ 
              value: selectedMetric === "mean_cpue" ? t('text-unit-kg-fisher-day') : 
                     selectedMetric === "mean_cpua" ? t('text-unit-kg-km2-day') : 
                     selectedMetric === "mean_rpue" ? t('text-unit-kes-fisher-day') : 
                     selectedMetric === "mean_rpua" ? t('text-unit-kes-km2-day') : 
                     selectedMetric === "mean_effort" ? t('text-unit-fishers-km2-day') : 
                     selectedMetricOption?.category === "catch" ? "Avg. catch (kg/fisher/month)" : "",
              angle: -90,
              position: 'insideLeft',
              style: { textAnchor: 'middle', fontSize: 12, fill: '#666' }
            }}
          />
          <Tooltip
            content={(props) => (
              <CustomTooltip
                {...props}
                selectedMetricOption={selectedMetricOption}
                selectedMetric={selectedMetric}
              />
            )}
            wrapperStyle={{ outline: "none" }}
          />
          
          {/* Zero reference line - critical for negative values visualization */}
          <ReferenceLine y={0} stroke="#000" strokeWidth={1} />
          
          {/* Add baseline reference lines only when NOT showing baseline comparisons */}
          {!isCiaHistoricalMode && selectedMetric === "mean_cpua" && (
            <>
              <ReferenceLine
                y={BASELINE_DATA.CPUA.MSY.FRINGING}
                stroke="#22c55e"
                strokeDasharray="8 4"
                strokeWidth={2}
                label={{ value: "MSY Fringing", position: "left", fill: "#22c55e", fontSize: 11 }}
              />
              <ReferenceLine
                y={BASELINE_DATA.CPUA.MSY.ISLAND}
                stroke="#16a34a"
                strokeDasharray="8 4"
                strokeWidth={2}
                label={{ value: "MSY Island", position: "left", fill: "#16a34a", fontSize: 11 }}
              />
              <ReferenceLine
                y={BASELINE_DATA.CPUA.CURRENT.FRINGING}
                stroke="#f59e0b"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{ value: "Current Fringing", position: "left", fill: "#f59e0b", fontSize: 11 }}
              />
              <ReferenceLine
                y={BASELINE_DATA.CPUA.CURRENT.ISLAND}
                stroke="#ea580c"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{ value: "Current Island", position: "left", fill: "#ea580c", fontSize: 11 }}
              />
            </>
          )}
          
          {!isCiaHistoricalMode && selectedMetric === "mean_rpue" && (
            <>
              <ReferenceLine
                y={BASELINE_DATA.INCOME.POVERTY_LINE}
                stroke="#ef4444"
                strokeDasharray="3 3"
                strokeWidth={1.5}
                label={{ value: t("text-poverty-line"), position: "left", fill: "#ef4444", fontSize: 11 }}
              />
              <ReferenceLine
                y={BASELINE_DATA.INCOME.NATIONAL_MINIMUM_WAGE}
                stroke="#f59e0b"
                strokeDasharray="3 3"
                strokeWidth={1.5}
                label={{ value: t("text-minimum-wage"), position: "left", fill: "#f59e0b", fontSize: 11 }}
              />
              <ReferenceLine
                y={BASELINE_DATA.INCOME.LIVING_WAGE}
                stroke="#22c55e"
                strokeDasharray="3 3"
                strokeWidth={1.5}
                label={{ value: t("text-living-wage"), position: "left", fill: "#22c55e", fontSize: 11 }}
              />
            </>
          )}
          
          
          {/* Month delimiters - ensure all months are shown */}
          {(() => {
            // Get all dates in sorted order
            const dates = mergedChartData.map(item => item.date).sort((a, b) => a - b);
            if (dates.length === 0) return null;
            
            // Only show every other month's delimiter to avoid overcrowding
            return dates.filter((_, index) => index % 2 === 0).map(date => (
              <ReferenceLine 
                key={`vline-${date}`}
                x={date}
                stroke="#e2e8f0"
                strokeWidth={1}
                strokeOpacity={0.7}
                strokeDasharray="3 3"
              />
            ));
          })()}
          
          {/* CIA mode with difference data */}
          {isCiaHistoricalMode && hasNewDataFormat ? (
            <Bar
              dataKey="difference"
              name={historicalBmuName || 'BMU'}
              fill="#fc3468" // BMU color
              fillOpacity={0.85}
              strokeOpacity={1}
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
            />
          ) : (
            // Regular rendering for non-CIA mode
            renderBars()
          )}
          
          {/* Add individual fisher bar if data is available - after BMU bars for consistent legend order */}
          {individualFisherData && userFisherId && (
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
          
          {/* Use custom legend implementation to show both colors */}
          <Legend content={renderCustomLegend} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
} 