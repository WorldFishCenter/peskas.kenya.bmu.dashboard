import { NextResponse } from "next/server"

import withJwt from "@/middleware/withJwt"
import withLang from "@/middleware/withLang"

export function defaultMiddleware() {
  return NextResponse.next();
}

export default withJwt(withLang(defaultMiddleware))

export const config = {
  matcher: [
    '/',
    '/sign-in',
    '/(en|sw|de|es|ar|he|zh)/:path*',
  ],
};