import { NextResponse } from 'next/server'
import { createToken } from '../../../db/queries';
import { db } from '../../../db';
import { tokens } from '../../../db/schema';
import { and, eq, or } from 'drizzle-orm';

export const runtime = 'edge'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const token = await createToken(body);
    return NextResponse.json(token)
  } catch (error) {
    console.error('Error creating token:', error)
    return NextResponse.json(
      { error: 'Failed to create token' },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const mintAddress = searchParams.get('mintAddress')
    const creatorWallet = searchParams.get('creatorWallet')

    const conditions = [];
    
    if (mintAddress) {
      conditions.push(eq(tokens.mintAddress, mintAddress));
    }
    
    if (creatorWallet) {
      conditions.push(eq(tokens.creatorWallet, creatorWallet));
    }
    
    const result = await db.query.tokens.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      with: {
        transactions: true
      }
    });

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching tokens:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tokens' },
      { status: 500 }
    )
  }
} 