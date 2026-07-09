function registerInventoryRoutes(app, store, asyncRoute) {
  app.get('/api/inventory/alerts', asyncRoute(async (_request, response) => {
    response.json({ ok: true, alerts: await store.getInventoryAlerts() });
  }));
}

module.exports = { registerInventoryRoutes };
