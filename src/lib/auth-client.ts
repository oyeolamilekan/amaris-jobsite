import { convexClient } from '@convex-dev/better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient({
  baseURL: (import.meta as any).env.VITE_CONVEX_SITE_URL!,
  plugins: [convexClient()],
})
