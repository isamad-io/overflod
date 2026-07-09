const SQL_SERVER = 'http://127.0.0.1:5501';
const API_BASE = `${SQL_SERVER}/api`;
const CART_KEY = 'overflod_cart_sql';
const SESSION_KEY = 'overflod_session_sql';
const IGV_RATE = 0.18;

const state = {
  products: [],
  providers: [],
  users: [],
  orders: [],
  queries: [],
  purchases: [],
  permissions: [],
  roles: [],
  transactions: [],
  inventoryAlerts: [],
  vaultResults: null,
  selectedTransactionId: null
};

const ADMIN_PERMISSIONS = new Set([
  'leer_stock',
  'editar_stock',
  'ver_costos',
  'validar_pagos',
  'ver_transacciones',
  'buscar_documentos',
  'gestionar_boveda',
  'gestionar_usuarios'
]);

const faqs = [
  ['¿Puedo comprar sin registrarme?', 'Puedes navegar por el catálogo, pero para confirmar un pedido debes registrarte e iniciar sesión.'],
  ['¿Realizan entregas a domicilio?', 'Sí, la entrega se coordina según la zona, cantidad de productos y disponibilidad.'],
  ['¿Cómo sé qué cemento elegir?', 'Puedes enviar una consulta y un asesor te orientará según el tipo de obra.'],
  ['¿Aceptan pedidos grandes?', 'Sí, se pueden registrar pedidos para viviendas, empresas y proyectos de construcción.'],
  ['¿Puedo modificar mi carrito?', 'Sí, puedes cambiar cantidades o eliminar productos antes de confirmar el pedido.'],
  ['¿Dónde veo mi historial?', 'El historial se muestra en tu perfil después de iniciar sesión.']
];

const $ = id => document.getElementById(id);
const money = value => Number(value || 0).toFixed(2);
const roundCurrency = value => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const totalWithIgv = subtotal => {
  const base = roundCurrency(subtotal);
  const igv = roundCurrency(base * IGV_RATE);
  return {subtotal: base, igv, total: roundCurrency(base + igv)};
};
const landedCost = (base, freight, taxes, units) => {
  const safeUnits = Math.max(1, Number(units || 1));
  return (Number(base || 0) + Number(freight || 0) + Number(taxes || 0)) / safeUnits;
};
const reorderPoint = (daily, leadTime, safety) => Math.ceil((Number(daily || 0) * Number(leadTime || 0)) + Number(safety || 0));
const imageSrc = value => {
  const src = String(value || '').trim();
  if(!src) return `${SQL_SERVER}/public/assets/productos/producto-generico.svg`;
  return src.startsWith('/') ? `${SQL_SERVER}${src}` : src;
};
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
const getCart = () => JSON.parse(localStorage.getItem(CART_KEY) || '[]');
const setCart = cart => localStorage.setItem(CART_KEY, JSON.stringify(cart));
const currentUser = () => JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
const hasPermission = code => {
  const user = currentUser();
  if(!user) return false;
  if(user.role === 'admin') return true;
  return Array.isArray(user.permissions) && user.permissions.includes(code);
};
const isAdmin = () => {
  const user = currentUser();
  if(!user) return false;
  return user.role === 'admin' || (user.permissions || []).some(code => ADMIN_PERMISSIONS.has(code));
};

async function api(path, options = {}){
  let response;
  try{
    response = await fetch(`${API_BASE}${path}`, {
      headers: {'Content-Type': 'application/json'},
      ...options
    });
  } catch(error){
    throw new Error('No hay conexion con el servidor Express. En VS Code ejecuta: npm run dev');
  }
  const contentType = response.headers.get('content-type') || '';
  if(!contentType.includes('application/json')){
    throw new Error('El servidor Express no respondio JSON. Ejecuta npm run dev en la carpeta overflod-web.');
  }
  const payload = await response.json().catch(() => ({ok:false,error:'Respuesta invalida del servidor Express.'}));
  if(!response.ok || payload.ok === false){
    throw new Error(payload.error || 'No se pudo completar la operación.');
  }
  return payload;
}

async function loadData(){
  const data = await api('/bootstrap');
  state.products = data.products || [];
  state.providers = data.providers || [];
  state.users = data.users || [];
  state.orders = data.orders || [];
  state.queries = data.queries || [];
  state.purchases = data.purchases || [];
  state.permissions = data.permissions || [];
  state.roles = data.roles || [];
  state.transactions = data.transactions || [];
  state.inventoryAlerts = data.inventoryAlerts || [];
  if(!state.vaultResults) state.vaultResults = state.transactions;
  if(!state.selectedTransactionId && state.transactions[0]) state.selectedTransactionId = state.transactions[0].id;
}

function toast(message){
  if($('toastTexto') && $('toastMensaje')){
    $('toastTexto').textContent = message;
    new bootstrap.Toast($('toastMensaje')).show();
  } else {
    alert(message);
  }
}

function fail(message, fieldId){
  const field = fieldId ? $(fieldId) : null;
  if(field){
    field.classList.add('is-invalid');
    field.focus();
  }
  toast(message);
  return false;
}

function clearInvalid(form){
  form?.querySelectorAll('.is-invalid').forEach(field => field.classList.remove('is-invalid'));
}

function textValue(id){
  return ($(id)?.value || '').trim();
}

function numberValue(id){
  return Number($(id)?.value || 0);
}

