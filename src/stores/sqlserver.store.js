
const {
  PERMISSION_DEFINITIONS,
  ROLE_PROFILES,
  defaultPermissionsForRole,
  normalizePermissionCodes,
  safeUser
} = require('../modules/auth/auth.service');
const {
  calculateLandedCost,
  inventoryAlert,
  normalizeInventoryProduct
} = require('../modules/inventory/inventory.service');
const {
  logicalPathForTransaction,
  buildVaultTree,
  filterVaultTransactions
} = require('../modules/vault/vault.service');
const {
  nextDispatchStatus,
  normalizePaymentStatus,
  transactionView
} = require('../modules/transactions/transactions.service');
const {
  ALLOWED_ORDER_STATUS,
  ALLOWED_PAYMENT_STATUS,
  ALLOWED_QUERY_STATUS
} = require('../constants/status');
const { PRODUCT_SEED, PROVIDER_SEED, SODIMAC_REFERENCES } = require('../data/seeds');
const { sqlServerConfig } = require('../config/env');
const { AppError } = require('../core/errors');
const { totalWithIgv } = require('../core/tax');
const { now } = require('../core/time');
const {
  clean,
  optionalText,
  requireEmail,
  requireInt,
  requireNumber,
  requirePhone,
  requireText,
  validateProduct
} = require('../core/validators');
const { orderView, productRow, purchaseView, queryView } = require('../mappers/views');

class SqlServerStore {
  constructor() {
    this.sql = null;
    this.pool = null;
  }

  async init() {
    try {
      this.sql = require('mssql');
    } catch {
      throw new Error('Falta instalar dependencias. Ejecuta: npm install');
    }
    this.pool = await this.sql.connect(sqlServerConfig());
    await this.createSchema();
    await this.seed();
  }

  async query(statement, params = []) {
    let index = 0;
    const sqlText = statement.replace(/\?/g, () => `@p${index++}`);
    const request = this.pool.request();
    params.forEach((value, paramIndex) => request.input(`p${paramIndex}`, value));
    const result = await request.query(sqlText);
    return result.recordset || [];
  }

  async insert(statement, params = []) {
    const rows = await this.query(`${statement.trim().replace(/;$/, '')}; SELECT CONVERT(INT, SCOPE_IDENTITY()) AS id`, params);
    return rows[0]?.id;
  }

