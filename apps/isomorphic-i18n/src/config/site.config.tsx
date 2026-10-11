import { Metadata } from 'next';
import { OpenGraph } from 'next/dist/lib/metadata/types/opengraph-types';

enum MODE {
  LIGHT = 'light',
  DARK = 'dark',
}

export const siteConfig = {
  title: 'PESKAS | KENYA FISHERIES',
  description: 'Peskas | Kenya Fisheries Dashboard',
  // The public name and production address, for page titles and link previews. The icons and
  // the link-preview image are files in src/app (favicon.ico, icon.svg, apple-icon.png,
  // opengraph-image.png).
  name: 'Peskas Kenya BMU dashboard',
  url: 'https://digitalfisheries.kenya.peskas.org',
  mode: MODE.LIGHT,
  author: {
    name: 'WorldFish',
    url: 'https://www.worldfishcenter.org',
  },
  partners: [
    {
      name: 'WCS',
      fullName: 'Wildlife Conservation Society',
      url: 'https://www.wcs.org',
    },
  ],
  mainContributor: {
    name: 'Lorenzo Longobardi',
    role: 'Main Contributor',
  },
  headerLinks: [],
};

export const metaObject = (
  title?: string,
  openGraph?: OpenGraph,
  description: string = siteConfig.description
): Metadata => {
  // The link preview (site name, image, card) is set once in the root layout (src/app/layout.tsx)
  // and takes this title and description. A page's own openGraph replaces the layout's whole,
  // image included, so pass one only to override the preview.
  return {
    title: title ? `${title} - ${siteConfig.name}` : siteConfig.title,
    description,
    ...(openGraph && { openGraph }),
  };
};
