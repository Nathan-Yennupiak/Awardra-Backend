# Awards Platform Backend API

Production-ready backend API for the Awards and Nomination Platform.

## Architecture

Built with:
- Node.js & TypeScript
- Express.js
- PostgreSQL & Prisma ORM
- Zod for validation
- Paystack for payments

## Features

- **Public API:** Fetch awards, categories, candidates, and initialize nominations.
- **Admin API:** Manage platform-specific awards, candidates, and view reports. Data is isolated by platform ownership.
- **Super Admin API:** Manage global settings, platforms, and view complete financial analytics.
- **Payments:** Secure Paystack webhook integration, accurate gross-up financial calculation, server-side idempotency.

## Setup

1. Copy `.env.example` to `.env` and configure your database and Paystack credentials.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run migrations and seed data:
   ```bash
   npx prisma migrate dev
   npm run prisma:seed
   ```
4. Start development server:
   ```bash
   npm run dev
   ```

## Financial Model

1. **Base Nomination Amount:** The intended price of the nomination (e.g., GHS 100).
2. **Paystack Fee:** Charged on top of the base amount (e.g., 1.95%). The API mathematically grosses this up so the customer pays it.
3. **Creator Fee:** Configurable percentage (e.g., 5%) deducted from the base amount, belonging to the Super Admin.
4. **Owner Net:** The remaining amount given to the Platform Admin.

All monetary values are calculated strictly using integer minor units (pesewas) to prevent floating-point errors.

## API Documentation

- **`/api/v1/auth`**: Login, Logout, Session management.
- **`/api/v1/super-admin`**: Platform-wide management and global analytics.
- **`/api/v1/admin`**: Platform-specific management (awards, categories, candidates).
- **`/api/v1/nominations`**: Initialize a new payment transaction.
- **`/api/v1/payments/paystack/webhook`**: Verifies and confirms payments securely.
- **`/api/v1/` (Public)**: Fetch published awards and candidate progress.
