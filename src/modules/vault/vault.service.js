function pad(value) {
  return String(value).padStart(2, '0');
}

function parseDate(value) {
  if (!value) return new Date();
  const normalized = String(value).includes('T') ? String(value) : String(value).replace(' ', 'T');
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function logicalPathForTransaction(type, timestamp, id) {
  const date = parseDate(timestamp);
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hour = `${pad(date.getHours())}${pad(date.getMinutes())}`;
  return `/almacen/${String(type || 'transaccion').toLowerCase()}/${year}/${month}/${day}/${hour}/${id}/`;
}

function buildVaultTree(transactions) {
  const root = {};
  for (const transaction of transactions) {
    const parts = String(transaction.logical_path || '').split('/').filter(Boolean);
    const year = parts[2] || 'sin-anio';
    const month = parts[3] || 'sin-mes';
    const day = parts[4] || 'sin-dia';
    root[year] ||= {};
    root[year][month] ||= {};
    root[year][month][day] ||= [];
    root[year][month][day].push(transaction);
  }
  return root;
}

function matchesDateRange(timestamp, dateFrom, dateTo) {
  const value = parseDate(timestamp).getTime();
  if (dateFrom && value < parseDate(`${dateFrom}T00:00:00`).getTime()) return false;
  if (dateTo && value > parseDate(`${dateTo}T23:59:59`).getTime()) return false;
  return true;
}

function matchesAttribute(transaction, key, value) {
  if (!key && !value) return true;
  const metadata = transaction.metadata || {};
  const haystack = key
    ? String(metadata[key] ?? transaction[key] ?? '').toLowerCase()
    : JSON.stringify({ ...metadata, ...transaction }).toLowerCase();
  return haystack.includes(String(value || '').toLowerCase());
}

function filterVaultTransactions(transactions, filters = {}) {
  const query = String(filters.q || '').trim().toLowerCase();
  return transactions.filter(transaction => {
    const typeOk = !filters.type || String(transaction.type).toUpperCase() === String(filters.type).toUpperCase();
    const statusOk = !filters.status || transaction.status === filters.status;
    const dateOk = matchesDateRange(transaction.timestamp || transaction.created_at, filters.dateFrom, filters.dateTo);
    const attributeOk = matchesAttribute(transaction, filters.attributeKey, filters.attributeValue);
    const queryText = `${transaction.id} ${transaction.type} ${transaction.status} ${transaction.party_name} ${transaction.party_email} ${transaction.logical_path} ${JSON.stringify(transaction.metadata || {})}`.toLowerCase();
    const queryOk = !query || queryText.includes(query);
    return typeOk && statusOk && dateOk && attributeOk && queryOk;
  });
}

module.exports = {
  buildVaultTree,
  filterVaultTransactions,
  logicalPathForTransaction
};
