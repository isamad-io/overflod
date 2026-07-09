
const { PAYMENT_STATUSES } = require('../modules/transactions/transactions.service');

const ALLOWED_ORDER_STATUS = new Set(['Pendiente', 'En proceso', 'Entregado']);
const ALLOWED_PAYMENT_STATUS = new Set(PAYMENT_STATUSES);
const ALLOWED_QUERY_STATUS = new Set(['Pendiente', 'Respondida']);

module.exports = {
  ALLOWED_ORDER_STATUS,
  ALLOWED_PAYMENT_STATUS,
  ALLOWED_QUERY_STATUS
};
