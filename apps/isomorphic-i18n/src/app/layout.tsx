import type { Metadata } from "next";
import { siteConfig } from "@/config/site.config";
import { inter, lexendDeca } from "@/app/fonts";
import cn from "@utils/class-names";
import ModalSwitcher from "@/app/_components/modal/modal-switcher";
import { TRPCReactProvider } from "@/trpc/react";

import "./[lang]/globals.css";

export const metadata: Metadata = {
  // Absolute base for the link-preview image (opengraph-image.png) and other metadata URLs.
  metadataBase: new URL(siteConfig.url),
  title: siteConfig.title,
  description: siteConfig.description,
  // The link preview for every page: Next adds opengraph-image.png (and its alt) here, and each
  // page's title and description fill in og:title and og:description.
  openGraph: {
    url: siteConfig.url,
    siteName: siteConfig.name, // https://developers.google.com/search/docs/appearance/site-names
    locale: "en_US",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