  parseJson(value, fallback) {
    if (!value) return fallback;
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  sqlTransactionRow(row) {
    return {
      id: row.id,
      type: row.type,
      timestamp: row.timestamp,
      status: normalizePaymentStatus(row.status),
      user_id: row.user_id,
      party_name: row.party_name,
      party_email: row.party_email,
      total: Number(row.total || 0),
      currency: row.currency || 'PEN',
      metadata: this.parseJson(row.metadata_json, {}),
      voucher: this.parseJson(row.voucher_json, null),
      logical_path: row.logical_path
    };
  }

  async getSqlTransaction(id) {
    const rows = await this.query('SELECT * FROM transactions WHERE id = ?', [id]);
    if (!rows[0]) return null;
    return this.sqlTransactionRow(rows[0]);
  }

  async getSqlDocuments(transactionId) {
    const rows = await this.query('SELECT * FROM vault_documents WHERE transaction_id = ? ORDER BY id', [transactionId]);
    return rows.map(row => ({
      ...row,
      attributes: this.parseJson(row.attributes_json, {})
    }));
  }

  async getSqlNotes(transactionId) {
    return this.query('SELECT * FROM transaction_notes WHERE transaction_id = ? ORDER BY id', [transactionId]);
  }

  async addSqlVaultDocument(transaction, document) {
    return this.insert(
      `INSERT INTO vault_documents
       (transaction_id, kind, name, mime_type, logical_path, status, attributes_json, content_base64, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        transaction.id,
        document.kind,
        document.name,
        document.mime_type || 'application/octet-stream',
        `${transaction.logical_path}${document.name}`,
        transaction.status,
        JSON.stringify(document.attributes || {}),
        document.content_base64 || '',
        now()
      ]
    );
  }

  async ensureSqlDataDocument(transaction) {
    const rows = await this.query("SELECT COUNT(*) AS count FROM vault_documents WHERE transaction_id = ? AND kind = 'datos'", [transaction.id]);
    if (Number(rows[0].count) > 0) return;
    await this.addSqlVaultDocument(transaction, {
      kind: 'datos',
      name: 'datos.json',
      mime_type: 'application/json',
      attributes: {
        tipo: transaction.type,
        estado: transaction.status,
        total: transaction.total,
        cliente: transaction.party_name,
        email: transaction.party_email
      }
    });
  }

  async syncSqlVaultDocumentStatus(transaction) {
    const documents = await this.getSqlDocuments(transaction.id);
    for (const document of documents) {
      const attributes = { ...(document.attributes || {}), estado: transaction.status };
      await this.query('UPDATE vault_documents SET status = ?, attributes_json = ? WHERE id = ?', [transaction.status, JSON.stringify(attributes), document.id]);
    }
  }

  async appendSqlStatusLog(transaction, actor, message) {
    let rows = await this.query("SELECT * FROM vault_documents WHERE transaction_id = ? AND kind = 'log_estado'", [transaction.id]);
    if (!rows[0]) {
      await this.addSqlVaultDocument(transaction, {
        kind: 'log_estado',
        name: 'log_estado.txt',
        mime_type: 'text/plain',
        attributes: { estado: transaction.status }
      });
      rows = await this.query("SELECT * FROM vault_documents WHERE transaction_id = ? AND kind = 'log_estado'", [transaction.id]);
    }
    const document = rows[0];
    const previous = document.content_base64 ? Buffer.from(document.content_base64, 'base64').toString('utf8') : '';
    const content = Buffer.from(`${previous}${now()} - ${actor}: ${message}\n`, 'utf8').toString('base64');
    await this.query(
      'UPDATE vault_documents SET status = ?, attributes_json = ?, content_base64 = ? WHERE id = ?',
      [transaction.status, JSON.stringify({ estado: transaction.status }), content, document.id]
    );
  }

  async createSqlTransaction(input) {
    const timestamp = input.timestamp || now();
    const status = normalizePaymentStatus(input.status);
    const id = await this.insert(
      `INSERT INTO transactions
       (type, [timestamp], status, user_id, party_name, party_email, total, currency, metadata_json, voucher_json, logical_path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        String(input.type || 'VENTA').toUpperCase(),
        timestamp,
        status,
        input.user_id ?? null,
        input.party_name || '',
        input.party_email || '',
        Number(input.total || 0),
        'PEN',
        JSON.stringify(input.metadata || {}),
        input.voucher ? JSON.stringify(input.voucher) : '',
        ''
      ]
    );
    const logicalPath = logicalPathForTransaction(input.type, timestamp, id);
    await this.query('UPDATE transactions SET logical_path = ? WHERE id = ?', [logicalPath, id]);
    const transaction = await this.getSqlTransaction(id);
    await this.ensureSqlDataDocument(transaction);
    await this.appendSqlStatusLog(transaction, 'Sistema', `Transaccion creada con estado ${transaction.status}.`);
    return transaction;
  }

  async createSchema() {
    const statements = [
      `IF OBJECT_ID(N'dbo.providers', N'U') IS NULL
       CREATE TABLE dbo.providers (
         id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_providers PRIMARY KEY,
         name NVARCHAR(120) NOT NULL CONSTRAINT UQ_providers_name UNIQUE,
         description NVARCHAR(500) NOT NULL CONSTRAINT DF_providers_description DEFAULT N'',
         product_lines NVARCHAR(500) NOT NULL CONSTRAINT DF_providers_product_lines DEFAULT N''
       )`,
      `IF OBJECT_ID(N'dbo.products', N'U') IS NULL
       CREATE TABLE dbo.products (
         id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_products PRIMARY KEY,
         sku NVARCHAR(20) NOT NULL CONSTRAINT UQ_products_sku UNIQUE,
         name NVARCHAR(160) NOT NULL,
         unit NVARCHAR(40) NOT NULL,
         provider_id INT NOT NULL,
         purchase_cost DECIMAL(12,2) NOT NULL,
         purchase_cost_base DECIMAL(12,2) NOT NULL CONSTRAINT DF_products_purchase_cost_base DEFAULT 0,
         freight_cost DECIMAL(12,2) NOT NULL CONSTRAINT DF_products_freight_cost DEFAULT 0,
         tax_cost DECIMAL(12,2) NOT NULL CONSTRAINT DF_products_tax_cost DEFAULT 0,
         landed_units DECIMAL(12,2) NOT NULL CONSTRAINT DF_products_landed_units DEFAULT 1,
         sale_price DECIMAL(12,2) NOT NULL,
         category NVARCHAR(80) NOT NULL,
         brand NVARCHAR(120) NOT NULL CONSTRAINT DF_products_brand DEFAULT N'',
         material NVARCHAR(100) NOT NULL CONSTRAINT DF_products_material DEFAULT N'',
         stock INT NOT NULL CONSTRAINT DF_products_stock DEFAULT 0,
         daily_consumption DECIMAL(12,2) NOT NULL CONSTRAINT DF_products_daily_consumption DEFAULT 1,
         lead_time_days DECIMAL(12,2) NOT NULL CONSTRAINT DF_products_lead_time_days DEFAULT 7,
         safety_stock DECIMAL(12,2) NOT NULL CONSTRAINT DF_products_safety_stock DEFAULT 20,
         stock_minimo DECIMAL(12,2) NOT NULL CONSTRAINT DF_products_stock_minimo DEFAULT 20,
         stock_maximo DECIMAL(12,2) NOT NULL CONSTRAINT DF_products_stock_maximo DEFAULT 0,
         reorder_point DECIMAL(12,2) NOT NULL CONSTRAINT DF_products_reorder_point DEFAULT 27,
         image_url NVARCHAR(800) NOT NULL CONSTRAINT DF_products_image_url DEFAULT N'',
         source_url NVARCHAR(800) NOT NULL CONSTRAINT DF_products_source_url DEFAULT N'',
         detail NVARCHAR(1000) NOT NULL CONSTRAINT DF_products_detail DEFAULT N'',
         created_at DATETIME2(0) NOT NULL,
         CONSTRAINT FK_products_providers FOREIGN KEY (provider_id) REFERENCES dbo.providers(id),
         CONSTRAINT CK_products_purchase_cost CHECK (purchase_cost >= 0),
         CONSTRAINT CK_products_sale_price CHECK (sale_price > 0),
         CONSTRAINT CK_products_stock CHECK (stock >= 0)
       )`,
      `IF OBJECT_ID(N'dbo.users', N'U') IS NULL
       CREATE TABLE dbo.users (
         id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_users PRIMARY KEY,
         name NVARCHAR(120) NOT NULL,
         email NVARCHAR(160) NOT NULL CONSTRAINT UQ_users_email UNIQUE,
         phone NVARCHAR(30) NOT NULL,
         password NVARCHAR(120) NOT NULL,
         role NVARCHAR(30) NOT NULL,
         created_at DATETIME2(0) NOT NULL
       )`,
      `IF OBJECT_ID(N'dbo.orders', N'U') IS NULL
       CREATE TABLE dbo.orders (
         id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_orders PRIMARY KEY,
         user_id INT NOT NULL,
         customer_name NVARCHAR(120) NOT NULL,
         customer_email NVARCHAR(160) NOT NULL,
         order_date DATETIME2(0) NOT NULL,
         status NVARCHAR(30) NOT NULL CONSTRAINT CK_orders_status CHECK (status IN (N'Pendiente', N'En proceso', N'Entregado')),
         payment_status NVARCHAR(30) NOT NULL CONSTRAINT DF_orders_payment_status DEFAULT N'Pendiente',
         total DECIMAL(12,2) NOT NULL CONSTRAINT CK_orders_total CHECK (total >= 0),
         CONSTRAINT FK_orders_users FOREIGN KEY (user_id) REFERENCES dbo.users(id)
       )`,
      `IF OBJECT_ID(N'dbo.order_items', N'U') IS NULL
       CREATE TABLE dbo.order_items (
         id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_order_items PRIMARY KEY,
         order_id INT NOT NULL,
         product_id INT NOT NULL,
         sku NVARCHAR(20) NOT NULL,
         name NVARCHAR(160) NOT NULL,
         unit NVARCHAR(40) NOT NULL,
         provider_name NVARCHAR(120) NOT NULL,
         quantity INT NOT NULL CONSTRAINT CK_order_items_quantity CHECK (quantity > 0),
         unit_price DECIMAL(12,2) NOT NULL CONSTRAINT CK_order_items_unit_price CHECK (unit_price >= 0),
         unit_cost DECIMAL(12,2) NOT NULL CONSTRAINT CK_order_items_unit_cost CHECK (unit_cost >= 0),
         CONSTRAINT FK_order_items_orders FOREIGN KEY (order_id) REFERENCES dbo.orders(id) ON DELETE CASCADE,
         CONSTRAINT FK_order_items_products FOREIGN KEY (product_id) REFERENCES dbo.products(id)
       )`,
      `IF OBJECT_ID(N'dbo.queries', N'U') IS NULL
       CREATE TABLE dbo.queries (
         id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_queries PRIMARY KEY,
         name NVARCHAR(120) NOT NULL,
         email NVARCHAR(160) NOT NULL,
         phone NVARCHAR(30) NOT NULL,
         subject NVARCHAR(140) NOT NULL,
         message NVARCHAR(1200) NOT NULL,
         status NVARCHAR(30) NOT NULL CONSTRAINT CK_queries_status CHECK (status IN (N'Pendiente', N'Respondida')),
         response NVARCHAR(1200) NOT NULL CONSTRAINT DF_queries_response DEFAULT N'',
         created_at DATETIME2(0) NOT NULL
       )`,
      `IF OBJECT_ID(N'dbo.purchases', N'U') IS NULL
       CREATE TABLE dbo.purchases (
         id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_purchases PRIMARY KEY,
         product_id INT NOT NULL,
         provider_id INT NOT NULL,
         sku NVARCHAR(20) NOT NULL,
         name NVARCHAR(160) NOT NULL,
         unit NVARCHAR(40) NOT NULL,
         quantity INT NOT NULL CONSTRAINT CK_purchases_quantity CHECK (quantity > 0),
         unit_cost DECIMAL(12,2) NOT NULL CONSTRAINT CK_purchases_unit_cost CHECK (unit_cost >= 0),
         base_cost DECIMAL(12,2) NOT NULL CONSTRAINT DF_purchases_base_cost DEFAULT 0,
         freight_cost DECIMAL(12,2) NOT NULL CONSTRAINT DF_purchases_freight_cost DEFAULT 0,
         tax_cost DECIMAL(12,2) NOT NULL CONSTRAINT DF_purchases_tax_cost DEFAULT 0,
         landed_units DECIMAL(12,2) NOT NULL CONSTRAINT DF_purchases_landed_units DEFAULT 1,
         landed_cost DECIMAL(12,2) NOT NULL CONSTRAINT DF_purchases_landed_cost DEFAULT 0,
         total DECIMAL(12,2) NOT NULL CONSTRAINT CK_purchases_total CHECK (total >= 0),
         note NVARCHAR(240) NOT NULL CONSTRAINT DF_purchases_note DEFAULT N'',
         created_at DATETIME2(0) NOT NULL,
         CONSTRAINT FK_purchases_products FOREIGN KEY (product_id) REFERENCES dbo.products(id),
         CONSTRAINT FK_purchases_providers FOREIGN KEY (provider_id) REFERENCES dbo.providers(id)
       )`,
      `IF OBJECT_ID(N'dbo.permissions', N'U') IS NULL
       CREATE TABLE dbo.permissions (
         id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_permissions PRIMARY KEY,
         code NVARCHAR(80) NOT NULL CONSTRAINT UQ_permissions_code UNIQUE,
         label NVARCHAR(120) NOT NULL,
         description NVARCHAR(500) NOT NULL,
         [group] NVARCHAR(80) NOT NULL
       )`,
      `IF OBJECT_ID(N'dbo.roles', N'U') IS NULL
       CREATE TABLE dbo.roles (
         id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_roles PRIMARY KEY,
         code NVARCHAR(80) NOT NULL CONSTRAINT UQ_roles_code UNIQUE,
         name NVARCHAR(120) NOT NULL,
         description NVARCHAR(500) NOT NULL,
         permission_codes_json NVARCHAR(MAX) NOT NULL
       )`,
      `IF OBJECT_ID(N'dbo.user_permissions', N'U') IS NULL
       CREATE TABLE dbo.user_permissions (
         id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_user_permissions PRIMARY KEY,
         user_id INT NOT NULL,
         permission_code NVARCHAR(80) NOT NULL,
         assigned_at DATETIME2(0) NOT NULL,
         CONSTRAINT FK_user_permissions_users FOREIGN KEY (user_id) REFERENCES dbo.users(id) ON DELETE CASCADE,
         CONSTRAINT FK_user_permissions_permissions FOREIGN KEY (permission_code) REFERENCES dbo.permissions(code),
         CONSTRAINT UQ_user_permissions UNIQUE (user_id, permission_code)
       )`,
      `IF OBJECT_ID(N'dbo.transactions', N'U') IS NULL
       CREATE TABLE dbo.transactions (
         id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_transactions PRIMARY KEY,
         type NVARCHAR(20) NOT NULL,
         [timestamp] DATETIME2(0) NOT NULL,
         status NVARCHAR(30) NOT NULL,
         user_id INT NULL,
         party_name NVARCHAR(160) NOT NULL CONSTRAINT DF_transactions_party_name DEFAULT N'',
         party_email NVARCHAR(160) NOT NULL CONSTRAINT DF_transactions_party_email DEFAULT N'',
         total DECIMAL(12,2) NOT NULL CONSTRAINT DF_transactions_total DEFAULT 0,
         currency NVARCHAR(10) NOT NULL CONSTRAINT DF_transactions_currency DEFAULT N'PEN',
         metadata_json NVARCHAR(MAX) NOT NULL,
         voucher_json NVARCHAR(MAX) NOT NULL CONSTRAINT DF_transactions_voucher_json DEFAULT N'',
         logical_path NVARCHAR(400) NOT NULL CONSTRAINT DF_transactions_logical_path DEFAULT N'',
         CONSTRAINT FK_transactions_users FOREIGN KEY (user_id) REFERENCES dbo.users(id),
         CONSTRAINT CK_transactions_type CHECK (type IN (N'VENTA', N'COMPRA')),
         CONSTRAINT CK_transactions_status CHECK (status IN (N'Pendiente', N'En Revisión', N'Pagado/Validado', N'Rechazado'))
       )`,
      `IF OBJECT_ID(N'dbo.transaction_notes', N'U') IS NULL
       CREATE TABLE dbo.transaction_notes (
         id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_transaction_notes PRIMARY KEY,
         transaction_id INT NOT NULL,
         author_name NVARCHAR(120) NOT NULL,
         author_email NVARCHAR(160) NOT NULL CONSTRAINT DF_transaction_notes_author_email DEFAULT N'',
         message NVARCHAR(1000) NOT NULL,
         created_at DATETIME2(0) NOT NULL,
         CONSTRAINT FK_transaction_notes_transactions FOREIGN KEY (transaction_id) REFERENCES dbo.transactions(id) ON DELETE CASCADE
       )`,
      `IF OBJECT_ID(N'dbo.vault_documents', N'U') IS NULL
       CREATE TABLE dbo.vault_documents (
         id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_vault_documents PRIMARY KEY,
         transaction_id INT NOT NULL,
         kind NVARCHAR(40) NOT NULL,
         name NVARCHAR(180) NOT NULL,
         mime_type NVARCHAR(120) NOT NULL,
         logical_path NVARCHAR(500) NOT NULL,
         status NVARCHAR(30) NOT NULL,
         attributes_json NVARCHAR(MAX) NOT NULL,
         content_base64 NVARCHAR(MAX) NOT NULL CONSTRAINT DF_vault_documents_content_base64 DEFAULT N'',
         created_at DATETIME2(0) NOT NULL,
         CONSTRAINT FK_vault_documents_transactions FOREIGN KEY (transaction_id) REFERENCES dbo.transactions(id) ON DELETE CASCADE
       )`,
      `IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_users_role')
       ALTER TABLE dbo.users DROP CONSTRAINT CK_users_role`,
      `IF COL_LENGTH('dbo.products', 'purchase_cost_base') IS NULL ALTER TABLE dbo.products ADD purchase_cost_base DECIMAL(12,2) NOT NULL CONSTRAINT DF_products_purchase_cost_base_m DEFAULT 0`,
      `IF COL_LENGTH('dbo.products', 'freight_cost') IS NULL ALTER TABLE dbo.products ADD freight_cost DECIMAL(12,2) NOT NULL CONSTRAINT DF_products_freight_cost_m DEFAULT 0`,
      `IF COL_LENGTH('dbo.products', 'tax_cost') IS NULL ALTER TABLE dbo.products ADD tax_cost DECIMAL(12,2) NOT NULL CONSTRAINT DF_products_tax_cost_m DEFAULT 0`,
      `IF COL_LENGTH('dbo.products', 'landed_units') IS NULL ALTER TABLE dbo.products ADD landed_units DECIMAL(12,2) NOT NULL CONSTRAINT DF_products_landed_units_m DEFAULT 1`,
      `IF COL_LENGTH('dbo.products', 'daily_consumption') IS NULL ALTER TABLE dbo.products ADD daily_consumption DECIMAL(12,2) NOT NULL CONSTRAINT DF_products_daily_consumption_m DEFAULT 1`,
      `IF COL_LENGTH('dbo.products', 'lead_time_days') IS NULL ALTER TABLE dbo.products ADD lead_time_days DECIMAL(12,2) NOT NULL CONSTRAINT DF_products_lead_time_days_m DEFAULT 7`,
      `IF COL_LENGTH('dbo.products', 'safety_stock') IS NULL ALTER TABLE dbo.products ADD safety_stock DECIMAL(12,2) NOT NULL CONSTRAINT DF_products_safety_stock_m DEFAULT 20`,
      `IF COL_LENGTH('dbo.products', 'stock_minimo') IS NULL ALTER TABLE dbo.products ADD stock_minimo DECIMAL(12,2) NOT NULL CONSTRAINT DF_products_stock_minimo_m DEFAULT 20`,
      `IF COL_LENGTH('dbo.products', 'stock_maximo') IS NULL ALTER TABLE dbo.products ADD stock_maximo DECIMAL(12,2) NOT NULL CONSTRAINT DF_products_stock_maximo_m DEFAULT 0`,
      `IF COL_LENGTH('dbo.products', 'reorder_point') IS NULL ALTER TABLE dbo.products ADD reorder_point DECIMAL(12,2) NOT NULL CONSTRAINT DF_products_reorder_point_m DEFAULT 27`,
      `IF COL_LENGTH('dbo.orders', 'payment_status') IS NULL ALTER TABLE dbo.orders ADD payment_status NVARCHAR(30) NOT NULL CONSTRAINT DF_orders_payment_status_m DEFAULT N'Pendiente'`,
      `IF COL_LENGTH('dbo.purchases', 'base_cost') IS NULL ALTER TABLE dbo.purchases ADD base_cost DECIMAL(12,2) NOT NULL CONSTRAINT DF_purchases_base_cost_m DEFAULT 0`,
      `IF COL_LENGTH('dbo.purchases', 'freight_cost') IS NULL ALTER TABLE dbo.purchases ADD freight_cost DECIMAL(12,2) NOT NULL CONSTRAINT DF_purchases_freight_cost_m DEFAULT 0`,
      `IF COL_LENGTH('dbo.purchases', 'tax_cost') IS NULL ALTER TABLE dbo.purchases ADD tax_cost DECIMAL(12,2) NOT NULL CONSTRAINT DF_purchases_tax_cost_m DEFAULT 0`,
      `IF COL_LENGTH('dbo.purchases', 'landed_units') IS NULL ALTER TABLE dbo.purchases ADD landed_units DECIMAL(12,2) NOT NULL CONSTRAINT DF_purchases_landed_units_m DEFAULT 1`,
      `IF COL_LENGTH('dbo.purchases', 'landed_cost') IS NULL ALTER TABLE dbo.purchases ADD landed_cost DECIMAL(12,2) NOT NULL CONSTRAINT DF_purchases_landed_cost_m DEFAULT 0`,
      `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_transactions_search' AND object_id = OBJECT_ID(N'dbo.transactions'))
       CREATE INDEX IX_transactions_search ON dbo.transactions(type, status, [timestamp])`,
      `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_vault_documents_transaction' AND object_id = OBJECT_ID(N'dbo.vault_documents'))
       CREATE INDEX IX_vault_documents_transaction ON dbo.vault_documents(transaction_id, kind)`
    ];
    for (const statement of statements) await this.query(statement);
  }

  async seed() {
    const providerCount = await this.query('SELECT COUNT(*) AS count FROM providers');
    if (Number(providerCount[0].count) === 0) {
      for (const provider of PROVIDER_SEED) {
        await this.query('INSERT INTO providers (name, description, product_lines) VALUES (?, ?, ?)', provider);
      }
    }
    const productCount = await this.query('SELECT COUNT(*) AS count FROM products');
    if (Number(productCount[0].count) === 0) {
      for (const seed of PRODUCT_SEED) {
        const [sku, name, unit, providerName, purchaseCost, salePrice, category, material, stock, detail] = seed;
        const provider = await this.query('SELECT id FROM providers WHERE name = ?', [providerName]);
        const [imageUrl, sourceUrl] = SODIMAC_REFERENCES[sku] || ['/public/assets/productos/producto-generico.svg', ''];
        await this.query(
          `INSERT INTO products
           (sku, name, unit, provider_id, purchase_cost, purchase_cost_base, freight_cost, tax_cost, landed_units, sale_price, category, brand, material, stock, daily_consumption, lead_time_days, safety_stock, stock_minimo, stock_maximo, reorder_point, image_url, source_url, detail, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 0, 0, 1, ?, ?, ?, ?, ?, 1, 7, 20, 20, 54, 27, ?, ?, ?, ?)`,
          [sku, name, unit, provider[0].id, purchaseCost, purchaseCost, salePrice, category, providerName, material, stock, imageUrl, sourceUrl, detail, now()]
        );
      }
    }
    for (const permission of PERMISSION_DEFINITIONS) {
      const exists = await this.query('SELECT COUNT(*) AS count FROM permissions WHERE code = ?', [permission.code]);
      if (Number(exists[0].count) === 0) {
        await this.query(
          'INSERT INTO permissions (code, label, description, [group]) VALUES (?, ?, ?, ?)',
          [permission.code, permission.label, permission.description, permission.group]
        );
      }
    }
    for (const profile of ROLE_PROFILES) {
      const exists = await this.query('SELECT COUNT(*) AS count FROM roles WHERE code = ?', [profile.code]);
      if (Number(exists[0].count) === 0) {
        await this.query(
          'INSERT INTO roles (code, name, description, permission_codes_json) VALUES (?, ?, ?, ?)',
          [profile.code, profile.name, profile.description, JSON.stringify(profile.permissions)]
        );
      }
    }
    const adminCount = await this.query("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'");
    if (Number(adminCount[0].count) === 0) {
      await this.query(
        'INSERT INTO users (name, email, phone, password, role, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        ['Administrador Overflod', 'admin@overflod.com', '960152072', 'admin123', 'admin', now()]
      );
    }
    const users = await this.query('SELECT id, role FROM users');
    for (const user of users) {
      const count = await this.query('SELECT COUNT(*) AS count FROM user_permissions WHERE user_id = ?', [user.id]);
      if (Number(count[0].count) === 0) {
        for (const code of defaultPermissionsForRole(user.role)) {
          await this.query('INSERT INTO user_permissions (user_id, permission_code, assigned_at) VALUES (?, ?, ?)', [user.id, code, now()]);
        }
      }
    }
  }

  async listProducts() {
    const rows = await this.query(
      `SELECT p.*, pr.name AS provider_name
       FROM products p
       JOIN providers pr ON pr.id = p.provider_id
       ORDER BY TRY_CONVERT(INT, p.sku), p.sku`
    );
    return rows.map(productRow);
  }

  async getProviders() {
    return this.query('SELECT * FROM providers ORDER BY name');
  }

  async getUsers() {
    const users = await this.query('SELECT id, name, email, phone, role, created_at FROM users ORDER BY created_at DESC');
    const permissions = await this.query('SELECT user_id, permission_code FROM user_permissions');
    return users.map(user => safeUser(user, permissions));
  }

  async getOrders() {
    const rows = await this.query('SELECT * FROM orders ORDER BY id DESC');
    const orders = [];
    for (const row of rows) {
      const items = await this.query('SELECT * FROM order_items WHERE order_id = ? ORDER BY id', [row.id]);
      orders.push(orderView(row, items));
    }
    return orders;
  }

  async getQueries() {
    const rows = await this.query('SELECT * FROM queries ORDER BY id DESC');
    return rows.map(queryView);
  }

  async getPurchases() {
    const rows = await this.query(
      `SELECT p.*, pr.name AS provider_name
       FROM purchases p
       JOIN providers pr ON pr.id = p.provider_id
       ORDER BY p.id DESC`
    );
    return rows.map(purchaseView);
  }

  async getPermissionDefinitions() {
    const rows = await this.query('SELECT id, code, label, description, [group] FROM permissions ORDER BY [group], code');
    return rows.length ? rows : PERMISSION_DEFINITIONS.map((permission, index) => ({ id: index + 1, ...permission }));
  }

  async getRoleProfiles() {
    const rows = await this.query('SELECT id, code, name, description, permission_codes_json FROM roles ORDER BY name');
    return rows.map(row => ({
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      permissions: this.parseJson(row.permission_codes_json, []),
      permission_codes: this.parseJson(row.permission_codes_json, [])
    }));
  }

  async ensureProvider(name) {
    const existing = await this.query('SELECT id FROM providers WHERE name = ?', [name]);
    if (existing[0]) return existing[0].id;
    return this.insert('INSERT INTO providers (name, description, product_lines) VALUES (?, ?, ?)', [name, 'Proveedor agregado desde inventario.', '']);
  }

  async register(data) {
    const name = requireText(data, 'name', 'Nombre', 3, 120);
    const email = requireEmail(data);
    const phone = requirePhone(data);
    const password = requireText(data, 'password', 'Contraseña', 6, 80);
    const id = await this.insert(
      "INSERT INTO users (name, email, phone, password, role, created_at) VALUES (?, ?, ?, ?, 'cliente', ?)",
      [name, email, phone, password, now()]
    );
    const rows = await this.query('SELECT id, name, email, phone, role, created_at FROM users WHERE id = ?', [id]);
    for (const code of defaultPermissionsForRole('cliente')) {
      await this.query('INSERT INTO user_permissions (user_id, permission_code, assigned_at) VALUES (?, ?, ?)', [id, code, now()]);
    }
    const permissions = await this.query('SELECT user_id, permission_code FROM user_permissions WHERE user_id = ?', [id]);
    return safeUser(rows[0], permissions);
  }

  async login(data) {
    const email = requireEmail(data);
    const password = requireText(data, 'password', 'Contraseña', 1, 80);
    const rows = await this.query(
      'SELECT id, name, email, phone, role, created_at FROM users WHERE email = ? AND password = ?',
      [email, password]
    );
    if (!rows[0]) throw new AppError('Correo o contraseña incorrectos.');
    const permissions = await this.query('SELECT user_id, permission_code FROM user_permissions WHERE user_id = ?', [rows[0].id]);
    return safeUser(rows[0], permissions);
  }

  async createUserWithPermissions(data) {
    const name = requireText(data, 'name', 'Nombre', 3, 120);
    const email = requireEmail(data);
    const phone = requirePhone(data);
    const password = requireText(data, 'password', 'Contraseña', 6, 80);
    const role = clean(data.role) || 'operador';
    const permissions = normalizePermissionCodes(data.permissions);
    const id = await this.insert(
      'INSERT INTO users (name, email, phone, password, role, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [name, email, phone, password, role, now()]
    );
    for (const code of permissions) {
      await this.query('INSERT INTO user_permissions (user_id, permission_code, assigned_at) VALUES (?, ?, ?)', [id, code, now()]);
    }
    const rows = await this.query('SELECT id, name, email, phone, role, created_at FROM users WHERE id = ?', [id]);
    const permissionRows = await this.query('SELECT user_id, permission_code FROM user_permissions WHERE user_id = ?', [id]);
    return safeUser(rows[0], permissionRows);
  }

  async updateUserPermissions(id, data) {
    const rows = await this.query('SELECT id, name, email, phone, role, created_at FROM users WHERE id = ?', [id]);
    if (!rows[0]) throw new AppError('Usuario no encontrado.');
    await this.query('DELETE FROM user_permissions WHERE user_id = ?', [id]);
    for (const code of normalizePermissionCodes(data.permissions)) {
      await this.query('INSERT INTO user_permissions (user_id, permission_code, assigned_at) VALUES (?, ?, ?)', [id, code, now()]);
    }
    const permissionRows = await this.query('SELECT user_id, permission_code FROM user_permissions WHERE user_id = ?', [id]);
    return safeUser(rows[0], permissionRows);
  }

  async createProduct(data) {
    const payload = validateProduct(data);
    if (payload.sale_price < payload.purchase_cost) throw new AppError('El precio de venta no puede ser menor que el costo de compra.');
    const providerId = await this.ensureProvider(payload.provider);
    const id = await this.insert(
      `INSERT INTO products
       (sku, name, unit, provider_id, purchase_cost, purchase_cost_base, freight_cost, tax_cost, landed_units, sale_price, category, brand, material, stock, daily_consumption, lead_time_days, safety_stock, stock_minimo, stock_maximo, reorder_point, image_url, detail, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.sku,
        payload.name,
        payload.unit,
        providerId,
        payload.purchase_cost,
        payload.purchase_cost_base,
        payload.freight_cost,
        payload.tax_cost,
        payload.landed_units,
        payload.sale_price,
        payload.category,
        payload.provider,
        payload.material,
        payload.stock,
        payload.daily_consumption,
        payload.lead_time_days,
        payload.safety_stock,
        payload.stock_minimo,
        payload.stock_maximo,
        payload.reorder_point,
        payload.image_url,
        payload.detail,
        now()
      ]
    );
    const rows = await this.query('SELECT p.*, pr.name AS provider_name FROM products p JOIN providers pr ON pr.id = p.provider_id WHERE p.id = ?', [id]);
    return productRow(rows[0]);
  }

  async updateProduct(id, data) {
    const existingRows = await this.query('SELECT * FROM products WHERE id = ?', [id]);
    const existing = existingRows[0];
    if (!existing) throw new AppError('Producto no encontrado.');
    const payload = validateProduct(data, true);
    if (Object.keys(payload).length === 0) throw new AppError('No hay datos para actualizar.');
    const nextCost = 'purchase_cost' in payload ? payload.purchase_cost : Number(existing.purchase_cost);
    const nextPrice = 'sale_price' in payload ? payload.sale_price : Number(existing.sale_price);
    if (nextPrice < nextCost) throw new AppError('El precio de venta no puede ser menor que el costo de compra.');
    if ('provider' in payload) {
      const providerId = await this.ensureProvider(payload.provider);
      payload.provider_id = providerId;
      payload.brand = payload.provider;
      delete payload.provider;
    }
    const hasCostUpdate = ['purchase_cost', 'purchase_cost_base', 'freight_cost', 'tax_cost', 'landed_units'].some(key => key in payload);
    if (hasCostUpdate) {
      payload.purchase_cost_base ??= Number(existing.purchase_cost_base ?? existing.purchase_cost);
      payload.freight_cost ??= Number(existing.freight_cost ?? 0);
      payload.tax_cost ??= Number(existing.tax_cost ?? 0);
      payload.landed_units ??= Number(existing.landed_units ?? 1);
      payload.purchase_cost = calculateLandedCost(payload.purchase_cost_base, payload.freight_cost, payload.tax_cost, payload.landed_units);
    }
    const columns = Object.keys(payload);
    const assignments = columns.map(column => `${column} = ?`).join(', ');
    await this.query(`UPDATE products SET ${assignments} WHERE id = ?`, [...columns.map(column => payload[column]), id]);
    const rows = await this.query('SELECT p.*, pr.name AS provider_name FROM products p JOIN providers pr ON pr.id = p.provider_id WHERE p.id = ?', [id]);
    return productRow(rows[0]);
  }

  async createOrder(data) {
    const email = requireEmail(data);
    const userRows = await this.query('SELECT * FROM users WHERE email = ?', [email]);
    const user = userRows[0];
    if (!user) throw new AppError('El cliente no esta registrado.');
    if (!Array.isArray(data.items) || data.items.length === 0) throw new AppError('Agrega al menos un producto al pedido.');
    const parsedItems = [];
    let subtotal = 0;
    for (const raw of data.items) {
      const productId = requireInt(raw, 'id', 'Producto', 1, true);
      const quantity = requireInt(raw, 'cantidad', 'Cantidad', 1, true);
      const rows = await this.query(
        'SELECT p.*, pr.name AS provider_name FROM products p JOIN providers pr ON pr.id = p.provider_id WHERE p.id = ?',
        [productId]
      );
      const product = rows[0];
      if (!product) throw new AppError('Uno de los productos no existe.');
      if (quantity > Number(product.stock)) throw new AppError(`Stock insuficiente para ${product.name}. Disponible: ${product.stock}.`);
      subtotal += quantity * Number(product.sale_price);
      parsedItems.push({ product, quantity });
    }
    const tax = totalWithIgv(subtotal);
    const orderId = await this.insert(
      "INSERT INTO orders (user_id, customer_name, customer_email, order_date, status, payment_status, total) VALUES (?, ?, ?, ?, 'Pendiente', 'Pendiente', ?)",
      [user.id, user.name, user.email, now(), tax.total]
    );
    for (const { product, quantity } of parsedItems) {
      await this.query('UPDATE products SET stock = stock - ? WHERE id = ?', [quantity, product.id]);
      await this.query(
        `INSERT INTO order_items
         (order_id, product_id, sku, name, unit, provider_name, quantity, unit_price, unit_cost)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [orderId, product.id, product.sku, product.name, product.unit, product.provider_name, quantity, product.sale_price, product.purchase_cost]
      );
    }
    const items = await this.query('SELECT * FROM order_items WHERE order_id = ? ORDER BY id', [orderId]);
    await this.createSqlTransaction({
      type: 'VENTA',
      timestamp: now(),
      status: 'Pendiente',
      user_id: user.id,
      party_name: user.name,
      party_email: user.email,
      total: tax.total,
      metadata: {
        order_id: orderId,
        items,
        subtotal: tax.subtotal,
        igv_rate: tax.igv_rate,
        igv_amount: tax.igv,
        total_with_igv: tax.total,
        source: 'pedido'
      }
    });
    return (await this.getOrders()).find(order => order.id === orderId);
  }

