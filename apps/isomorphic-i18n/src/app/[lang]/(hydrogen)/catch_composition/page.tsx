"use client";
import { use, useState, useMemo } from "react";
import { useAtom } from "jotai";
import { useTranslation } from "@/app/i18n/client";
import type { DefaultSession } from "next-auth";
import type { TBmu } from "@repo/nosql/schema/bmu";
import FishCompositionChart from "@/app/shared/analytics/species/components/composition-chart";
import FishCompositionComparison from "@/app/shared/analytics/species/components/composition-comparison";
import FishCompositionAreaChart from "@/app/shared/analytics/species/components/composition-area-chart";
import IndividualFishCompositionUnified from "@/app/shared/analytics/species/components/individual-fish-composition-unified";
import IndividualFishCompositionComparison from "@/app/shared/analytics/species/components/individual-composition-comparison";
import { useUserPermissions } from "@/app/shared/analytics/core/hooks/use-user-permissions";
import { useIndividualData } from "@/app/shared/analytics/individual/hooks/use-individual-data";
import { api } from "@/trpc/react";
import { getTimeRangeStartDate } from "@/app/shared/analytics/core/utils/time-range-filter";
import { selectedTimeRangeAtom, bmusAtom } from "@/app/components/filter-selector";
import { Text, Collapse } from "rizzui";
import { PiUser, PiCaretDownBold } from "react-icons/pi";
import cn from "@utils/class-names";

type SerializedBmu = {
  _id: string;
  BMU: string;
  group: string;
}

type CustomSession = {
  user?: {
    bmus?: Omit<TBmu, "lat" | "lng" | "treatments">[];
    userBmu?: SerializedBmu;
  } & DefaultSession["user"]
}

// Fix for Next.js 14: Use proper param typing for app router pages
interface PageProps {
  params: Promise<{
    lang: string;
  }>;
}

