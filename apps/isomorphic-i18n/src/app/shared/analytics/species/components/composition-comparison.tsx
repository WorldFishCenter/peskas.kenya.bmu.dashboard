"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useAtom } from "jotai";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import WidgetCard from "@components/cards/widget-card";
import { api } from "@/trpc/react";
import { bmusAtom, selectedTimeRangeAtom } from "@/app/components/filter-selector";
import { useTranslation } from "@/app/i18n/client";
import { getClientLanguage } from "@/app/i18n/language-link";
import SimpleBar from "@ui/simplebar";
import useUserPermissions from "../../core/hooks/use-user-permissions";
import { generateFishCategoryColor, updateBmuColorRegistry } from "../../charts/utils/chart-utils";
import { normalizeBmuForDisplay, landingSiteMatchesQueryBmu } from "../../charts/utils/bmu-display-normalizer";
import { filterDataByTimeRange } from "../../core/utils/time-range-filter";
import cn from "@utils/class-names";

// Fish category translation mapping
const FISH_TRANSLATION_KEYS: Record<string, string> = {
  "Octopus": "text-fish-octopus",
  "Scavengers": "text-fish-scavengers",
  "Rabbitfish": "text-fish-rabbitfish",
  "Goatfish": "text-fish-goatfish",
  "Rest Of Catch": "text-fish-rest-of-catch",
  "Pelagics": "text-fish-pelagics",
  "Shark": "text-fish-shark",
  "Ray": "text-fish-ray",
  "Parrotfish": "text-fish-parrotfish",
  "Lobster": "text-fish-lobster",
};

// Helper function to translate fish category names
const translateFishCategory = (category: string, t: (key: string) => string): string => {
  const translationKey = FISH_TRANSLATION_KEYS[category];
  return translationKey ? t(translationKey) : category;
};

// Define fish category display data
interface CategoryDisplay {
  id: string;
  name: string;
  color: string;
}

interface FishCompositionComparisonProps {
  className?: string;
  lang?: string;
  bmu?: string;
}