  async updateOrderStatus(id, data) {
    const status = requireText(data, 'status', 'Estado', 1, 30);
    if (!ALLOWED_ORDER_STATUS.has(status)) throw new AppError('Estado de pedido invalido.');
    const exists = await this.query('SELECT COUNT(*) AS count FROM orders WHERE id = ?', [id]);
    if (Number(exists[0].count) === 0) throw new AppError('Pedido no encontrado.');
    await this.query('UPDATE orders SET status = ? WHERE id = ?', [status, id]);
    return (await this.getOrders()).find(order => order.id === id);
  }

  async createQuery(data) {
    const id = await this.insert(
      "INSERT INTO queries (name, email, phone, subject, message, status, created_at) VALUES (?, ?, ?, ?, ?, 'Pendiente', ?)",
      [
        requireText(data, 'name', 'Nombre', 3, 120),
        requireEmail(data),
        requirePhone(data),
        requireText(data, 'subject', 'Asunto', 3, 140),
        requireText(data, 'message', 'Mensaje', 8, 1200),
        now()
      ]
    );
    return (await this.getQueries()).find(query => query.id === id);
  }

  async respondQuery(id) {
    const exists = await this.query('SELECT COUNT(*) AS count FROM queries WHERE id = ?', [id]);
    if (Number(exists[0].count) === 0) throw new AppError('Mensaje no encontrado.');
    await this.query("UPDATE queries SET status = 'Respondida' WHERE id = ?", [id]);
    return (await this.getQueries()).find(query => query.id === id);
  }

