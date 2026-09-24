"use client";

import React, { useState, useMemo, useEffect } from "react";
import WidgetCard from "@components/cards/widget-card";
import { useTranslation } from "@/app/i18n/client";
import { useUserPermissions } from "../../core/hooks/use-user-permissions";
import { getFishCategories } from "./composition-chart";
import FishCategorySelector from "../../charts/domain/fish-category-selector";
import SimpleBar from "@ui/simplebar";

// Import chart components from Recharts directly 
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend, AreaChart, Area } from "recharts";
import { useAtom } from "jotai";
import { selectedTimeRangeAtom } from "@/app/components/filter-selector";
import { getTimeRangeStartDate } from "../../core/utils/time-range-filter";
import { generateFishCategoryColor } from "../../charts/utils/chart-utils";
import { format } from "date-fns";
import cn from "@utils/class-names";

interface IndividualFishCompositionUnifiedProps {
  allData: any[];
  userFisherId: string;
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  bmuName?: string;
  title?: string;
  description?: string;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export default function IndividualFishCompositionUnified({
  allData,
  userFisherId,
  selectedCategory,
  setSelectedCategory,
  bmuName = "",
  title,
  description,
  activeTab = 'bar-chart',
  onTabChange,
}: IndividualFishCompositionUnifiedProps) {
  const { t } = useTranslation("common");
  const { canCompareWithOthers, isIiaUser } = useUserPermissions();
  const [selectedTimeRange] = useAtom(selectedTimeRangeAtom);

  // Get translated fish categories
  const translatedFishCategories = useMemo(() => getFishCategories(t), [t]);

  // Local state for tab management
  const [localActiveTab, setLocalActiveTab] = useState(activeTab);
  const [visibilityState, setVisibilityState] = useState<Record<string, { opacity: number }>>({});
  
  // Handle tab changes
  const handleTabChange = (tab: string) => {
    setLocalActiveTab(tab);
    onTabChange?.(tab);
  };
  
  // Get available fish categories from data
  const availableFishCategories = useMemo(() => {
    if (!allData.length) return translatedFishCategories;

    const availableCategories = new Set(allData.map(item => item.fish_category));
    return translatedFishCategories.filter(cat => availableCategories.has(cat.value));
  }, [allData, translatedFishCategories]);

  // Find selected category option for dropdown
  const selectedCategoryOption = useMemo(() => 
    availableFishCategories.find(c => c.value === selectedCategory), 
    [selectedCategory, availableFishCategories]
  );

  // Process data for bar chart (monthly trends)
  const barChartData = useMemo(() => {
    if (!allData.length) return [];
    
    const filtered = allData.filter(item => item.fish_category === selectedCategory);
    const grouped: Record<string, { you: number; others: number; fullDate: string }> = {};
    const othersCount: Record<string, Set<string>> = {};
    const othersSum: Record<string, number> = {};
    
    filtered.forEach(item => {
      const date = new Date(item.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!grouped[monthKey]) grouped[monthKey] = { you: 0, others: 0, fullDate: date.toISOString() };
      
      if (item.fisher_id === userFisherId) {
        grouped[monthKey].you += item.mean_catch_kg || 0;
      } else if (canCompareWithOthers) {
        if (!othersCount[monthKey]) othersCount[monthKey] = new Set();
        if (!othersSum[monthKey]) othersSum[monthKey] = 0;
        othersSum[monthKey] += item.mean_catch_kg || 0;
        othersCount[monthKey].add(item.fisher_id);
      }
    });
    
    // Calculate mean for others only if user can compare
    if (canCompareWithOthers) {
      Object.keys(grouped).forEach(monthKey => {
        const count = othersCount[monthKey]?.size || 0;
        grouped[monthKey].others = count > 0 ? othersSum[monthKey] / count : 0;
      });
    }
    
    return Object.entries(grouped).map(([monthKey, vals]) => {
      const [year, month] = monthKey.split('-');
      const displayMonth = new Date(Number(year), Number(month) - 1).toLocaleString('default', { month: 'short', year: 'numeric' });
      return {
        displayMonth,
        ...vals,
      };
    }).sort((a, b) => new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime());
  }, [allData, selectedCategory, userFisherId, canCompareWithOthers]);

  // Process data for area chart (composition over time)
  const areaChartData = useMemo(() => {
    if (!allData.length) return [];
    
    const normalize = (str: string) => str.trim().toLowerCase();
    const grouped: Record<string, { youTotals: Record<string, number>; othersTotals: Record<string, number>; youSum: number; othersSum: number }> = {};
    
    allData.forEach(item => {
      const date = new Date(item.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!grouped[monthKey]) grouped[monthKey] = { youTotals: {}, othersTotals: {}, youSum: 0, othersSum: 0 };
      
      const key = normalize(item.fish_category);
      if (item.fisher_id === userFisherId) {
        grouped[monthKey].youTotals[key] = (grouped[monthKey].youTotals[key] || 0) + (item.mean_catch_kg || 0);
        grouped[monthKey].youSum += item.mean_catch_kg || 0;
      } else if (canCompareWithOthers) {
        grouped[monthKey].othersTotals[key] = (grouped[monthKey].othersTotals[key] || 0) + (item.mean_catch_kg || 0);
        grouped[monthKey].othersSum += item.mean_catch_kg || 0;
      }
    });
    
    return Object.entries(grouped).map(([monthKey, vals]) => {
      const displayMonth = new Date(monthKey + '-01').toLocaleString('default', { month: 'short', year: 'numeric' });
      const row: Record<string, any> = { month: displayMonth };
      
      availableFishCategories.forEach(cat => {
        const key = normalize(cat.value);
        row[`you_${cat.value}`] = vals.youTotals[key] || 0;
        if (canCompareWithOthers) {
          row[`others_${cat.value}`] = vals.othersTotals[key] || 0;
        }
      });
      
      row.youSum = vals.youSum;
      if (canCompareWithOthers) {
        row.othersSum = vals.othersSum;
      }
      return row;
    }).sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());
  }, [allData, userFisherId, canCompareWithOthers, availableFishCategories]);

