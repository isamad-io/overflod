function registerTransactionRoutes(app, store, asyncRoute) {
  app.get('/api/transactions', asyncRoute(async (request, response) => {
    response.json({ ok: true, transactions: await store.getTransactions(request.query) });
  }));

  app.get('/api/transactions/pending-validation', asyncRoute(async (_request, response) => {
    response.json({ ok: true, transactions: await store.getPendingPaymentValidations() });
  }));

  app.post('/api/transactions/:id/voucher', asyncRoute(async (request, response) => {
    response.status(201).json({
      ok: true,
      transaction: await store.uploadTransactionVoucher(Number(request.params.id), request.body)
    });
  }));

  app.post('/api/transactions/:id/notes', asyncRoute(async (request, response) => {
    response.status(201).json({
      ok: true,
      transaction: await store.addTransactionNote(Number(request.params.id), request.body)
    });
  }));

  app.patch('/api/transactions/:id/status', asyncRoute(async (request, response) => {
    response.json({
      ok: true,
      transaction: await store.updateTransactionStatus(Number(request.params.id), request.body)
    });
  }));
}

module.exports = { registerTransactionRoutes };
