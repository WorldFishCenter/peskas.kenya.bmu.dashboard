import { NextResponse, type NextFetchEvent, type NextMiddleware, type NextRequest } from "next/server";

import type { MiddlewareFactory } from "./types"
import { JWT_COOKIE_NAME } from "./const"
import { languages, fallbackLng } from "@/app/i18n/settings";

const withJwt: MiddlewareFactory = (next: NextMiddleware) => {
  return async (request: NextRequest, _next: NextFetchEvent) => {
    const res = await next(request, _next)
    const [cookieToken] = request.cookies
      .getAll()
      .filter((o) => o.name.indexOf(JWT_COOKIE_NAME) > -1)

    // Extract language from pathname
    const pathname = request.nextUrl.pathname;
    const segments = pathname.split('/').filter(Boolean);
    const currentLang = segments.length > 0 && languages.includes(segments[0]) ? segments[0] : fallbackLng;

    const pageMatches = /.*\/(sign-in|forgot-password|reset-password)/gim.exec(
      request.nextUrl.pathname,
    )
    const page = pageMatches ? pageMatches[1] : null;
    
    if (page &&
      !cookieToken
    ) {
      return res
    }

    if (page &&
      cookieToken
    ) {
      // Redirect to root with preserved language
      return NextResponse.redirect(
        new URL(`/${currentLang}`, request.url),
      )
    }

    if (!cookieToken) {
      // Redirect to sign-in with preserved language
      return NextResponse.redirect(
        new URL(`/${currentLang}/sign-in`, request.url),
      )
    } 

    return res
  }
}

export default withJwt
