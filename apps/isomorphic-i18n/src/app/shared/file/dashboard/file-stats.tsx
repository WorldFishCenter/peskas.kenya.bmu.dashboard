"use client";

import { BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from "recharts";
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

type FileStatsType = {
  className?: string;
  lang?: string;
  bmu?: string;
};

interface ChartPoint {
  month: string;
  value: number | null; // BMU value
  individualValue?: number | null; // Individual fisher value for grouped bars
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

export function FileStatGrid({ className, lang, bmu }: { className?: string; lang?: string; bmu?: string }) {
  // Use client language instead of lang prop
  const clientLang = getClientLanguage();
  const { t, i18n } = useTranslation(clientLang, "common");
  
  // Track current language with state
  const [currentLang, setCurrentLang] = useState(clientLang);
  
  const [statsData, setStatsData] = useState<StatData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredMonth, setHoveredMonth] = useState<{[key: string]: { month: string; value: number | null }}>({});
  
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
  const { userBMU, shouldShowIndividualData, userFisherId, referenceBMU } = useUserPermissions();
  
  // Use effective BMU (reference or user's BMU)
  const effectiveBMU = referenceBMU || userBMU;
  
  // Calculate date range for individual data
  const dateRange = useMemo(() => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 3); // Always get last 3 months
    return { startDate, endDate };
  }, []);
  
  // Fetch individual fisher data if user has fisher permissions (use same data source as other components)
  const { fisherData } = useIndividualData(
    shouldShowIndividualData && userFisherId ? dateRange : { startDate: null, endDate: new Date() }
  );
  
  // Fetch monthly data for the effective BMU
  const { data: monthlyData, isLoading, error: queryError } = api.aggregatedCatch.monthly.useQuery(
    { bmus: effectiveBMU ? [effectiveBMU] : [] },
    {
      retry: 3,
      retryDelay: 1000,
      staleTime: 1000 * 60 * 5,
      enabled: !!effectiveBMU,
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

  // Process data - get the latest 3 months
  const processedData = useMemo(() => {
    if (!monthlyData || !effectiveBMU) return null;
    
    try {
      // Sort data by date and get latest 3 months
      const sortedData = monthlyData
        .filter(record => landingSiteMatchesQueryBmu(effectiveBMU, record.landing_site))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 3)
        .reverse(); // Reverse to show chronological order (oldest to newest)
      
      if (sortedData.length === 0) return null;
      
      return metrics.map(metric => {
        // Collect values for this metric from the 3 months
        const monthValues: ChartPoint[] = [];
        
        sortedData.forEach((record, index) => {
          const value = (record as any)[metric.field];
          if (value !== null && value !== undefined) {
            const date = new Date(record.date);
            const monthName = date.toLocaleString('default', { month: 'short' });
            monthValues.push({
              month: monthName,
              value: value,
              index: index,
              isIndividual: false
            });
          }
        });
        
        // Add individual fisher data if available - create grouped data structure
        if (shouldShowIndividualData && userFisherId && fisherData && fisherData.length > 0) {
          // Group individual data by month for the same months as BMU data
          const individualMonthlyData: Record<string, { sum: number; count: number }> = {};
          
          fisherData.forEach(record => {
            const recordDate = new Date(record.date);
            const monthKey = recordDate.toLocaleString('default', { month: 'short' });
            
            // Only include months that match our BMU months
            if (monthValues.some(mv => mv.month === monthKey)) {
              if (!individualMonthlyData[monthKey]) {
                individualMonthlyData[monthKey] = { sum: 0, count: 0 };
              }
              
              const fieldValue = (record as any)[metric.field];
              if (fieldValue !== null && fieldValue !== undefined) {
                individualMonthlyData[monthKey].sum += fieldValue;
                individualMonthlyData[monthKey].count++;
              }
            }
          });
          
          // Update monthValues to include individual data for grouped bars
          monthValues.forEach(monthValue => {
            const individualData = individualMonthlyData[monthValue.month];
            if (individualData && individualData.count > 0) {
              (monthValue as any).individualValue = individualData.sum / individualData.count;
            }
          });
        }
        
        // Get the latest month value for display instead of average
        const latestMonth = monthValues.length > 0 ? monthValues[monthValues.length - 1] : null;
        const latestValue = latestMonth?.value || 0;
        const latestMonthName = latestMonth?.month || '';
        
        return {
          id: metric.id,
          title: metric.title,
          metric: Math.round(latestValue).toLocaleString(),
          unit: metric.unit,
          chart: monthValues,
          userBMUValue: null,
          monthName: t('text-last-3-months')
        };
      });
    } catch (error) {
      console.error("Error transforming data:", error);
      return null;
    }
  }, [monthlyData, metrics, effectiveBMU, shouldShowIndividualData, userFisherId, fisherData, t]);

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
    } else if (!isLoading && !processedData && effectiveBMU) {
      setError("No statistics data available");
      setLoading(false);
    }
  }, [processedData, isLoading, queryError, effectiveBMU]);

  // Handlers
  const handleBarClick = useCallback((data: any, metricId: string) => {
    if (!data || !data.activePayload || data.activePayload.length === 0) return;
    
    const entry = data.activePayload[0];
    const month = entry.payload.month;
    const value = entry.payload.value;
    
    setHoveredMonth(prev => ({
      ...prev,
      [metricId]: { month, value }
    }));
  }, []);

  const handleMouseMove = useCallback((state: any, metricId: string) => {
    if (state.activePayload && state.activePayload.length > 0) {
      const entry = state.activePayload[0];
      const month = entry.payload.month;
      const value = entry.payload.value;
      
      setHoveredMonth(prev => ({
        ...prev,
        [metricId]: { month, value }
      }));
    }
  }, []);

  const handleMouseLeave = useCallback((metricId: string) => {
    setHoveredMonth(prev => {
      const newState = { ...prev };
      delete newState[metricId];
      return newState;
    });
  }, []);


  if (loading) return <LoadingState />;
  if (error) return <div className="min-w-[292px] w-full p-4 text-center text-gray-500">{error}</div>;
  if (!statsData.length) return <div className="min-w-[292px] w-full p-4 text-center text-gray-500">No data available</div>;

  return (
    <>
      {statsData.map((stat) => {
        // Find the metric info to get the category
        const metricInfo = metrics.find(m => m.id === stat.id);
        const isRevenueMetric = metricInfo?.category === 'revenue';
        
        // Calculate ticks that always include 0
        const calculateTicks = () => {
          const values = stat.chart.map(d => d.value).filter(v => v !== null) as number[];
          const individualValues = stat.chart.map(d => d.individualValue).filter(v => v !== null && v !== undefined) as number[];
          const allValues = [...values, ...individualValues];
          
          if (allValues.length === 0) return [0];
          const min = Math.min(0, ...allValues);
          const max = Math.max(0, ...allValues);
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
                {stat.monthName}
              </Text>
            </div>
            
            {/* <div className="flex items-baseline justify-between mt-2">
              <div className="flex items-baseline gap-2">
                <Text className="text-l font-bold text-gray-900">
                  {hoveredMonth[stat.id] 
                    ? (hoveredMonth[stat.id].value === null ? "N/A" : Math.round(hoveredMonth[stat.id].value!).toLocaleString())
                    : "Hover to see values"}
                </Text>
                <span className="text-xs font-bold text-gray-500">
                  {hoveredMonth[stat.id] ? hoveredMonth[stat.id].month : ""}
                </span>
              </div>
            </div> */}
          </div>
          
          {/* Legend for grouped bars */}
          <div className="flex items-center gap-3 text-2xs px-4 pb-2">
            <div className="flex items-center gap-1">
              <div className={cn(
                "w-1.5 h-1.5 rounded-full",
                isRevenueMetric ? "bg-amber-500" : "bg-blue-500"
              )} />
              <span>{effectiveBMU}</span>
            </div>
            {shouldShowIndividualData && userFisherId && stat.chart.some(point => point.individualValue !== undefined) && (
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-[#F79F79]" />
                <span>{t('text-you')}</span>
              </div>
            )}
          </div>
          
          <div 
            className="h-32 w-full bg-gray-50/50 transition-colors duration-200 hover:bg-gray-100/60"
            onMouseLeave={() => handleMouseLeave(stat.id)}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={stat.chart}
                margin={{ top: 15, right: 8, bottom: 0, left: 8 }}
                barGap={2}
                onMouseMove={(state) => handleMouseMove(state, stat.id)}
                onClick={(data) => handleBarClick(data, stat.id)}
                className="[&_.recharts-cartesian-grid]:hidden"
              >
                <XAxis 
                  dataKey="month" 
                  hide={false}
                  tick={(props) => {
                    const { x, y, payload } = props;
                    const isUserData = false; // This chart shows months, not BMU names
                    return (
                      <g transform={`translate(${x},${y})`}>
                        <text
                          x={0}
                          y={0}
                          dy={16}
                          textAnchor="middle"
                          fill="#666"
                          fontSize={10}
                          fontWeight={isUserData ? 'bold' : 'normal'}
                        >
                          {payload.value}
                        </text>
                      </g>
                    );
                  }}
                  textAnchor="middle"
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
                {/* BMU Data Bars */}
                <Bar
                  dataKey="value"
                  name={effectiveBMU}
                  fill={isRevenueMetric ? "rgba(245, 158, 11, 0.5)" : "rgba(59, 130, 246, 0.5)"}
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
                />
                {/* Individual Fisher Data Bars - only if data exists */}
                {shouldShowIndividualData && userFisherId && stat.chart.some(point => point.individualValue !== undefined) && (
                  <Bar
                    dataKey="individualValue"
                    name={t('text-you')}
                    fill="#F79F79"
                    radius={[2, 2, 0, 0]}
                    maxBarSize={8}
                    minPointSize={0}
                    activeBar={{ stroke: '#e67e22', strokeWidth: 1 }}
                    label={{
                      position: 'top',
                      fontSize: 8,
                      fill: '#666',
                      formatter: (value: number) => Math.round(value).toLocaleString()
                    }}
                  />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </MetricCard>
        );
      })}
    </>
  );
}

export default function FileStats({ className, lang, bmu }: FileStatsType) {
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
          <FileStatGrid className="min-w-[292px]" lang={lang} bmu={bmu} />
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