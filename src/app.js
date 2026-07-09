
const express = require('express');
const path = require('path');

const { ROOT } = require('./config/env');
const { registerAuthRoutes } = require('./modules/auth/auth.controller');
const { registerInventoryRoutes } = require('./modules/inventory/inventory.controller');
const { registerTransactionRoutes } = require('./modules/transactions/transactions.controller');
const { registerVaultRoutes } = require('./modules/vault/vault.controller');
const { registerBaseRoutes } = require('./routes/base.routes');

function asyncRoute(handler) {
  return (request, response, next) => Promise.resolve(handler(request, response, next)).catch(next);
}

function createApp(store) {
  const app = express();

  app.use((request, response, next) => {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    response.setHeader('Cache-Control', 'no-store');
    if (request.method === 'OPTIONS') return response.sendStatus(204);
    next();
  });

  app.use(express.json({ limit: '4mb' }));
  app.use('/public', express.static(path.join(ROOT, 'public')));
  app.use('/src', express.static(path.join(ROOT, 'src')));
  app.use(express.static(ROOT));

  registerBaseRoutes(app, store, asyncRoute);
  registerAuthRoutes(app, store, asyncRoute);
  registerInventoryRoutes(app, store, asyncRoute);
  registerTransactionRoutes(app, store, asyncRoute);
  registerVaultRoutes(app, store, asyncRoute);

  app.use('/api', (_request, response) => response.status(404).json({ ok: false, error: 'Ruta API no encontrada.' }));
  app.use((error, _request, response, _next) => {
    const status = error.status || (String(error.message || '').match(/duplicate|unique|duplicado/i) ? 409 : 500);
    response.status(status).json({ ok: false, error: status === 500 ? 'Error interno: ' + error.message : error.message });
  });

  return app;
}

module.exports = { asyncRoute, createApp };