export default function CatchCompositionPage({ params }: PageProps) {
  const { lang } = use(params);
  // Use the same state management pattern as the homepage FileDashboard
  const [selectedCategory, setSelectedCategory] = useState<string>("Octopus");
  const [activeTab, setActiveTab] = useState("trends");
  const [isCollapseOpen, setIsCollapseOpen] = useState(false);
  const { t } = useTranslation("common");

  // Use the same permission patterns as homepage
  const {
    referenceBMU,
    isIiaUser,
    userFisherId,
    isWbciaUser,
    shouldShowUnifiedDashboard,
    isAdminFisher,
    shouldShowIndividualData,
    canSeeBMUData
  } = useUserPermissions();

  const [selectedTimeRange] = useAtom(selectedTimeRangeAtom);
  const [bmus] = useAtom(bmusAtom); // Get the BMU array for charts

  // Use reference BMU like homepage - consistent pattern
  const effectiveBMU = referenceBMU || undefined;

  // Only recalculate when selectedTimeRange changes - memoize dates to prevent loops
  const { startDate: memoStartDate, endDate: memoEndDate, startDateObj, endDateObj } = useMemo(() => {
    const end = new Date();
    const start = getTimeRangeStartDate(selectedTimeRange, end);
    return {
      startDate: start ? start.toISOString() : undefined,
      endDate: end.toISOString(),
      startDateObj: start,
      endDateObj: end,
    };
  }, [selectedTimeRange]);

  // Fetch individual data for users who should see individual data (IIA users and admin-fishers)
  const { individualFishDistribution, isLoadingIndividualFishDistribution } = useIndividualData({
    startDate: startDateObj || undefined,
    endDate: endDateObj
  });

  // Get BMU name from individual data for BMU-specific queries
  const bmuName = useMemo(() => {
    if (!shouldShowIndividualData || !individualFishDistribution || individualFishDistribution.length === 0) return undefined;
    return individualFishDistribution[0]?.landing_site;
  }, [individualFishDistribution, shouldShowIndividualData]);

  // Fetch all individual fish distribution for the BMU (for peers comparison) - only if user can compare
  const { data: allBmuIndividualData, isLoading: isLoadingBmuData } = api.individualData.individualFishDistributionByBMU.useQuery(
    {
      bmu: bmuName || "",
      startDate: memoStartDate,
      endDate: memoEndDate,
    },
    { enabled: shouldShowIndividualData && !!bmuName && canSeeBMUData }
  );





  // Process individual data for pure IIA users (no BMU comparison)
  const individualOnlyData = useMemo(() => {
    if (!shouldShowIndividualData || !individualFishDistribution || canSeeBMUData) return null;

    // For pure IIA users, create a simplified data structure with only their own data
    return individualFishDistribution.map(item => ({
      ...item,
      fisher_id: userFisherId
    }));
  }, [individualFishDistribution, shouldShowIndividualData, canSeeBMUData, userFisherId]);

  // Loading state for individual data users
  const isLoadingIndividualCharts = shouldShowIndividualData && (isLoadingIndividualFishDistribution || (canSeeBMUData && isLoadingBmuData));

  // If user is pure IIA, show only individual fisher dashboard (like homepage)
  if (isIiaUser && userFisherId && !isAdminFisher) {
    return (
      <div className="w-full">
        <div className="grid grid-cols-1 gap-5 xl:gap-6">
          <div className="grid grid-cols-12 gap-5 xl:gap-6">
            {/* Unified Fish Composition Charts with Tab Switching */}
            <div className="col-span-12">
              {isLoadingIndividualCharts || (!allBmuIndividualData && !individualOnlyData) ? (
                <div className="h-96 w-full flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-8 h-8 border-4 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
                    <span className="text-sm text-gray-500">{t("text-loading")}</span>
                  </div>
                </div>
              ) : (
                <IndividualFishCompositionUnified
                  allData={allBmuIndividualData || individualOnlyData || []}
                  userFisherId={userFisherId || ""}
                  selectedCategory={selectedCategory}
                  setSelectedCategory={setSelectedCategory}
                  bmuName={bmuName || ""}
                  activeTab="bar-chart"
                  onTabChange={(tab) => {
                    // Optional: Add any additional tab change handling here
                  }}
                />
              )}
            </div>
            {/* Keep the composition comparison as a separate component */}
            <div className="col-span-12">
              {isLoadingIndividualCharts || (!allBmuIndividualData && !individualOnlyData) ? (
                <div className="h-96 w-full flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-8 h-8 border-4 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
                    <span className="text-sm text-gray-500">{t("text-loading")}</span>
                  </div>
                </div>
              ) : (
                <IndividualFishCompositionComparison
                  allData={allBmuIndividualData || individualOnlyData || []}
                  userFisherId={userFisherId || ""}
                  bmuName={bmuName || ""}
                  title={t("text-fish-composition-comparison")}
                  description={t("text-fish-composition-comparison-desc")}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Default BMU-level dashboard with optional individual section for admin-fishers (like homepage)
  return (
    <div className="w-full">
      <div className="grid grid-cols-1 gap-5 xl:gap-6">

        {/* Individual Fisher Performance Integration for Administrator-Fishers */}

        {/* {shouldShowUnifiedDashboard && (
          <div className="bg-gradient-to-r from-blue-100 to-indigo-50 rounded-xl border border-blue-100 shadow-sm">
            <Collapse
              defaultOpen={false}
              className="px-6 py-6"
              header={({ open, toggle }) => (
                <button
                  type="button"
                  onClick={() => {
                    toggle();
                    setIsCollapseOpen(!open);
                  }}
                  className="flex w-full cursor-pointer items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-12 h-12 bg-blue-500 rounded-xl shadow-sm">
                      <PiUser className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-left">
                      <Text className="text-xl font-bold text-gray-900">
                        {t('text-your-fishing-performance')}
                      </Text>
                      <Text className="text-sm text-gray-600">
                        {t('text-personal-fishing-insights-alongside-management')}
                      </Text>
                    </div>
                  </div>
                  <PiCaretDownBold
                    className={cn(
                      "h-5 w-5 -rotate-90 transform transition-transform duration-300 text-gray-500 rtl:rotate-90",
                      open && "rotate-0 rtl:rotate-0"
                    )}
                  />
                </button>
              )}
            >
              
              {isCollapseOpen && (
                <div className="space-y-6 pt-6">
                  <div className="grid grid-cols-12 gap-5 xl:gap-6">
                  <div className="col-span-12">
                    {isLoadingIndividualCharts || !allBmuIndividualData ? (
                      <div className="h-96 w-full flex items-center justify-center">
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-8 h-8 border-4 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
                          <span className="text-sm text-gray-500">{t("text-loading")}</span>
                        </div>
                      </div>
                    ) : (
                      <IndividualFishCompositionChart
                        allData={allBmuIndividualData}
                        userFisherId={userFisherId || ""}
                        selectedCategory={selectedCategory}
                        setSelectedCategory={setSelectedCategory}
                        bmuName={bmuName || ""}
                        title={t("text-your-monthly-trends")}
                        description={t("text-compared-with-bmu-average", { bmu: bmuName })}
                      />
                    )}
                  </div>
                  <div className="col-span-12">
                    {isLoadingIndividualCharts || !allBmuIndividualData ? (
                      <div className="h-96 w-full flex items-center justify-center">
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-8 h-8 border-4 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
                          <span className="text-sm text-gray-500">{t("text-loading")}</span>
                        </div>
                      </div>
                    ) : (
                      <IndividualFishCompositionComparison
                        allData={allBmuIndividualData}
                        userFisherId={userFisherId || ""}
                        bmuName={bmuName || ""}
                        title={t("text-fish-composition-comparison")}
                        description={t("text-fish-composition-comparison-desc")}
                      />
                    )}
                  </div>
                  </div>
                </div>
              )}
            </Collapse>
          </div>
        )} */}

        {/* BMU-level charts for users who can see BMU data */}
        {canSeeBMUData && bmus.length > 0 && (
          <div className="grid grid-cols-12 gap-5 xl:gap-6">
            <div className="col-span-12">
              <FishCompositionComparison
                lang={lang}
                bmu={effectiveBMU}
              />
            </div>
            <div className="col-span-12">
              <FishCompositionChart
                lang={lang}
                bmu={effectiveBMU}
                selectedCategory={selectedCategory}
                onCategoryChange={setSelectedCategory}
                activeTab={activeTab}
                onTabChange={setActiveTab}
              />
            </div>
            <div className="col-span-12">
              <FishCompositionAreaChart
                lang={lang}
                bmu={effectiveBMU}
                isIiaUser={isIiaUser}
              />
            </div>
          </div>
        )}

        {/* Show message if no BMUs available */}
        {canSeeBMUData && bmus.length === 0 && (
          <div className="col-span-12 h-96 w-full flex items-center justify-center">
            <div className="text-center">
              <div className="text-lg font-medium text-gray-900 mb-2">
                {t("text-no-bmus-selected")}
              </div>
              <div className="text-sm text-gray-500">
                {t("text-please-select-bmus-from-filter")}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}