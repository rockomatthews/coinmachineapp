import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// This function can be marked `async` if using `await` inside
export function middleware(request: NextRequest) {
  // Get the pathname of the request
  const path = request.nextUrl.pathname

  // Define public paths that don't require authentication
  const isPublicPath = path === '/' || path.startsWith('/api/public')

  // Get the wallet address from the request headers
  const walletAddress = request.headers.get('x-wallet-address')
  const signature = request.headers.get('x-signature')

  // If it's a protected path and no wallet address is provided, redirect to home
  if (!isPublicPath && (!walletAddress || !signature)) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    )
  }

  // Verify the signature if provided
  if (walletAddress && signature) {
    // TODO: Implement signature verification
    // For now, we'll just pass the wallet address to the API routes
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-verified-wallet', walletAddress)

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })
  }

  return NextResponse.next()
}

// Configure which routes to run middleware on
export const config = {
  matcher: [
    '/api/users/:path*',
    '/api/tokens/:path*',
    '/api/transactions/:path*',
  ],
} 