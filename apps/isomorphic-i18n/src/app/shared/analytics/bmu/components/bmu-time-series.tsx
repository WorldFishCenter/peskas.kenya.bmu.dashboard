import WidgetCard from "@components/cards/widget-card";
import { useAtom } from "jotai";
import { useEffect, useState, useCallback } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Line,
  ReferenceLine,
  BarChart,
  Bar,
  ComposedChart,
} from "recharts";

import { bmusAtom, selectedTimeRangeAtom } from "@/app/components/filter-selector";
import { useTranslation } from "@/app/i18n/client";
import { api } from "@/trpc/react";
import { useMedia } from "@hooks/use-media";
import SimpleBar from "@ui/simplebar";
import cn from "@utils/class-names";
import { ActionIcon, Popover } from "rizzui";
import { useSession } from "next-auth/react";
import { generateColor, updateBmuColorRegistry, getSortedBmuList } from "../../charts/utils/chart-utils";
import { MetricKey, METRIC_OPTIONS } from "../../charts/utils/chart-types";
import useUserPermissions from "../../core/hooks/use-user-permissions";
import { getClientLanguage } from "@/app/i18n/language-link";
import { filterDataByTimeRange } from "../../core/utils/time-range-filter";
import { landingSiteMatchesQueryBmu } from "../../charts/utils/bmu-display-normalizer";

// Add local formatNumber function to replace the import
const formatNumber = (num: number, precision = 0): string => {
  if (isNaN(num)) return '0';
  return num.toLocaleString(undefined, {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision
  });
};

interface ChartDataPoint {
  date: number;
  average?: number;
  [key: string]: number | undefined;
}

interface ApiDataPoint {
  date: string;
  landing_site: string;
  mean_effort: number;
  mean_cpue: number;
  mean_cpua: number;
  mean_rpue: number;
  mean_rpua: number;
}

interface MetricOption {
  value: MetricKey;
  label: string;
  unit: string;
  category: "catch" | "revenue";
}

interface CatchMetricsChartProps {
  className?: string;
  lang?: string;
  selectedMetric: MetricKey;
  onMetricChange: (metric: MetricKey) => void;
  bmu?: string;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    name?: string;
    dataKey: string | number;
    color: string;
    payload?: {
      average?: number;
      [key: string]: any;
    };
  }>;
  label?: string | number;
  separator?: string;
  selectedMetric: MetricKey;
  selectedMetricOption: MetricOption | undefined;
  visibilityState?: VisibilityState;
}

interface VisibilityState {
  [key: string]: {
    opacity: number;
  };
}

type TickProps = {
  x?: number;
  y?: number;
  payload?: {
    value: number;
  };
};

// Get positive and negative colors for each site
const getBarColor = (baseColor: string, isPositive: boolean): string => {
  // For positive values, use the original color
  if (isPositive) {
    return baseColor;
  }
  
  // For negative values, use a darker shade of the color
  // This creates better visual distinction while maintaining the color identity
  return baseColor === "#fc3468" ? "#d71e50" : baseColor;
};

const LoadingState = () => {
  return (
    <WidgetCard title="">
      <div className="h-96 w-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
          <span className="text-sm text-gray-500">Loading chart...</span>
        </div>
      </div>
    </WidgetCard>
  );
};

