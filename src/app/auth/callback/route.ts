import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  
  if (code) {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!authError && user) {
      // Check if user has a nickname to determine onboarding status
      const { data: profile } = await supabase
        .from('profiles')
        .select('nickname')
        .eq('id', user.id)
        .single()
        
      if (profile && profile.nickname) {
        return NextResponse.redirect(`${origin}/`)
      } else {
        return NextResponse.redirect(`${origin}/onboarding`)
      }
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth?error=Could not authenticate user`)
}
