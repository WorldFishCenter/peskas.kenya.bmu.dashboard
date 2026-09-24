import { Toaster } from "react-hot-toast";
import { getServerSession } from "next-auth/next";
import NextProgress from "@components/next-progress";
import { authOptions } from "@/app/api/auth/[...nextauth]/auth-options";
import AuthProvider from "@/app/api/auth/[...nextauth]/auth-provider";
import GlobalDrawer from "@/app/shared/drawer-views/container";
import GlobalModal from "@/app/shared/modal-views/container";
import { ThemeProvider } from "@/app/shared/theme-provider";
import { siteConfig } from "@/config/site.config";
import { inter, lexendDeca } from "@/app/fonts";
import cn from "@utils/class-names";
import { dir } from "i18next";
import { languages } from "../i18n/settings";
import { TRPCReactProvider } from "@/trpc/react";
import LanguageInitializer from "../i18n/language-initializer";
import GoogleAnalytics from "../_components/google-analytics";
import UserAnalyticsTracker from "../_components/user-analytics-tracker";
import UsageTracker from "../_components/usage-tracker";
import ModalSwitcher from "@/app/_components/modal/modal-switcher";

export const metadata = {
  title: siteConfig.title,
  description: siteConfig.description,
};

export async function generateStaticParams() {
  return languages.map((lang) => ({ lang }));
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const session = await getServerSession(authOptions);
  return (
    <html lang={lang} dir={dir(lang)} suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={cn(inter.variable, lexendDeca.variable, "font-inter")}
      >
        <GoogleAnalytics />
        <TRPCReactProvider>
          <AuthProvider session={session}>
            <UserAnalyticsTracker />
            <UsageTracker />
            <ThemeProvider>
              <NextProgress />
              <LanguageInitializer lang={lang} />
              {children}
              <Toaster />
              <GlobalDrawer />
              <GlobalModal />
              <ModalSwitcher />
            </ThemeProvider>
          </AuthProvider>
        </TRPCReactProvider>
      </body>
    </html>
  );
}