const MetricSelector = ({
  selectedMetric,
  onMetricChange,
  selectedMetricOption,
}: {
  selectedMetric: MetricKey;
  onMetricChange: (metric: MetricKey) => void;
  selectedMetricOption: MetricOption | undefined;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useTranslation("common");

  const groupedMetrics = {
    catch: METRIC_OPTIONS.filter((m) => m.category === "catch"),
    revenue: METRIC_OPTIONS.filter((m) => m.category === "revenue"),
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Popover isOpen={isOpen} setIsOpen={setIsOpen} placement="bottom-end">
          <Popover.Trigger>
            <ActionIcon
              variant="text"
              className={cn(
                "relative min-w-[180px] h-auto px-4 py-2 rounded-full flex items-center justify-between",
                selectedMetric === "mean_rpue" || selectedMetric === "mean_rpua"
                  ? "bg-amber-50 text-amber-900"
                  : "bg-blue-50 text-blue-900"
              )}
            >
              <span className="text-sm font-medium">
                {selectedMetricOption?.label}
              </span>
              <svg
                className="h-4 w-4 ml-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </ActionIcon>
          </Popover.Trigger>{" "}
          <Popover.Content
            className="w-[280px] p-2 bg-white/75 backdrop-blur-sm"
          >
            <div className="grid grid-cols-1 gap-2">
              {/* Catch Metrics Section */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-sm font-semibold text-gray-900">
                    {t("text-metrics-catch")}
                  </span>
                </div>
                <div className="space-y-1 pl-4">
                  {groupedMetrics.catch.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        onMetricChange(option.value);
                        setIsOpen(false);
                      }}
                      className={cn(
                        "w-full px-3 py-2 text-left text-sm transition duration-200 rounded-md flex items-center justify-between",
                        selectedMetric === option.value
                          ? "bg-blue-50/90 text-blue-900"
                          : "text-gray-600 hover:bg-gray-50/90"
                      )}
                    >
                      <span>{t(`text-metrics-${option.label.toLowerCase().replace(/ /g, "-")}`)}</span>
                      <span className="text-xs text-gray-500">
                        {option.unit}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-gray-200 my-2" />

              {/* Revenue Metrics Section */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-2">
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-sm font-semibold text-gray-900">
                    {t("text-metrics-revenue")}
                  </span>
                </div>
                <div className="space-y-1 pl-4">
                  {groupedMetrics.revenue.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        onMetricChange(option.value);
                        setIsOpen(false);
                      }}
                      className={cn(
                        "w-full px-3 py-2 text-left text-sm transition duration-200 rounded-md flex items-center justify-between",
                        selectedMetric === option.value
                          ? "bg-amber-50 text-amber-900"
                          : "text-gray-600 hover:bg-gray-50"
                      )}
                    >
                      <span>{t(`text-metrics-${option.label.toLowerCase().replace(/ /g, "-")}`)}</span>
                      <span className="text-xs text-gray-500">
                        {option.unit}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Popover.Content>
        </Popover>
      </div>
    </div>
  );
};

function CustomYAxisTick({ x = 0, y = 0, payload = { value: 0 } }: TickProps) {
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={16}
        textAnchor="end"
        className="text-xs fill-gray-500"
      >
        {payload.value.toFixed(1)}
      </text>
    </g>
  );
}

const calculateTrendline = (data: { date: number; difference?: number }[]) => {
  if (data.length === 0) return { slope: 0, intercept: 0 };

  // Calculate means
  const meanX = data.reduce((sum, point) => sum + point.date, 0) / data.length;
  const meanY = data.reduce((sum, point) => sum + (point.difference ?? 0), 0) / data.length;

  // Calculate slope using covariance and variance
  const numerator = data.reduce((sum, point) => {
    return sum + (point.date - meanX) * ((point.difference ?? 0) - meanY);
  }, 0);

  const denominator = data.reduce((sum, point) => {
    return sum + Math.pow(point.date - meanX, 2);
  }, 0);

  const slope = numerator / denominator;
  const intercept = meanY - slope * meanX;

  // Calculate monthly slope for display
  const msPerMonth = 30 * 24 * 60 * 60 * 1000;
  const monthlySlope = slope * msPerMonth;

  return { 
    slope,           // For the visualization
    intercept,       // For the visualization
    displaySlope: monthlySlope  // For display purposes
  };
};

