import { cache } from "react";
import { headers } from "next/headers";
import { getServerSession } from "next-auth";

import { createCaller, createTRPCContext } from "@api/index";

import { authOptions } from "@/app/api/auth/[...nextauth]/auth-options";

/**
 * This wraps the `createTRPCContext` helper and provides the required context for the tRPC API when
 * handling a tRPC call from a React Server Component.
 */
const createContext = cache(async () => {
  const heads = new Headers(await headers());
  heads.set('x-trpc-source', 'rsc');

  return createTRPCContext({
    session: await getServerSession(authOptions),
    headers: heads,
  });
});

export const api = createCaller(createContext);
