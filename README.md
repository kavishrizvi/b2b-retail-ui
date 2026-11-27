# Order desk (B2B Retail UI)

```
npm install
npm run dev
```

Open http://localhost:5173. Start the four backend services first (see the backend README).

## Screens

- **Order desk**: pick a customer (top bar), choose a channel (Online, Offline or Reward points), pick a product and place the order. The status refreshes until the order is `SUCCESSFUL` or `FAILED`.
- **Products**: the catalog with price, points price and stock. "Order" sends the product to the Order desk.
- **Admin**: needs the admin key (`admin.api-key` in the backend `application.yml`, `dev-admin-key` by default). Lists all online, offline and reward orders with filters, and receives new stock.

## How it reaches the backend

The browser only talks to `/api/*`. The Vite dev server strips `/api` and forwards each path to the service that owns it (see `vite.config.js`):

| Path | Service | Default |
|---|---|---|
| `/orders`, `/admin/orders` | Order service | `http://localhost:8080` (`OMS_URL`) |
| `/products`, `/admin/inventory/*` | Inventory service | `http://localhost:8081` (`INVENTORY_URL`) |
| `/customers` | Reward service | `http://localhost:8082` (`REWARD_URL`) |

For production, serve the build (`npm run build`) behind a reverse proxy with the same routing, or set `VITE_API_BASE` and enable CORS on the services. All endpoint assumptions are listed at the top of `src/api.js`.
