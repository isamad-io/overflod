
const { calculateLandedCost, calculateReorderPoint } = require('../modules/inventory/inventory.service');
const { AppError } = require('./errors');

function clean(value) {
  return String(value ?? '').trim();
}

function requireText(data, field, label = field, min = 1, max = 120) {
  const value = clean(data[field]);
  if (value.length < min) throw new AppError(`${label} es obligatorio.`);
  if (value.length > max) throw new AppError(`${label} no puede superar ${max} caracteres.`);
  return value;
}

function optionalText(data, field, max = 240) {
  const value = clean(data[field]);
  if (value.length > max) throw new AppError(`${field} no puede superar ${max} caracteres.`);
  return value;
}

function requireEmail(data, field = 'email') {
  const email = clean(data[field]).toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new AppError('Ingresa un correo valido.');
  return email;
}

function requirePhone(data, field = 'phone') {
  const phone = clean(data[field]);
  if (!/^[0-9+() -]{6,20}$/.test(phone)) throw new AppError('Ingresa un telefono valido.');
  return phone;
}

function requireNumber(data, field, label = field, minimum = 0, positive = false) {
  const value = Number(data[field]);
  if (!Number.isFinite(value)) throw new AppError(`${label} debe ser numerico.`);
  if (positive && value <= 0) throw new AppError(`${label} debe ser mayor que cero.`);
  if (value < minimum) throw new AppError(`${label} no puede ser menor que ${minimum}.`);
  return value;
}

function requireInt(data, field, label = field, minimum = 0, positive = false) {
  const value = requireNumber(data, field, label, minimum, positive);
  if (!Number.isInteger(value)) throw new AppError(`${label} debe ser un numero entero.`);
  return value;
}

function pickField(data, fields) {
  return fields.find(field => Object.prototype.hasOwnProperty.call(data, field));
}

function validateProduct(data, partial = false) {
  const payload = {};
  if (!partial || 'sku' in data) {
    const sku = requireText(data, 'sku', 'ID', 1, 20);
    if (!/^[A-Za-z0-9-]+$/.test(sku)) throw new AppError('El ID solo puede usar letras, numeros y guiones.');
    payload.sku = sku;
  }
  if (!partial || 'name' in data || 'nombre' in data) payload.name = requireText(data, 'name' in data ? 'name' : 'nombre', 'Producto', 2, 160);
  if (!partial || 'unit' in data || 'unidad' in data) payload.unit = requireText(data, 'unit' in data ? 'unit' : 'unidad', 'Unidad', 1, 40);
  if (!partial || 'provider' in data || 'proveedor' in data) payload.provider = requireText(data, 'provider' in data ? 'provider' : 'proveedor', 'Proveedor', 2, 120);
  const costField = pickField(data, ['purchaseCost', 'costoCompra']);
  const baseCostField = pickField(data, ['purchaseCostBase', 'precioCompraBase', 'basePurchaseCost']);
  const freightField = pickField(data, ['freightCost', 'flete']);
  const taxField = pickField(data, ['taxCost', 'impuestos']);
  const landedUnitsField = pickField(data, ['landedUnits', 'unidadesCosteo']);
  const hasCostPayload = Boolean(costField || baseCostField || freightField || taxField || landedUnitsField);
  if (!partial || hasCostPayload) {
    const fallbackCost = costField ? requireNumber(data, costField, 'Costo compra', 0) : 0;
    const baseCost = baseCostField ? requireNumber(data, baseCostField, 'Compra base', 0) : fallbackCost;
    const freightCost = freightField ? requireNumber(data, freightField, 'Flete', 0) : 0;
    const taxCost = taxField ? requireNumber(data, taxField, 'Impuestos', 0) : 0;
    const landedUnits = landedUnitsField ? requireNumber(data, landedUnitsField, 'Unidades', 1, true) : 1;
    payload.purchase_cost_base = baseCost;
    payload.freight_cost = freightCost;
    payload.tax_cost = taxCost;
    payload.landed_units = landedUnits;
    payload.purchase_cost = calculateLandedCost(baseCost, freightCost, taxCost, landedUnits);
  }
  if (!partial || 'salePrice' in data || 'precio' in data || 'precioVenta' in data) {
    const field = 'salePrice' in data ? 'salePrice' : ('precioVenta' in data ? 'precioVenta' : 'precio');
    payload.sale_price = requireNumber(data, field, 'Precio venta', 0, true);
  }
  if (!partial || 'category' in data || 'categoria' in data) payload.category = requireText(data, 'category' in data ? 'category' : 'categoria', 'Categoria', 2, 80);
  if (!partial || 'material' in data) payload.material = requireText(data, 'material', 'Material', 1, 100);
  if (!partial || 'stock' in data) payload.stock = requireInt(data, 'stock', 'Stock', 0);
  const dailyField = pickField(data, ['dailyConsumption', 'consumoDiario']);
  const leadField = pickField(data, ['leadTimeDays', 'leadTime']);
  const safetyField = pickField(data, ['safetyStock', 'stockSeguridad', 'stockMinimo']);
  const maxField = pickField(data, ['stockMaximo']);
  const reorderField = pickField(data, ['reorderPoint', 'puntoReorden', 'limiteInventarioBajo', 'limiteBajo']);
  if (!partial || dailyField) payload.daily_consumption = dailyField ? requireNumber(data, dailyField, 'Consumo diario', 0) : 1;
  if (!partial || leadField) payload.lead_time_days = leadField ? requireNumber(data, leadField, 'Lead time', 0) : 7;
  if (!partial || safetyField) {
    payload.safety_stock = safetyField ? requireNumber(data, safetyField, 'Stock de seguridad', 0) : 20;
    payload.stock_minimo = payload.safety_stock;
  }
  if (!partial || maxField) payload.stock_maximo = maxField ? requireNumber(data, maxField, 'Stock maximo', 0) : 0;
  if (reorderField) {
    payload.reorder_point = requireNumber(data, reorderField, 'Limite de inventario bajo', 0);
  } else if ('daily_consumption' in payload || 'lead_time_days' in payload || 'safety_stock' in payload) {
    payload.reorder_point = calculateReorderPoint(
      payload.daily_consumption ?? 1,
      payload.lead_time_days ?? 7,
      payload.safety_stock ?? 20
    );
  }
  if ('imageUrl' in data || 'img' in data) payload.image_url = optionalText(data, 'imageUrl' in data ? 'imageUrl' : 'img', 800);
  else if (!partial) payload.image_url = '/public/assets/productos/producto-generico.svg';
  if ('detail' in data || 'detalle' in data) payload.detail = optionalText(data, 'detail' in data ? 'detail' : 'detalle', 1000);
  else if (!partial) payload.detail = 'Producto agregado desde el panel administrador.';
  return payload;
}

module.exports = {
  clean,
  optionalText,
  pickField,
  requireEmail,
  requireInt,
  requireNumber,
  requirePhone,
  requireText,
  validateProduct
};
