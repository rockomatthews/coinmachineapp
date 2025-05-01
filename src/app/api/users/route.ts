import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { walletAddress, email } = await request.json()

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { walletAddress },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 400 }
      )
    }

    // Create new user
    const user = await prisma.user.create({
      data: {
        walletAddress,
        email,
      },
    })

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
      const user = await prisma.user.findUnique({
        where: { walletAddress },
        include: {
          tokens: true,
          transactions: true,
        },
      })
      return NextResponse.json(user)
    }

    const users = await prisma.user.findMany({
      include: {
        tokens: true,
        transactions: true,
      },
    })
    return NextResponse.json(users)
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 