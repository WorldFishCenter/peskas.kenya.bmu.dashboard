"use client";

import { BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine, Cell } from "recharts";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useAtom } from "jotai";
import { Button, Text } from "rizzui";
import cn from "@utils/class-names";
import { useScrollableSlider } from "@hooks/use-scrollable-slider";
import { PiCaretLeftBold, PiCaretRightBold } from "react-icons/pi";
import MetricCard from "@components/cards/metric-card";
import { useTranslation } from "@/app/i18n/client";
import { getClientLanguage } from "@/app/i18n/language-link";
import { api } from "@/trpc/react";
import { useUserPermissions } from "../../analytics/core/hooks/use-user-permissions";
import { bmusAtom } from "@/app/components/filter-selector";
import { useIndividualData } from "../../analytics/individual/hooks/use-individual-data";
import { landingSiteMatchesQueryBmu } from "../../analytics/charts/utils/bmu-display-normalizer";

type FileStatsCIAType = {
  className?: string;
  lang?: string;
};

interface ChartPoint {
  bmu: string;
  value: number | null;
  index: number;
  isIndividual?: boolean; // Flag to identify individual fisher data
}

interface StatData {
  id: string;
  title: string;
  metric: string;
  unit: string;
  chart: ChartPoint[];
  userBMUValue?: number | null;
  monthName?: string;
}

const LoadingState = () => {
  return (
    <MetricCard
      title=""
      metric=""
      rounded="lg"
      chart={
        <div className="h-24 w-24 @[16.25rem]:h-28 @[16.25rem]:w-32 @xs:h-32 @xs:w-36 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-4 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
            <span className="text-sm text-gray-500">Loading chart...</span>
          </div>
        </div>
      }
      chartClassName="flex flex-col w-auto h-auto text-center justify-center"
      className="min-w-[292px] w-full max-w-full flex flex-col items-center justify-center"
    />
  );
};

