# AWS Order Flow

Fullstack monorepo do obsługi zamówień z orkiestracją kroków przez Step Functions i wzorcem Saga.

## Stack technologiczny

| Warstwa | Technologie |
|---------|-------------|
| **Monorepo** | Turborepo, npm workspaces |
| **Frontend** | React 19, Vite 7, TypeScript, Tailwind CSS 4, Lucide React, Shadcn/ui (CVA, clsx, tailwind-merge) |
| **Backend** | AWS Lambda (Node.js 20), AWS Step Functions (Express), API Gateway HTTP API |
| **Infrastruktura** | AWS CDK 2 (TypeScript), DynamoDB, EventBridge, PostgreSQL (pg) |
| **Narzędzia** | Lambda PowerTools (Logger), AWS SDK v3 |

## Wzorzec Saga (Orchestration-based)

Projekt implementuje **Saga Pattern w wersji orchestracji** – centralny koordynator (Step Functions) steruje sekwencją kroków i kompensacją przy błędach.

### Przepływ

```
[API] → [CheckStock] → [ProcessPayment] → [SaveToPostgres] → sukces
                ↓              ↓                   ↓
            [Rollback] ← [Rollback] ← [Rollback]   (przy błędzie)
```

### Kroki transakcji

1. **CheckStock** – sprawdza dostępność w DynamoDB (`quantity` > 0)
2. **ProcessPayment** – symuluje płatność (losowy sukces/porażka)
3. **SaveToPostgres** – zapisuje zamówienie w PostgreSQL i aktualizuje stan w DynamoDB

### Kompensacja (Rollback)

Przy błędzie (brak stock, nieudana płatność) workflow wywołuje **Rollback**, który:

- Publikuje event `Rollback` na EventBridge (DetailType: `Rollback`, Source: `order-processor`)
- Zawiera `orderId`, `reason`, `timestamp`

Event można obsłużyć przez EventBridge rules (np. anulowanie rezerwacji, powiadomienia, logowanie).

### Charakterystyka

- **Orchestrator**: Step Functions (state machine)
- **Kompensacja**: Event-driven – Rollback emituje event zamiast bezpośrednio cofać zmiany
- **Spójność**: Każdy krok jest idempotentny w ramach jednego wykonania

## Struktura projektu

```
├── frontend/     # React + Vite + Tailwind + Shadcn/ui
├── infra/        # AWS CDK (Lambda, Step Functions, API Gateway)
├── shared/       # Wspólne typy TypeScript (Order, Product)
├── package.json  # Root workspace
└── turbo.json    # Turborepo
```

## Setup

```bash
npm install
```

## Skrypty

| Polecenie | Opis |
|-----------|------|
| `npm run build` | Buduje wszystkie pakiety |
| `npm run dev` | Uruchamia dev (najpierw buduje zależności) |
| `npm run lint` | Lint wszystkich pakietów |
| `npm run clean` | Czyści artefakty budowania |

## GitHub Actions (CI)

Workflow `.github/workflows/ci.yml` uruchamia się przy push/PR na `main` lub `master`:

1. **build-and-lint** – `npm ci`, `npm run build`, `npm run lint`
2. **cdk-synth** – `cd infra && npx cdk synth` (wymaga przejścia build-and-lint)

## Workspaces

- **@aws-order-flow/frontend** – Dashboard: `cd frontend && npm run dev`
  - Ustaw `VITE_API_URL` na URL API Gateway (z outputu `cdk deploy`)
- **@aws-order-flow/infra** – CDK: `cd infra && npm run cdk synth`
- **@aws-order-flow/shared** – Typy współdzielone między frontendem i infra

## AWS CDK (Infra)

### Zasoby

- **DynamoDB** – tabela `Inventory` z kluczem `productId`
- **Step Functions** – workflow `OrderProcessor` (Express)
- **API Gateway** – HTTP API z endpointami:
  - `POST /orders` – utworzenie zamówienia (start Step Function)
  - `GET /products` – lista produktów z DynamoDB
  - `GET /orders/status?executionArn=...` – status wykonania Step Function
  - `GET /orders/list` – ostatnie 10 zamówień z PostgreSQL
- **EventBridge** – event bus dla eventów Rollback

### Credentials PostgreSQL

Przekaż dane do bazy przez CDK context:

```bash
cdk deploy \
  -c dbHost=your-db-host \
  -c dbPort=5432 \
  -c dbName=your_db \
  -c dbUser=user \
  -c dbPassword=your-password \
  -c dbSsl=true
```

### Schemat tabel

```sql
CREATE TABLE orders (
  id VARCHAR(255) PRIMARY KEY,
  customer_id VARCHAR(255) NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP
);

CREATE TABLE order_items (
  order_id VARCHAR(255) REFERENCES orders(id),
  product_id VARCHAR(255) NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (order_id, product_id)
);
```

### Deploy

```bash
cd infra
npm run cdk bootstrap   # Jednorazowo
npm run cdk synth      # Synteza CloudFormation

# Z PostgreSQL:
cdk deploy -c dbHost=... -c dbName=... -c dbUser=... -c dbPassword=...

# Bez PostgreSQL (tylko DynamoDB):
cdk deploy
```

### Seed Inventory

Dodaj produkty do DynamoDB (`quantity` > 0, opcjonalnie `name`, `price`):

```bash
aws dynamodb put-item --table-name Inventory --item '{"productId":{"S":"prod-1"},"quantity":{"N":"100"},"name":{"S":"Widget"},"price":{"N":"29.99"}}'
```

### Przykład requestu API

```bash
curl -X POST https://YOUR_API_URL/orders \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "ord-001",
    "customerId": "cust-001",
    "items": [{"productId": "prod-1", "quantity": 2, "unitPrice": 29.99}],
    "totalAmount": 59.98
  }'
```

## Frontend Dashboard

- **Products** – lista produktów z przyciskiem „Order Now”
- **Live Order Status** – polling statusu Step Function co 2 s
- **Manager Dashboard** – ostatnie 10 zamówień z PostgreSQL (refresh)