  async createPurchase(data) {
    const productId = requireInt(data, 'productId', 'Producto', 1, true);
    const quantity = requireInt(data, 'quantity', 'Cantidad', 1, true);
    const legacyUnitCost = 'unitCost' in data ? requireNumber(data, 'unitCost', 'Costo unitario', 0) : null;
    const baseCost = 'baseCost' in data || 'compraBase' in data
      ? requireNumber(data, 'baseCost' in data ? 'baseCost' : 'compraBase', 'Compra base', 0)
      : Number(legacyUnitCost ?? 0) * quantity;
    const freightCost = 'freightCost' in data || 'flete' in data ? requireNumber(data, 'freightCost' in data ? 'freightCost' : 'flete', 'Flete', 0) : 0;
    const taxCost = 'taxCost' in data || 'impuestos' in data ? requireNumber(data, 'taxCost' in data ? 'taxCost' : 'impuestos', 'Impuestos', 0) : 0;
    const landedUnits = 'landedUnits' in data || 'unidadesCosteo' in data
      ? requireNumber(data, 'landedUnits' in data ? 'landedUnits' : 'unidadesCosteo', 'Unidades', 1, true)
      : quantity;
    const unitCost = calculateLandedCost(baseCost, freightCost, taxCost, landedUnits);
    const note = optionalText(data, 'note', 240);
    const rows = await this.query(
      'SELECT p.*, pr.name AS provider_name FROM products p JOIN providers pr ON pr.id = p.provider_id WHERE p.id = ?',
      [productId]
    );
    const product = rows[0];
    if (!product) throw new AppError('Producto no encontrado.');
    const total = baseCost + freightCost + taxCost;
    const id = await this.insert(
      `INSERT INTO purchases
       (product_id, provider_id, sku, name, unit, quantity, unit_cost, base_cost, freight_cost, tax_cost, landed_units, landed_cost, total, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [product.id, product.provider_id, product.sku, product.name, product.unit, quantity, unitCost, baseCost, freightCost, taxCost, landedUnits, unitCost, total, note, now()]
    );
    await this.query(
      `UPDATE products
       SET stock = stock + ?, purchase_cost = ?, purchase_cost_base = ?, freight_cost = 0, tax_cost = 0, landed_units = 1
       WHERE id = ?`,
      [quantity, unitCost, unitCost, productId]
    );
    await this.createSqlTransaction({
      type: 'COMPRA',
      timestamp: now(),
      status: 'Pagado/Validado',
      user_id: null,
      party_name: product.provider_name,
      party_email: '',
      total,
      metadata: {
        purchase_id: id,
        product_id: product.id,
        sku: product.sku,
        product_name: product.name,
        quantity,
        base_cost: baseCost,
        freight_cost: freightCost,
        tax_cost: taxCost,
        landed_cost: unitCost,
        source: 'compra_proveedor'
      }
    });
    return (await this.getPurchases()).find(purchase => purchase.id === id);
  }

  async getInventoryAlerts() {
    const rows = await this.query(
      `SELECT p.*, pr.name AS provider_name
       FROM products p
       JOIN providers pr ON pr.id = p.provider_id`
    );
    return rows.map(product => inventoryAlert(product)).filter(Boolean);
  }

  async getTransactions(filters = {}) {
    const conditions = [];
    const params = [];
    if (filters.type) {
      conditions.push('type = ?');
      params.push(String(filters.type).toUpperCase());
    }
    if (filters.status) {
      conditions.push('status = ?');
      params.push(normalizePaymentStatus(filters.status));
    }
    if (filters.dateFrom) {
      conditions.push('[timestamp] >= ?');
      params.push(`${filters.dateFrom} 00:00:00`);
    }
    if (filters.dateTo) {
      conditions.push('[timestamp] <= ?');
      params.push(`${filters.dateTo} 23:59:59`);
    }
    const rows = await this.query(
      `SELECT * FROM transactions ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''} ORDER BY [timestamp] DESC, id DESC`,
      params
    );
    let transactions = rows.map(row => this.sqlTransactionRow(row));
    transactions = filterVaultTransactions(transactions, filters);
    const views = [];
    for (const transaction of transactions) {
      views.push(transactionView(transaction, await this.getSqlNotes(transaction.id), await this.getSqlDocuments(transaction.id)));
    }
    return views;
  }

  async getPendingPaymentValidations() {
    return this.getTransactions({ status: 'En Revisión' });
  }

  async uploadTransactionVoucher(id, data) {
    const transaction = await this.getSqlTransaction(id);
    if (!transaction) throw new AppError('Transaccion no encontrada.');
    const originalName = requireText(data, 'originalName', 'Archivo', 1, 180);
    const mimeType = optionalText(data, 'mimeType', 120) || 'application/octet-stream';
    if (!/^(application\/pdf|image\/png|image\/jpeg|image\/webp)$/i.test(mimeType)) throw new AppError('El comprobante debe ser PDF o imagen.');
    const extension = path.extname(originalName).toLowerCase() || (mimeType.includes('pdf') ? '.pdf' : '.jpg');
    const storedName = `voucher-${transaction.id}${extension}`;
    const voucher = {
      original_name: originalName,
      stored_name: storedName,
      mime_type: mimeType,
      size: Number(data.size || 0),
      uploaded_by: optionalText(data, 'userEmail', 160),
      uploaded_at: now()
    };
    transaction.status = 'En Revisión';
    transaction.voucher = voucher;
    await this.query('UPDATE transactions SET status = ?, voucher_json = ? WHERE id = ?', [transaction.status, JSON.stringify(voucher), id]);
    await this.addSqlVaultDocument(transaction, {
      kind: 'voucher',
      name: storedName,
      mime_type: mimeType,
      content_base64: optionalText(data, 'contentBase64', 3000000),
      attributes: {
        originalName,
        uploadedBy: voucher.uploaded_by,
        estado: transaction.status
      }
    });
    await this.syncSqlVaultDocumentStatus(transaction);
    await this.appendSqlStatusLog(transaction, voucher.uploaded_by || 'Cliente', `Voucher cargado como ${storedName}. Estado En Revisión.`);
    const orderId = transaction.metadata?.order_id;
    if (orderId) await this.query('UPDATE orders SET payment_status = ? WHERE id = ?', ['En Revisión', orderId]);
    return transactionView(transaction, await this.getSqlNotes(id), await this.getSqlDocuments(id));
  }

  async addTransactionNote(id, data) {
    const transaction = await this.getSqlTransaction(id);
    if (!transaction) throw new AppError('Transaccion no encontrada.');
    await this.query(
      'INSERT INTO transaction_notes (transaction_id, author_name, author_email, message, created_at) VALUES (?, ?, ?, ?, ?)',
      [
        id,
        requireText(data, 'authorName', 'Autor', 2, 120),
        optionalText(data, 'authorEmail', 160),
        requireText(data, 'message', 'Nota', 2, 1000),
        now()
      ]
    );
    return transactionView(transaction, await this.getSqlNotes(id), await this.getSqlDocuments(id));
  }

  async updateTransactionStatus(id, data) {
    const transaction = await this.getSqlTransaction(id);
    if (!transaction) throw new AppError('Transaccion no encontrada.');
    const status = normalizePaymentStatus(requireText(data, 'status', 'Estado', 1, 30));
    if (!ALLOWED_PAYMENT_STATUS.has(status)) throw new AppError('Estado de pago invalido.');
    transaction.status = status;
    await this.query('UPDATE transactions SET status = ? WHERE id = ?', [status, id]);
    const orderId = transaction.metadata?.order_id;
    if (orderId) {
      await this.query('UPDATE orders SET payment_status = ?, status = ? WHERE id = ?', [status, nextDispatchStatus(status), orderId]);
    }
    if (clean(data.note)) {
      await this.query(
        'INSERT INTO transaction_notes (transaction_id, author_name, author_email, message, created_at) VALUES (?, ?, ?, ?, ?)',
        [id, optionalText(data, 'authorName', 120) || 'Sistema', optionalText(data, 'authorEmail', 160), optionalText(data, 'note', 1000), now()]
      );
    }
    await this.ensureSqlDataDocument(transaction);
    await this.syncSqlVaultDocumentStatus(transaction);
    await this.appendSqlStatusLog(transaction, optionalText(data, 'authorName', 120) || 'Sistema', `Estado actualizado a ${status}.`);
    return transactionView(transaction, await this.getSqlNotes(id), await this.getSqlDocuments(id));
  }

  async getVaultTree() {
    return buildVaultTree(await this.getTransactions());
  }

  async searchVault(filters = {}) {
    return this.getTransactions(filters);
  }
}

module.exports = { SqlServerStore };