function isEmail(email){
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

function isPhone(phone){
  return /^[0-9+() -]{6,20}$/.test(phone);
}

function validateRegister(){
  if(textValue('registroNombre').length < 3) return fail('El nombre debe tener al menos 3 caracteres.', 'registroNombre');
  if(!isEmail(textValue('registroCorreo'))) return fail('Ingresa un correo válido.', 'registroCorreo');
  if(!isPhone(textValue('registroTelefono'))) return fail('Ingresa un teléfono válido.', 'registroTelefono');
  if(textValue('registroClave').length < 6) return fail('La contraseña debe tener al menos 6 caracteres.', 'registroClave');
  return true;
}

function validateLogin(){
  if(!isEmail(textValue('loginCorreo'))) return fail('Ingresa un correo válido.', 'loginCorreo');
  if(textValue('loginClave').length < 1) return fail('Ingresa tu contraseña.', 'loginClave');
  return true;
}

function validateContact(){
  if(textValue('consultaNombre').length < 3) return fail('Ingresa tu nombre completo.', 'consultaNombre');
  if(!isPhone(textValue('consultaTelefono'))) return fail('Ingresa un teléfono válido.', 'consultaTelefono');
  if(!isEmail(textValue('consultaCorreo'))) return fail('Ingresa un correo válido.', 'consultaCorreo');
  if(textValue('consultaAsunto').length < 3) return fail('Ingresa un asunto.', 'consultaAsunto');
  if(textValue('consultaMensaje').length < 8) return fail('El mensaje debe tener al menos 8 caracteres.', 'consultaMensaje');
  return true;
}

function validateProductForm(){
  const sku = textValue('adminSkuProducto');
  const cost = numberValue('adminCostoProducto');
  const freight = numberValue('adminFleteProducto');
  const taxes = numberValue('adminImpuestosProducto');
  const units = numberValue('adminUnidadesCosteoProducto') || 1;
  const finalCost = landedCost(cost, freight, taxes, units);
  const price = numberValue('adminPrecioProducto');
  const stock = numberValue('adminStockProducto');
  const daily = numberValue('adminConsumoDiarioProducto');
  const leadTime = numberValue('adminLeadTimeProducto');
  const safety = numberValue('adminStockSeguridadProducto');
  if(sku && !/^[A-Za-z0-9-]+$/.test(sku)) return fail('El ID solo puede usar letras, números y guiones.', 'adminSkuProducto');
  if(textValue('adminNombreProducto').length < 2) return fail('Ingresa el nombre del producto.', 'adminNombreProducto');
  if(textValue('adminUnidadProducto').length < 1) return fail('Ingresa la unidad.', 'adminUnidadProducto');
  if(textValue('adminProveedorProducto').length < 2) return fail('Ingresa el proveedor.', 'adminProveedorProducto');
  if(textValue('adminCategoriaProducto').length < 2) return fail('Ingresa la categoría.', 'adminCategoriaProducto');
  if(textValue('adminMaterialProducto').length < 1) return fail('Ingresa el material.', 'adminMaterialProducto');
  if(cost < 0) return fail('La compra base no puede ser negativa.', 'adminCostoProducto');
  if(freight < 0) return fail('El flete no puede ser negativo.', 'adminFleteProducto');
  if(taxes < 0) return fail('Los impuestos no pueden ser negativos.', 'adminImpuestosProducto');
  if(units <= 0) return fail('Las unidades de costeo deben ser mayores que cero.', 'adminUnidadesCosteoProducto');
  if(price <= 0) return fail('El precio de venta debe ser mayor que cero.', 'adminPrecioProducto');
  if(price < finalCost) return fail('El precio de venta no debe ser menor al landed cost.', 'adminPrecioProducto');
  if(stock < 0 || !Number.isInteger(stock)) return fail('El stock debe ser un número entero mayor o igual a cero.', 'adminStockProducto');
  if(daily < 0) return fail('El consumo diario no puede ser negativo.', 'adminConsumoDiarioProducto');
  if(leadTime < 0) return fail('El lead time no puede ser negativo.', 'adminLeadTimeProducto');
  if(safety < 0) return fail('El stock de seguridad no puede ser negativo.', 'adminStockSeguridadProducto');
  return true;
}

function validatePurchaseForm(){
  const quantity = numberValue('compraCantidad');
  const base = $('compraBase') ? numberValue('compraBase') : numberValue('compraCosto');
  const freight = numberValue('compraFlete');
  const taxes = numberValue('compraImpuestos');
  if(!textValue('compraProducto')) return fail('Selecciona un producto.', 'compraProducto');
  if(quantity <= 0 || !Number.isInteger(quantity)) return fail('La cantidad debe ser un entero mayor que cero.', 'compraCantidad');
  if(base < 0) return fail('La compra base no puede ser negativa.', $('compraBase') ? 'compraBase' : 'compraCosto');
  if(freight < 0) return fail('El flete no puede ser negativo.', 'compraFlete');
  if(taxes < 0) return fail('Los impuestos no pueden ser negativos.', 'compraImpuestos');
  return true;
}

function fillSelect(id, values){
  if($(id)) $(id).innerHTML = values.map(value => `<option value="${escapeHTML(value)}">${escapeHTML(value)}</option>`).join('');
}

function renderFilters(){
  if(!$('filtroCategoria')) return;
  fillSelect('filtroCategoria', ['Todos', ...new Set(state.products.map(product => product.categoria))]);
  fillSelect('filtroMarca', ['Todas', ...new Set(state.products.map(product => product.marca))]);
  fillSelect('filtroMaterial', ['Todos', ...new Set(state.products.map(product => product.material))]);
}

function renderProducts(){
  if(!$('productosContainer')) return;
  const query = (textValue('buscarProducto') || '').toLowerCase();
  const category = $('filtroCategoria')?.value || 'Todos';
  const brand = $('filtroMarca')?.value || 'Todas';
  const material = $('filtroMaterial')?.value || 'Todos';
  const maxPrice = parseFloat($('filtroPrecio')?.value) || Infinity;
  const products = state.products.filter(product => {
    const searchText = `${product.sku} ${product.nombre} ${product.proveedor} ${product.unidad}`.toLowerCase();
    return searchText.includes(query)
      && (category === 'Todos' || product.categoria === category)
      && (brand === 'Todas' || product.marca === brand)
      && (material === 'Todos' || product.material === material)
      && Number(product.precio) <= maxPrice;
  });
  $('productosContainer').innerHTML = products.map(product => `
    <div class="col-sm-6 col-lg-3">
      <div class="card h-100 product-card shadow-sm">
        <img src="${escapeHTML(imageSrc(product.img))}" class="card-img-top" alt="${escapeHTML(product.nombre)}" loading="lazy">
        <div class="card-body d-flex flex-column">
          <div class="d-flex align-items-center justify-content-between gap-2 mb-2">
            <span class="badge text-bg-light">${escapeHTML(product.sku)}</span>
            <span class="small ${product.stock <= 20 ? 'text-danger' : 'text-muted'}">Stock: ${product.stock} ${escapeHTML(product.unidad)}</span>
          </div>
          <h2 class="h5">${escapeHTML(product.nombre)}</h2>
          <p class="small text-muted mb-1">Proveedor: ${escapeHTML(product.proveedor)}</p>
          <p class="small text-muted">Unidad: ${escapeHTML(product.unidad)}</p>
          <p class="price mt-auto">S/ ${money(product.precio)}</p>
          <div class="d-grid gap-2">
            <button class="btn btn-outline-primary" onclick="verDetalle(${product.id})" aria-label="Ver detalle: ${escapeHTML(product.nombre)}">Ver detalle</button>
            <button class="btn btn-celeste" onclick="agregarCarrito(${product.id})" aria-label="${product.stock <= 0 ? 'Sin stock' : 'Agregar al carrito'}: ${escapeHTML(product.nombre)}" ${product.stock <= 0 ? 'disabled' : ''}>${product.stock <= 0 ? 'Sin stock' : 'Agregar al carrito'}</button>
          </div>
        </div>
      </div>
    </div>`).join('') || '<div class="col-12"><div class="alert alert-info">No se encontraron productos.</div></div>';
}

function verDetalle(id){
  const product = state.products.find(item => item.id === id);
  if(!product || !$('detalleModal')) return;
  $('detalleTitulo').textContent = product.nombre;
  $('detalleBody').innerHTML = `
    <div class="row g-4">
      <div class="col-md-6"><img src="${escapeHTML(imageSrc(product.img))}" class="img-fluid rounded-4" alt="${escapeHTML(product.nombre)}"></div>
      <div class="col-md-6">
        <p>${escapeHTML(product.detalle)}</p>
        <p><strong>ID:</strong> ${escapeHTML(product.sku)}</p>
        <p><strong>Categoría:</strong> ${escapeHTML(product.categoria)}</p>
        <p><strong>Proveedor:</strong> ${escapeHTML(product.proveedor)}</p>
        <p><strong>Unidad:</strong> ${escapeHTML(product.unidad)}</p>
        <p><strong>Stock:</strong> ${product.stock}</p>
        <p class="price">S/ ${money(product.precio)}</p>
        <div class="d-flex flex-wrap gap-2">
          <button class="btn btn-celeste" onclick="agregarCarrito(${product.id})" aria-label="Agregar al carrito: ${escapeHTML(product.nombre)}">Agregar al carrito</button>
        </div>
      </div>
    </div>`;
  new bootstrap.Modal($('detalleModal')).show();
}

function agregarCarrito(id){
  const product = state.products.find(item => item.id === id);
  if(!product || product.stock <= 0){ toast('Este producto no tiene stock disponible.'); return; }
  const cart = getCart();
  const item = cart.find(row => row.id === id);
  const nextQuantity = item ? item.cantidad + 1 : 1;
  if(nextQuantity > product.stock){ toast('No hay más stock disponible para este producto.'); return; }
  if(item) item.cantidad += 1; else cart.push({id, cantidad: 1});
  setCart(cart);
  renderCart();
  toast('Producto agregado al carrito.');
}

function cambiarCantidad(id, value){
  const product = state.products.find(item => item.id === id);
  if(!product || product.stock <= 0){ eliminarCarrito(id); return; }
  const quantity = Math.min(product.stock, Math.max(1, Number(value) || 1));
  setCart(getCart().map(item => item.id === id ? {...item, cantidad: quantity} : item));
  renderCart();
}

function eliminarCarrito(id){
  setCart(getCart().filter(item => item.id !== id));
  renderCart();
}

function renderCart(){
  const cart = getCart();
  let subtotal = 0;
  if($('contadorCarrito')) $('contadorCarrito').textContent = cart.reduce((sum, item) => sum + item.cantidad, 0);
  if($('listaCarrito')){
    const rows = cart.map(item => {
      const product = state.products.find(row => row.id === item.id);
      if(!product) return '';
      const quantity = Math.min(item.cantidad, product.stock);
      subtotal += product.precio * quantity;
      return `
        <div class="carrito-item">
          <strong>${escapeHTML(product.nombre)}</strong><br>
          <span>S/ ${money(product.precio)} por ${escapeHTML(product.unidad)}</span>
          <small class="d-block text-muted">Stock disponible: ${product.stock}</small>
          <div class="d-flex gap-2 mt-2">
            <input type="number" min="1" max="${product.stock}" class="form-control cantidad-input" value="${quantity}" aria-label="Cantidad de ${escapeHTML(product.nombre)}" onchange="cambiarCantidad(${product.id},this.value)">
            <button class="btn btn-sm btn-outline-danger" onclick="eliminarCarrito(${product.id})" aria-label="Eliminar ${escapeHTML(product.nombre)} del carrito">Eliminar</button>
          </div>
        </div>`;
    }).join('');
    const tax = totalWithIgv(subtotal);
    $('listaCarrito').innerHTML = rows
      ? `${rows}
        <div class="cart-tax-summary mt-3">
          <div><span>Subtotal</span><strong>S/ ${money(tax.subtotal)}</strong></div>
          <div><span>IGV 18%</span><strong>S/ ${money(tax.igv)}</strong></div>
          <div class="cart-tax-total"><span>Total con IGV</span><strong>S/ ${money(tax.total)}</strong></div>
        </div>`
      : '<p class="text-muted">El carrito está vacío.</p>';
  }
  if($('totalCarrito')) $('totalCarrito').textContent = money(totalWithIgv(subtotal).total);
}

async function confirmarPedido(){
  const user = currentUser();
  const cart = getCart();
  if(!user){
    toast('Debes iniciar sesión o registrarte para confirmar la compra.');
    if($('loginModal')) new bootstrap.Modal($('loginModal')).show();
    return;
  }
  if(cart.length === 0){ toast('El carrito está vacío.'); return; }
  try{
    await api('/orders', {method:'POST', body: JSON.stringify({email: user.email, items: cart})});
    setCart([]);
    await loadData();
    renderAll();
    toast('Pedido confirmado correctamente.');
  } catch(error){
    toast(error.message);
  }
}

function renderProveedores(){
  if(!$('proveedoresContainer')) return;
  $('proveedoresContainer').innerHTML = state.providers.map(provider => `
    <div class="col-md-6 col-lg-3">
      <div class="card h-100 shadow-sm">
        <div class="card-body">
          <div class="proveedor-logo mb-3">${escapeHTML(provider.name.substring(0,2).toUpperCase())}</div>
          <h5>${escapeHTML(provider.name)}</h5>
          <p>${escapeHTML(provider.description)}</p>
          <p class="small text-muted"><strong>Productos:</strong> ${escapeHTML(provider.product_lines)}</p>
        </div>
      </div>
    </div>`).join('');
}

function renderFaq(){
  if(!$('faqContainer')) return;
  const query = (textValue('buscarFaq') || '').toLowerCase();
  $('faqContainer').innerHTML = faqs
    .filter(item => item[0].toLowerCase().includes(query) || item[1].toLowerCase().includes(query))
    .map((item, index) => `
      <div class="accordion-item">
        <h2 class="accordion-header"><button class="accordion-button ${index ? 'collapsed' : ''}" type="button" data-bs-toggle="collapse" data-bs-target="#faq${index}">${item[0]}</button></h2>
        <div id="faq${index}" class="accordion-collapse collapse ${index ? '' : 'show'}" data-bs-parent="#faqContainer"><div class="accordion-body">${item[1]}</div></div>
      </div>`).join('') || '<div class="alert alert-info">No hay preguntas relacionadas.</div>';
}

async function registro(event){
  event.preventDefault();
  clearInvalid(event.target);
  if(!validateRegister()) return;
  try{
    const result = await api('/register', {
      method:'POST',
      body: JSON.stringify({
        name: textValue('registroNombre'),
        email: textValue('registroCorreo').toLowerCase(),
        phone: textValue('registroTelefono'),
        password: textValue('registroClave')
      })
    });
    localStorage.setItem(SESSION_KEY, JSON.stringify(result.user));
    event.target.reset();
    await loadData();
    renderAll();
    closeModal('registroModal');
    toast('Cuenta creada e inicio de sesión correcto.');
  } catch(error){
    toast(error.message);
  }
}

async function login(event){
  event.preventDefault();
  clearInvalid(event.target);
  if(!validateLogin()) return;
  try{
    const result = await api('/login', {
      method:'POST',
      body: JSON.stringify({email: textValue('loginCorreo').toLowerCase(), password: textValue('loginClave')})
    });
    localStorage.setItem(SESSION_KEY, JSON.stringify(result.user));
    event.target.reset();
    closeModal('loginModal');
    await loadData();
    renderAll();
    toast('Sesión iniciada.');
  } catch(error){
    toast(error.message);
  }
}

function closeModal(id){
  const modal = $(id) ? bootstrap.Modal.getInstance($(id)) : null;
  if(modal) modal.hide();
}

function logout(event){
  event?.preventDefault();
  localStorage.removeItem(SESSION_KEY);
  renderAll();
  toast('Sesión cerrada.');
}

function updateSessionUI(){
  const user = currentUser();
  document.querySelectorAll('#estadoSesion').forEach(element => {
    element.textContent = user ? `Sesión activa: ${user.name} (${user.role})` : 'No has iniciado sesión.';
  });
  document.querySelectorAll('#imgPerfil').forEach(image => {
    image.src = user ? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=1597d4&color=fff` : 'https://ui-avatars.com/api/?name=Guest&background=ccc&color=fff';
  });
  document.querySelectorAll('#linkAdmin').forEach(link => {
    link.style.display = isAdmin() ? '' : 'none';
  });
}

function renderPerfil(){
  const container = $('perfilUsuario');
  if(!container) return;
  const user = currentUser();
  if(!user){
    container.innerHTML = '<p class="text-muted">Inicia sesión para ver y administrar tu perfil e historial de compras.</p>';
    return;
  }
  const orders = state.orders.filter(order => order.cliente === user.email);
  const transactionForOrder = order => state.transactions.find(transaction => Number(transaction.metadata?.order_id) === Number(order.id));
  container.innerHTML = `
    <h5>${escapeHTML(user.name)}</h5>
    <p><strong>Correo:</strong> ${escapeHTML(user.email)}<br><strong>Teléfono:</strong> ${escapeHTML(user.phone)}<br><strong>Perfil:</strong> ${escapeHTML(user.role)}</p>
    <h6>Mis compras</h6>
    ${orders.map(order => {
      const transaction = transactionForOrder(order);
      const paymentStatus = transaction?.status || order.estadoPago || 'Pendiente';
      const canUpload = transaction && ['Pendiente','Rechazado'].includes(paymentStatus);
      return `
        <div class="alert alert-light border">
          <div class="d-flex flex-wrap justify-content-between gap-2">
            <strong>Pedido #${order.id}</strong>
            <span class="badge ${estadoBadge(paymentStatus)}">${escapeHTML(paymentStatus)}</span>
          </div>
          <small class="text-muted">${escapeHTML(order.fecha)}</small><br>
          ${orderTotalMarkup(order)}
          Despacho: ${escapeHTML(order.status)}
          ${transaction?.voucher ? `<div class="small text-success mt-2">Comprobante cargado como ${escapeHTML(transaction.voucher.stored_name)}</div>` : ''}
          ${canUpload ? `
            <div class="mt-3">
              <label class="form-label" for="voucher-${transaction.id}">Cargar comprobante PDF o imagen</label>
              <div class="input-group">
                <input class="form-control" type="file" id="voucher-${transaction.id}" accept="application/pdf,image/png,image/jpeg,image/webp">
                <button class="btn btn-outline-primary" type="button" onclick="cargarComprobante(${transaction.id})">Enviar</button>
              </div>
            </div>` : ''}
          ${transaction?.notes?.length ? `<div class="small mt-2"><strong>Notas:</strong> ${transaction.notes.map(note => escapeHTML(note.message)).join(' · ')}</div>` : ''}
        </div>`;
    }).join('') || '<p class="small text-muted">Aún no tienes compras registradas.</p>'}`;
}

async function cargarComprobante(transactionId){
  const user = currentUser();
  const input = $(`voucher-${transactionId}`);
  const file = input?.files?.[0];
  if(!user){ toast('Inicia sesión para cargar comprobantes.'); return; }
  if(!file){ toast('Selecciona un PDF o imagen del voucher.'); return; }
  if(!/^(application\/pdf|image\/png|image\/jpeg|image\/webp)$/i.test(file.type)){ toast('El comprobante debe ser PDF o imagen.'); return; }
  if(file.size > 1500000){ toast('El archivo no debe superar 1.5 MB para esta demo.'); return; }
  const contentBase64 = await readFileAsBase64(file);
  try{
    await api(`/transactions/${transactionId}/voucher`, {
      method:'POST',
      body: JSON.stringify({
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
        contentBase64,
        userEmail: user.email
      })
    });
    await loadData();
    state.vaultResults = state.transactions;
    renderAll();
    toast('Comprobante enviado a validación.');
  } catch(error){
    toast(error.message);
  }
}

function readFileAsBase64(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.readAsDataURL(file);
  });
}

async function consulta(event){
  event.preventDefault();
  clearInvalid(event.target);
  if(!validateContact()) return;
  try{
    await api('/queries', {
      method:'POST',
      body: JSON.stringify({
        name: textValue('consultaNombre'),
        phone: textValue('consultaTelefono'),
        email: textValue('consultaCorreo').toLowerCase(),
        subject: textValue('consultaAsunto'),
        message: textValue('consultaMensaje')
      })
    });
    event.target.reset();
    event.target.classList.remove('was-validated');
    await loadData();
    renderAdmin();
    toast('Consulta enviada correctamente.');
  } catch(error){
    toast(error.message);
  }
}

function estadoBadge(status){
  if(status === 'Entregado' || status === 'Respondida' || status === 'Pagado/Validado') return 'text-bg-success';
  if(status === 'En proceso' || status === 'En Revisión') return 'text-bg-info';
  if(status === 'Rechazado') return 'text-bg-danger';
  return 'text-bg-warning';
}

function orderCost(order){
  return (order.items || []).reduce((sum, item) => sum + Number(item.costoCompra || 0) * Number(item.cantidad || 0), 0);
}

function orderSubtotal(order){
  return roundCurrency((order.items || []).reduce((sum, item) => sum + Number(item.precio || 0) * Number(item.cantidad || 0), 0));
}

function orderTaxView(order){
  const subtotal = orderSubtotal(order);
  const total = roundCurrency(order.total || 0);
  const igv = Math.max(0, roundCurrency(total - subtotal));
  return {subtotal, igv, total};
}

function orderTotalMarkup(order){
  const tax = orderTaxView(order);
  return `
    <strong>S/ ${money(tax.total)}</strong>
    <small class="d-block text-muted">Subtotal S/ ${money(tax.subtotal)} · IGV S/ ${money(tax.igv)}</small>`;
}

function renderPedidoItems(order){
  return (order.items || []).map(item => `${escapeHTML(item.nombre)} <span class="text-muted">x${item.cantidad} ${escapeHTML(item.unidad || '')}</span>`).join('<br>') || '<span class="text-muted">Sin detalle</span>';
}

function renderPedidosRows(orders){
  return orders.map(order => `
    <tr>
      <td><strong>#${order.id}</strong><br><small class="text-muted">${escapeHTML(order.fecha)}</small></td>
      <td>${escapeHTML(order.nombre)}<br><small class="text-muted">${escapeHTML(order.cliente)}</small></td>
      <td>${renderPedidoItems(order)}</td>
      <td>${orderTotalMarkup(order)}</td>
      <td>
        <div class="mb-2"><span class="badge ${estadoBadge(order.estadoPago || order.paymentStatus || 'Pendiente')}">${escapeHTML(order.estadoPago || order.paymentStatus || 'Pendiente')}</span></div>
        <select class="form-select form-select-sm" aria-label="Cambiar estado del pedido ${order.id}" onchange="cambiarEstadoPedido(${order.id},this.value)">
          <option ${order.status === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
          <option ${order.status === 'En proceso' ? 'selected' : ''}>En proceso</option>
          <option ${order.status === 'Entregado' ? 'selected' : ''}>Entregado</option>
        </select>
      </td>
    </tr>`).join('');
}

function renderVentasRows(orders){
  return orders.map(order => {
    const cost = orderCost(order);
    const tax = orderTaxView(order);
    const profit = tax.subtotal - cost;
    return `
      <tr>
        <td><strong>#${order.id}</strong><br><small class="text-muted">${escapeHTML(order.fecha)}</small></td>
        <td>${escapeHTML(order.nombre)}<br><small class="text-muted">${escapeHTML(order.cliente)}</small></td>
        <td>${renderPedidoItems(order)}</td>
        <td>${orderTotalMarkup(order)}</td>
        <td>S/ ${money(cost)}</td>
        <td><strong class="${profit >= 0 ? 'text-success' : 'text-danger'}">S/ ${money(profit)}</strong></td>
        <td><span class="badge ${estadoBadge(order.status)}">${escapeHTML(order.status)}</span></td>
      </tr>`;
  }).join('');
}

function providerStats(){
  return state.providers.map(provider => {
    const products = state.products.filter(product => product.proveedor === provider.name);
    const stock = products.reduce((sum, product) => sum + Number(product.stock || 0), 0);
    const inventoryCost = products.reduce((sum, product) => sum + Number(product.stock || 0) * Number(product.costoCompra || 0), 0);
    return {...provider, products, stock, inventoryCost};
  });
}

function permissionCheckboxes(name, selected = [], disabled = false){
  const selectedSet = new Set(selected || []);
  return state.permissions.map(permission => `
    <label class="permission-check">
      <input class="form-check-input" type="checkbox" name="${escapeHTML(name)}" value="${escapeHTML(permission.code)}" ${selectedSet.has(permission.code) ? 'checked' : ''} ${disabled ? 'disabled' : ''}>
      <span><strong>${escapeHTML(permission.code)}</strong><small>${escapeHTML(permission.label)}</small></span>
    </label>`).join('');
}

function renderPermissionAdmin(){
  if($('permisosUsuarioNuevo')) $('permisosUsuarioNuevo').innerHTML = permissionCheckboxes('permisoNuevo', ['leer_stock','ver_transacciones']);
  if(!$('tablaUsuarios')) return;
  $('tablaUsuarios').innerHTML = state.users.map(user => `
    <tr>
      <td><strong>${escapeHTML(user.name)}</strong><br><small>${escapeHTML(user.email)} · ${escapeHTML(user.phone || '')}</small><br><span class="badge ${user.role === 'admin' ? 'text-bg-primary' : 'text-bg-secondary'}">${escapeHTML(user.role)}</span></td>
      <td><div class="permission-grid permission-grid-compact">${permissionCheckboxes(`perm-user-${user.id}`, user.permissions || [], user.role === 'admin')}</div></td>
      <td><button class="btn btn-sm btn-outline-primary" onclick="guardarPermisosUsuario(${user.id})" ${user.role === 'admin' ? 'disabled' : ''}>Guardar</button></td>
    </tr>`).join('') || '<tr><td colspan="3">No hay usuarios registrados.</td></tr>';
}

function vaultDataset(){
  return state.vaultResults || state.transactions;
}

function renderVaultWorkbench(){
  if(!$('vaultExplorer')) return;
  const transactions = vaultDataset();
  if(!state.selectedTransactionId && transactions[0]) state.selectedTransactionId = transactions[0].id;
  if(state.selectedTransactionId && !transactions.some(transaction => Number(transaction.id) === Number(state.selectedTransactionId))){
    state.selectedTransactionId = transactions[0]?.id || null;
  }
  $('vaultExplorer').innerHTML = transactions.map(transaction => `
    <button type="button" class="vault-node ${Number(transaction.id) === Number(state.selectedTransactionId) ? 'active' : ''}" onclick="seleccionarTransaccion(${transaction.id})">
      <span>${escapeHTML(transaction.ruta || transaction.logical_path || '')}</span>
      <strong>${escapeHTML(transaction.tipo || transaction.type)} #${transaction.id}</strong>
      <small>${escapeHTML(transaction.party_name || 'Sin contraparte')} · S/ ${money(transaction.total)}</small>
    </button>`).join('') || '<p class="text-muted small">No hay transacciones para los filtros aplicados.</p>';
  renderVaultDetail();
  renderVaultChat();
}

function selectedTransaction(){
  return vaultDataset().find(transaction => Number(transaction.id) === Number(state.selectedTransactionId))
    || state.transactions.find(transaction => Number(transaction.id) === Number(state.selectedTransactionId));
}

function findVaultDocument(transactionId, documentId){
  const transaction = vaultDataset().find(item => Number(item.id) === Number(transactionId))
    || state.transactions.find(item => Number(item.id) === Number(transactionId));
  const document = (transaction?.documents || []).find(item => Number(item.id) === Number(documentId));
  return {transaction, document};
}

function renderVaultDocumentButton(transaction, document){
  const hasPreview = Boolean(document?.content_base64 && /^(image\/png|image\/jpeg|image\/webp|application\/pdf)$/i.test(document.mime_type || ''));
  const label = document?.kind === 'voucher' ? 'Ver comprobante' : document?.name;
  return `
    <button type="button" class="vault-file vault-file-button" onclick="verDocumentoBoveda(${Number(transaction.id)},${Number(document.id)})" ${hasPreview ? '' : 'disabled'}>
      ${escapeHTML(label || 'Adjunto')}
      <small>${escapeHTML(document?.kind || 'archivo')} · ${escapeHTML(document?.status || '')}${hasPreview ? '' : ' · sin vista previa'}</small>
    </button>`;
}

function verDocumentoBoveda(transactionId, documentId){
  const {transaction, document} = findVaultDocument(transactionId, documentId);
  if(!transaction || !document){
    toast('No se encontro el comprobante.');
    return;
  }
  if(!document.content_base64){
    toast('Este archivo no tiene contenido cargado para previsualizar.');
    return;
  }
  const mimeType = document.mime_type || 'application/octet-stream';
  const dataUrl = `data:${mimeType};base64,${document.content_base64}`;
  if($('visorDocumentoTitulo')) $('visorDocumentoTitulo').textContent = `${document.kind === 'voucher' ? 'Comprobante' : 'Archivo'} - ${document.name}`;
  if($('visorDocumentoBody')){
    $('visorDocumentoBody').innerHTML = mimeType === 'application/pdf'
      ? `<iframe class="vault-preview-frame" src="${escapeHTML(dataUrl)}" title="${escapeHTML(document.name)}"></iframe>`
      : `<img class="vault-preview-image" src="${escapeHTML(dataUrl)}" alt="${escapeHTML(document.name)}">`;
  }
  if(typeof bootstrap === 'undefined'){
    window.open(dataUrl, '_blank', 'noopener');
    return;
  }
  new bootstrap.Modal($('visorDocumentoModal')).show();
}

function renderVaultDetail(){
  if(!$('vaultDetail')) return;
  const transaction = selectedTransaction();
  if(!transaction){
    $('vaultDetail').innerHTML = '<p class="text-muted">Selecciona una transacción del explorador.</p>';
    return;
  }
  const items = transaction.metadata?.items || [];
  $('vaultDetail').innerHTML = `
    <div class="d-flex flex-wrap justify-content-between gap-2 mb-3">
      <div>
        <h3 class="h5 mb-1">${escapeHTML(transaction.tipo || transaction.type)} #${transaction.id}</h3>
        <small class="text-muted">${escapeHTML(transaction.fecha || transaction.timestamp)} · ${escapeHTML(transaction.ruta || transaction.logical_path)}</small>
      </div>
      <span class="badge ${estadoBadge(transaction.status)} align-self-start">${escapeHTML(transaction.status)}</span>
    </div>
    <div class="row g-2 mb-3">
      <div class="col-md-6"><strong>Cliente/proveedor</strong><br>${escapeHTML(transaction.party_name || 'No registrado')}</div>
      <div class="col-md-3"><strong>Total</strong><br>S/ ${money(transaction.total)}</div>
      <div class="col-md-3"><strong>Tipo</strong><br>${escapeHTML(transaction.tipo || transaction.type)}</div>
    </div>
    <h4 class="h6">Productos</h4>
    ${items.length ? `<div class="table-responsive"><table class="table table-sm"><thead><tr><th>Producto</th><th>Cantidad</th><th>Precio</th></tr></thead><tbody>${items.map(item => `<tr><td>${escapeHTML(item.name || item.nombre || item.product_name || item.sku)}</td><td>${item.quantity || item.cantidad}</td><td>S/ ${money(item.unit_price || item.precio || item.landed_cost)}</td></tr>`).join('')}</tbody></table></div>` : `<pre class="vault-json">${escapeHTML(JSON.stringify(transaction.metadata || {}, null, 2))}</pre>`}
    <h4 class="h6 mt-3">Adjuntos</h4>
    <div class="vault-files">${(transaction.documents || []).map(document => renderVaultDocumentButton(transaction, document)).join('') || '<span class="text-muted small">Sin adjuntos.</span>'}</div>`;
}

function renderVaultChat(){
  if(!$('vaultChat')) return;
  const transaction = selectedTransaction();
  if(!transaction){
    $('vaultChat').innerHTML = '<p class="text-muted">No hay conversación seleccionada.</p>';
    return;
  }
  $('vaultChat').innerHTML = `
    <div class="chat-thread">
      ${(transaction.notes || []).map(note => `
        <div class="chat-note">
          <strong>${escapeHTML(note.author_name)}</strong>
          <small>${escapeHTML(note.created_at)}</small>
          <p>${escapeHTML(note.message)}</p>
        </div>`).join('') || '<p class="small text-muted">Sin notas internas todavía.</p>'}
    </div>
    <form id="notaTransaccionForm" class="mt-3">
      <label class="form-label" for="notaTransaccionTexto">Agregar nota</label>
      <textarea class="form-control" id="notaTransaccionTexto" rows="3" required></textarea>
      <button class="btn btn-celeste btn-sm mt-2" type="submit">Enviar nota</button>
    </form>`;
  $('notaTransaccionForm')?.addEventListener('submit', agregarNotaTransaccion);
}

function renderPaymentValidation(){
  if(!$('tablaValidacionPagos')) return;
  const rows = state.transactions.filter(transaction => transaction.status === 'En Revisión');
  $('tablaValidacionPagos').innerHTML = rows.map(transaction => `
    <tr>
      <td><strong>${escapeHTML(transaction.tipo || transaction.type)} #${transaction.id}</strong><br><small>${escapeHTML(transaction.fecha || transaction.timestamp)}</small></td>
      <td>${escapeHTML(transaction.party_name || '')}<br><small>${escapeHTML(transaction.party_email || '')}</small></td>
      <td>${renderVoucherCell(transaction)}</td>
      <td>S/ ${money(transaction.total)}</td>
      <td><textarea class="form-control form-control-sm" id="nota-validacion-${transaction.id}" rows="2" placeholder="Monto incompleto, imagen borrosa, pago verificado..."></textarea></td>
      <td>
        <div class="d-flex flex-column gap-2">
          <button class="btn btn-sm btn-success" onclick="cambiarEstadoTransaccion(${transaction.id},'Pagado/Validado')">Validar</button>
          <button class="btn btn-sm btn-outline-danger" onclick="cambiarEstadoTransaccion(${transaction.id},'Rechazado')">Rechazar</button>
        </div>
      </td>
    </tr>`).join('') || '<tr><td colspan="6">No hay pagos en revisión.</td></tr>';
}

function renderVoucherCell(transaction){
  const voucherDocument = (transaction.documents || []).find(document => document.kind === 'voucher');
  if(voucherDocument) return renderVaultDocumentButton(transaction, voucherDocument);
  if(transaction.voucher) return `${escapeHTML(transaction.voucher.stored_name)}<br><small>${escapeHTML(transaction.voucher.mime_type)}</small>`;
  return '<span class="text-muted">Sin voucher</span>';
}

function seleccionarTransaccion(id){
  state.selectedTransactionId = id;
  renderVaultWorkbench();
}

async function buscarBoveda(event){
  event.preventDefault();
  const params = new URLSearchParams();
  if(textValue('vaultFechaDesde')) params.set('dateFrom', textValue('vaultFechaDesde'));
  if(textValue('vaultFechaHasta')) params.set('dateTo', textValue('vaultFechaHasta'));
  if(textValue('vaultTipo')) params.set('type', textValue('vaultTipo'));
  if(textValue('vaultEstado')) params.set('status', textValue('vaultEstado'));
  if(textValue('vaultAtributo')) params.set('attributeValue', textValue('vaultAtributo'));
  if(textValue('vaultBusqueda')) params.set('q', textValue('vaultBusqueda'));
  try{
    const result = await api(`/vault/search?${params.toString()}`);
    state.vaultResults = result.results || [];
    state.selectedTransactionId = state.vaultResults[0]?.id || null;
    renderVaultWorkbench();
  } catch(error){
    toast(error.message);
  }
}

async function agregarNotaTransaccion(event){
  event.preventDefault();
  const transaction = selectedTransaction();
  const user = currentUser();
  if(!transaction || !user) return;
  try{
    await api(`/transactions/${transaction.id}/notes`, {
      method:'POST',
      body: JSON.stringify({
        authorName: user.name,
        authorEmail: user.email,
        message: textValue('notaTransaccionTexto')
      })
    });
    await loadData();
    state.vaultResults = state.transactions;
    renderVaultWorkbench();
    renderPaymentValidation();
  } catch(error){
    toast(error.message);
  }
}

async function cambiarEstadoTransaccion(id, status){
  const user = currentUser();
  const note = textValue(`nota-validacion-${id}`);
  try{
    await api(`/transactions/${id}/status`, {
      method:'PATCH',
      body: JSON.stringify({
        status,
        note,
        authorName: user?.name || 'Sistema',
        authorEmail: user?.email || ''
      })
    });
    await loadData();
    state.vaultResults = state.transactions;
    state.selectedTransactionId = id;
    renderAll();
    toast(`Pago actualizado a ${status}.`);
  } catch(error){
    toast(error.message);
  }
}

async function crearUsuarioOperativo(event){
  event.preventDefault();
  const permissions = [...document.querySelectorAll('input[name="permisoNuevo"]:checked')].map(input => input.value);
  if(textValue('permisoNombre').length < 3) return fail('Ingresa el nombre del usuario.', 'permisoNombre');
  if(!isEmail(textValue('permisoCorreo'))) return fail('Ingresa un correo válido.', 'permisoCorreo');
  if(!isPhone(textValue('permisoTelefono'))) return fail('Ingresa un teléfono válido.', 'permisoTelefono');
  if(textValue('permisoClave').length < 6) return fail('La contraseña debe tener al menos 6 caracteres.', 'permisoClave');
  try{
    await api('/auth/users', {
      method:'POST',
      body: JSON.stringify({
        name: textValue('permisoNombre'),
        email: textValue('permisoCorreo').toLowerCase(),
        phone: textValue('permisoTelefono'),
        password: textValue('permisoClave'),
        role: 'operador',
        permissions
      })
    });
    event.target.reset();
    await loadData();
    renderAdmin();
    toast('Usuario creado con permisos personalizados.');
  } catch(error){
    toast(error.message);
  }
}

async function guardarPermisosUsuario(id){
  const permissions = [...document.querySelectorAll(`input[name="perm-user-${id}"]:checked`)].map(input => input.value);
  try{
    await api(`/auth/users/${id}/permissions`, {
      method:'PATCH',
      body: JSON.stringify({permissions})
    });
    await loadData();
    renderAdmin();
    toast('Permisos actualizados.');
  } catch(error){
    toast(error.message);
  }
}

function renderProveedorCompraOptions(){
  const providerSelect = $('compraProveedor');
  const productSelect = $('compraProducto');
  if(!providerSelect || !productSelect) return;
  const selectedProvider = providerSelect.value;
  providerSelect.innerHTML = state.providers.map(provider => `<option value="${escapeHTML(provider.name)}">${escapeHTML(provider.name)}</option>`).join('');
  if(selectedProvider && state.providers.some(provider => provider.name === selectedProvider)) providerSelect.value = selectedProvider;
  const providerName = providerSelect.value || state.providers[0]?.name || '';
  const products = state.products.filter(product => product.proveedor === providerName);
  const selectedProduct = productSelect.value;
  productSelect.innerHTML = products.map(product => `<option value="${product.id}">${escapeHTML(product.sku)} - ${escapeHTML(product.nombre)}</option>`).join('');
  if(selectedProduct && products.some(product => String(product.id) === selectedProduct)) productSelect.value = selectedProduct;
  actualizarCostoCompraFormulario();
}

function actualizarCostoCompraFormulario(){
  const product = state.products.find(item => String(item.id) === $('compraProducto')?.value);
  if(!product) return;
  const quantity = Math.max(1, numberValue('compraCantidad') || 1);
  if($('compraCosto')) $('compraCosto').value = money(product.costoCompra);
  if($('compraBase')) $('compraBase').value = money(Number(product.costoCompra || 0) * quantity);
  if($('compraFlete') && !$('compraFlete').value) $('compraFlete').value = '0';
  if($('compraImpuestos') && !$('compraImpuestos').value) $('compraImpuestos').value = '0';
  if($('compraUnidad')) $('compraUnidad').textContent = product.unidad;
  actualizarLandedCompra();
}

function actualizarLandedCompra(){
  if(!$('compraLandedCost')) return;
  const quantity = Math.max(1, numberValue('compraCantidad') || 1);
  $('compraLandedCost').value = `S/ ${money(landedCost(numberValue('compraBase'), numberValue('compraFlete'), numberValue('compraImpuestos'), quantity))}`;
}

function actualizarLandedProducto(){
  if(!$('adminLandedPreview')) return;
  const unitCost = landedCost(
    numberValue('adminCostoProducto'),
    numberValue('adminFleteProducto'),
    numberValue('adminImpuestosProducto'),
    numberValue('adminUnidadesCosteoProducto') || 1
  );
  const rop = reorderPoint(numberValue('adminConsumoDiarioProducto'), numberValue('adminLeadTimeProducto'), numberValue('adminStockSeguridadProducto'));
  $('adminLandedPreview').value = `S/ ${money(unitCost)} · ROP ${rop}`;
}

async function registrarCompraProveedor(event){
  event.preventDefault();
  clearInvalid(event.target);
  if(!validatePurchaseForm()) return;
  try{
    await api('/purchases', {
      method:'POST',
      body: JSON.stringify({
        productId: Number(textValue('compraProducto')),
        quantity: Number(textValue('compraCantidad')),
        baseCost: $('compraBase') ? Number(textValue('compraBase')) : Number(textValue('compraCosto')) * Number(textValue('compraCantidad')),
        freightCost: numberValue('compraFlete'),
        taxCost: numberValue('compraImpuestos'),
        landedUnits: Number(textValue('compraCantidad')),
        note: textValue('compraNota')
      })
    });
    event.target.reset();
    await loadData();
    renderAll();
    toast('Compra registrada e inventario actualizado.');
  } catch(error){
    toast(error.message);
  }
}

function renderAdmin(){
  if(!$('adminBloqueado') || !$('adminContenido')) return;
  $('adminBloqueado').classList.toggle('d-none', isAdmin());
  $('adminContenido').classList.toggle('d-none', !isAdmin());
  if(!isAdmin()) return;

  const pendingOrders = state.orders.filter(order => order.status === 'Pendiente');
  const pendingQueries = state.queries.filter(query => query.estado === 'Pendiente');
  const stockTotal = state.products.reduce((sum, product) => sum + Number(product.stock || 0), 0);
  const sales = state.orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const salesSubtotal = state.orders.reduce((sum, order) => sum + orderSubtotal(order), 0);
  const salesCost = state.orders.reduce((sum, order) => sum + orderCost(order), 0);
  const profit = salesSubtotal - salesCost;
  const purchaseTotal = state.purchases.reduce((sum, purchase) => sum + Number(purchase.total || 0), 0);
  const units = state.orders.reduce((sum, order) => sum + (order.items || []).reduce((subtotal, item) => subtotal + item.cantidad, 0), 0);
  const clients = state.users.filter(user => user.role === 'cliente');

  if($('tablaProductosAdmin')) $('tablaProductosAdmin').innerHTML = state.products.map(product => `
    <tr class="${product.alertaReorden ? 'table-warning' : ''}">
      <td><strong>${escapeHTML(product.sku)} - ${escapeHTML(product.nombre)}</strong><br><small class="text-muted">${escapeHTML(product.detalle)}</small></td>
      <td>${escapeHTML(product.unidad)}</td>
      <td>${escapeHTML(product.proveedor)}</td>
      <td>${product.stock} ${escapeHTML(product.unidad || '')}</td>
      <td>S/ ${money(product.landedCost || product.costoCompra)}</td>
      <td>S/ ${money(product.precio)}</td>
      <td><strong>${product.puntoReorden}</strong><br><small class="text-muted">${product.consumoDiario}/día · LT ${product.leadTime} · SS ${product.stockSeguridad}</small></td>
      <td><span class="badge ${product.alertaReorden ? 'text-bg-warning' : 'text-bg-success'}">${product.alertaReorden ? 'Reordenar' : 'Disponible'}</span></td>
      <td><button class="btn btn-sm btn-outline-primary" type="button" onclick="abrirEditorInventario(${product.id})">Editar</button></td>
    </tr>`).join('');

  const sortedOrders = [...state.orders].sort((a, b) => (a.status === 'Pendiente' ? -1 : 1) - (b.status === 'Pendiente' ? -1 : 1));
  if($('tablaPedidos')) $('tablaPedidos').innerHTML = renderPedidosRows(sortedOrders) || '<tr><td colspan="5">No hay pedidos registrados.</td></tr>';
  if($('tablaPedidosPendientes')) $('tablaPedidosPendientes').innerHTML = renderPedidosRows(pendingOrders) || '<tr><td colspan="5">No hay pedidos pendientes.</td></tr>';
  if($('tablaVentas')) $('tablaVentas').innerHTML = renderVentasRows(state.orders) || '<tr><td colspan="7">No hay ventas registradas.</td></tr>';
  if($('tablaUsuarios')) $('tablaUsuarios').innerHTML = state.users.map(user => `<tr><td>${escapeHTML(user.name)}</td><td>${escapeHTML(user.email)}</td><td>${escapeHTML(user.phone)}</td><td><span class="badge ${user.role === 'admin' ? 'text-bg-primary' : 'text-bg-secondary'}">${escapeHTML(user.role)}</span></td></tr>`).join('');
  if($('tablaClientes')) $('tablaClientes').innerHTML = clients.map(client => {
    const orders = state.orders.filter(order => order.cliente === client.email);
    const total = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const lastOrder = orders[0];
    return `<tr><td>${escapeHTML(client.name)}</td><td>${escapeHTML(client.email)}</td><td>${escapeHTML(client.phone)}</td><td>${orders.length}</td><td>S/ ${money(total)}</td><td>${lastOrder ? escapeHTML(lastOrder.fecha) : 'Sin compras'}</td></tr>`;
  }).join('') || '<tr><td colspan="6">No hay clientes registrados.</td></tr>';
  if($('tablaProveedores')) $('tablaProveedores').innerHTML = providerStats().map(provider => `
    <tr>
      <td><strong>${escapeHTML(provider.name)}</strong><br><small class="text-muted">${escapeHTML(provider.description)}</small></td>
      <td>${provider.products.length}</td>
      <td>${provider.stock}</td>
      <td>S/ ${money(provider.inventoryCost)}</td>
      <td>${escapeHTML(provider.product_lines)}</td>
    </tr>`).join('');
  if($('tablaComprasProveedor')) $('tablaComprasProveedor').innerHTML = state.purchases.map(purchase => `
    <tr>
      <td><strong>#${purchase.id}</strong><br><small class="text-muted">${escapeHTML(purchase.fecha)}</small></td>
      <td>${escapeHTML(purchase.proveedor)}</td>
      <td>${escapeHTML(purchase.sku)} - ${escapeHTML(purchase.nombre)}</td>
      <td>${purchase.cantidad} ${escapeHTML(purchase.unidad)}</td>
      <td>S/ ${money(purchase.costoUnitario)}</td>
      <td>S/ ${money(purchase.total)}</td>
    </tr>`).join('') || '<tr><td colspan="6">No hay compras registradas.</td></tr>';
  if($('listaConsultasAdmin')) $('listaConsultasAdmin').innerHTML = state.queries.map(query => `
    <div class="card mb-2 admin-message ${query.estado === 'Pendiente' ? 'admin-message-pending' : ''}">
      <div class="card-body">
        <div class="d-flex flex-wrap justify-content-between gap-2 mb-2">
          <h6 class="mb-0">${escapeHTML(query.asunto)}</h6>
          <span class="badge ${estadoBadge(query.estado)}">${escapeHTML(query.estado)}</span>
        </div>
        <p class="mb-1"><strong>${escapeHTML(query.nombre)}</strong> - ${escapeHTML(query.correo)} - ${escapeHTML(query.telefono)}</p>
        <p>${escapeHTML(query.mensaje)}</p>
        <small class="text-muted">${escapeHTML(query.fecha)}</small>
        <div class="mt-3"><button class="btn btn-sm btn-outline-primary" onclick="responderConsulta(${query.id})" aria-label="Marcar como respondida la consulta ${query.id}">Marcar respondida</button></div>
      </div>
    </div>`).join('') || '<p class="text-muted">No hay mensajes de contacto.</p>';

  if($('reportesAdmin')) $('reportesAdmin').innerHTML = `
    <div class="col-sm-6 col-xl-3"><div class="mini-card admin-metric"><strong>Productos</strong><h3>${state.products.length}</h3><small>Stock total: ${stockTotal}</small></div></div>
    <div class="col-sm-6 col-xl-3"><div class="mini-card admin-metric"><strong>Pedidos pendientes</strong><h3>${pendingOrders.length}</h3><small>Pedidos totales: ${state.orders.length}</small></div></div>
    <div class="col-sm-6 col-xl-3"><div class="mini-card admin-metric"><strong>Compras</strong><h3>S/ ${money(purchaseTotal)}</h3><small>${state.purchases.length} ingresos a inventario</small></div></div>
    <div class="col-sm-6 col-xl-3"><div class="mini-card admin-metric"><strong>Utilidad</strong><h3>S/ ${money(profit)}</h3><small>Ventas con IGV: S/ ${money(sales)} · Unidades: ${units}</small></div></div>`;
  if($('adminSubmetricas')) $('adminSubmetricas').innerHTML = `
    <div class="col-md-4"><div class="alert alert-light border h-100"><strong>Clientes registrados</strong><br><span class="fs-4">${clients.length}</span></div></div>
    <div class="col-md-4"><div class="alert alert-light border h-100"><strong>Mensajes nuevos</strong><br><span class="fs-4">${pendingQueries.length}</span></div></div>
    <div class="col-md-4"><div class="alert alert-light border h-100"><strong>Costo de ventas</strong><br><span class="fs-4">S/ ${money(salesCost)}</span></div></div>`;
  renderProveedorCompraOptions();
  renderPermissionAdmin();
  renderVaultWorkbench();
  renderPaymentValidation();
  actualizarLandedProducto();
}

async function cambiarEstadoPedido(id, status){
  try{
    await api(`/orders/${id}/status`, {method:'PATCH', body: JSON.stringify({status})});
    await loadData();
    renderAll();
  } catch(error){
    toast(error.message);
  }
}

async function responderConsulta(id){
  try{
    await api(`/queries/${id}/respond`, {method:'PATCH', body: JSON.stringify({})});
    await loadData();
    renderAdmin();
  } catch(error){
    toast(error.message);
  }
}

function setEditValue(id, value){
  if($(id)) $(id).value = value ?? '';
}

function actualizarPreviewEditorInventario(){
  if(!$('editLandedPreview')) return;
  const unitCost = landedCost(
    numberValue('editCompraBase'),
    numberValue('editFlete'),
    numberValue('editImpuestos'),
    numberValue('editUnidadesCosteo') || 1
  );
  const recommendedRop = reorderPoint(numberValue('editConsumoDiario'), numberValue('editLeadTime'), numberValue('editStockSeguridad'));
  $('editLandedPreview').value = `S/ ${money(unitCost)} · ROP recomendado ${recommendedRop}`;
  if($('editImagenPreview')) $('editImagenPreview').src = imageSrc(textValue('editImagen'));
}

function usarRopRecomendado(){
  if(!$('editPuntoReorden')) return;
  $('editPuntoReorden').value = reorderPoint(numberValue('editConsumoDiario'), numberValue('editLeadTime'), numberValue('editStockSeguridad'));
  actualizarPreviewEditorInventario();
}

function abrirEditorInventario(id){
  const product = state.products.find(item => Number(item.id) === Number(id));
  if(!product){
    toast('Producto no encontrado.');
    return;
  }
  clearInvalid($('inventarioEditorForm'));
  setEditValue('editProductoId', product.id);
  setEditValue('editIdInterno', product.id);
  setEditValue('editSku', product.sku);
  setEditValue('editNombre', product.nombre);
  setEditValue('editUnidad', product.unidad);
  setEditValue('editProveedor', product.proveedor);
  setEditValue('editCategoria', product.categoria);
  setEditValue('editMaterial', product.material);
  setEditValue('editCompraBase', money(product.precioCompraBase ?? product.costoCompra));
  setEditValue('editFlete', money(product.flete));
  setEditValue('editImpuestos', money(product.impuestos));
  setEditValue('editUnidadesCosteo', product.unidadesCosteo || 1);
  setEditValue('editPrecioVenta', money(product.precio));
  setEditValue('editStock', product.stock);
  setEditValue('editConsumoDiario', product.consumoDiario ?? 0);
  setEditValue('editLeadTime', product.leadTime ?? 0);
  setEditValue('editStockSeguridad', product.stockSeguridad ?? 0);
  setEditValue('editPuntoReorden', product.puntoReorden ?? 0);
  setEditValue('editImagen', product.img || '');
  setEditValue('editDetalle', product.detalle || '');
  actualizarPreviewEditorInventario();
  if(typeof bootstrap === 'undefined'){
    toast('Bootstrap no esta cargado para abrir el editor.');
    return;
  }
  new bootstrap.Modal($('inventarioEditorModal')).show();
}

function validateInventoryEditForm(){
  const sku = textValue('editSku');
  const base = numberValue('editCompraBase');
  const freight = numberValue('editFlete');
  const taxes = numberValue('editImpuestos');
  const units = numberValue('editUnidadesCosteo') || 1;
  const price = numberValue('editPrecioVenta');
  const stock = numberValue('editStock');
  const daily = numberValue('editConsumoDiario');
  const leadTime = numberValue('editLeadTime');
  const safety = numberValue('editStockSeguridad');
  const reorder = numberValue('editPuntoReorden');
  const finalCost = landedCost(base, freight, taxes, units);
  if(!/^[A-Za-z0-9-]+$/.test(sku)) return fail('El SKU solo puede usar letras, números y guiones.', 'editSku');
  if(textValue('editNombre').length < 2) return fail('Ingresa el nombre del producto.', 'editNombre');
  if(textValue('editUnidad').length < 1) return fail('Ingresa la unidad.', 'editUnidad');
  if(textValue('editProveedor').length < 2) return fail('Ingresa el proveedor.', 'editProveedor');
  if(textValue('editCategoria').length < 2) return fail('Ingresa la categoría.', 'editCategoria');
  if(textValue('editMaterial').length < 1) return fail('Ingresa el material.', 'editMaterial');
  if(base < 0) return fail('La compra base no puede ser negativa.', 'editCompraBase');
  if(freight < 0) return fail('El flete no puede ser negativo.', 'editFlete');
  if(taxes < 0) return fail('Los impuestos no pueden ser negativos.', 'editImpuestos');
  if(units <= 0) return fail('Las unidades de costeo deben ser mayores que cero.', 'editUnidadesCosteo');
  if(price <= 0) return fail('El precio de venta debe ser mayor que cero.', 'editPrecioVenta');
  if(price < finalCost) return fail('El precio de venta no debe ser menor al landed cost.', 'editPrecioVenta');
  if(stock < 0 || !Number.isInteger(stock)) return fail('El stock debe ser un entero mayor o igual a cero.', 'editStock');
  if(daily < 0) return fail('El consumo diario no puede ser negativo.', 'editConsumoDiario');
  if(leadTime < 0) return fail('El lead time no puede ser negativo.', 'editLeadTime');
  if(safety < 0) return fail('El stock de seguridad no puede ser negativo.', 'editStockSeguridad');
  if(reorder < 0 || !Number.isFinite(reorder)) return fail('El límite de inventario bajo debe ser mayor o igual a cero.', 'editPuntoReorden');
  return true;
}

async function guardarEditorInventario(event){
  event.preventDefault();
  clearInvalid(event.target);
  if(!validateInventoryEditForm()) return;
  const id = Number(textValue('editProductoId'));
  try{
    await api(`/products/${id}`, {
      method:'PATCH',
      body: JSON.stringify({
        sku: textValue('editSku'),
        nombre: textValue('editNombre'),
        unidad: textValue('editUnidad'),
        proveedor: textValue('editProveedor'),
        categoria: textValue('editCategoria'),
        material: textValue('editMaterial'),
        precioCompraBase: numberValue('editCompraBase'),
        flete: numberValue('editFlete'),
        impuestos: numberValue('editImpuestos'),
        unidadesCosteo: numberValue('editUnidadesCosteo'),
        precio: numberValue('editPrecioVenta'),
        stock: numberValue('editStock'),
        consumoDiario: numberValue('editConsumoDiario'),
        leadTime: numberValue('editLeadTime'),
        stockSeguridad: numberValue('editStockSeguridad'),
        puntoReorden: numberValue('editPuntoReorden'),
        img: textValue('editImagen'),
        detalle: textValue('editDetalle')
      })
    });
    await loadData();
    renderAll();
    closeModal('inventarioEditorModal');
    toast('Producto actualizado correctamente.');
  } catch(error){
    toast(error.message);
  }
}

async function agregarProductoAdmin(event){
  event.preventDefault();
  clearInvalid(event.target);
  if(!validateProductForm()) return;
  try{
    await api('/products', {
      method:'POST',
      body: JSON.stringify({
        sku: textValue('adminSkuProducto') || String(Date.now()).slice(-6),
        nombre: textValue('adminNombreProducto'),
        unidad: textValue('adminUnidadProducto'),
        proveedor: textValue('adminProveedorProducto'),
        categoria: textValue('adminCategoriaProducto'),
        material: textValue('adminMaterialProducto'),
        precioCompraBase: numberValue('adminCostoProducto'),
        flete: numberValue('adminFleteProducto'),
        impuestos: numberValue('adminImpuestosProducto'),
        unidadesCosteo: numberValue('adminUnidadesCosteoProducto'),
        precio: numberValue('adminPrecioProducto'),
        stock: numberValue('adminStockProducto'),
        consumoDiario: numberValue('adminConsumoDiarioProducto'),
        leadTime: numberValue('adminLeadTimeProducto'),
        stockSeguridad: numberValue('adminStockSeguridadProducto'),
        img: textValue('adminImagenProducto'),
        detalle: textValue('adminDetalleProducto')
      })
    });
    event.target.reset();
    actualizarLandedProducto();
    await loadData();
    renderAll();
    toast('Producto agregado correctamente.');
  } catch(error){
    toast(error.message);
  }
}

function renderAll(){
  updateSessionUI();
  renderFilters();
  renderProducts();
  renderCart();
  renderProveedores();
  renderFaq();
  renderPerfil();
  renderAdmin();
}

function setupTabFallback(){
  if(typeof bootstrap !== 'undefined') return;
  document.querySelectorAll('[data-bs-toggle="tab"]').forEach(button => {
    button.addEventListener('click', event => {
      event.preventDefault();
      const targetSelector = button.getAttribute('data-bs-target');
      const target = targetSelector ? document.querySelector(targetSelector) : null;
      if(!target) return;
      const tabList = button.closest('.nav-tabs');
      tabList?.querySelectorAll('.nav-link').forEach(tab => tab.classList.remove('active'));
      button.classList.add('active');
      const container = target.closest('.tab-content');
      container?.querySelectorAll('.tab-pane').forEach(panel => panel.classList.remove('show','active'));
      target.classList.add('show','active');
    });
  });
}

window.addEventListener('DOMContentLoaded', async () => {
  try{
    await loadData();
    renderAll();
  } catch(error){
    toast(error.message);
  }

  ['buscarProducto','filtroCategoria','filtroMarca','filtroMaterial','filtroPrecio'].forEach(id => {
    if($(id)) $(id).addEventListener('input', renderProducts);
  });
  if($('buscarFaq')) $('buscarFaq').addEventListener('input', renderFaq);
  setupTabFallback();
  if($('registroForm')) $('registroForm').addEventListener('submit', registro);
  if($('loginForm')) $('loginForm').addEventListener('submit', login);
  document.querySelectorAll('#btnCerrarSesion').forEach(button => button.addEventListener('click', logout));
  if($('btnConfirmarPedido')) $('btnConfirmarPedido').addEventListener('click', confirmarPedido);
  if($('consultaForm')) $('consultaForm').addEventListener('submit', consulta);
  if($('productoAdminForm')) $('productoAdminForm').addEventListener('submit', agregarProductoAdmin);
  if($('inventarioEditorForm')) $('inventarioEditorForm').addEventListener('submit', guardarEditorInventario);
  if($('proveedorCompraForm')) $('proveedorCompraForm').addEventListener('submit', registrarCompraProveedor);
  if($('usuarioPermisosForm')) $('usuarioPermisosForm').addEventListener('submit', crearUsuarioOperativo);
  if($('bovedaFiltroForm')) $('bovedaFiltroForm').addEventListener('submit', buscarBoveda);
  if($('compraProveedor')) $('compraProveedor').addEventListener('change', renderProveedorCompraOptions);
  if($('compraProducto')) $('compraProducto').addEventListener('change', actualizarCostoCompraFormulario);
  ['compraCantidad','compraBase','compraFlete','compraImpuestos'].forEach(id => {
    if($(id)) $(id).addEventListener('input', () => {
      if(id === 'compraCantidad') actualizarCostoCompraFormulario();
      else actualizarLandedCompra();
    });
  });
  ['adminCostoProducto','adminFleteProducto','adminImpuestosProducto','adminUnidadesCosteoProducto','adminConsumoDiarioProducto','adminLeadTimeProducto','adminStockSeguridadProducto'].forEach(id => {
    if($(id)) $(id).addEventListener('input', actualizarLandedProducto);
  });
  ['editCompraBase','editFlete','editImpuestos','editUnidadesCosteo','editConsumoDiario','editLeadTime','editStockSeguridad','editImagen'].forEach(id => {
    if($(id)) $(id).addEventListener('input', actualizarPreviewEditorInventario);
  });
});
