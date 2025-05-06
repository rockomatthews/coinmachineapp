import { NextResponse } from 'next/server'
import { testConnection } from '../../../db'

export async function GET() {
  try {
    const result = await testConnection()
    return NextResponse.json(result)
  } catch (error) {
    console.error('Database test error:', error)
    return NextResponse.json(
      { error: 'Database connection test failed', details: error },
      { status: 500 }
    )
  }
} 