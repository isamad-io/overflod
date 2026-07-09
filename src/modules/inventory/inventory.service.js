function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function calculateLandedCost(basePurchase, freight, taxes, units) {
  const normalizedUnits = Math.max(1, toNumber(units, 1));
  return roundMoney((toNumber(basePurchase) + toNumber(freight) + toNumber(taxes)) / normalizedUnits);
}

function calculateReorderPoint(dailyConsumption, leadTimeDays, safetyStock) {
  return Math.ceil((toNumber(dailyConsumption) * toNumber(leadTimeDays)) + toNumber(safetyStock));
}

function normalizeInventoryProduct(product) {
  const basePurchase = toNumber(product.purchase_cost_base ?? product.base_purchase_cost ?? product.purchase_cost, 0);
  const freight = toNumber(product.freight_cost, 0);
  const taxes = toNumber(product.tax_cost, 0);
  const units = Math.max(1, toNumber(product.landed_units, 1));
  const dailyConsumption = Math.max(0, toNumber(product.daily_consumption, 1));
  const leadTimeDays = Math.max(0, toNumber(product.lead_time_days, 7));
  const safetyStock = Math.max(0, toNumber(product.safety_stock ?? product.stock_minimo, 20));
  const calculatedReorderPoint = calculateReorderPoint(dailyConsumption, leadTimeDays, safetyStock);
  const reorderPoint = Math.max(0, toNumber(product.reorder_point, calculatedReorderPoint));

  product.purchase_cost_base = basePurchase;
  product.freight_cost = freight;
  product.tax_cost = taxes;
  product.landed_units = units;
  product.purchase_cost = calculateLandedCost(basePurchase, freight, taxes, units);
  product.daily_consumption = dailyConsumption;
  product.lead_time_days = leadTimeDays;
  product.safety_stock = safetyStock;
  product.stock_minimo = safetyStock;
  product.stock_maximo = Math.max(toNumber(product.stock_maximo, reorderPoint * 2), reorderPoint);
  product.reorder_point = reorderPoint;
  return product;
}

function inventoryFieldsView(row) {
  const product = normalizeInventoryProduct({ ...row });
  const stock = toNumber(product.stock);
  return {
    precioCompraBase: product.purchase_cost_base,
    flete: product.freight_cost,
    impuestos: product.tax_cost,
    unidadesCosteo: product.landed_units,
    landedCost: product.purchase_cost,
    costoTotalUnitario: product.purchase_cost,
    consumoDiario: product.daily_consumption,
    leadTime: product.lead_time_days,
    stockSeguridad: product.safety_stock,
    stockMinimo: product.stock_minimo,
    stockMaximo: product.stock_maximo,
    puntoReorden: product.reorder_point,
    alertaReorden: stock < product.reorder_point,
    margenUnitario: roundMoney(toNumber(product.sale_price) - toNumber(product.purchase_cost))
  };
}

function inventoryAlert(product) {
  const view = inventoryFieldsView(product);
  if (!view.alertaReorden) return null;
  return {
    productId: product.id,
    sku: product.sku,
    name: product.name,
    stock: product.stock,
    unit: product.unit,
    reorderPoint: view.puntoReorden,
    safetyStock: view.stockSeguridad,
    message: `${product.sku} - ${product.name}: stock ${product.stock} < punto de reorden ${view.puntoReorden}`
  };
}

module.exports = {
  calculateLandedCost,
  calculateReorderPoint,
  inventoryAlert,
  inventoryFieldsView,
  normalizeInventoryProduct,
  roundMoney,
  toNumber
};
