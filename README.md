# AWS Order Flow

Fullstack monorepo with Turborepo, AWS CDK, React + Vite + Tailwind, and shared TypeScript types.

## Structure

```
├── frontend/     # React + Vite + Tailwind + TypeScript
├── infra/        # AWS CDK (TypeScript)
├── shared/       # Common types (Order, Product, etc.)
├── package.json  # Root workspace config
└── turbo.json    # Turborepo config
```

## Setup

```bash
npm install
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Build all packages |
| `npm run dev` | Run dev servers (builds deps first) |
| `npm run lint` | Lint all packages |
| `npm run clean` | Clean build outputs |

## Workspaces

- **@aws-order-flow/frontend** – React app: `cd frontend && npm run dev`
- **@aws-order-flow/infra** – AWS CDK: `cd infra && npm run cdk synth`
- **@aws-order-flow/shared** – Shared types used by frontend and infra

## AWS CDK

```bash
cd infra
npm run cdk bootstrap   # First-time setup
npm run cdk synth       # Synthesize CloudFormation
npm run cdk deploy      # Deploy stack
```
