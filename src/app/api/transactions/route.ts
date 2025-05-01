import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const {
      tokenId,
      type,
      fromWallet,
      toWallet,
      amount,
      txSignature,
    } = await request.json()

    // Create new transaction
    const transaction = await prisma.transaction.create({
      data: {
        tokenId,
        type,
        fromWallet,
        toWallet,
        amount: amount ? BigInt(amount) : null,
        txSignature,
      },
    })

    return NextResponse.json(transaction)
  } catch (error) {
    console.error('Error creating transaction:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const tokenId = searchParams.get('tokenId')
    const fromWallet = searchParams.get('fromWallet')
    const status = searchParams.get('status')

    let where = {}
    if (tokenId) where = { ...where, tokenId }
    if (fromWallet) where = { ...where, fromWallet }
    if (status) where = { ...where, status }

    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        token: true,
        user: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json(transactions)
  } catch (error) {
    console.error('Error fetching transactions:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const { id, status, error } = await request.json()

    const transaction = await prisma.transaction.update({
      where: { id },
      data: {
        status,
        error,
      },
    })

    return NextResponse.json(transaction)
  } catch (error) {
    console.error('Error updating transaction:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 