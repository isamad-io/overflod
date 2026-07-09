
const { DB_ENGINE, LOCAL_DB_PATH } = require('../config/env');
const { LocalStore } = require('./local.store');
const { SqlServerStore } = require('./sqlserver.store');

async function createStore() {
  if (['sqlserver', 'mssql', 'sql-server'].includes(DB_ENGINE)) {
    const store = new SqlServerStore();
    await store.init();
    return store;
  }
  const store = new LocalStore(LOCAL_DB_PATH);
  await store.init();
  return store;
}

module.exports = { createStore };
