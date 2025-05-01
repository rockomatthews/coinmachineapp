import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const {
      mintAddress,
      creatorWallet,
      name,
      symbol,
      description,
      imageUrl,
      totalSupply,
      decimals,
      metadataUri,
    } = await request.json()

    // Check if token already exists
    const existingToken = await prisma.token.findUnique({
      where: { mintAddress },
    })

    if (existingToken) {
      return NextResponse.json(
        { error: 'Token already exists' },
        { status: 400 }
      )
    }

    // Create new token
    const token = await prisma.token.create({
      data: {
        mintAddress,
        creatorWallet,
        name,
        symbol,
        description,
        imageUrl,
        totalSupply: BigInt(totalSupply),
        decimals,
        metadataUri,
      },
    })

    return NextResponse.json(token)
  } catch (error) {
    console.error('Error creating token:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const mintAddress = searchParams.get('mintAddress')
    const creatorWallet = searchParams.get('creatorWallet')

    if (mintAddress) {
      const token = await prisma.token.findUnique({
        where: { mintAddress },
        include: {
          creator: true,
          transactions: true,
        },
      })
      return NextResponse.json(token)
    }

    if (creatorWallet) {
      const tokens = await prisma.token.findMany({
        where: { creatorWallet },
        include: {
          creator: true,
          transactions: true,
        },
      })
      return NextResponse.json(tokens)
    }

    const tokens = await prisma.token.findMany({
      include: {
        creator: true,
        transactions: true,
      },
    })
    return NextResponse.json(tokens)
  } catch (error) {
    console.error('Error fetching tokens:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 