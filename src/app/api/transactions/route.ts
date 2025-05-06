import { NextResponse } from 'next/server'
import { createTransaction, getTransactionsByOptions } from '../../../db/queries';
import { db } from '../../../db';
import { transactions } from '../../../db/schema';
import { eq } from 'drizzle-orm';

export const runtime = 'edge'

export async function POST(request: Request) {
  try {
    const data = await request.json()
    
    // Create new transaction
    const transaction = await createTransaction(data);
    
    return NextResponse.json(transaction)
  } catch (error) {
    console.error('Error creating transaction:', error)
    return NextResponse.json(
      { error: 'Failed to create transaction' },
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

    const options = {
      ...(tokenId && { tokenId }),
      ...(fromWallet && { fromWallet }),
      ...(status && { status })
    };

    const transactions = await getTransactionsByOptions(options);

    return NextResponse.json(transactions)
  } catch (error) {
    console.error('Error fetching transactions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const result = await db.update(transactions)
      .set({
        status: body.status as any,
        error: body.error
      })
      .where(eq(transactions.id, body.id))
      .returning();
    
    return NextResponse.json(result[0])
  } catch (error) {
    console.error('Error updating transaction:', error)
    return NextResponse.json(
      { error: 'Failed to update transaction' },
      { status: 500 }
    )
  }
} 