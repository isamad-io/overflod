
const { DB_ENGINE, LOCAL_DB_PATH, PORT } = require('./src/config/env');
const { createApp } = require('./src/app');
const { createStore } = require('./src/stores/create-store');

async function main() {
  const store = await createStore();
  const app = createApp(store);

  app.listen(PORT, '127.0.0.1', () => {
    console.log('Overflod Express listo en http://127.0.0.1:' + PORT + '/');
    console.log(['sqlserver', 'mssql', 'sql-server'].includes(DB_ENGINE)
      ? 'Base de datos SQL Server: ' + (process.env.SQLSERVER_SERVER || 'localhost') + ' / ' + (process.env.SQLSERVER_DATABASE || 'Overflod')
      : 'Base local de demostracion: ' + LOCAL_DB_PATH);
  });
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