export function FileStatWBCIAGrid({ className, lang }: { className?: string; lang?: string }) {
  // Use client language instead of lang prop
  const clientLang = getClientLanguage();
  const { t, i18n } = useTranslation(clientLang, "common");
  
  // Track current language with state
  const [currentLang, setCurrentLang] = useState(clientLang);
  
  const [statsData, setStatsData] = useState<StatData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredBMU, setHoveredBMU] = useState<{[key: string]: { bmu: string; value: number | null }}>({});
  const [bmus] = useAtom(bmusAtom);
  
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
  
  // Get user permissions
  const { userBMU, shouldShowIndividualData, userFisherId } = useUserPermissions();
  
  // Ensure bmus is always an array
  const safeBmus = useMemo(() => bmus || [], [bmus]);
  
  // Calculate date range for individual data
  const dateRange = useMemo(() => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 3); // Always get last 3 months
    return { startDate, endDate };
  }, []);
  
  // Fetch individual fisher data if user has fisher permissions (use same data source as BMU component)
  const { fisherData } = useIndividualData(
    shouldShowIndividualData && userFisherId ? dateRange : { startDate: null, endDate: new Date() }
  );
  
  // Fetch monthly data to get latest month values per BMU
  const { data: monthlyData, isLoading, error: queryError } = api.aggregatedCatch.monthly.useQuery(
    { bmus: safeBmus },
    {
      retry: 3,
      retryDelay: 1000,
      staleTime: 1000 * 60 * 5,
      enabled: safeBmus.length > 0,
    }
  );

  // Define metrics once with monthly API field mapping
  const metrics = useMemo(() => [
    { id: 'effort', field: 'mean_effort', title: t('text-metrics-effort'), unit: t('text-unit-fishers-km2-day'), category: 'catch' as const },
    { id: 'catch-rate', field: 'mean_cpue', title: t('text-metrics-catch-rate'), unit: t('text-unit-kg-fisher-day'), category: 'catch' as const },
    { id: 'catch-density', field: 'mean_cpua', title: t('text-metrics-catch-density'), unit: t('text-unit-kg-km2-day'), category: 'catch' as const },
    { id: 'fisher-revenue', field: 'mean_rpue', title: t('text-metrics-fisher-revenue'), unit: t('text-unit-kes-fisher-day'), category: 'revenue' as const },
    { id: 'area-revenue', field: 'mean_rpua', title: t('text-metrics-area-revenue'), unit: t('text-unit-kes-km2-day'), category: 'revenue' as const },
    { id: 'costs', field: 'mean_cost', title: t('text-metrics-trip-costs'), unit: t('text-unit-kes-fisher-day'), category: 'revenue' as const },
    { id: 'profit', field: 'mean_profit', title: t('text-metrics-profit'), unit: t('text-unit-kes-fisher-day'), category: 'revenue' as const }
  ] as const, [t]);

  // Process data - use previous month data per BMU
  const processedData = useMemo(() => {
    if (!monthlyData || safeBmus.length === 0) return null;
    
    try {
      // Get current date and calculate previous month
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth(); // 0-indexed
      
      // Calculate previous month date
      const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const previousYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      
      // Group by BMU and find records from previous month
      const previousMonthByBMU: { [key: string]: any } = {};
      
      monthlyData.forEach(record => {
        const recordDate = new Date(record.date);
        const recordYear = recordDate.getFullYear();
        const recordMonth = recordDate.getMonth();
        
        // Check if this record is from the previous month
        if (recordYear === previousYear && recordMonth === previousMonth) {
          const bmu = record.landing_site;
          previousMonthByBMU[bmu] = record;
        }
      });
      
      // If no data from previous month, fall back to latest available
      const dataByBMU = Object.keys(previousMonthByBMU).length > 0 
        ? previousMonthByBMU 
        : (() => {
            const latestByBMU: { [key: string]: any } = {};
            monthlyData.forEach(record => {
              const bmu = record.landing_site;
              if (!latestByBMU[bmu] || new Date(record.date) > new Date(latestByBMU[bmu].date)) {
                latestByBMU[bmu] = record;
              }
            });
            return latestByBMU;
          })();
      
      // Get month name for display
      const latestDate = Object.values(dataByBMU)[0]?.date;
      const monthName = latestDate 
        ? new Date(latestDate).toLocaleString('default', { month: 'long' })
        : '';
      
      return metrics.map(metric => {
        // Collect values for this metric from data per BMU
        const bmuValues: ChartPoint[] = [];
        
        Object.entries(dataByBMU).forEach(([bmu, record], index) => {
          const value = (record as any)[metric.field];
          if (value !== null && value !== undefined) {
            bmuValues.push({
              bmu: bmu,
              value: value,
              index: index,
              isIndividual: false
            });
          }
        });
        
        // Add individual fisher data if available - process same way as BMU component
        if (shouldShowIndividualData && userFisherId && fisherData && fisherData.length > 0) {
          // Process individual data to get the latest/previous month value (same logic as BMU data)
          const currentDate = new Date();
          const currentYear = currentDate.getFullYear();
          const currentMonth = currentDate.getMonth(); // 0-indexed
          
          // Calculate previous month date
          const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1;
          const previousYear = currentMonth === 0 ? currentYear - 1 : currentYear;
          
          // Find records from previous month or latest available
          const previousMonthRecords = fisherData.filter(record => {
            const recordDate = new Date(record.date);
            const recordYear = recordDate.getFullYear();
            const recordMonth = recordDate.getMonth();
            return recordYear === previousYear && recordMonth === previousMonth;
          });
          
          // If no previous month data, use latest records
          const relevantRecords = previousMonthRecords.length > 0 
            ? previousMonthRecords 
            : fisherData.slice(-30); // Last 30 days as fallback
          
          if (relevantRecords.length > 0) {
            // Calculate average for the metric field from the relevant records
            const validRecords = relevantRecords.filter(record => {
              const fieldValue = (record as any)[metric.field];
              return fieldValue !== null && fieldValue !== undefined;
            });
            
            if (validRecords.length > 0) {
              const sum = validRecords.reduce((sum, record) => sum + (record as any)[metric.field], 0);
              const individualValue = sum / validRecords.length;
              
              bmuValues.push({
                bmu: t('text-you'),
                value: individualValue,
                index: bmuValues.length,
                isIndividual: true
              });
            }
          }
        }
        
        // Sort by value descending and take top 10 (plus individual if present)
        const sortedValues = bmuValues
          .sort((a, b) => (b.value || 0) - (a.value || 0))
          .slice(0, shouldShowIndividualData && userFisherId ? 11 : 10); // Allow one extra for individual data
        
        // Calculate average for display (excluding individual data)
        const bmuOnlyValues = bmuValues.filter(v => !v.isIndividual && v.value !== null && v.value !== undefined);
        const avgValue = bmuOnlyValues.length > 0
          ? bmuOnlyValues.reduce((sum, v) => sum + (v.value || 0), 0) / bmuOnlyValues.length
          : 0;
        
        const userBMUData = bmuValues.find(
          v => !v.isIndividual && userBMU && landingSiteMatchesQueryBmu(userBMU, v.bmu)
        );
        
        return {
          id: metric.id,
          title: metric.title,
          metric: Math.round(avgValue).toLocaleString(),
          unit: metric.unit,
          chart: sortedValues,
          userBMUValue: userBMUData?.value,
          monthName: monthName
        };
      });
    } catch (error) {
      console.error("Error transforming data:", error);
      return null;
    }
  }, [monthlyData, metrics, safeBmus, userBMU, shouldShowIndividualData, userFisherId, fisherData, t]);

  // Update state based on processed data
  useEffect(() => {
    setLoading(isLoading);
    
    if (queryError) {
      console.error("API error:", queryError);
      setError("Failed to load statistics data");
      setLoading(false);
      return;
    }
    
    if (!isLoading && processedData) {
      setStatsData(processedData);
      setError(null);
      setLoading(false);
    } else if (!isLoading && !processedData && safeBmus.length > 0) {
      setError("No statistics data available");
      setLoading(false);
    }
  }, [processedData, isLoading, queryError, safeBmus.length]);

  // Handlers
  const handleBarClick = useCallback((data: any, metricId: string) => {
    if (!data || !data.activePayload || data.activePayload.length === 0) return;
    
    const entry = data.activePayload[0];
    const bmu = entry.payload.bmu;
    const value = entry.payload.value;
    
    setHoveredBMU(prev => ({
      ...prev,
      [metricId]: { bmu, value }
    }));
  }, []);

  const handleMouseMove = useCallback((state: any, metricId: string) => {
    if (state.activePayload && state.activePayload.length > 0) {
      const entry = state.activePayload[0];
      const bmu = entry.payload.bmu;
      const value = entry.payload.value;
      
      setHoveredBMU(prev => ({
        ...prev,
        [metricId]: { bmu, value }
      }));
    }
  }, []);

  const handleMouseLeave = useCallback((metricId: string) => {
    setHoveredBMU(prev => {
      const newState = { ...prev };
      delete newState[metricId];
      return newState;
    });
  }, []);

  // Custom bar shape that filters out non-DOM props
  const CustomBar = (props: any, metricCategory?: 'catch' | 'revenue') => {
    // Extract only the DOM-safe props that rect elements can accept
    const {
      x,
      y,
      width,
      height,
      payload,
      // Remove all non-DOM props that Recharts might pass
      dataKey,
      index,
      value,
      tooltipPayload,
      onClick,
      onMouseEnter,
      onMouseLeave,
      ...otherProps // This should now be safe for DOM
    } = props;
    
    // Determine fill color based on BMU and metric category
    const isRevenueMetric = metricCategory === 'revenue';
    const baseColor = isRevenueMetric ? "rgba(245, 158, 11, 0.5)" : "rgba(59, 130, 246, 0.5)"; // amber vs blue - more opaque
    
    let fill = baseColor;
    if (payload?.isIndividual) {
      fill = "#F79F79"; // Coral/orange for individual performance (consistent with other components)
    } else if (payload?.bmu && userBMU && landingSiteMatchesQueryBmu(userBMU, payload.bmu)) {
      fill = "#fc3468"; // Pink for user's BMU
    }
    
    return (
      <rect 
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fill}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      />
    );
  };

  if (loading) return <LoadingState />;
  if (error) return <div className="min-w-[292px] w-full p-4 text-center text-gray-500">{error}</div>;
  if (!statsData.length) return <div className="min-w-[292px] w-full p-4 text-center text-gray-500">No data available</div>;

  return (
    <>
      {statsData.map((stat) => {
        // Find the metric info to get the category
        const metricInfo = metrics.find(m => m.id === stat.id);
        const isRevenueMetric = metricInfo?.category === 'revenue';
        
        // Process chart data to add color information
        const chartDataWithColors = stat.chart.map(point => ({
          ...point,
          barColor: point.isIndividual 
            ? "#F79F79" 
            : userBMU && landingSiteMatchesQueryBmu(userBMU, point.bmu)
              ? "#fc3468" 
              : isRevenueMetric 
                ? "rgba(245, 158, 11, 0.5)" 
                : "rgba(59, 130, 246, 0.5)"
        }));

        // Calculate ticks that always include 0
        const calculateTicks = () => {
          const values = chartDataWithColors.map(d => d.value).filter(v => v !== null) as number[];
          if (values.length === 0) return [0];
          const min = Math.min(0, ...values);
          const max = Math.max(0, ...values);
          const range = max - min;
          if (range === 0) return [0];
          const step = Math.ceil(range / 3);
          const ticks = [];
          for (let i = min; i <= max; i += step) {
            ticks.push(i);
          }
          if (!ticks.includes(0)) ticks.push(0);
          return ticks.sort((a, b) => a - b);
        };

        return (
        <MetricCard
          key={stat.id}
          title=""
          metric={<></>}
          rounded="lg"
                      className={cn(
              "@container text-[15px]",
              "min-w-[260px] w-full max-w-full flex-1 p-0 overflow-hidden",
              // Apply color scheme based on category
              isRevenueMetric 
                ? "bg-amber-50/60" 
                : "bg-blue-50/60",
              className
            )}
        >
          <div className="p-4 pb-2">
            <div className="flex flex-col gap-1">
              <div className="flex items-baseline gap-1">
                <Text className="text-m font-medium text-gray-700">{stat.title}</Text>
                {currentLang !== 'sw' && (
                  <Text className="text-xs text-gray-400">({stat.unit})</Text>
                )}
              </div>
              <Text className="text-xs text-gray-500">
                {t('text-latest-month-comparison')} {stat.monthName ? `(${stat.monthName})` : ''} {t('text-comparison-across-bmus')}
              </Text>
            </div>
            
            <div className="flex items-baseline justify-between mt-2">
              <div className="flex items-baseline gap-2">
                <Text className="text-l font-bold text-gray-900">
                  {hoveredBMU[stat.id] 
                    ? (hoveredBMU[stat.id].value === null ? "N/A" : Math.round(hoveredBMU[stat.id].value!).toLocaleString())
                    : stat.metric}
                </Text>
                                <span className="text-xs font-bold text-gray-500">
                {hoveredBMU[stat.id] ? hoveredBMU[stat.id].bmu : t('text-average-among-all-bmus')}
              </span>
              </div>
              
            </div>
          </div>
          
          <div 
            className="h-32 w-full bg-gray-50/50 transition-colors duration-200 hover:bg-gray-100/60"
            onMouseLeave={() => handleMouseLeave(stat.id)}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={chartDataWithColors}
                margin={{ top: 15, right: 8, bottom: 25, left: 8 }}
                barGap={2}
                onMouseMove={(state) => handleMouseMove(state, stat.id)}
                onClick={(data) => handleBarClick(data, stat.id)}
                className="[&_.recharts-cartesian-grid]:hidden"
              >
                <XAxis 
                  dataKey="bmu" 
                  hide={false}
                  tick={(props) => {
                    const { x, y, payload } = props;
                    const isUserData = payload.value === t('text-you') || 
                      (userBMU && landingSiteMatchesQueryBmu(userBMU, String(payload.value)));
                    return (
                      <g transform={`translate(${x},${y})`}>
                        <text
                          x={0}
                          y={0}
                          dy={16}
                          textAnchor="end"
                          fill="#666"
                          fontSize={10}
                          fontWeight={isUserData ? 'bold' : 'normal'}
                          transform="rotate(-45)"
                        >
                          {payload.value}
                        </text>
                      </g>
                    );
                  }}
                  angle={-45}
                  textAnchor="end"
                  height={30}
                  interval={0}
                />
                <YAxis 
                  hide={false}
                  domain={[(dataMin: number) => Math.min(0, dataMin), (dataMax: number) => Math.max(0, dataMax)]}
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  tickLine={{ stroke: '#cbd5e1' }}
                  axisLine={{ stroke: '#cbd5e1', strokeWidth: 1 }}
                  width={25}
                  type="number"
                  ticks={calculateTicks()}
                  tickFormatter={(value) => {
                    if (value >= 1000) {
                      return `${(value / 1000).toFixed(0)}k`;
                    }
                    return value.toFixed(0);
                  }}
                />
                <Tooltip 
                  content={<></>}
                  isAnimationActive={false}
                />
                <ReferenceLine y={0} stroke="#666" strokeDasharray="2 2" strokeWidth={1} />
                <Bar
                  dataKey="value"
                  radius={[2, 2, 0, 0]}
                  maxBarSize={8}
                  minPointSize={0}
                  activeBar={{ stroke: '#333', strokeWidth: 1 }}
                  label={{
                    position: 'top',
                    fontSize: 8,
                    fill: '#666',
                    formatter: (value: number) => Math.round(value).toLocaleString()
                  }}
                >
                  {chartDataWithColors.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.barColor} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </MetricCard>
        );
      })}
    </>
  );
}