  // Category displays for area chart legend - only show available categories
  const categoryDisplays = useMemo(() =>
    availableFishCategories.map(cat => ({
      id: cat.value,
      name: cat.label,
      color: generateFishCategoryColor(cat.value),
    })), [availableFishCategories]
  );

  // Get color for selected fish category
  const selectedCategoryColor = useMemo(() => {
    const selectedCat = translatedFishCategories.find(cat => cat.value === selectedCategory);
    return selectedCat ? generateFishCategoryColor(selectedCat.value) : "#F79F79";
  }, [selectedCategory, translatedFishCategories]);

  // Get appropriate tab title and description
  const getTabTitle = (tab: string): string => {
    switch(tab) {
      case 'bar-chart':
        return t("text-monthly-fish-composition");
      case 'area-chart':
        return t("text-fish-composition-over-time");
      default:
        return t("text-monthly-fish-composition");
    }
  };
  
  const getTabDescription = (tab: string): string => {
    switch(tab) {
      case 'bar-chart':
        return canCompareWithOthers 
          ? t("text-fish-composition-bar-description") 
          : t("text-fish-composition-individual-description");
      case 'area-chart':
        return canCompareWithOthers 
          ? t("text-fish-composition-area-description") 
          : t("text-fish-composition-area-individual-description");
      default:
        return t("text-fish-composition-bar-description");
    }
  };

