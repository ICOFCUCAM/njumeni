# Njumeni web application

This is the application shell for Njumeni — Global Legal Intelligence.

## Run locally
1. Use Node.js 22.13 or later within the Node 22 major line.
2. Install dependencies with npm ci after the committed package-lock.json is present.
3. Start the development server with npm run dev.
4. Open http://localhost:3000.

## Current scope
- Next.js App Router shell and route groups.
- Responsive workspace navigation.
- Dashboard and all thirteen A–M module route entry points.
- Sign-in boundary placeholder reserved for Phase 1.
- Health endpoint explicitly reports no auth/database connection.
- No customer data, legal matter records, AI provider or Supabase connection.

The module routes are intentionally non-operational until their numbered phases. Do not add simulated legal advice, sample customer matters or confidential fixtures to the shell.
