function registerVaultRoutes(app, store, asyncRoute) {
  app.get('/api/vault/tree', asyncRoute(async (_request, response) => {
    response.json({ ok: true, tree: await store.getVaultTree() });
  }));

  app.get('/api/vault/search', asyncRoute(async (request, response) => {
    response.json({ ok: true, results: await store.searchVault(request.query) });
  }));
}

module.exports = { registerVaultRoutes };