// Define visibility state type
interface VisibilityState {
  [key: string]: {
    opacity: number;
  };
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

export default function FishCompositionComparison({ 
  className, 
  lang, 
  bmu,
  chartData: externalChartData,
  isIiaUser,
}: FishCompositionComparisonProps & { chartData?: any[]; isIiaUser?: boolean }) {
  // Use client language instead of lang prop
  const clientLang = getClientLanguage();

  // Track current language with state
  const [currentLang, setCurrentLang] = useState(clientLang);

  // Use currentLang for translation so it updates when language changes
  const { t, i18n } = useTranslation(currentLang, "common");
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [categoryDisplays, setCategoryDisplays] = useState<CategoryDisplay[]>([]);
  const [visibilityState, setVisibilityState] = useState<VisibilityState>({});
  const [bmus] = useAtom(bmusAtom);
  const [selectedTimeRange] = useAtom(selectedTimeRangeAtom);
  
  // Track time range changes for refetching
  const previousTimeRangeRef = useRef<string>('all');
  
  // Get BMUs based on permissions
  const { userBMU, isAdmin, hasRestrictedAccess, referenceBMU, getLimitedBMUs } = useUserPermissions();
  const effectiveBMU = bmu || referenceBMU || userBMU;
  
  // Memoize queryBmus to prevent it from recalculating on every render
  const queryBmus = useMemo(() => {
    // For admin users, use a limited set of BMUs (max 8)
    if (isAdmin) {
      return getLimitedBMUs(bmus, 8);
    }
    
    // For restricted users, only show their BMU
    if (hasRestrictedAccess) {
      return effectiveBMU ? [effectiveBMU] : [];
    }
    
    // For others, show all selected BMUs
    return bmus;
  }, [isAdmin, hasRestrictedAccess, effectiveBMU, bmus, getLimitedBMUs]);
  
  // Memoize the API query to prevent re-fetching on every render
  const fishDistributionQuery = api.fishDistribution.monthlyTrends.useQuery({ 
    bmus: queryBmus,
  }, {
    retry: 3,
    retryDelay: 1000,
    staleTime: 1000 * 60 * 5,
    enabled: queryBmus.length > 0,
  });


  
  // Extract data from the query
  const fishDistributionData = fishDistributionQuery.data;
  const isLoadingData = fishDistributionQuery.isLoading;
  const apiError = fishDistributionQuery.error;

  // Use external chart data if in IIA mode
  const useChartData = isIiaUser && externalChartData ? externalChartData : chartData;

  const compositionYAxisWidth = useMemo(() => {
    if (!useChartData?.length) return 140;
    const maxLen = Math.max(...useChartData.map((r: { bmuName?: string }) => (r.bmuName ?? "").length));
    return Math.min(340, Math.max(120, Math.ceil(maxLen * 6.5 + 28)));
  }, [useChartData]);

  // Track selectedTimeRange changes and force data reprocessing
  useEffect(() => {
    if (previousTimeRangeRef.current !== selectedTimeRange) {
      previousTimeRangeRef.current = selectedTimeRange;
      setChartData([]);
      setCategoryDisplays([]);
      setLoading(true);
      // Force refetch when time range changes
      fishDistributionQuery.refetch();
    }
  }, [selectedTimeRange, fishDistributionQuery]);

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

  // Handle legend item click
  const handleLegendClick = (categoryId: string) => {
    setVisibilityState(prev => {
      const newState = { ...prev };
      
      // Toggle the opacity for this category
      newState[categoryId] = {
        opacity: prev[categoryId]?.opacity === 1 ? 0.2 : 1
      };
      
      return newState;
    });
  };
  
  const visibilityKeyCount = Object.keys(visibilityState).length;

  // Memoize the initialization of visibility state to prevent it from changing on each render
  useEffect(() => {
    if (categoryDisplays.length > 0 && visibilityKeyCount === 0) {
      const initialVisibility: VisibilityState = {};
      categoryDisplays.forEach(category => {
        initialVisibility[category.id] = { opacity: 1 };
      });
      setVisibilityState(initialVisibility);
    }
  }, [categoryDisplays, visibilityKeyCount]);
  
  // Process data when it changes
  useEffect(() => {
    if (isLoadingData || queryBmus.length === 0) {
      setLoading(true);
      return;
    }
    
    if (queryBmus.length === 0) {
      setError("No BMUs selected. Please select at least one BMU.");
      setLoading(false);
      return;
    }
    
    if (apiError) {
      setError("Failed to load fish distribution data");
      setLoading(false);
      return;
    }
    
    if (!fishDistributionData) {
      setError("No fish distribution data available");
      setLoading(false);
      return;
    }
    
    try {
      // Update the global BMU color registry to ensure unique colors across all dashboard components
      updateBmuColorRegistry(queryBmus);
      
      // Apply time range filter to the data
      const filteredFishDistributionData = filterDataByTimeRange(fishDistributionData, selectedTimeRange);
      
      // Process the fish category data
      const totals: Record<string, Record<string, number>> = {};
      const categories: Set<string> = new Set();
      
      // Initialize totals object for each BMU
      queryBmus.forEach(bmu => {
        totals[bmu] = {};
      });
      
      // Process the filtered monthly data
      filteredFishDistributionData.forEach(monthData => {
        const bmuName = monthData.landing_site;

        const matchedQueryBmu = queryBmus.find(qBmu => landingSiteMatchesQueryBmu(qBmu, bmuName));
        if (!matchedQueryBmu) return;

        // Process categories for this month/BMU
        if (monthData.categories && Array.isArray(monthData.categories)) {
          monthData.categories.forEach((cat: { category: string; total_catch: number }) => {
            // Ensure we have a valid category name and catch value
            if (!cat.category) return;

            const categoryName = cat.category;
            categories.add(categoryName);

            // Initialize category for this BMU if it doesn't exist - use matchedQueryBmu instead of bmuName
            if (!totals[matchedQueryBmu][categoryName]) {
              totals[matchedQueryBmu][categoryName] = 0;
            }

            // Only add to the total if we have a valid catch amount
            if (cat.total_catch !== undefined && cat.total_catch !== null) {
              totals[matchedQueryBmu][categoryName] += cat.total_catch;
            }
          });
        }
      });
      
      // Convert to array of category objects with colors
      const categoryArray = Array.from(categories).map((category) => {
        return {
          id: category.toLowerCase().replace(/\s+/g, '_'),
          name: translateFishCategory(category, t),
          originalName: category, // Keep original English name for data lookup
          color: generateFishCategoryColor(category)
        };
      });
      
      setCategoryDisplays(categoryArray);
      
      // Create chart data for each BMU
      const chartDataArray = queryBmus.map(bmu => {
        // Calculate total catch for this BMU
        let totalCatch = 0;
        Object.values(totals[bmu]).forEach(value => {
          totalCatch += value;
        });
        
        // Create the base data object
        const bmuData: any = {
          bmu,
          bmuName: normalizeBmuForDisplay(bmu),
          totalCatch,
        };
        
        // Add percentage values for each category
        if (totalCatch > 0) {
          // Calculate percentages
          let totalPercentage = 0;
          
          categoryArray.forEach(category => {
            const value = totals[bmu][category.originalName] || 0;
            const percentage = Math.floor((value / totalCatch) * 100);
            bmuData[category.id] = percentage;
            totalPercentage += percentage;
          });
          
          // Adjust to ensure total is 100%
          if (totalPercentage !== 100) {
            // Find the largest category
            let largestCategory = null;
            let largestValue = -1;
            
            categoryArray.forEach(category => {
              if (bmuData[category.id] > largestValue) {
                largestValue = bmuData[category.id];
                largestCategory = category.id;
              }
            });
            
            // Adjust the largest category
            if (largestCategory) {
              bmuData[largestCategory] += (100 - totalPercentage);
            }
          }
        } else {
          // If no catch data, set all categories to 0
          categoryArray.forEach(category => {
            bmuData[category.id] = 0;
          });
        }
        
        return bmuData;
      });
      
      // Include all BMUs in the chart and sort by name
      const filteredData = chartDataArray
        .sort((a, b) => a.bmuName.localeCompare(b.bmuName));
      
      setChartData(filteredData);
      setError(null);
      setLoading(false);
    } catch (err) {
      setError("Error processing data");
      setLoading(false);
    }
  }, [fishDistributionData, isLoadingData, apiError, queryBmus, selectedTimeRange, currentLang, t]);
  
  // Custom tooltip for the chart
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-md shadow-md">
          <p className="font-medium text-gray-900">{label}</p>
          <div className="mt-2 space-y-1">
            {payload.map((entry: any, index: number) => {
              // Check if the value is undefined, null, or 0 when it should be N/A
              const isValidValue = entry.value !== undefined && entry.value !== null;
              const displayValue = isValidValue ? `${entry.value}%` : t("text-na");
              
              return (
                <div key={`tooltip-${index}`} className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-sm text-gray-700">
                    {entry.name}: {displayValue}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    return null;
  };
  
  // Interactive legend component similar to composition-chart.tsx
  const CustomLegend = () => {
    return (
      <div className="flex justify-center mt-6">
        <div className="inline-flex flex-wrap justify-center gap-4">
          {categoryDisplays.map((category) => (
            <div 
              key={category.id} 
              className="flex items-center gap-2 cursor-pointer transition-opacity duration-200 px-2 py-1 rounded hover:bg-gray-100"
              onClick={() => handleLegendClick(category.id)}
            >
              <div 
                className="w-3 h-3 rounded-full flex-shrink-0" 
                style={{ 
                  backgroundColor: category.color,
                  opacity: visibilityState[category.id]?.opacity ?? 1 
                }}
              />
              <span 
                className="text-sm text-gray-700 whitespace-nowrap"
                style={{ opacity: visibilityState[category.id]?.opacity ?? 1 }}
              >
                {category.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Custom Y-axis tick to highlight user's BMU
const CustomYAxisTick = ({ x = 0, y = 0, payload = { value: '' }, userBMU }: any) => {
  const isUserBMU =
    userBMU && landingSiteMatchesQueryBmu(userBMU, payload.value as string);

  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={-5}
        y={0}
        dy={4}
        textAnchor="end"
        className={cn(
          "text-xs",
          isUserBMU ? "fill-blue-600 font-semibold" : "fill-gray-500"
        )}
      >
        {payload.value}
      </text>
      {isUserBMU && (
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
    </g>
  );
};

  
  return (
    <WidgetCard
      title={
        loading ? "" : (
          <div className="flex items-center justify-center w-full">
            <div className="text-base font-medium text-gray-800">
              <div className="text-center">
                {hasRestrictedAccess && effectiveBMU
                  ? t("text-fish-composition-for-bmu", { bmuName: normalizeBmuForDisplay(effectiveBMU) }) || `Average Fish Composition for ${normalizeBmuForDisplay(effectiveBMU)}`
                  : t("text-fish-composition-by-bmu") || "Average Fish Composition by BMU"}
              </div>
              <div className="text-xs text-gray-500 text-center mt-1">
                {isAdmin 
                  ? t("text-comparison-chart-description") || "Showing limited BMU selection. Use reference selector to highlight a BMU."
                  : hasRestrictedAccess
                    ? t("text-cia-chart-description") || "Average distribution of fish groups in your BMU"
                    : t("text-comparison-chart-description") || "Compare average fish group distribution across BMUs"}
              </div>
            </div>
          </div>
        )
      }
      className="h-full"
    >
      {loading ? (
        <div className="h-96 w-full flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-4 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
            <span className="text-sm text-gray-500">{t("text-loading")}</span>
          </div>
        </div>
      ) : error ? (
        <div className="h-96 w-full flex items-center justify-center">
          <p className="text-gray-500">{error}</p>
        </div>
      ) : (
        <SimpleBar className="h-full">
          <div className="p-4 md:p-6 h-full min-h-96">
            {/* Main Chart */}
            <div 
              className={`w-full ${useChartData.length === 1 ? 'flex items-center justify-center' : ''}`}
              style={{ 
                height: useChartData.length === 1 
                  ? '160px' // Much smaller fixed height for single BMU
                  : `${Math.max(300, Math.min(450, useChartData.length * 75 + 100))}px` 
              }}
            >
              <ResponsiveContainer 
                width={useChartData.length === 1 ? "75%" : "100%"} 
                height="100%"
                minHeight={384}
              >
                <BarChart
                  data={useChartData}
                  layout="vertical"
                  margin={useChartData.length === 1 
                    ? { top: 15, right: 30, left: 12, bottom: 15 } 
                    : { top: 5, right: 30, left: 12, bottom: 5 }
                  }
                  barSize={useChartData.length === 1 ? 90 : 75} 
                  barGap={1}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis 
                    type="number" 
                    unit="%" 
                    domain={[0, 100]} 
                    ticks={[0, 25, 50, 75, 100]}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    dataKey="bmuName" 
                    type="category" 
                    width={compositionYAxisWidth}
                    tick={<CustomYAxisTick userBMU={userBMU} />}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    content={<CustomTooltip />}
                    cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }}
                    wrapperStyle={{ zIndex: 1000, outline: 'none' }}
                    allowEscapeViewBox={{ x: true, y: true }}
                  />
                  
                  {/* Stack bars for each fish category with visibility state */}
                  {categoryDisplays.map((category) => {
                    // Extra check to ensure color is correctly assigned
                    const categoryColor = category.color || generateFishCategoryColor(category.name);
                    
                    return (
                      <Bar 
                        key={category.id}
                        dataKey={category.id}
                        name={category.name}
                        stackId="a"
                        fill={categoryColor}
                        radius={useChartData.length === 1 ? [2, 2, 0, 0] : [0, 0, 0, 0]}
                        fillOpacity={visibilityState[category.id]?.opacity ?? 1}
                        hide={visibilityState[category.id]?.opacity === 0}
                        isAnimationActive={false}
                      />
                    );
                  })}
                </BarChart>
              </ResponsiveContainer>
            </div>
            
            {/* Interactive legend */}
            <CustomLegend />
          </div>
        </SimpleBar>
      )}
    </WidgetCard>
  );
} 