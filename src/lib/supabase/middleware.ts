import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder-project.supabase.co"
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key"

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        )
        supabaseResponse = NextResponse.next({
          request,
        })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        )
      },
    },
  })

  // refreshToken 메서드 등을 통해 세션을 최신화
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 보호되어야 할 경로 정의
  const protectedRoutes = ['/home', '/onboarding', '/match', '/chat', '/requests']
  const isProtectedRoute = protectedRoutes.some((route) => 
    request.nextUrl.pathname.startsWith(route)
  )

  if (isProtectedRoute && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth'
    return NextResponse.redirect(url)
  }

  // 인증된 사용자가 인증 페이지에 접근하려 할 때 
  // (임시적으로 /home으로 리스트림. 콜백 등에서 profile을 확인할 것이므로 기본값은 /home 처리)
  if (request.nextUrl.pathname === '/auth' && user) {
     const url = request.nextUrl.clone()
     url.pathname = '/home'
     return NextResponse.redirect(url)
  }

  return supabaseResponse
}
