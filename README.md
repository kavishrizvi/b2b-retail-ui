# Order desk (OMS UI)

```
npm install
npm run dev
```
   

The dev server proxies `/api/*` to your OMS service. For production, serve the build
(`npm run build`) behind the same host as the API, or set `VITE_API_BASE` and enable CORS.
All endpoint assumptions are in `src/api.js`.
