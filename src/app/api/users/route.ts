import { NextResponse } from 'next/server'
import { createUser, getUserByWalletAddress, getAllUsers } from '../../../db/queries';

export async function POST(request: Request) {
  try {
    const { walletAddress, email } = await request.json()

    // Check if user already exists
    const existingUser = await getUserByWalletAddress(walletAddress);

    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 400 }
      )
    }

    // Create new user
    const user = await createUser({
      walletAddress,
      email,
      lastLogin: new Date(),
      tokensCreated: 0,
      isVerified: false
    });

    return NextResponse.json(user)
  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const walletAddress = searchParams.get('walletAddress')

    if (walletAddress) {
      const user = await getUserByWalletAddress(walletAddress);
      return NextResponse.json(user)
    }

    const users = await getAllUsers();
    return NextResponse.json(users)
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 