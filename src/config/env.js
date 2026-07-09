
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const TRUE_VALUES = new Set(['1', 'true', 'yes', 'si', 'sí', 'y']);

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const index = line.indexOf('=');
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(path.join(ROOT, '.env'));

const PORT = Number(process.env.PORT || 5501);
const DATA_DIR = path.join(ROOT, 'data');
const LOCAL_DB_PATH = process.env.LOCAL_DB_PATH || path.join(DATA_DIR, 'overflod.local.json');
const DB_ENGINE = String(process.env.DB_ENGINE || 'local').trim().toLowerCase();

function sqlServerConfig() {
  if (process.env.SQLSERVER_CONNECTION_STRING) return process.env.SQLSERVER_CONNECTION_STRING;
  const rawServer = process.env.SQLSERVER_SERVER || 'localhost';
  const [server, rawPort] = rawServer.split(',');
  const trusted = TRUE_VALUES.has(String(process.env.SQLSERVER_TRUSTED_CONNECTION || '').toLowerCase());
  const config = {
    server,
    database: process.env.SQLSERVER_DATABASE || 'Overflod',
    options: {
      encrypt: TRUE_VALUES.has(String(process.env.SQLSERVER_ENCRYPT || 'yes').toLowerCase()),
      trustServerCertificate: TRUE_VALUES.has(String(process.env.SQLSERVER_TRUST_CERTIFICATE || 'yes').toLowerCase())
    }
  };
  if (rawPort) config.port = Number(rawPort);
  if (!trusted) {
    config.user = process.env.SQLSERVER_USER;
    config.password = process.env.SQLSERVER_PASSWORD;
    if (!config.user || !config.password) throw new Error('Faltan SQLSERVER_USER y SQLSERVER_PASSWORD en .env.');
  } else {
    config.options.trustedConnection = true;
  }
  return config;
}

module.exports = {
  DB_ENGINE,
  DATA_DIR,
  LOCAL_DB_PATH,
  PORT,
  ROOT,
  TRUE_VALUES,
  loadEnvFile,
  sqlServerConfig
};