export default function CatchMetricsChart({
  className,
  lang,
  selectedMetric,
  onMetricChange,
  bmu,
  activeTab = 'standard',
  onTabChange,
}: CatchMetricsChartProps) {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [fiveYearMarks, setFiveYearMarks] = useState<number[]>([]);
  const [visibilityState, setVisibilityState] = useState<VisibilityState>({});
  const [siteColors, setSiteColors] = useState<Record<string, string>>({});
  const [selectedPoint, setSelectedPoint] = useState<{
    date: string;
    values: {name: string; value: number; color: string}[];
    average?: number;
  } | null>(null);

  // Map old tab names to new ones for backwards compatibility
  const getNewTabName = useCallback((oldTab: string) => {
    if (oldTab === 'standard') return 'trends';
    if (oldTab === 'recent') return 'comparison';
    return oldTab;
  }, []);

  // Initialize with mapped value to handle both old and new tab names
  const [localActiveTab, setLocalActiveTab] = useState(() => getNewTabName(activeTab));
  const [annualData, setAnnualData] = useState<ChartDataPoint[]>([]);

  const isTablet = useMedia("(max-width: 800px)", false);
  const { t } = useTranslation("common");
  const [bmus] = useAtom(bmusAtom);
  const [selectedTimeRange] = useAtom(selectedTimeRangeAtom);
  const { data: session } = useSession();

  // Determine if the user is part of the CIA group
  const isCiaUser = session?.user?.groups?.some((group: { name: string }) => group.name === 'CIA');

  const { data: monthlyData } = api.aggregatedCatch.monthly.useQuery({ bmus });

  // Keep in sync with parent component, handling old tab names too
  useEffect(() => {
    const newTabName = getNewTabName(activeTab);
    if (localActiveTab !== newTabName) {
      setLocalActiveTab(newTabName);
    }
  }, [activeTab, getNewTabName, localActiveTab]);

  const handleLegendClick = (site: string) => {
    // Don't toggle visibility for the average line
    if (site === "average") return;
    
    setVisibilityState((prev) => {
      // Create a copy of the previous state
      const newState = { ...prev };
      
      // Toggle the clicked site
      newState[site] = {
        opacity: prev[site]?.opacity === 1 ? 0.2 : 1,
      };
      
      // For Comparison tab, we need to handle the Positive/Negative variants too
      if ((localActiveTab === 'comparison' || localActiveTab === 'recent') && !isCiaUser) {
        // Also update the positive and negative variants
        const positiveKey = `${site}Positive`;
        const negativeKey = `${site}Negative`;
        
        newState[positiveKey] = { opacity: newState[site].opacity };
        newState[negativeKey] = { opacity: newState[site].opacity };
      }
      
      return newState;
    });
  };

  const handleTabChange = (tab: string) => {
    setLocalActiveTab(tab);
    // Map back to old names when calling parent callback for backwards compatibility
    const oldTabName = tab === 'trends' ? 'standard' : tab === 'comparison' ? 'recent' : tab;
    onTabChange?.(oldTabName);
  };

  // First-time render check
  const [initialRenderComplete, setInitialRenderComplete] = useState(false);
  
  useEffect(() => {
    // Set initial render complete after mounting
    setInitialRenderComplete(true);
  }, []);

  useEffect(() => {
    if (!monthlyData) return;

    try {
      // Get unique sites from the data
      const uniqueSitesSet = Array.from(
        new Set(monthlyData.map((item: ApiDataPoint) => item.landing_site))
      );
      
      // Sort BMUs consistently across all charts
      const uniqueSites = getSortedBmuList(uniqueSitesSet);

      // Update the global BMU color registry to ensure unique colors
      updateBmuColorRegistry(uniqueSites as string[]);

      // Create color mapping for sites
      const newSiteColors = uniqueSites.reduce<Record<string, string>>(
        (acc, site, index) => ({
          ...acc,
          [site as string]: generateColor(index, site, bmu),
        }),
        {}
      );
      
      // Only add average for non-CIA users
      if (!isCiaUser) {
        // Add color for average line
        newSiteColors["average"] = generateColor(0, "average", undefined);
      }
      
      setSiteColors(newSiteColors);

      // Set visibility state based on user's BMU
      const initialVisibility = uniqueSites.reduce<VisibilityState>(
          (acc, site) => ({
            ...acc,
            [site as string]: { opacity: (bmu && landingSiteMatchesQueryBmu(bmu, site as string) ? 1 : 0.2) },
          }),
          {}
      );
      
      // For Comparison tab, add visibility for positive and negative variants
      if ((localActiveTab === 'comparison' || localActiveTab === 'recent') && !isCiaUser) {
        uniqueSites.forEach(site => {
          initialVisibility[`${site}Positive`] = { opacity: initialVisibility[site].opacity };
          initialVisibility[`${site}Negative`] = { opacity: initialVisibility[site].opacity };
        });
      }
      
      // Only add average visibility for non-CIA users
      if (!isCiaUser) {
        // Always show average line
        initialVisibility["average"] = { opacity: 1 };
      }
      
      setVisibilityState(initialVisibility);

      // Apply time range filter
      const filteredData = filterDataByTimeRange(monthlyData as ApiDataPoint[], selectedTimeRange);

      // Group data by date
      const groupedData = filteredData.reduce<Record<string, ChartDataPoint>>(
        (acc, item: ApiDataPoint) => {
          const date = new Date(item.date).getTime();
          if (!acc[date]) {
            acc[date] = {
              date,
              ...uniqueSites.reduce(
                (sites, site) => ({ ...sites, [site]: undefined }),
                {}
              ),
            };
          }
          acc[date][item.landing_site] = item[selectedMetric as keyof ApiDataPoint] as number;
          return acc;
        },
        {}
      );

      // Calculate average value for each date point - only for non-CIA users
      if (!isCiaUser) {
        Object.keys(groupedData).forEach(dateKey => {
          const dateData = groupedData[dateKey];
          const values = Object.entries(dateData)
            .filter(([key, value]) => key !== "date" && value !== undefined)
            .map(([_, value]) => value as number);
          
          if (values.length > 0) {
            const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
            groupedData[dateKey].average = parseFloat(avg.toFixed(2));
          } else {
            // Ensure we have an average property even if it's 0
            groupedData[dateKey].average = 0;
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
      console.error("Error processing data:", error);
    } finally {
      setLoading(false);
    }
  }, [monthlyData, selectedMetric, bmu, selectedTimeRange, isCiaUser, localActiveTab]);

  const CustomLegend = ({ payload }: any) => {
    // Filter out the auto-generated average entry from the payload
    // This prevents duplicate average entries in the legend
    const customPayload = payload?.filter((entry: any) => entry.dataKey !== "average");
    const showAverage = !isCiaUser && (localActiveTab === 'trends' || localActiveTab === 'standard');
    
    return (
      <div className="flex flex-wrap gap-4 justify-center mt-2">
        {/* Average entry first - only show for non-CIA users and only in Trends tab */}
        {showAverage && (
          <div
            key="average"
            className="flex items-center gap-2 cursor-default select-none"
          >
            <div
              className="w-3 h-3 rounded-full"
              style={{
                backgroundColor: "#000000",
              }}
            />
            <span className="text-sm font-medium">Average of all BMUs</span>
          </div>
        )}
        
        {/* Other BMUs */}
        {customPayload?.map((entry: any) => (
          <div
            key={entry.value}
            className="flex items-center gap-2 cursor-pointer select-none transition-all duration-200"
            onClick={() => handleLegendClick(entry.value)}
            style={{ opacity: visibilityState[entry.value]?.opacity }}
          >
            <div
              className="w-3 h-3 rounded-full transition-all duration-200"
              style={{
                backgroundColor: entry.color,
              }}
            />
            <span className="text-sm font-medium">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  };

  const calculateDifferenceData = (data: ChartDataPoint[]) => {
    return data.map(item => {
      const userValue = item[bmu || ''] || 0;
      const otherBMUs = Object.keys(item).filter(
        key => key !== "date" && key !== bmu && item[key] !== undefined
      );
      const otherAverage = otherBMUs.reduce((sum, key) => sum + (item[key] || 0), 0) / otherBMUs.length;
      
      // Only return points where we have valid data
      if (userValue === 0 && otherAverage === 0) {
        return null;
      }
      
      return {
        date: item.date,
        difference: userValue - otherAverage
      };
    }).filter((item): item is { date: number; difference: number } => item !== null);
  };

  const differenceData = calculateDifferenceData(chartData);

  // Calculate trendline only for periods with valid differences
  const trendline = calculateTrendline(differenceData);

  // Create trendline data separately
  const trendlineData = differenceData.map((point) => {
    const trendValue = trendline.slope * point.date + trendline.intercept;
    return {
      date: point.date,
      difference: point.difference,
      trendline: trendValue
    };
  });

  // Get last 24 months of data with comparison to average
  const getRecentData = () => {
    if (!chartData.length) return [];
    
    const sortedData = [...chartData].sort((a, b) => b.date - a.date);
    const lastSixMonths = sortedData.slice(0, 24).reverse();
    
    // For CIA users who don't have access to average, just return the data as is
    if (isCiaUser) return lastSixMonths;
    
    // For regular users, transform the data to show difference from average
    const result = lastSixMonths.map(item => {
      const result: { [key: string]: any } = { date: item.date };
      
      // For each BMU, calculate the difference from average
      Object.entries(item).forEach(([key, value]) => {
        if (key !== 'date' && key !== 'average' && value !== undefined) {
          const average = item.average || 0;
          result[key] = parseFloat((value - average).toFixed(2));
        }
      });
      
      return result;
    });
    
    // Sort by date to ensure chronological order
    return result.sort((a, b) => a.date - b.date);
  };

  // Get annual data by aggregating monthly data
  const getAnnualData = useCallback((): ChartDataPoint[] => {
    if (!chartData.length) return [];
    
    // Group data by year
    const yearlyData: Record<number, { date: number; [key: string]: any }> = {};
    
    // First, ensure we have entries for all years in our dataset
    const allYears = Array.from(new Set(chartData.map(item => new Date(item.date).getFullYear())));
    const allSites = Object.keys(siteColors).filter(site => site !== "average");
    
    // Ensure we have entries for all years and all BMUs
    allYears.forEach(year => {
      const yearTimestamp = new Date(`${year}-01-01`).getTime();
      yearlyData[year] = { date: yearTimestamp };
      
      // Initialize all BMUs with null values
      allSites.forEach(site => {
        yearlyData[year][`${site}_sum`] = 0;
        yearlyData[year][`${site}_count`] = 0;
      });
    });
    
    // Now populate the data
    chartData.forEach(item => {
      const year = new Date(item.date).getFullYear();
      
      // Process each BMU value
      Object.entries(item).forEach(([key, value]) => {
        if (key !== 'date' && key !== 'average' && value !== undefined) {
          if (!yearlyData[year][`${key}_sum`]) {
            yearlyData[year][`${key}_sum`] = 0;
            yearlyData[year][`${key}_count`] = 0;
          }
          yearlyData[year][`${key}_sum`] += value;
          yearlyData[year][`${key}_count`] += 1;
        }
      });
    });
    
    // Calculate averages for each year and BMU
    const result: ChartDataPoint[] = Object.entries(yearlyData).map(([_, data]) => {
      const yearResult: ChartDataPoint = { date: data.date };
      
      // Get all BMU keys (removing the _sum and _count suffix)
      const bmuKeys = Object.keys(data)
        .filter(key => key.endsWith('_sum'))
        .map(key => key.replace('_sum', ''));
      
      bmuKeys.forEach(key => {
        const sum = data[`${key}_sum`];
        const count = data[`${key}_count`];
        if (count > 0) {
          yearResult[key] = sum / count;
        } else {
          // If no data for this BMU in this year, set to 0 or null
          yearResult[key] = 0;
        }
      });
      
      // For non-CIA users, calculate the average across all BMUs
      if (!isCiaUser) {
        const bmuValues = Object.entries(yearResult)
          .filter(([key]) => key !== 'date' && key !== 'average')
          .map(([_, value]) => value as number)
          .filter(val => val > 0); // Only consider positive values
          
        if (bmuValues.length > 0) {
          yearResult.average = bmuValues.reduce((sum, val) => sum + val, 0) / bmuValues.length;
        } else {
          yearResult.average = 0;
        }
      }
      
      return yearResult;
    });
    
    // Sort by year
    return result.sort((a, b) => a.date - b.date);
  }, [chartData, isCiaUser, siteColors]);

  const recentData = getRecentData();

  // Update visibility state when changing tabs
  useEffect(() => {
    if ((localActiveTab === 'comparison' || localActiveTab === 'recent') && !isCiaUser) {
      // Make sure all BMUs have proper visibility state
      const newVisibilityState = { ...visibilityState };
      Object.keys(siteColors).forEach(site => {
        if (site !== 'average' && !newVisibilityState[site]) {
          const matchesBmu = bmu && landingSiteMatchesQueryBmu(bmu, site);
          newVisibilityState[site] = { opacity: matchesBmu ? 1 : 0.2 };
        }
      });
      setVisibilityState(newVisibilityState);
    }
  }, [localActiveTab, isCiaUser, siteColors, bmu, visibilityState]);

  // Calculate annual data when chart data changes
  useEffect(() => {
    if (chartData.length > 0) {
      setAnnualData(getAnnualData());
    }
  }, [chartData, getAnnualData]);

  // Add a handler for clicks on chart elements
  const handleChartClick = (data: any) => {
    if (!data || !data.activePayload || data.activePayload.length === 0) return;
    
    // Extract date and format it
    const payload = data.activePayload[0].payload;
    const date = new Date(payload.date);
    const formattedDate = date.toLocaleDateString('en-US', { 
      month: 'short',
      year: '2-digit'
    });
    
    // Extract values for each visible site
    const values = data.activePayload
      .filter((entry: any) => 
        entry.value && 
        typeof entry.value === 'number' && 
        entry.dataKey !== 'average'
      )
      .map((entry: any) => ({
        name: entry.name || entry.dataKey,
        value: entry.value,
        color: entry.color
      }))
      .sort((a: any, b: any) => {
        if (bmu && landingSiteMatchesQueryBmu(bmu, a.name)) return -1;
        if (bmu && landingSiteMatchesQueryBmu(bmu, b.name)) return 1;
        return a.name.localeCompare(b.name);
      });
    
    // Set the selected point
    setSelectedPoint({
      date: formattedDate,
      values,
      average: payload.average
    });
  };

  if (loading) return <LoadingState />;
  if (!chartData || chartData.length === 0) {
    return (
      <WidgetCard title="Catch Metrics">
        <div className="h-96 w-full flex items-center justify-center">
          <span className="text-sm text-gray-500">No data available</span>
        </div>
      </WidgetCard>
    );
  }

  const selectedMetricOption = METRIC_OPTIONS.find(
    (m) => m.value === selectedMetric
  );

  // Create data panel component
  const DataPanel = () => {
    if (!selectedPoint) {
      // Create empty panel with placeholder content for consistent layout
      return (
        <div className="mt-2 bg-gray-50 p-2 rounded-md border border-gray-100 text-xs h-[80px] flex flex-col justify-between">
          <div className="font-medium text-gray-700 border-b border-gray-100 pb-1">
            Select a data point
          </div>
          <div className="text-center text-gray-400 py-2">
            Click on the chart to view details
          </div>
        </div>
      );
    }
    
    return (
      <div className="mt-2 bg-gray-50 p-2 rounded-md border border-gray-100 text-xs min-h-[80px]">
        <div className="font-medium text-gray-700 border-b border-gray-100 pb-1 mb-1">
          {selectedPoint.date}
        </div>
        <div className="flex flex-col gap-0.5">
          {selectedPoint.values.map(item => (
            <div key={item.name} className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <div
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="font-medium">{item.name}</span>
              </div>
              <span>{Math.round(item.value).toLocaleString()}</span>
            </div>
          ))}
          
          {!isCiaUser && selectedPoint.average !== undefined && (
            <div className="mt-0.5 pt-0.5 border-t border-gray-100 flex items-center justify-between">
              <span className="text-gray-500">Average</span>
              <span className="font-medium text-gray-700">
                {Math.round(selectedPoint.average).toLocaleString()}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <WidgetCard
      title={
        <div className="flex items-center justify-between w-full">
          <MetricSelector
            selectedMetric={selectedMetric}
            onMetricChange={onMetricChange}
            selectedMetricOption={selectedMetricOption}
          />
          {!isCiaUser && (
            <div className="flex flex-wrap justify-end space-x-2">
              <button
                className={`px-3 py-1 text-sm ${localActiveTab === 'trends' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'} rounded shadow-sm transition duration-200 hover:bg-blue-600`}
                onClick={() => handleTabChange('trends')}
              >
                Trends
              </button>
              <button
                className={`px-3 py-1 text-sm ${localActiveTab === 'comparison' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'} rounded shadow-sm transition duration-200 hover:bg-blue-600`}
                onClick={() => handleTabChange('comparison')}
              >
                Comparison
              </button>
              <button
                className={`px-3 py-1 text-sm ${localActiveTab === 'annual' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'} rounded shadow-sm transition duration-200 hover:bg-blue-600`}
                onClick={() => handleTabChange('annual')}
              >
                Annual
              </button>
            </div>
          )}
        </div>
      }
      className={className}
    >
      {(localActiveTab === 'trends' || localActiveTab === 'standard') && (
        <SimpleBar>
          <div className="h-96 w-full pt-9">
            <ResponsiveContainer
              width="100%"
              height="100%"
              {...(isTablet && { minWidth: "700px" })}
            >
              <ComposedChart
                data={chartData}
                margin={{
                  left: 35,
                  right: 35,
                  bottom: 20,
                  top: 20,
                }}
                className="[&_.recharts-cartesian-axis-tick-value]:fill-gray-500 [&_.recharts-cartesian-axis.yAxis]:-translate-y-3 rtl:[&_.recharts-cartesian-axis.yAxis]:-translate-x-12 [&_.recharts-cartesian-grid-vertical]:opacity-0"
                onClick={handleChartClick}
              >
                <defs>
                  {Object.entries(siteColors).map(([site, color]) => (
                    <linearGradient
                      key={site}
                      id={`${site}_gradient`}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor={color} stopOpacity={0.75} />
                      <stop offset="95%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="8 10" strokeOpacity={0.435} />
                <XAxis
                  dataKey="date"
                  scale="time"
                  type="number"
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={(unixTime) => {
                    const date = new Date(unixTime);
                    return date.toLocaleDateString('en-US', { 
                      month: 'short',
                      year: '2-digit'
                    });
                  }}
                  interval="preserveStartEnd"
                  minTickGap={50}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={CustomYAxisTick}
                  width={60}
                  label={{
                    value: selectedMetricOption?.unit,
                    angle: -90,
                    position: "insideLeft",
                    offset: -20,
                    style: {
                      fontSize: 14,
                      fill: "#666666",
                      textAnchor: "middle",
                    },
                  }}
                />
                <Legend content={CustomLegend} />
                {Object.entries(siteColors)
                  .filter(([site]) => site !== "average") // Skip average since we added it separately
                  .map(([site, color]) => (
                  <Area
                    key={site}
                    type="monotone"
                    dataKey={site}
                    name={site}
                    stroke={color}
                    strokeWidth={2}
                    fillOpacity={visibilityState[site]?.opacity ?? 1}
                    strokeOpacity={visibilityState[site]?.opacity ?? 1}
                    fill={`url(#${site}_gradient)`}
                  />
                ))}
                {/* Only add the average line for the Trends tab and non-CIA users */}
                {!isCiaUser && (String(localActiveTab) === 'trends' || String(localActiveTab) === 'standard') && (
                  <Line
                    key="average"
                    type="monotone"
                    dataKey="average"
                    name="Average of all BMUs"
                    stroke="#000000"
                    strokeWidth={3}
                    dot={false}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                    strokeDasharray="5 5"
                    legendType="none" // Hide from auto-generated legend
                    isAnimationActive={false}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <DataPanel />
        </SimpleBar>
      )}
      {(localActiveTab === 'comparison' || localActiveTab === 'recent') && (
        <SimpleBar>
          <div className="h-96 w-full pt-9">
            <ResponsiveContainer
              width="100%"
              height="100%"
              {...(isTablet && { minWidth: "700px" })}
            >
              <BarChart
                data={recentData}
                margin={{
                  left: 45,
                  right: 45,
                  bottom: 20,
                  top: 20,
                }}
                barSize={15}
                barGap={1}
                className="[&_.recharts-cartesian-axis-tick-value]:fill-gray-500 [&_.recharts-cartesian-axis.yAxis]:-translate-y-3 rtl:[&_.recharts-cartesian-axis.yAxis]:-translate-x-12 [&_.recharts-cartesian-grid-vertical]:opacity-0"
                onClick={handleChartClick}
              >
                <CartesianGrid strokeDasharray="8 10" strokeOpacity={0.435} />
                <XAxis
                  dataKey="date"
                  scale="time"
                  type="number"
                  domain={['dataMin - 86400000', 'dataMax + 86400000']}
                  tickFormatter={(unixTime) => {
                    const date = new Date(unixTime);
                    return date.toLocaleDateString('en-US', { 
                      month: 'short',
                      year: '2-digit'
                    });
                  }}
                  ticks={recentData.map(item => item.date)}
                  interval={0}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12 }}
                  padding={{ left: 20, right: 20 }}
                  minTickGap={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={CustomYAxisTick}
                  width={60}
                  label={{
                    value: isCiaUser 
                      ? selectedMetricOption?.unit 
                      : `Diff. from mean (${selectedMetricOption?.unit})`,
                    angle: -90,
                    position: "insideLeft",
                    offset: -20,
                    style: {
                      fontSize: 14,
                      fill: "#666666",
                      textAnchor: "middle",
                    },
                  }}
                />
                <Legend content={CustomLegend} />
                {!isCiaUser && (
                  <ReferenceLine 
                    y={0} 
                    stroke="#666" 
                    strokeWidth={1} 
                    strokeDasharray="3 3"
                  />
                )}
                
                {Object.entries(siteColors)
                  .filter(([site]) => site !== "average") // Skip average
                  .map(([site, color]) => (
                    <Bar
                      key={site}
                      dataKey={site}
                      name={site}
                      fill={color}
                      // Simple opacity based on visibility state
                      opacity={visibilityState[site]?.opacity ?? 1}
                      // Use isAnimationActive={false} to prevent transition issues
                      isAnimationActive={false}
                      // Shape corners based on positive/negative values
                      radius={[4, 4, 0, 0]}
                    />
                  ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <DataPanel />
        </SimpleBar>
      )}
      {localActiveTab === 'annual' && (
        <SimpleBar>
          <div className="h-96 w-full pt-9">
            <ResponsiveContainer
              width="100%"
              height="100%"
              {...(isTablet && { minWidth: "700px" })}
            >
              <BarChart
                data={annualData}
                margin={{
                  left: 45,
                  right: 45,
                  bottom: 20,
                  top: 20,
                }}
                barSize={30}
                barGap={2}
                className="[&_.recharts-cartesian-axis-tick-value]:fill-gray-500 [&_.recharts-cartesian-axis.yAxis]:-translate-y-3 rtl:[&_.recharts-cartesian-axis.yAxis]:-translate-x-12 [&_.recharts-cartesian-grid-vertical]:opacity-0"
                onClick={handleChartClick}
              >
                <CartesianGrid strokeDasharray="8 10" strokeOpacity={0.435} />
                <XAxis
                  dataKey="date"
                  type="category"
                  tickFormatter={(unixTime) => {
                    const date = new Date(unixTime);
                    return date.getFullYear().toString();
                  }}
                  interval={0}
                  textAnchor="middle"
                  height={30}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12 }}
                  tickCount={annualData.length}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={CustomYAxisTick}
                  width={60}
                  label={{
                    value: selectedMetricOption?.unit,
                    angle: -90,
                    position: "insideLeft",
                    offset: -20,
                    style: {
                      fontSize: 14,
                      fill: "#666666",
                      textAnchor: "middle",
                    },
                  }}
                />
                <Legend content={CustomLegend} />
                
                {/* Add the average line if not a CIA user and only in trends tab */}
                {!isCiaUser && (String(localActiveTab) === 'trends' || String(localActiveTab) === 'standard') && (
                  <Line
                    type="monotone"
                    dataKey="average"
                    name="Average of all BMUs"
                    stroke="#000000"
                    strokeWidth={3}
                    dot={false}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                    strokeDasharray="5 5"
                    isAnimationActive={false}
                  />
                )}
                
                {/* Render the bars for each BMU */}
                {Object.entries(siteColors)
                  .filter(([site]) => site !== "average") // Skip average
                  .map(([site, color]) => (
                  <Bar
                    key={site}
                    dataKey={site}
                    name={site}
                    fill={color}
                    opacity={visibilityState[site]?.opacity ?? 1}
                      isAnimationActive={false}
                    radius={[4, 4, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <DataPanel />
        </SimpleBar>
      )}
    </WidgetCard>
  );
}
