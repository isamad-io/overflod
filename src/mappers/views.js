
const { inventoryFieldsView } = require('../modules/inventory/inventory.service');
const { normalizePaymentStatus } = require('../modules/transactions/transactions.service');

function productRow(row) {
  const inventory = inventoryFieldsView(row);
  return {
    ...row,
    precio: Number(row.sale_price),
    precioVenta: Number(row.sale_price),
    costoCompra: Number(row.purchase_cost),
    ...inventory,
    nombre: row.name,
    unidad: row.unit,
    proveedor: row.provider_name,
    categoria: row.category,
    marca: row.brand,
    material: row.material,
    img: row.image_url,
    sourceUrl: row.source_url || '',
    sodimacUrl: row.source_url || '',
    detalle: row.detail
  };
}

function orderView(order, items) {
  const subtotal = items.reduce((sum, item) => sum + (Number(item.unit_price) * Number(item.quantity)), 0);
  const total = Number(order.total || 0);
  const igvAmount = Math.max(0, Math.round(((total - subtotal) + Number.EPSILON) * 100) / 100);
  return {
    ...order,
    subtotal,
    igvRate: igvAmount > 0 ? 0.18 : 0,
    igvAmount,
    fecha: order.order_date,
    nombre: order.customer_name,
    cliente: order.customer_email,
    paymentStatus: normalizePaymentStatus(order.payment_status || order.paymentStatus || order.status),
    estadoPago: normalizePaymentStatus(order.payment_status || order.paymentStatus || order.status),
    items: items.map(item => ({
      id: item.product_id,
      sku: item.sku,
      nombre: item.name,
      unidad: item.unit,
      proveedor: item.provider_name,
      cantidad: item.quantity,
      precio: Number(item.unit_price),
      costoCompra: Number(item.unit_cost)
    }))
  };
}

function queryView(row) {
  return {
    id: row.id,
    nombre: row.name,
    correo: row.email,
    telefono: row.phone,
    asunto: row.subject,
    mensaje: row.message,
    estado: row.status,
    respuesta: row.response || '',
    fecha: row.created_at
  };
}

function purchaseView(row) {
  return {
    id: row.id,
    fecha: row.created_at,
    proveedor: row.provider_name,
    productId: row.product_id,
    sku: row.sku,
    nombre: row.name,
    unidad: row.unit,
    cantidad: row.quantity,
    costoUnitario: Number(row.unit_cost),
    compraBase: Number(row.base_cost ?? row.total ?? 0),
    flete: Number(row.freight_cost ?? 0),
    impuestos: Number(row.tax_cost ?? 0),
    unidadesCosteo: Number(row.landed_units ?? row.quantity ?? 1),
    landedCost: Number(row.landed_cost ?? row.unit_cost),
    total: Number(row.total),
    nota: row.note || ''
  };
}

module.exports = {
  orderView,
  productRow,
  purchaseView,
  queryView
};
