
function registerBaseRoutes(app, store, asyncRoute) {
  app.get('/api/bootstrap', asyncRoute(async (_request, response) => {
    response.json({
      ok: true,
      products: await store.listProducts(),
      providers: await store.getProviders(),
      users: await store.getUsers(),
      orders: await store.getOrders(),
      queries: await store.getQueries(),
      purchases: await store.getPurchases(),
      permissions: await store.getPermissionDefinitions(),
      roles: await store.getRoleProfiles(),
      transactions: await store.getTransactions(),
      inventoryAlerts: await store.getInventoryAlerts()
    });
  }));

  app.get('/api/products', asyncRoute(async (_request, response) => response.json({ ok: true, products: await store.listProducts() })));
  app.post('/api/products', asyncRoute(async (request, response) => response.status(201).json({ ok: true, product: await store.createProduct(request.body) })));
  app.patch('/api/products/:id', asyncRoute(async (request, response) => response.json({ ok: true, product: await store.updateProduct(Number(request.params.id), request.body) })));
  app.get('/api/providers', asyncRoute(async (_request, response) => response.json({ ok: true, providers: await store.getProviders() })));
  app.get('/api/users', asyncRoute(async (_request, response) => response.json({ ok: true, users: await store.getUsers() })));
  app.post('/api/register', asyncRoute(async (request, response) => response.status(201).json({ ok: true, user: await store.register(request.body) })));
  app.post('/api/login', asyncRoute(async (request, response) => response.json({ ok: true, user: await store.login(request.body) })));
  app.get('/api/orders', asyncRoute(async (_request, response) => response.json({ ok: true, orders: await store.getOrders() })));
  app.post('/api/orders', asyncRoute(async (request, response) => response.status(201).json({ ok: true, order: await store.createOrder(request.body) })));
  app.patch('/api/orders/:id/status', asyncRoute(async (request, response) => response.json({ ok: true, order: await store.updateOrderStatus(Number(request.params.id), request.body) })));
  app.get('/api/queries', asyncRoute(async (_request, response) => response.json({ ok: true, queries: await store.getQueries() })));
  app.post('/api/queries', asyncRoute(async (request, response) => response.status(201).json({ ok: true, query: await store.createQuery(request.body) })));
  app.patch('/api/queries/:id/respond', asyncRoute(async (request, response) => response.json({ ok: true, query: await store.respondQuery(Number(request.params.id), request.body) })));
  app.get('/api/purchases', asyncRoute(async (_request, response) => response.json({ ok: true, purchases: await store.getPurchases() })));
  app.post('/api/purchases', asyncRoute(async (request, response) => response.status(201).json({ ok: true, purchase: await store.createPurchase(request.body) })));
}

module.exports = { registerBaseRoutes };
