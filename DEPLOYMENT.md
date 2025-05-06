# Deploying to Vercel with Neon Database

This guide provides instructions on deploying your Next.js application to Vercel with Neon serverless Postgres.

## Prerequisites

- A Vercel account connected to your GitHub/GitLab/Bitbucket repository
- A Neon account with an active project

## Steps to Deploy

### 1. Configure Neon Database

1. Create a Neon account at [neon.tech](https://neon.tech)
2. Create a new project
3. In your project dashboard, find your connection string:
   - Click on "Connection Details"
   - Copy the connection string that looks like: `postgres://user:password@hostname:port/database?sslmode=require`

### 2. Set Up Environment Variables on Vercel

When deploying to Vercel, add the following environment variables:

- `DATABASE_URL`: Your Neon connection string (required)
- Any other environment variables specific to your application

### 3. Deploy to Vercel

1. Connect your repository to Vercel
2. Set up the environment variables
3. Deploy the project

The deployment will automatically:
- Generate Drizzle schema files
- Build the Next.js application
- Deploy to Vercel's edge network

### 4. Verify Database Connection

After deployment, visit `/api/db-test` endpoint to verify your database connection.

## Common Issues

### Database Connection Timeout

If you experience connection timeout issues:
- Check your Neon project status
- Verify the correct connection string is being used
- Check if your IP is allowed in Neon's IP restrictions (if enabled)

### Schema Migration Issues

If schema migrations fail:
- Run migrations locally first with `npm run db:migrate`
- Check for any database schema errors
- Verify your database user has the correct permissions

## Scaling Tips

- Neon automatically scales based on usage
- For high-traffic applications, consider:
  - Enabling connection pooling
  - Optimizing query patterns using indexes
  - Using the Neon serverless driver's built-in connection pooling features 