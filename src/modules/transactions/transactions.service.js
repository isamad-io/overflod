const PAYMENT_STATUSES = ['Pendiente', 'En Revisión', 'Pagado/Validado', 'Rechazado'];

function normalizePaymentStatus(status) {
  const value = String(status || '').trim();
  if (value === 'En Revision') return 'En Revisión';
  if (PAYMENT_STATUSES.includes(value)) return value;
  return 'Pendiente';
}

function isPaymentStatus(status) {
  return PAYMENT_STATUSES.includes(normalizePaymentStatus(status));
}

function nextDispatchStatus(paymentStatus) {
  if (paymentStatus === 'Pagado/Validado') return 'En proceso';
  if (paymentStatus === 'Rechazado') return 'Pendiente';
  return 'Pendiente';
}

function transactionView(transaction, notes = [], documents = []) {
  return {
    ...transaction,
    status: normalizePaymentStatus(transaction.status),
    estado: normalizePaymentStatus(transaction.status),
    tipo: transaction.type,
    fecha: transaction.timestamp,
    ruta: transaction.logical_path,
    metadata: transaction.metadata || {},
    notes: notes.filter(note => Number(note.transaction_id) === Number(transaction.id)),
    documents: documents.filter(document => Number(document.transaction_id) === Number(transaction.id))
  };
}

module.exports = {
  PAYMENT_STATUSES,
  isPaymentStatus,
  nextDispatchStatus,
  normalizePaymentStatus,
  transactionView
};
