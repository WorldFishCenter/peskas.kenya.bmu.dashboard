import React, { useState, useMemo } from "react";
import WidgetCard from "@components/cards/widget-card";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { getFishCategories } from "./composition-chart";
import SimpleBar from "@ui/simplebar";
import { generateFishCategoryColor } from "../../charts/utils/chart-utils";
import { useAtom } from "jotai";
import { selectedTimeRangeAtom } from "@/app/components/filter-selector";
import { useUserPermissions } from "../../core/hooks/use-user-permissions";
import { useTranslation } from "@/app/i18n/client";

export default function IndividualFishCompositionComparison({
  allData,
  userFisherId,
  title,
  description,
  bmuName = ""
}: {
  allData: any[];
  userFisherId: string;
  title?: string;
  description?: string;
  bmuName?: string;
}) {
  const { t } = useTranslation("common");
  const [selectedTimeRange] = useAtom(selectedTimeRangeAtom);
  const [visibilityState, setVisibilityState] = useState<Record<string, { opacity: number }>>({});
  const { canCompareWithOthers } = useUserPermissions();

  // Get translated fish categories
  const translatedFishCategories = useMemo(() => getFishCategories(t), [t]);

  const endDate = new Date();
  let startDate = new Date(0); // No longer needed, filtering is done in component

  // Use allData as-is (already filtered by backend)
  const filteredData = allData;

  // Find the latest month in the filtered data
  const latestMonth = useMemo(() => {
    if (!Array.isArray(filteredData) || filteredData.length === 0) return null;
    const months = filteredData.map(item => {
      const date = new Date(item.date);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    });
    return months.sort().reverse()[0];
  }, [filteredData]);

  // Get available fish categories from data
  const availableFishCategories = useMemo(() => {
    if (!allData.length) return translatedFishCategories;

    const availableCategories = new Set(allData.map(item => item.fish_category));
    return translatedFishCategories.filter(cat => availableCategories.has(cat.value));
  }, [allData, translatedFishCategories]);

  // Clean aggregation logic, no debug logs
  const chartData = useMemo(() => {
    if (!filteredData.length) return [];
    const normalize = (str: string) => str.trim().toLowerCase();
    const youTotals: Record<string, number> = {};
    let youSum = 0;
    const othersTotals: Record<string, number> = {};
    let othersSum = 0;
    filteredData.forEach(item => {
      const key = normalize(item.fish_category);
      if (item.fisher_id === userFisherId) {
        youTotals[key] = (youTotals[key] || 0) + (item.mean_catch_kg || 0);
        youSum += item.mean_catch_kg || 0;
      } else if (canCompareWithOthers) {
        // Only process others data if user can compare with others
        othersTotals[key] = (othersTotals[key] || 0) + (item.mean_catch_kg || 0);
        othersSum += item.mean_catch_kg || 0;
      }
    });
    const youRow: Record<string, any> = { label: t('text-you') };
    const othersRow: Record<string, any> = { label: "Other BMU fishers" };
    let youTotalPct = 0;
    let othersTotalPct = 0;
    availableFishCategories.forEach(cat => {
      const key = normalize(cat.value);
      const youPct = youSum > 0 ? ((youTotals[key] || 0) / youSum * 100) : 0;
      youRow[cat.value] = +youPct.toFixed(2);
      youTotalPct += youPct;
      
      // Only process others percentages if user can compare
      if (canCompareWithOthers) {
        const othersPct = othersSum > 0 ? ((othersTotals[key] || 0) / othersSum * 100) : 0;
        othersRow[cat.value] = +othersPct.toFixed(2);
        othersTotalPct += othersPct;
      }
    });
    if (youTotalPct !== 100) {
      const maxKey = availableFishCategories.reduce((max, cat) => youRow[cat.value] > youRow[max] ? cat.value : max, availableFishCategories[0].value);
      youRow[maxKey] += +(100 - youTotalPct).toFixed(2);
    }
    if (canCompareWithOthers && othersTotalPct !== 100) {
      const maxKey = availableFishCategories.reduce((max, cat) => othersRow[cat.value] > othersRow[max] ? cat.value : max, availableFishCategories[0].value);
      othersRow[maxKey] += +(100 - othersTotalPct).toFixed(2);
    }
    // Return only user's row if they can't compare, otherwise return both
    return canCompareWithOthers ? [youRow, othersRow] : [youRow];
  }, [filteredData, userFisherId, canCompareWithOthers, availableFishCategories, t]);

  // Legend and color mapping - only available categories
  const categoryDisplays = availableFishCategories.map(cat => ({
    id: cat.value,
    name: cat.label,
    color: generateFishCategoryColor(cat.value),
  }));
  // Row labels for the chart
  const rowLabels = canCompareWithOthers ? [
    { label: t('text-you') },
    { label: `Other ${bmuName ? bmuName + ' ' : ''}fishers (mean, avg. per month)` }
  ] : [
    { label: t('text-you') }
  ];

  // Interactive legend logic
  React.useEffect(() => {
    // Reset legend visibility when categories change
    const initialVisibility: Record<string, { opacity: number }> = {};
    categoryDisplays.forEach(category => {
      initialVisibility[category.id] = { opacity: 1 };
    });
    setVisibilityState(initialVisibility);
    // categoryDisplays is rebuilt each render; length is the stable signal we care about
    // eslint-disable-next-line react-hooks/exhaustive-deps -- categoryDisplays identity would infinite-loop
  }, [categoryDisplays.length]);

  const handleLegendClick = (categoryId: string) => {
    setVisibilityState(prev => {
      const newState = { ...prev };
      newState[categoryId] = {
        opacity: prev[categoryId]?.opacity === 1 ? 0.2 : 1
      };
      return newState;
    });
  };

  // Tooltip
  // Group entries by 'You' and 'Other BMU fishers', only show non-zero values
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      // Group by label ("You" or full others label)
      const othersLabel = `Other ${bmuName ? bmuName + ' ' : ''}fishers (mean, avg. per month)`;
      const youEntries = payload.filter((entry: any) => entry.payload.label === t('text-you') && entry.value > 0);
      const othersEntries = payload.filter((entry: any) => entry.payload.label === othersLabel && entry.value > 0);
      if (youEntries.length === 0 && othersEntries.length === 0) return null;
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-md shadow-md">
          <div className="space-y-2">
            {youEntries.length > 0 && (
              <div>
                <div className="font-semibold text-gray-900 mb-1">{t('text-you')}</div>
                {youEntries.map((entry: any, idx: number) => (
                  <div key={`tooltip-you-${idx}`} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span className="text-sm text-gray-700">{entry.name}: {entry.value.toFixed(2)}% <span className="text-xs text-gray-500">(avg. catch per month)</span></span>
                  </div>
                ))}
              </div>
            )}
            {othersEntries.length > 0 && (
              <div>
                <div className="font-semibold text-gray-900 mb-1 mt-2">{othersLabel}</div>
                {othersEntries.map((entry: any, idx: number) => (
                  <div key={`tooltip-others-${idx}`} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span className="text-sm text-gray-700">{entry.name}: {entry.value.toFixed(2)}% <span className="text-xs text-gray-500">(avg. catch per month)</span></span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  // Interactive Legend
  const CustomLegend = () => (
    <div className="flex justify-center mt-6">
      <div className="inline-flex flex-wrap justify-center gap-4">
        {categoryDisplays.map(category => (
          <div
            key={category.id}
            className="flex items-center gap-2 px-2 py-1 cursor-pointer transition-opacity duration-200 rounded hover:bg-gray-100"
            onClick={() => handleLegendClick(category.id)}
            style={{ opacity: visibilityState[category.id]?.opacity ?? 1 }}
          >
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: category.color }} />
            <span className="text-sm text-gray-700 whitespace-nowrap">{category.name}</span>
          </div>
        ))}
      </div>
    </div>
  );

  if (!latestMonth) {
    return <WidgetCard title={title || "Fish Composition Comparison"}><div className="h-64 flex items-center justify-center text-gray-400">No data</div></WidgetCard>;
  }

  return (
    <WidgetCard title={title} description={description} headerClassName="pb-2">
      <SimpleBar>
        <div className="h-96 w-full pt-9">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData.map((row, i) => ({ ...row, label: rowLabels[i]?.label || row.label }))}
              layout="vertical"
              margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
              barCategoryGap={8}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis 
                type="number" 
                tick={{ fontSize: 12 }} 
                domain={[0, 100]} 
                tickFormatter={(value) => `${value}%`}
                label={{
                  value: 'Avg. catch composition (% per month)',
                  position: 'insideBottom',
                  offset: -5,
                  style: { textAnchor: 'middle', fontSize: 12, fill: '#666' }
                }}
                axisLine={false}
              />
              <YAxis 
                type="category" 
                dataKey="label" 
                tick={{ fontSize: 12 }} 
                width={canCompareWithOthers ? 140 : 80}
                axisLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              {categoryDisplays.map(category => (
                <Bar
                  key={category.id}
                  dataKey={category.id}
                  name={category.name}
                  stackId="stack"
                  fill={category.color}
                  isAnimationActive={false}
                  fillOpacity={visibilityState[category.id]?.opacity ?? 1}
                  hide={visibilityState[category.id]?.opacity === 0.2}
                  radius={[0, 2, 2, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
        {/* Move legend outside of chart container */}
        <CustomLegend />
      </SimpleBar>
    </WidgetCard>
  );
} 