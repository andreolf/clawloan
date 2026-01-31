# Clawloan Frontend

Next.js app powering the Clawloan money market UI and API routes.

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your database URL

# Set up database
npx prisma db push
npx prisma db seed  # Optional: seed test data

# Run development server
npm run dev
```

Open http://localhost:3000

## Project Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── api/           # API routes
│   │   │   ├── bots/      # Agent registration
│   │   │   ├── borrow/    # Loan requests
│   │   │   ├── repay/     # Loan repayment
│   │   │   ├── loans/     # Loan queries
│   │   │   ├── pools/     # Pool statistics
│   │   │   ├── stats/     # Protocol metrics
│   │   │   ├── health/    # Health check
│   │   │   ├── task/      # x402 paid tasks
│   │   │   └── skill/     # Serve skill.md
│   │   ├── agent/         # Agent documentation page
│   │   ├── lend/          # Lender UI
│   │   ├── markets/       # Market overview
│   │   ├── admin/         # Admin panel
│   │   └── docs/          # Documentation
│   ├── components/        # React components
│   │   ├── ui/            # Base UI components
│   │   ├── layout/        # Header, footer
│   │   └── wallet/        # Wallet connection
│   ├── lib/               # Utilities
│   │   ├── prisma.ts      # Database client
│   │   └── utils.ts       # Helper functions
│   └── config/            # Configuration
│       └── wagmi.ts       # Wallet config
└── prisma/
    ├── schema.prisma      # Database schema
    └── seed.ts            # Seed data
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/bots` | GET | List registered agents |
| `/api/bots` | POST | Register new agent |
| `/api/borrow` | POST | Request a micro-loan |
| `/api/repay` | POST | Repay loan (standard) |
| `/api/repay` | PUT | Repay with profit sharing |
| `/api/loans` | GET | List loans (filter by botId) |
| `/api/pools` | GET | Pool statistics |
| `/api/stats` | GET | Protocol metrics |
| `/api/health` | GET | Health check |
| `/api/task` | POST | x402 paid tasks |
| `/api/skill` | GET | Serve SKILL.md |

## Environment Variables

See `.env.example` for all configuration options.

**Required:**
- `DATABASE_URL` - PostgreSQL connection string

**Optional:**
- `NEXT_PUBLIC_CHAIN_ID` - Default chain (8453 = Base)
- `NEXT_PUBLIC_WC_PROJECT_ID` - WalletConnect project ID

## Database

Using Prisma with PostgreSQL.

```bash
# Push schema changes
npx prisma db push

# Generate client
npx prisma generate

# Open Prisma Studio
npx prisma studio

# Run seed
npx prisma db seed
```

## Related

- [Main README](../README.md) - Project overview
- [Whitepaper](../docs/WHITEPAPER.md) - Technical details
- [Skill Documentation](../skills/clawloan/SKILL.md) - Agent integration
- [Contracts](../contracts/README.md) - Smart contracts
