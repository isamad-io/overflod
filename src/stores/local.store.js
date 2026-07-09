
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

const {
  PERMISSION_DEFINITIONS,
  ROLE_PROFILES,
  defaultPermissionsForRole,
  normalizePermissionCodes,
  safeUser
} = require('../modules/auth/auth.service');
const {
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
const { ALLOWED_ORDER_STATUS, ALLOWED_PAYMENT_STATUS } = require('../constants/status');
const { PRODUCT_SEED, PROVIDER_SEED, SODIMAC_REFERENCES } = require('../data/seeds');
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

class LocalStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = null;
  }

  async init() {
    await fsp.mkdir(path.dirname(this.filePath), { recursive: true });
    if (fs.existsSync(this.filePath)) {
      this.data = JSON.parse(await fsp.readFile(this.filePath, 'utf8'));
      if (this.normalize()) await this.save();
    } else {
      this.data = this.seedData();
      await this.save();
    }
  }

  normalize() {
    let changed = false;
    const tables = [
      'providers',
      'products',
      'users',
      'orders',
      'order_items',
      'queries',
      'purchases',
      'permissions',
      'roles',
      'user_permissions',
      'transactions',
      'transaction_notes',
      'vault_documents',
      'inventory_alerts'
    ];
    for (const table of tables) {
      if (!Array.isArray(this.data[table])) {
        this.data[table] = [];
        changed = true;
      }
    }
    if (!this.data.next) this.data.next = {};
    for (const table of tables) {
      const maxId = this.data[table].reduce((max, row) => Math.max(max, Number(row.id) || 0), 0);
      this.data.next[table] = Math.max(Number(this.data.next[table]) || 1, maxId + 1);
    }
    for (const definition of PERMISSION_DEFINITIONS) {
      const existing = this.data.permissions.find(permission => permission.code === definition.code);
      if (existing) Object.assign(existing, definition);
      else {
        this.data.permissions.push({ id: this.nextId('permissions'), ...definition });
        changed = true;
      }
    }
    for (const profile of ROLE_PROFILES) {
      const existing = this.data.roles.find(role => role.code === profile.code);
      const row = { id: existing?.id || this.nextId('roles'), ...profile, permission_codes: profile.permissions };
      if (existing) Object.assign(existing, row);
      else {
        this.data.roles.push(row);
        changed = true;
      }
    }
    for (const product of this.data.products) {
      const before = JSON.stringify(product);
      normalizeInventoryProduct(product);
      if (JSON.stringify(product) !== before) changed = true;
    }
    for (const user of this.data.users) {
      const existingPermissions = this.data.user_permissions.filter(row => Number(row.user_id) === Number(user.id));
      if (existingPermissions.length === 0) {
        for (const code of defaultPermissionsForRole(user.role)) {
          this.data.user_permissions.push({
            id: this.nextId('user_permissions'),
            user_id: user.id,
            permission_code: code,
            assigned_at: now()
          });
        }
        changed = true;
      }
    }
    for (const order of this.data.orders) {
      if (!order.payment_status) {
        order.payment_status = order.status === 'Pendiente' ? 'Pendiente' : 'Pagado/Validado';
        changed = true;
      }
      const exists = this.data.transactions.some(transaction => Number(transaction.metadata?.order_id) === Number(order.id));
      if (!exists) {
        const items = this.data.order_items.filter(item => Number(item.order_id) === Number(order.id));
        this.createLocalTransaction({
          type: 'VENTA',
          timestamp: order.order_date,
          status: order.payment_status,
          user_id: order.user_id,
          party_name: order.customer_name,
          party_email: order.customer_email,
          total: order.total,
          metadata: {
            order_id: order.id,
            items,
            source: 'pedido'
          }
        });
        changed = true;
      }
    }
    for (const purchase of this.data.purchases) {
      const exists = this.data.transactions.some(transaction => Number(transaction.metadata?.purchase_id) === Number(purchase.id));
      if (!exists) {
        this.createLocalTransaction({
          type: 'COMPRA',
          timestamp: purchase.created_at,
          status: 'Pagado/Validado',
          user_id: null,
          party_name: this.providerName(purchase.provider_id),
          party_email: '',
          total: purchase.total,
          metadata: {
            purchase_id: purchase.id,
            product_id: purchase.product_id,
            sku: purchase.sku,
            product_name: purchase.name,
            quantity: purchase.quantity,
            landed_cost: purchase.landed_cost ?? purchase.unit_cost,
            source: 'compra_proveedor'
          }
        });
        changed = true;
      }
    }
    for (const transaction of this.data.transactions) {
      const before = JSON.stringify(transaction);
      transaction.status = normalizePaymentStatus(transaction.status);
      if (!transaction.logical_path) transaction.logical_path = logicalPathForTransaction(transaction.type, transaction.timestamp, transaction.id);
      this.ensureVaultDataDocument(transaction);
      if (!this.data.vault_documents.some(document => Number(document.transaction_id) === Number(transaction.id) && document.kind === 'log_estado')) {
        this.appendStatusLog(transaction, 'Sistema', `Log creado para estado ${transaction.status}.`);
        changed = true;
      }
      if (JSON.stringify(transaction) !== before) changed = true;
    }
    return changed;
  }

  seedData() {
    const data = {
      next: {},
      providers: [],
      products: [],
      users: [],
      orders: [],
      order_items: [],
      queries: [],
      purchases: [],
      permissions: [],
      roles: [],
      user_permissions: [],
      transactions: [],
      transaction_notes: [],
      vault_documents: [],
      inventory_alerts: []
    };
    this.data = data;
    this.normalize();
    for (const [name, description, product_lines] of PROVIDER_SEED) {
      data.providers.push({ id: this.nextId('providers'), name, description, product_lines });
    }
    for (const seed of PRODUCT_SEED) {
      const [sku, name, unit, providerName, purchase_cost, sale_price, category, material, stock, detail] = seed;
      const provider = data.providers.find(item => item.name === providerName);
      const [image_url, source_url] = SODIMAC_REFERENCES[sku] || ['/public/assets/productos/producto-generico.svg', ''];
      data.products.push({
        id: this.nextId('products'),
        sku,
        name,
        unit,
        provider_id: provider.id,
        purchase_cost,
        purchase_cost_base: purchase_cost,
        freight_cost: 0,
        tax_cost: 0,
        landed_units: 1,
        sale_price,
        category,
        brand: providerName,
        material,
        stock,
        daily_consumption: 1,
        lead_time_days: 7,
        safety_stock: 20,
        stock_minimo: 20,
        stock_maximo: 100,
        reorder_point: 27,
        image_url,
        source_url,
        detail,
        created_at: now()
      });
    }
    data.users.push({
      id: this.nextId('users'),
      name: 'Administrador Overflod',
      email: 'admin@overflod.com',
      phone: '960152072',
      password: 'admin123',
      role: 'admin',
      created_at: now()
    });
    this.normalize();
    return data;
  }

  nextId(table) {
    const id = this.data.next[table] || 1;
    this.data.next[table] = id + 1;
    return id;
  }

  createLocalTransaction(input) {
    const transaction = {
      id: this.nextId('transactions'),
      type: String(input.type || 'VENTA').toUpperCase(),
      timestamp: input.timestamp || now(),
      status: normalizePaymentStatus(input.status),
      user_id: input.user_id ?? null,
      party_name: input.party_name || '',
      party_email: input.party_email || '',
      total: Number(input.total || 0),
      currency: 'PEN',
      metadata: input.metadata || {},
      voucher: input.voucher || null,
      logical_path: ''
    };
    transaction.logical_path = logicalPathForTransaction(transaction.type, transaction.timestamp, transaction.id);
    this.data.transactions.push(transaction);
    this.ensureVaultDataDocument(transaction);
    this.appendStatusLog(transaction, 'Sistema', `Transaccion creada con estado ${transaction.status}.`);
    return transaction;
  }

  ensureVaultDataDocument(transaction) {
    const exists = this.data.vault_documents.some(document => Number(document.transaction_id) === Number(transaction.id) && document.kind === 'datos');
    if (exists) return;
    this.data.vault_documents.push({
      id: this.nextId('vault_documents'),
      transaction_id: transaction.id,
      kind: 'datos',
      name: 'datos.json',
      mime_type: 'application/json',
      logical_path: `${transaction.logical_path}datos.json`,
      status: transaction.status,
      attributes: {
        tipo: transaction.type,
        estado: transaction.status,
        total: transaction.total,
        cliente: transaction.party_name,
        email: transaction.party_email
      },
      created_at: transaction.timestamp
    });
  }

  addVaultDocument(transaction, document) {
    const stored = {
      id: this.nextId('vault_documents'),
      transaction_id: transaction.id,
      kind: document.kind,
      name: document.name,
      mime_type: document.mime_type || 'application/octet-stream',
      logical_path: `${transaction.logical_path}${document.name}`,
      status: transaction.status,
      attributes: document.attributes || {},
      content_base64: document.content_base64 || '',
      created_at: now()
    };
    this.data.vault_documents.push(stored);
    return stored;
  }

  syncVaultDocumentStatus(transaction) {
    for (const document of this.data.vault_documents.filter(item => Number(item.transaction_id) === Number(transaction.id))) {
      document.status = transaction.status;
      document.attributes ||= {};
      document.attributes.estado = transaction.status;
    }
  }

  appendStatusLog(transaction, actor, message) {
    let document = this.data.vault_documents.find(item => Number(item.transaction_id) === Number(transaction.id) && item.kind === 'log_estado');
    if (!document) {
      document = this.addVaultDocument(transaction, {
        kind: 'log_estado',
        name: 'log_estado.txt',
        mime_type: 'text/plain',
        attributes: { estado: transaction.status }
      });
    }
    const previous = document.content_base64 ? Buffer.from(document.content_base64, 'base64').toString('utf8') : '';
    const line = `${now()} - ${actor}: ${message}\n`;
    document.content_base64 = Buffer.from(previous + line, 'utf8').toString('base64');
    document.status = transaction.status;
    document.attributes ||= {};
    document.attributes.estado = transaction.status;
    return document;
  }

  async save() {
    await fsp.writeFile(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
  }

  providerName(id) {
    return this.data.providers.find(provider => provider.id === id)?.name || '';
  }

  productWithProvider(product) {
    return productRow({ ...product, provider_name: this.providerName(product.provider_id) });
  }

  async listProducts() {
    return this.data.products
      .map(product => this.productWithProvider(product))
      .sort((a, b) => (Number(a.sku) || 0) - (Number(b.sku) || 0) || String(a.sku).localeCompare(String(b.sku)));
  }

  async getProviders() {
    return [...this.data.providers].sort((a, b) => a.name.localeCompare(b.name));
  }

  async getUsers() {
    return [...this.data.users]
      .map(user => safeUser(user, this.data.user_permissions))
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  }

  async getOrders() {
    return [...this.data.orders]
      .sort((a, b) => b.id - a.id)
      .map(order => orderView(order, this.data.order_items.filter(item => item.order_id === order.id).sort((a, b) => a.id - b.id)));
  }

  async getQueries() {
    return [...this.data.queries].sort((a, b) => b.id - a.id).map(queryView);
  }

  async getPurchases() {
    return [...this.data.purchases]
      .sort((a, b) => b.id - a.id)
      .map(row => purchaseView({ ...row, provider_name: this.providerName(row.provider_id) }));
  }

  async getPermissionDefinitions() {
    return [...this.data.permissions].sort((a, b) => a.group.localeCompare(b.group) || a.code.localeCompare(b.code));
  }

  async getRoleProfiles() {
    return [...this.data.roles].sort((a, b) => a.name.localeCompare(b.name));
  }

  async ensureProvider(name) {
    let provider = this.data.providers.find(item => item.name === name);
    if (!provider) {
      provider = { id: this.nextId('providers'), name, description: 'Proveedor agregado desde inventario.', product_lines: '' };
      this.data.providers.push(provider);
    }
    return provider.id;
  }

  async register(data) {
    const user = {
      id: this.nextId('users'),
      name: requireText(data, 'name', 'Nombre', 3, 120),
      email: requireEmail(data),
      phone: requirePhone(data),
      password: requireText(data, 'password', 'Contraseña', 6, 80),
      role: 'cliente',
      created_at: now()
    };
    if (this.data.users.some(item => item.email === user.email)) throw new AppError('El correo ya esta registrado.', 409);
    this.data.users.push(user);
    for (const code of defaultPermissionsForRole(user.role)) {
      this.data.user_permissions.push({
        id: this.nextId('user_permissions'),
        user_id: user.id,
        permission_code: code,
        assigned_at: now()
      });
    }
    await this.save();
    return safeUser(user, this.data.user_permissions);
  }

  async login(data) {
    const email = requireEmail(data);
    const password = requireText(data, 'password', 'Contraseña', 1, 80);
    const user = this.data.users.find(item => item.email === email && item.password === password);
    if (!user) throw new AppError('Correo o contraseña incorrectos.');
    return safeUser(user, this.data.user_permissions);
  }

  async createUserWithPermissions(data) {
    const permissions = normalizePermissionCodes(data.permissions);
    const user = {
      id: this.nextId('users'),
      name: requireText(data, 'name', 'Nombre', 3, 120),
      email: requireEmail(data),
      phone: requirePhone(data),
      password: requireText(data, 'password', 'Contraseña', 6, 80),
      role: clean(data.role) || 'operador',
      created_at: now()
    };
    if (this.data.users.some(item => item.email === user.email)) throw new AppError('El correo ya esta registrado.', 409);
    this.data.users.push(user);
    for (const code of permissions) {
      this.data.user_permissions.push({ id: this.nextId('user_permissions'), user_id: user.id, permission_code: code, assigned_at: now() });
    }
    await this.save();
    return safeUser(user, this.data.user_permissions);
  }

  async updateUserPermissions(id, data) {
    const user = this.data.users.find(item => item.id === id);
    if (!user) throw new AppError('Usuario no encontrado.');
    const permissions = normalizePermissionCodes(data.permissions);
    this.data.user_permissions = this.data.user_permissions.filter(row => Number(row.user_id) !== Number(id));
    for (const code of permissions) {
      this.data.user_permissions.push({ id: this.nextId('user_permissions'), user_id: user.id, permission_code: code, assigned_at: now() });
    }
    await this.save();
    return safeUser(user, this.data.user_permissions);
  }

  async createProduct(data) {
    const payload = validateProduct(data);
    if (payload.sale_price < payload.purchase_cost) throw new AppError('El precio de venta no puede ser menor que el costo de compra.');
    if (this.data.products.some(product => product.sku === payload.sku)) throw new AppError('El ID del producto ya existe.', 409);
    const providerId = await this.ensureProvider(payload.provider);
    const product = {
      id: this.nextId('products'),
      sku: payload.sku,
      name: payload.name,
      unit: payload.unit,
      provider_id: providerId,
      purchase_cost: payload.purchase_cost,
      purchase_cost_base: payload.purchase_cost_base,
      freight_cost: payload.freight_cost,
      tax_cost: payload.tax_cost,
      landed_units: payload.landed_units,
      sale_price: payload.sale_price,
      category: payload.category,
      brand: payload.provider,
      material: payload.material,
      stock: payload.stock,
      daily_consumption: payload.daily_consumption,
      lead_time_days: payload.lead_time_days,
      safety_stock: payload.safety_stock,
      stock_minimo: payload.stock_minimo,
      stock_maximo: payload.stock_maximo,
      reorder_point: payload.reorder_point,
      image_url: payload.image_url,
      source_url: '',
      detail: payload.detail,
      created_at: now()
    };
    normalizeInventoryProduct(product);
    this.data.products.push(product);
    await this.save();
    return this.productWithProvider(product);
  }

  async updateProduct(id, data) {
    const product = this.data.products.find(item => item.id === id);
    if (!product) throw new AppError('Producto no encontrado.');
    const payload = validateProduct(data, true);
    if (Object.keys(payload).length === 0) throw new AppError('No hay datos para actualizar.');
    const nextCost = 'purchase_cost' in payload ? payload.purchase_cost : product.purchase_cost;
    const nextPrice = 'sale_price' in payload ? payload.sale_price : product.sale_price;
    if (nextPrice < nextCost) throw new AppError('El precio de venta no puede ser menor que el costo de compra.');
    if ('provider' in payload) {
      product.provider_id = await this.ensureProvider(payload.provider);
      product.brand = payload.provider;
      delete payload.provider;
    }
    const hasCostUpdate = ['purchase_cost', 'purchase_cost_base', 'freight_cost', 'tax_cost', 'landed_units'].some(key => key in payload);
    if (hasCostUpdate) {
      payload.purchase_cost_base ??= product.purchase_cost_base ?? product.purchase_cost;
      payload.freight_cost ??= product.freight_cost ?? 0;
      payload.tax_cost ??= product.tax_cost ?? 0;
      payload.landed_units ??= product.landed_units ?? 1;
    }
    Object.assign(product, payload);
    normalizeInventoryProduct(product);
    await this.save();
    return this.productWithProvider(product);
  }

  async createOrder(data) {
    const email = requireEmail(data);
    const user = this.data.users.find(item => item.email === email);
    if (!user) throw new AppError('El cliente no esta registrado.');
    const items = data.items;
    if (!Array.isArray(items) || items.length === 0) throw new AppError('Agrega al menos un producto al pedido.');
    const parsedItems = [];
    let subtotal = 0;
    for (const raw of items) {
      const productId = requireInt(raw, 'id', 'Producto', 1, true);
      const quantity = requireInt(raw, 'cantidad', 'Cantidad', 1, true);
      const product = this.data.products.find(item => item.id === productId);
      if (!product) throw new AppError('Uno de los productos no existe.');
      if (quantity > product.stock) throw new AppError(`Stock insuficiente para ${product.name}. Disponible: ${product.stock}.`);
      subtotal += quantity * product.sale_price;
      parsedItems.push({ product, quantity });
    }
    const tax = totalWithIgv(subtotal);
    const order = {
      id: this.nextId('orders'),
      user_id: user.id,
      customer_name: user.name,
      customer_email: user.email,
      order_date: now(),
      status: 'Pendiente',
      payment_status: 'Pendiente',
      subtotal: tax.subtotal,
      igv_rate: tax.igv_rate,
      igv_amount: tax.igv,
      total: tax.total
    };
    this.data.orders.push(order);
    for (const { product, quantity } of parsedItems) {
      product.stock -= quantity;
      this.data.order_items.push({
        id: this.nextId('order_items'),
        order_id: order.id,
        product_id: product.id,
        sku: product.sku,
        name: product.name,
        unit: product.unit,
        provider_name: this.providerName(product.provider_id),
        quantity,
        unit_price: product.sale_price,
        unit_cost: product.purchase_cost
      });
    }
    this.createLocalTransaction({
      type: 'VENTA',
      timestamp: order.order_date,
      status: 'Pendiente',
      user_id: user.id,
      party_name: user.name,
      party_email: user.email,
      total: tax.total,
      metadata: {
        order_id: order.id,
        items: this.data.order_items.filter(item => item.order_id === order.id),
        subtotal: tax.subtotal,
        igv_rate: tax.igv_rate,
        igv_amount: tax.igv,
        total_with_igv: tax.total,
        source: 'pedido'
      }
    });
    await this.save();
    return (await this.getOrders()).find(item => item.id === order.id);
  }

  async updateOrderStatus(id, data) {
    const status = requireText(data, 'status', 'Estado', 1, 30);
    if (!ALLOWED_ORDER_STATUS.has(status)) throw new AppError('Estado de pedido invalido.');
    const order = this.data.orders.find(item => item.id === id);
    if (!order) throw new AppError('Pedido no encontrado.');
    order.status = status;
    await this.save();
    return (await this.getOrders()).find(item => item.id === id);
  }

  async createQuery(data) {
    const query = {
      id: this.nextId('queries'),
      name: requireText(data, 'name', 'Nombre', 3, 120),
      email: requireEmail(data),
      phone: requirePhone(data),
      subject: requireText(data, 'subject', 'Asunto', 3, 140),
      message: requireText(data, 'message', 'Mensaje', 8, 1200),
      status: 'Pendiente',
      response: '',
      created_at: now()
    };
    this.data.queries.push(query);
    await this.save();
    return queryView(query);
  }

  async respondQuery(id) {
    const query = this.data.queries.find(item => item.id === id);
    if (!query) throw new AppError('Mensaje no encontrado.');
    query.status = 'Respondida';
    await this.save();
    return queryView(query);
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
    const product = this.data.products.find(item => item.id === productId);
    if (!product) throw new AppError('Producto no encontrado.');
    const purchase = {
      id: this.nextId('purchases'),
      product_id: product.id,
      provider_id: product.provider_id,
      sku: product.sku,
      name: product.name,
      unit: product.unit,
      quantity,
      unit_cost: unitCost,
      base_cost: baseCost,
      freight_cost: freightCost,
      tax_cost: taxCost,
      landed_units: landedUnits,
      landed_cost: unitCost,
      total: baseCost + freightCost + taxCost,
      note,
      created_at: now()
    };
    product.stock += quantity;
    product.purchase_cost = unitCost;
    product.purchase_cost_base = unitCost;
    product.freight_cost = 0;
    product.tax_cost = 0;
    product.landed_units = 1;
    normalizeInventoryProduct(product);
    this.data.purchases.push(purchase);
    this.createLocalTransaction({
      type: 'COMPRA',
      timestamp: purchase.created_at,
      status: 'Pagado/Validado',
      user_id: null,
      party_name: this.providerName(product.provider_id),
      party_email: '',
      total: purchase.total,
      metadata: {
        purchase_id: purchase.id,
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
    await this.save();
    return purchaseView({ ...purchase, provider_name: this.providerName(product.provider_id) });
  }

  async getInventoryAlerts() {
    return this.data.products.map(product => inventoryAlert(product)).filter(Boolean);
  }

  async getTransactions(filters = {}) {
    const transactions = filterVaultTransactions([...this.data.transactions], filters)
      .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
    return transactions.map(transaction => transactionView(transaction, this.data.transaction_notes, this.data.vault_documents));
  }

  async getPendingPaymentValidations() {
    return this.getTransactions({ status: 'En Revisión' });
  }

  async uploadTransactionVoucher(id, data) {
    const transaction = this.data.transactions.find(item => Number(item.id) === Number(id));
    if (!transaction) throw new AppError('Transaccion no encontrada.');
    const originalName = requireText(data, 'originalName', 'Archivo', 1, 180);
    const mimeType = optionalText(data, 'mimeType', 120) || 'application/octet-stream';
    if (!/^(application\/pdf|image\/png|image\/jpeg|image\/webp)$/i.test(mimeType)) throw new AppError('El comprobante debe ser PDF o imagen.');
    const extension = path.extname(originalName).toLowerCase() || (mimeType.includes('pdf') ? '.pdf' : '.jpg');
    const storedName = `voucher-${transaction.id}${extension}`;
    const contentBase64 = optionalText(data, 'contentBase64', 3000000);
    transaction.status = 'En Revisión';
    transaction.voucher = {
      original_name: originalName,
      stored_name: storedName,
      mime_type: mimeType,
      size: Number(data.size || 0),
      uploaded_by: optionalText(data, 'userEmail', 160),
      uploaded_at: now()
    };
    this.addVaultDocument(transaction, {
      kind: 'voucher',
      name: storedName,
      mime_type: mimeType,
      content_base64: contentBase64,
      attributes: {
        originalName,
        uploadedBy: transaction.voucher.uploaded_by,
        estado: transaction.status
      }
    });
    this.syncVaultDocumentStatus(transaction);
    this.appendStatusLog(transaction, transaction.voucher.uploaded_by || 'Cliente', `Voucher cargado como ${storedName}. Estado En Revisión.`);
    const orderId = transaction.metadata?.order_id;
    if (orderId) {
      const order = this.data.orders.find(item => Number(item.id) === Number(orderId));
      if (order) order.payment_status = 'En Revisión';
    }
    await this.save();
    return transactionView(transaction, this.data.transaction_notes, this.data.vault_documents);
  }

  async addTransactionNote(id, data) {
    const transaction = this.data.transactions.find(item => Number(item.id) === Number(id));
    if (!transaction) throw new AppError('Transaccion no encontrada.');
    const note = {
      id: this.nextId('transaction_notes'),
      transaction_id: transaction.id,
      author_name: requireText(data, 'authorName', 'Autor', 2, 120),
      author_email: optionalText(data, 'authorEmail', 160),
      message: requireText(data, 'message', 'Nota', 2, 1000),
      created_at: now()
    };
    this.data.transaction_notes.push(note);
    await this.save();
    return transactionView(transaction, this.data.transaction_notes, this.data.vault_documents);
  }

  async updateTransactionStatus(id, data) {
    const transaction = this.data.transactions.find(item => Number(item.id) === Number(id));
    if (!transaction) throw new AppError('Transaccion no encontrada.');
    const status = normalizePaymentStatus(requireText(data, 'status', 'Estado', 1, 30));
    if (!ALLOWED_PAYMENT_STATUS.has(status)) throw new AppError('Estado de pago invalido.');
    transaction.status = status;
    const orderId = transaction.metadata?.order_id;
    if (orderId) {
      const order = this.data.orders.find(item => Number(item.id) === Number(orderId));
      if (order) {
        order.payment_status = status;
        order.status = nextDispatchStatus(status);
      }
    }
    if (clean(data.note)) {
      this.data.transaction_notes.push({
        id: this.nextId('transaction_notes'),
        transaction_id: transaction.id,
        author_name: optionalText(data, 'authorName', 120) || 'Sistema',
        author_email: optionalText(data, 'authorEmail', 160),
        message: optionalText(data, 'note', 1000),
        created_at: now()
      });
    }
    this.ensureVaultDataDocument(transaction);
    this.syncVaultDocumentStatus(transaction);
    this.appendStatusLog(transaction, optionalText(data, 'authorName', 120) || 'Sistema', `Estado actualizado a ${status}.`);
    await this.save();
    return transactionView(transaction, this.data.transaction_notes, this.data.vault_documents);
  }

  async getVaultTree() {
    return buildVaultTree(await this.getTransactions());
  }

  async searchVault(filters = {}) {
    return this.getTransactions(filters);
  }
}

module.exports = { LocalStore };
