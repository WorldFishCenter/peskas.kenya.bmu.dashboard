import { NextResponse, type NextFetchEvent, type NextMiddleware, type NextRequest } from "next/server"

import { fallbackLng, languages } from "@/app/i18n/settings";
import type { MiddlewareFactory } from "./types";

const withLang: MiddlewareFactory = (next: NextMiddleware) => {
  return async (request: NextRequest, _next: NextFetchEvent) => {
    const res = await next(request, _next)
    const cookieName = "i18next";
    const lang = 
      request.cookies.has(cookieName)
        ? request.cookies.get(cookieName)?.value
        : fallbackLng;
        
    // Get current path
    const { pathname, search } = request.nextUrl;
    
    // Check for repeated language prefixes (common in production)
    const repeatedLangPattern = new RegExp(`^/(${languages.join('|')})/(${languages.join('|')})`);
    if (repeatedLangPattern.test(pathname)) {
      // Get path parts and rebuild correctly
      const pathParts = pathname.split('/').filter(Boolean);
      
      // Find the first non-language segment
      const nonLangIndex = pathParts.findIndex(part => !languages.includes(part));
      
      let newPath;
      if (nonLangIndex !== -1) {
        // Use the latest language in the path + remaining segments
        const latestLang = pathParts[pathParts.length - 1] === 'sw' || 
                           pathParts[pathParts.length - 1] === 'en' ? 
                           pathParts[pathParts.length - 1] : 
                           pathParts[0];
                           
        newPath = `/${latestLang}/${pathParts.slice(nonLangIndex).join('/')}`;
      } else {
        // If all segments are languages, use the last one
        const lastLang = pathParts[pathParts.length - 1];
        newPath = `/${lastLang}`;
      }
      
      // Clean up the path
      newPath = newPath.replace(/\/+/g, '/');
      return NextResponse.redirect(new URL(`${newPath}${search}`, request.url));
    }

    // Handle standard case: no language prefix in path
    if (!languages.some((local) => pathname.startsWith(`/${local}`))) {
      // Use stored language or default
      return NextResponse.redirect(new URL(`/${lang}${pathname}${search}`, request.url));
    }

    return res;
  };
};

export default withLang;