  // Custom tooltips
  const BarChartTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="text-sm font-medium text-gray-600 mb-2">{data.displayMonth}</p>
          <div className="space-y-1.5">
            {data.you !== undefined && data.you !== null && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: selectedCategoryColor }} />
                <p className="text-sm font-medium">
                  You <span className="font-semibold">{data.you.toFixed(2)} kg</span>
                </p>
              </div>
            )}
            {canCompareWithOthers && data.others !== undefined && data.others !== null && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: `${selectedCategoryColor}80` }} />
                <p className="text-sm font-medium">
                  {`Other ${bmuName ? bmuName + ' ' : ''}fishers (mean)`} <span className="font-semibold">{data.others.toFixed(2)} kg</span>
                </p>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  // Initialize visibility state for area chart legend
  useEffect(() => {
    const initialVisibility: Record<string, { opacity: number }> = {};
    categoryDisplays.forEach(category => {
      initialVisibility[category.id] = { opacity: 1 };
    });
    setVisibilityState(initialVisibility);
  }, [categoryDisplays]);

  const handleLegendClick = (categoryId: string) => {
    setVisibilityState(prev => {
      const newState = { ...prev };
      newState[categoryId] = {
        opacity: prev[categoryId]?.opacity === 1 ? 0.2 : 1
      };
      return newState;
    });
  };

  // Sync external active tab changes
  useEffect(() => {
    if (activeTab !== localActiveTab) {
      setLocalActiveTab(activeTab);
    }
  }, [activeTab, localActiveTab]);

  // Ensure selected category is available in the data
  useEffect(() => {
    if (availableFishCategories.length > 0 && !availableFishCategories.find(cat => cat.value === selectedCategory)) {
      // If selected category is not available, select the first available category
      setSelectedCategory(availableFishCategories[0].value);
    }
  }, [availableFishCategories, selectedCategory, setSelectedCategory]);

  return (
    <WidgetCard
      title={
        <div className="flex flex-col sm:flex-row items-start sm:items-center w-full gap-3">
          {/* Fish category selector - top left */}
          {localActiveTab === 'bar-chart' && (
            <div className="flex items-center">
              <FishCategorySelector
                selectedCategory={selectedCategory}
                onCategoryChange={setSelectedCategory}
                selectedCategoryOption={selectedCategoryOption}
                fishCategories={availableFishCategories}
              />
            </div>
          )}
          <div className="hidden sm:block text-base font-medium text-gray-800 flex-1">
            <div className="text-center">
              {getTabTitle(localActiveTab)}
            </div>
            <div className="text-xs text-gray-500 text-center mt-1">
              {getTabDescription(localActiveTab)}
            </div>
          </div>
          {/* Tab buttons */}
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto sm:flex-shrink-0">
            <button
              className={`px-4 py-2 text-sm rounded-md transition duration-200 ${
                localActiveTab === 'bar-chart' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              } w-full sm:w-auto`}
              onClick={() => handleTabChange('bar-chart')}
            >
              {t("text-bar-chart-tab") || "Bar Chart"}
            </button>
            <button
              className={`px-4 py-2 text-sm rounded-md transition duration-200 ${
                localActiveTab === 'area-chart' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              } w-full sm:w-auto`}
              onClick={() => handleTabChange('area-chart')}
            >
              {t("text-area-chart-tab") || "Area Chart"}
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


      {/* Bar Chart Tab */}
      {localActiveTab === 'bar-chart' && (
        <SimpleBar>
          <div className="h-96 w-full pt-9">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={barChartData}
                margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                barGap={0}
                barCategoryGap={0}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="displayMonth"
                  tick={{ fontSize: 12 }}
                  tickMargin={10}
                  axisLine={false}
                />
                <YAxis
                  axisLine={false}
                  tick={{ fontSize: 12 }}
                  width={50}
                  label={{
                    value: t('text-unit-kg-fisher-day'),
                    angle: -90,
                    position: 'insideLeft',
                    style: { textAnchor: 'middle', fontSize: 12, fill: '#666' }
                  }}
                />
                <Tooltip content={<BarChartTooltip />} />
                <Bar
                  dataKey="you"
                  fill={selectedCategoryColor}
                  name={t('text-you')}
                  radius={[4, 4, 0, 0]}
                  barSize={18}
                />
                {canCompareWithOthers && (
                  <Bar
                    dataKey="others"
                    fill={`${selectedCategoryColor}80`}
                    name={`Other ${bmuName ? bmuName + ' ' : ''}fishers (mean)`}
                    radius={[4, 4, 0, 0]}
                    barSize={18}
                  />
                )}
                {canCompareWithOthers && (
                  <Legend 
                    verticalAlign="bottom" 
                    height={36} 
                    iconType="rect" 
                    wrapperStyle={{ paddingTop: '10px' }} 
                  />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SimpleBar>
      )}

      {/* Area Chart Tab */}
      {localActiveTab === 'area-chart' && (
        <SimpleBar>
          <div className="h-96 w-full pt-9">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={areaChartData}
                margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="month" 
                  tick={{ fontSize: 12 }}
                  axisLine={false}
                />
                <YAxis 
                  axisLine={false}
                  tick={{ fontSize: 12 }}
                  width={50}
                  label={{
                    value: t('text-unit-kg-fisher-day'),
                    angle: -90,
                    position: 'insideLeft',
                    style: { textAnchor: 'middle', fontSize: 12, fill: '#666' }
                  }}
                />
                <Tooltip 
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const youEntries = payload.filter((entry: any) => entry.name.startsWith('You:') && entry.value > 0);
                      const othersEntries = canCompareWithOthers ? payload.filter((entry: any) => entry.name.startsWith(`Other`) && entry.value > 0) : [];
                      
                      if (youEntries.length === 0 && othersEntries.length === 0) return null;
                      
                      return (
                        <div className="bg-white p-3 border border-gray-200 rounded-md shadow-md">
                          <p className="font-medium text-gray-900">{label}</p>
                          {youEntries.length > 0 && (
                            <div className="mt-2">
                              <p className="text-sm font-medium text-gray-700">You:</p>
                              {youEntries.map((entry: any, index: number) => (
                                <div key={index} className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div 
                                      className="w-3 h-3 rounded-full" 
                                      style={{ backgroundColor: entry.color }}
                                    />
                                    <span className="text-sm">{entry.name.replace('You: ', '')}</span>
                                  </div>
                                  <span className="text-sm font-medium">{entry.value.toFixed(2)} kg</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {othersEntries.length > 0 && (
                            <div className="mt-2">
                              <p className="text-sm font-medium text-gray-700">Others (mean):</p>
                              {othersEntries.map((entry: any, index: number) => (
                                <div key={index} className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div 
                                      className="w-3 h-3 rounded-full" 
                                      style={{ backgroundColor: entry.color }}
                                    />
                                    <span className="text-sm">{entry.name.replace('Others: ', '')}</span>
                                  </div>
                                  <span className="text-sm font-medium">{entry.value.toFixed(2)} kg</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                {/* Render areas for each available fish category - You */}
                {availableFishCategories.map((cat, index) => (
                  <Area
                    key={`you_${cat.value}`}
                    type="monotone"
                    dataKey={`you_${cat.value}`}
                    stackId="you"
                    stroke={generateFishCategoryColor(cat.label)}
                    fill={generateFishCategoryColor(cat.label)}
                    fillOpacity={(visibilityState[cat.value]?.opacity || 1) * 0.8}
                    strokeOpacity={visibilityState[cat.value]?.opacity || 1}
                    name={`You: ${cat.label}`}
                  />
                ))}
                {/* Render areas for each available fish category - Others (if comparison enabled) */}
                {canCompareWithOthers && availableFishCategories.map((cat, index) => (
                  <Area
                    key={`others_${cat.value}`}
                    type="monotone"
                    dataKey={`others_${cat.value}`}
                    stackId="others"
                    stroke={generateFishCategoryColor(cat.label)}
                    fill={generateFishCategoryColor(cat.label)}
                    fillOpacity={(visibilityState[cat.value]?.opacity || 1) * 0.4}
                    strokeOpacity={visibilityState[cat.value]?.opacity || 1}
                    name={`Others: ${cat.label}`}
                  />
                ))}
                {/* Interactive Legend */}
                <Legend
                  content={(props) => {
                    const { payload } = props;
                    if (!payload) return null;
                    
                    return (
                      <div className="flex flex-wrap gap-2 justify-center mt-4">
                        {categoryDisplays.map((category) => (
                          <button
                            key={category.id}
                            className={cn(
                              "flex items-center gap-2 px-3 py-1 rounded-md text-sm transition-opacity",
                              visibilityState[category.id]?.opacity === 1
                                ? "opacity-100"
                                : "opacity-40"
                            )}
                            onClick={() => handleLegendClick(category.id)}
                          >
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: category.color }}
                            />
                            <span>{category.name}</span>
                          </button>
                        ))}
                      </div>
                    );
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SimpleBar>
      )}
    </WidgetCard>
  );
}