export default function FileStatsWBCIA({ className, lang }: FileStatsCIAType) {
  const {
    sliderEl,
    sliderPrevBtn,
    sliderNextBtn,
    scrollToTheRight,
    scrollToTheLeft,
  } = useScrollableSlider();

  return (
    <div className={cn("relative flex w-auto items-center overflow-hidden", className)}>
      <Button
        title="Prev"
        variant="text"
        ref={sliderPrevBtn}
        onClick={() => scrollToTheLeft()}
        className="!absolute -left-1 top-0 z-10 !h-full w-20 !justify-start rounded-none bg-gradient-to-r from-gray-0 via-gray-0/70 to-transparent px-0 ps-1 text-gray-500 hover:text-gray-900 3xl:hidden dark:from-gray-50 dark:via-gray-50/70"
      >
        <PiCaretLeftBold className="h-5 w-5" />
      </Button>
      <div className="w-full overflow-hidden">
        <div
          ref={sliderEl}
          className="custom-scrollbar-x grid grid-flow-col gap-5 overflow-x-auto scroll-smooth 2xl:gap-6 3xl:gap-8"
        >
          <FileStatWBCIAGrid className="min-w-[292px]" lang={lang} />
        </div>
      </div>
      <Button
        title="Next"
        variant="text"
        ref={sliderNextBtn}
        onClick={() => scrollToTheRight()}
        className="!absolute right-0 top-0 z-10 !h-full w-20 !justify-end rounded-none bg-gradient-to-l from-gray-0 via-gray-0/70 to-transparent px-0 text-gray-500 hover:text-gray-900 3xl:hidden dark:from-gray-50 dark:via-gray-50/70"
      >
        <PiCaretRightBold className="h-5 w-5" />
      </Button>
    </div>
  );
} 