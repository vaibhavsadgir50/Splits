import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const DEV_AUTH_COOKIE = 'dev_auth_email'

// Resolves the signed-in Supabase user from the request's cookies, or null.
//
// Dev-only bypass: if the `dev_auth_email` cookie is set, impersonate that
// email instead of requiring a real Google OAuth session — lets local
// testing of multi-account flows happen without signing in as different
// Google accounts each time. Set/cleared via /api/dev-login, which itself
// refuses to run outside development. This branch is unreachable in
// production since NODE_ENV is always 'production' there.
export async function getAuthedUser() {
  const cookieStore = await cookies()

  if (process.env.NODE_ENV !== 'production') {
    const devEmail = cookieStore.get(DEV_AUTH_COOKIE)?.value
    if (devEmail) {
      return { email: devEmail, user_metadata: { full_name: devEmail.split('@')[0] } }
    }
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        },
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}
