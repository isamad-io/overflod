function registerAuthRoutes(app, store, asyncRoute) {
  app.get('/api/auth/permissions', asyncRoute(async (_request, response) => {
    response.json({
      ok: true,
      permissions: await store.getPermissionDefinitions(),
      roles: await store.getRoleProfiles()
    });
  }));

  app.post('/api/auth/users', asyncRoute(async (request, response) => {
    response.status(201).json({
      ok: true,
      user: await store.createUserWithPermissions(request.body)
    });
  }));

  app.patch('/api/auth/users/:id/permissions', asyncRoute(async (request, response) => {
    response.json({
      ok: true,
      user: await store.updateUserPermissions(Number(request.params.id), request.body)
    });
  }));
}

module.exports = { registerAuthRoutes };
