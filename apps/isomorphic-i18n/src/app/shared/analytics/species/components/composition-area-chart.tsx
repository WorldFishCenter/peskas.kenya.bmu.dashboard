"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useAtom } from "jotai";
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import WidgetCard from "@components/cards/widget-card";
import { api } from "@/trpc/react";
import { bmusAtom, selectedTimeRangeAtom } from "@/app/components/filter-selector";
import { useTranslation } from "@/app/i18n/client";
import { getClientLanguage } from "@/app/i18n/language-link";
import SimpleBar from "@ui/simplebar";
import useUserPermissions from "../../core/hooks/use-user-permissions";
import { generateFishCategoryColor, updateBmuColorRegistry } from "../../charts/utils/chart-utils";
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

interface FishCompositionAreaChartProps {
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

// Chart modes
type ChartMode = 'absolute' | 'percent';

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

export default function FishCompositionAreaChart({ 
  className, 
  lang, 
  bmu,
  chartData: externalChartData,
  isIiaUser,
}: FishCompositionAreaChartProps & { chartData?: any[]; isIiaUser?: boolean }) {
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
  const [chartMode, setChartMode] = useState<ChartMode>('absolute');
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
    useTotal: true, // Use total_catch_kg for this component
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

  // Handle chart mode toggle
  const handleModeToggle = (mode: ChartMode) => {
    setChartMode(mode);
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
      
      // Group data by month and category
      const monthlyData: Record<string, Record<string, number>> = {};
      const categories: Set<string> = new Set();
      
      // Process the filtered monthly data
      filteredFishDistributionData.forEach(monthData => {
        const date = new Date(monthData.date);
        date.setDate(1); // Normalize to first day of month
        const monthKey = date.toISOString().slice(0, 7); // YYYY-MM format
        
        // Initialize month if it doesn't exist
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = {};
        }
        
        // Process categories for this month
        if (monthData.categories && Array.isArray(monthData.categories)) {
          monthData.categories.forEach((cat: { category: string; total_catch: number }) => {
            if (!cat.category) return;
            
            const categoryName = cat.category;
            categories.add(categoryName);
            
            // Initialize category for this month if it doesn't exist
            if (!monthlyData[monthKey][categoryName]) {
              monthlyData[monthKey][categoryName] = 0;
            }
            
            // Add to the total if we have a valid catch amount
            if (cat.total_catch !== undefined && cat.total_catch !== null) {
              monthlyData[monthKey][categoryName] += cat.total_catch;
            }
          });
        }
      });
      
      // Convert to array of category objects with colors
      const categoryArray = Array.from(categories).map((category) => ({
        id: category.toLowerCase().replace(/\s+/g, '_'),
        name: translateFishCategory(category, t),
        originalName: category, // Keep original English name for data lookup
        color: generateFishCategoryColor(category)
      }));
      
      setCategoryDisplays(categoryArray);
      
      // Convert monthly data to chart format
      const chartDataArray = Object.keys(monthlyData)
        .sort() // Sort chronologically
        .map(monthKey => {
          const [year, month] = monthKey.split('-');
          const date = new Date(parseInt(year), parseInt(month) - 1, 1);
          
          const dataPoint: any = {
            month: monthKey,
            date: date.getTime(),
            displayMonth: date.toLocaleDateString(clientLang === 'sw' ? 'sw-TZ' : 'en-US', { 
              year: 'numeric', 
              month: 'short' 
            })
          };
          
          // Calculate total for percentage calculation
          let totalCatch = 0;
          categoryArray.forEach(category => {
            const value = monthlyData[monthKey][category.originalName] || 0;
            totalCatch += value;
          });

                     // Add absolute and percentage values for each category
           categoryArray.forEach(category => {
             const absoluteValue = monthlyData[monthKey][category.originalName] || 0;
             dataPoint[`${category.id}_absolute`] = absoluteValue;
             // For percent mode, we use the raw values and let Recharts calculate percentages
             // with stackOffset="expand" - this will automatically convert to 0-100% stacking
             dataPoint[`${category.id}_percent`] = absoluteValue;
           });
          
          return dataPoint;
        });
      
      setChartData(chartDataArray);
      setError(null);
      setLoading(false);
    } catch (err) {
      console.error("Error processing fish composition area chart data:", err);
      setError("Error processing data");
      setLoading(false);
    }
  }, [fishDistributionData, isLoadingData, apiError, queryBmus, selectedTimeRange, clientLang, t]);
  
     // Custom tooltip for the chart
   const CustomTooltip = ({ active, payload, label }: any) => {
     if (active && payload && payload.length) {
       return (
         <div className="bg-white p-3 border border-gray-200 rounded-md shadow-md">
           <p className="font-medium text-gray-900">{label}</p>
           <div className="mt-2 space-y-1">
             {payload.map((entry: any, index: number) => {
               const isValidValue = entry.value !== undefined && entry.value !== null && entry.value > 0;
               
               if (!isValidValue) return null;
               
               let displayValue;
               if (chartMode === 'absolute') {
                 displayValue = `${Math.round(entry.value).toLocaleString()} kg`;
               } else {
                 // For percent mode, we need to get the raw data and calculate percentages manually
                 // because stackOffset="expand" doesn't provide the correct percentages in tooltip
                 const dataPoint = useChartData.find(d => d.displayMonth === label);
                 if (dataPoint) {
                   // Get the raw value for this category
                   const categoryId = entry.dataKey.replace('_percent', '');
                   const rawValue = dataPoint[`${categoryId}_absolute`] || 0;
                   
                   // Calculate total for this month
                   const totalForMonth = categoryDisplays.reduce((sum, cat) => {
                     return sum + (dataPoint[`${cat.id}_absolute`] || 0);
                   }, 0);
                   
                   const percentage = totalForMonth > 0 ? Math.round((rawValue / totalForMonth) * 100) : 0;
                   displayValue = `${percentage}%`;
                 } else {
                   displayValue = `0%`;
                 }
               }
               
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
                         {chartMode === 'absolute' && (
              <div className="pt-1 mt-2 border-t border-gray-200">
                <span className="text-sm font-medium text-gray-900">
                  Total: {payload.reduce((sum: number, entry: any) => sum + (entry.value || 0), 0).toLocaleString()} kg
                </span>
              </div>
            )}
           </div>
         </div>
       );
     }
     return null;
   };
  
     // Interactive legend component
   const CustomLegend = () => {
     return (
       <div className="flex justify-center">
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

     // Format Y-axis values
   const formatYAxisValue = (value: number) => {
     if (chartMode === 'percent') {
       return `${Math.round(value * 100)}%`;
     }
     
     if (value >= 1000) {
       return `${(value / 1000).toFixed(0)}k`;
     }
     return value.toString();
   };

  // Get chart title and description
  const getTitle = () => {
    if (chartMode === 'absolute') {
      return hasRestrictedAccess && effectiveBMU
        ? t("text-fish-composition-trends-absolute-bmu", { bmuName: effectiveBMU }) || `Fish Composition Trends for ${effectiveBMU} (kg)`
        : t("text-fish-composition-trends-absolute") || "Fish Composition Trends (kg)";
    } else {
      return hasRestrictedAccess && effectiveBMU
        ? t("text-fish-composition-trends-percent-bmu", { bmuName: effectiveBMU }) || `Fish Composition Trends for ${effectiveBMU} (%)`
        : t("text-fish-composition-trends-percent") || "Fish Composition Trends (%)";
    }
  };

  const getDescription = () => {
    if (chartMode === 'absolute') {
      return t("text-fish-composition-trends-absolute-desc") || "Shows absolute catch amounts over time by fish category";
    } else {
      return t("text-fish-composition-trends-percent-desc") || "Shows percentage distribution of fish categories over time";
    }
  };
  
  return (
    <WidgetCard
      title={
        loading ? "" : (
          <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between w-full gap-3">
            <div className="w-full sm:w-auto">
              <div className="text-base font-medium text-gray-800">
                {getTitle()}
              </div>
            </div>
            {/* Mode Toggle Buttons - only show for non-IIA users */}
            {!isIiaUser && (
              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  className={cn(
                    "px-4 py-2 text-sm rounded-md transition duration-200 w-full sm:w-auto",
                    chartMode === 'absolute' 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  )}
                  onClick={() => handleModeToggle('absolute')}
                >
                  {t("text-absolute-values") || "Absolute"}
                </button>
                <button
                  className={cn(
                    "px-4 py-2 text-sm rounded-md transition duration-200 w-full sm:w-auto",
                    chartMode === 'percent' 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  )}
                  onClick={() => handleModeToggle('percent')}
                >
                  {t("text-percent-values") || "Percent"}
                </button>
              </div>
            )}
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
             <div className="w-full h-[400px] min-h-96">
               <ResponsiveContainer width="100%" height="100%" minHeight={384}>
                 <AreaChart
                   data={useChartData}
                   margin={{ top: 20, right: 30, left: 60, bottom: 60 }}
                   stackOffset={chartMode === 'percent' ? 'expand' : 'none'}
                 >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="displayMonth"
                    tick={{ fontSize: 12, fill: "#64748b" }}
                    axisLine={{ stroke: "#cbd5e1", strokeWidth: 1 }}
                    tickLine={{ stroke: "#cbd5e1" }}
                                         angle={-45}
                     textAnchor="end"
                     height={60}
                     interval={0}
                  />
                                     <YAxis 
                     tick={{ fontSize: 12, fill: "#64748b" }}
                     axisLine={{ stroke: "#cbd5e1", strokeWidth: 1 }}
                     tickLine={{ stroke: "#cbd5e1" }}
                     tickFormatter={formatYAxisValue}
                     domain={chartMode === 'percent' ? [0, 1] : [0, 'dataMax']}
                     label={{ 
                       value: chartMode === 'absolute' ? t('text-unit-kg-fisher-day') : 'Percentage (%)',
                       angle: -90,
                       position: 'insideLeft',
                       style: { textAnchor: 'middle', fontSize: 12, fill: '#666' }
                     }}
                   />
                  <Tooltip content={<CustomTooltip />} />
                  
                  {/* Stack areas for each fish category with visibility state */}
                  {categoryDisplays.map((category) => {
                    const dataKey = chartMode === 'absolute' 
                      ? `${category.id}_absolute` 
                      : `${category.id}_percent`;
                    
                    const opacity = visibilityState[category.id]?.opacity ?? 1;
                    
                    return (
                                             <Area
                         key={`${category.id}_${chartMode}`}
                         type="monotone"
                         dataKey={dataKey}
                         name={category.name}
                         stackId="1"
                         stroke={category.color}
                         fill={category.color}
                         fillOpacity={opacity * 0.8}
                         strokeWidth={1}
                         hide={opacity === 0.2}
                         connectNulls={false}
                         isAnimationActive={false}
                       />
                    );
                  })}
                </AreaChart>
              </ResponsiveContainer>
            </div>
                         
             {/* Interactive legend */}
             <div className="mt-4">
               <CustomLegend />
             </div>
          </div>
        </SimpleBar>
      )}
    </WidgetCard>
  );
} 