# peskas.kenya.bmu.dashboard 2.5.1

## Enhancements
- Enhanced BMU name normalization for consistent data handling and visualization
- Improved BMU display normalization for consistent display of BMU names across all charts and UI components
- Refined BMU name normalization for improved data querying and filtering capabilities

## Fixes
- Fixed BMU name normalization issues for consistent data handling and visualization
- Fixed BMU display normalization issues for consistent display of BMU names across all charts and UI components
---


# peskas.kenya.bmu.dashboard 2.5.0

## Enhancements
- Updated living wage references in analytics components and translations for improved accuracy and clarity
- Enhanced fish category handling in analytics components for better data categorization
- Refined translations across English and Swahili locales for improved user experience

## Fixes
- Improved fish category selection and display consistency throughout the application

---

# peskas.kenya.bmu.dashboard 2.4.0

## New features
- Implemented comprehensive user authentication tracking and session management (#28, #29)
- Added UserAnalyticsTracker component for enhanced user activity monitoring
- Introduced session tracking capabilities with user email and authentication event logging

## Enhancements
- Enhanced layout to include UserAnalyticsTracker for improved user tracking throughout the application
- Implemented analytics features to monitor user sessions and authentication patterns
- Added user email tracking to analytics system for better user identification

---

# peskas.kenya.bmu.dashboard 2.3.0

## New features
- Implemented AIA (Administrative Information Access) user role support with dedicated dashboard components
- Added FileStatsAIA component for AIA-specific analytics visualization
- Introduced user role differentiation in FilterSelector component to support CIA, WBCIA, AIA, and IIA roles
- Added role-based chart rendering logic with FileStatsAdmin component for admin users

## Enhancements
- Enhanced FilterSelector to support comprehensive user role differentiation
- Updated analytics components to handle AIA user permissions and data access patterns
- Added mongoose dependency (v8.7.1) to support enhanced data modeling requirements
- Improved chart clarity with reference line adjustments and Y-axis domain calculations
- Refactored Y-axis tick calculation for improved chart readability

---

# peskas.kenya.bmu.dashboard 2.2.0

## New features
- Implemented FileStatsAdmin component for admin-specific dashboard views (#27)
- Added dynamic fish category selection across fish composition analytics
- Introduced unified fish composition charts (IndividualFishCompositionUnified)
- Added user comparison features for individual fisher analytics
- Implemented dynamic color logic for performance difference visualization

## Enhancements
- Enhanced analytics components for IIA (Individual Information Access) user support
- Refactored analytics components for improved user experience and metric handling
- Enhanced FileStatWBCIAGrid to support individual fisher data integration
- Updated localization files (English and Swahili) for enhanced clarity in performance metrics
- Improved FileStatGrid data handling and visualization capabilities
- Refactored FileStat components to use fixed date range for individual data consistency
- Enhanced IndividualFisherTrends component with baseline comparison features
- Updated IndividualFisherStats component for comprehensive performance insights
- Improved catch composition analytics with user comparison capabilities

## Fixes
- Removed historical reference lines from ComparisonChart to reduce visual complexity
- Removed reference lines for "mean_rpua" metric from AnnualChart and TrendsChart for clearer visualization
- Improved chart rendering consistency across different user roles

---

# peskas.kenya.bmu.dashboard 2.1.0

## New features
- Implemented optimized FilterSelector component with improved logic (#24, #25)
- Enhanced CatchMetricsChart component with refined rendering and data handling
- Added BMURanking component for comparative performance visualization

## Enhancements
- Refactored FilterSelector and CatchMetricsChart components for improved clarity
- Enhanced FileStatGrid components for better data handling and visualization
- Improved chart component performance and responsiveness
- Updated collection name in catch monthly schema for consistency
- Enhanced AboutPage content with updated site configuration

## Fixes
- Fixed logic issues in FilterSelector component for better user experience
- Improved chart rendering stability across different data scenarios

---

# peskas.kenya.bmu.dashboard 2.0.0

## New features
- Integrated comprehensive individual fisher data throughout the application (#20, #21, #22, #23)
- Implemented individual fisher performance metrics and dashboard components
- Added trip costs and profit calculations to fisher metrics
- Introduced IndividualFisherStats, IndividualFisherTrends, and IndividualFisherGearPerformance components
- Added individual gear data integration with GearHeatmap component
- Implemented IndividualFishComposition components for personalized catch composition analysis
- Added fisher ID support to user sessions and authentication system

## Enhancements
- Enhanced dashboard to conditionally render individual fisher data based on user permissions
- Updated localization for income-related and fishing performance metrics
- Refactored fish distribution metrics to utilize mean catch values
- Enhanced CatchCompositionPage with individual fisher data integration
- Improved dashboard metrics visibility for IIA users
- Added HeaderMetricSelector for improved mobile support
- Enhanced FileStatGrid with individual fisher metric handling and visualization
- Updated ComparisonChart for improved metric handling with individual data
- Refactored individual data hooks for better performance
- Enhanced GearPerformanceBarChart and GearPerformanceCard components

## Fixes
- Fixed metric compatibility checks for individual vs aggregated data
- Improved chart opacity settings for better readability
- Updated Fisher ID field visibility in UserModal based on user roles

## Documentation
- Updated dashboard component structure to support individual fisher workflows

---

# peskas.kenya.bmu.dashboard 1.2.0

## New features
- Implemented baseline comparisons and time range filtering (#19)
- Added fisher days and baseline data to dashboard metrics
- Introduced time range selector with multiple preset options (current month, 3 months, 6 months, 12 months, all time)
- Added FishCompositionAreaChart for temporal fish composition visualization
- Implemented date range filtering across dashboard components

## Enhancements
- Enhanced dashboard metrics with baseline comparison capabilities
- Added multi-BMU support for comparative baseline analysis
- Implemented client language detection and state management
- Enhanced language switcher functionality to update URL on language change
- Refactored JWT middleware to support language preservation in redirects
- Updated localization files for time range and baseline-related terminology
- Improved fish composition dashboard with area chart visualization
- Enhanced BMU name support in fish composition components

## Fixes
- Fixed language handling in LanguageSwitcher and dashboard components
- Improved language preservation across authentication flows

---

# peskas.kenya.bmu.dashboard 1.1.0

## New features
- Implemented comprehensive internationalization (i18n) support with English and Swahili locales (#7)
- Added language switcher component with flag icons for English and Swahili
- Introduced LanguageInitializer and LanguageHandler components for language persistence
- Added Google Analytics tracking integration in RootLayout

## Enhancements
- Enhanced all dashboard components with i18n translation support
- Added Swahili translations for all user-facing text and metrics
- Improved language detection logic with localStorage and URL parameter support
- Enhanced metric selector with dynamic translation of units
- Updated chart tooltips and labels with localized metric names
- Removed support for Arabic, Chinese, German, and Spanish languages
- Streamlined language options to focus on English and Swahili

## Fixes
- Fixed language prefix handling in LanguageLink component
- Improved language state management across components
- Fixed language persistence issues in dashboard navigation

---

# peskas.kenya.bmu.dashboard 1.0.0

## New features
- Integrated real MongoDB data across all dashboard components
- Implemented monthly statistics collection endpoint with real-time trends
- Added CatchMetricsChart component with multiple view modes (recent, annual, trends)
- Introduced ComparisonChart for BMU performance comparison
- Added AnnualChart for year-over-year analysis
- Implemented TrendsChart with linear regression trendlines
- Added GearHeatmap component with ApexCharts visualization
- Introduced FishCompositionChart and FishCompositionComparison components
- Implemented PerformanceTable with sortable headers and real-time data
- Added BMU-specific dashboard views with CIA user group restrictions
- Introduced session-based BMU retrieval for personalized dashboards
- Added reference BMU selection for comparative analysis

## Enhancements
- Updated dashboard to display real metrics (submissions, fishers, catches, weight)
- Implemented metric selection functionality across charts (catch, effort, CPUE, CPUA, revenue)
- Enhanced radar and area charts with multi-site support
- Added dynamic legend and tooltip for improved data visualization
- Implemented differenced view for comparing individual BMU performance against reference
- Added trendline calculation and visualization with color-coded monthly slope indicators
- Enhanced map visualization with improved tooltip styling and semi-transparent controls
- Refactored color generation system for dynamic BMU colors
- Improved chart interactivity with click handlers and data panels
- Enhanced loading states and error handling across all chart components
- Added percentage change calculation on chart hover
- Implemented robust null/zero value handling in calculations

## Fixes
- Fixed TypeScript interfaces and data typing across components
- Improved default map view positioning for Kenya coast
- Fixed data initialization issues in charts
- Enhanced differenced data calculation for catch charts
- Improved chart rendering stability with better data validation

---

# peskas.kenya.bmu.dashboard 0.6.0

## New features
- Added About page with detailed Peskas Kenya information
- Introduced Kenya flag icon component in Lithium header layout
- Added InfoIcon component for navigation menu

## Enhancements
- Enhanced file stats dashboard with dynamic BMU-specific rendering
- Improved chart interactions with detailed tooltips and percentage changes
- Updated profile menu with dynamic session rendering and user-specific items
- Standardized loading states across dashboard components with LoadingState component
- Improved chart styling consistency with refined margins and layouts
- Enhanced data fetching logic for different user roles and BMU scenarios
- Optimized chart rendering with reduced padding and compact layouts
- Added database connection error handling in API router
- Improved MongoDB connection management with better timeout and logging

## Fixes
- Fixed map visualization issues with info panel positioning (#2)
- Resolved info panel container view overflow
- Fixed radio group label interaction for better UX
- Enhanced data processing and error handling in CatchRadarChart
- Improved chart data calculation with better null/zero value handling

---

# peskas.kenya.bmu.dashboard 0.5.0

## New features
- Implemented NextAuth.js authentication with JWT strategy (#1)
- Added custom Mongoose adapter for NextAuth
- Introduced Google OAuth authentication support
- Added user management with groups and BMU associations
- Implemented password reset flow with email verification
- Added user modal for creating and editing users
- Introduced BMU permission system with seeding capabilities

## Enhancements
- Refactored authentication middleware (withJwt, withPermission, withLang)
- Updated session handling with 1-day default expiry (30 days with "remember me")
- Enhanced sign-in page layout with new background images
- Simplified AuthWrapperFour component structure
- Refactored database connection handling with Mongoose
- Added user table with BMU and group management
- Enhanced profile menu with session-based rendering
- Updated copyright year to 2025

## Fixes
- Fixed redirect after successful login
- Resolved runtime errors in authentication flow
- Fixed missing image references
- Improved environment variable handling for Vercel deployment

---

# peskas.kenya.bmu.dashboard 0.4.0

## New features
- Implemented Global Filter Selector component (#3)
- Integrated tRPC for type-safe API communication
- Added BMU (Beach Management Unit) filtering capability
- Introduced global filter state management with cookies

## Enhancements
- Added tRPC API package (@isomorphic/api) with routers for aggregated catch, gear distribution, and monthly stats
- Implemented header-based global filter passing (x-global-filters)
- Enhanced dashboard components to utilize global filter context
- Added Vercel deployment configuration

## Fixes
- Fixed build errors related to path aliases
- Resolved unused variable warnings
- Updated environment variable configuration in turbo.json

---

# peskas.kenya.bmu.dashboard 0.3.0

## New features
- Implemented MongoDB API integration with real data collections
- Added aggregated catch data endpoints
- Introduced gear distribution API routes
- Created mean catch radar API endpoint
- Added monthly_stats collection integration

## Enhancements
- Updated dashboard components to fetch data from MongoDB
- Enhanced catch aggregated page with real-time data
- Improved gear-distribution API to fetch from correct collections
- Added logging for debugging API routes
- Filtered gear-tree data to exclude zero counts
- Integrated file dashboard with catch radar chart and deck map

## Fixes
- Updated MongoDB client connection handling
- Fixed data collection references across API routes
- Improved error handling in API endpoints

---

# peskas.kenya.bmu.dashboard 0.2.0

## New features
- Added GPS trackers DeckGL map visualization with interactive controls
- Implemented aggregated catch page with data visualization
- Created catch time series chart component
- Added gear type treemap visualization
- Introduced CatchRadarChart for multi-dimensional catch analysis

## Enhancements
- Populated aggregated catch page with real data
- Added export functionality for aggregated catch bar plots
- Enhanced dashboard layout with catch visualization components
- Improved map controls with collapsible info panel
- Added dark theme support for dashboard and header components
- Implemented theme toggle button
- Enhanced chart components with loading and error states

## Fixes
- Refactored getTooltip function for better DeckMap styling
- Improved tooltip transparency and spacing
- Updated default map view and attribution controls

---

# peskas.kenya.bmu.dashboard 0.1.0

## New features
- Initial project setup with Next.js 14.2.3 and Turborepo monorepo structure
- Created isomorphic-i18n application as main production app
- Implemented Hydrogen layout system as default (with Helium, Lithium, Beryllium, Boron, Carbon alternatives)
- Added logo and branding elements
- Set up navigation bar with icons

## Enhancements
- Configured Turborepo workspace with shared packages (@isomorphic/core, @repo/nosql, @repo/tailwind-config)
- Updated dependencies for core functionality
- Established default layout structure

## Documentation
- Initialized repository with basic README
