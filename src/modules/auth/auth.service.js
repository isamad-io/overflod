const PERMISSION_DEFINITIONS = [
  {
    code: 'leer_stock',
    label: 'Ver stock',
    description: 'Consultar inventario, existencias y alertas ROP.',
    group: 'Inventario'
  },
  {
    code: 'editar_stock',
    label: 'Editar stock',
    description: 'Actualizar productos, costos, entradas y salidas de almacen.',
    group: 'Inventario'
  },
  {
    code: 'ver_costos',
    label: 'Ver costos',
    description: 'Revisar costos de compra, landed cost y margen operativo.',
    group: 'Inventario'
  },
  {
    code: 'validar_pagos',
    label: 'Validar pagos',
    description: 'Aprobar o rechazar vouchers de compras pendientes.',
    group: 'Transacciones'
  },
  {
    code: 'ver_transacciones',
    label: 'Ver transacciones',
    description: 'Consultar compras, ventas y sus estados.',
    group: 'Transacciones'
  },
  {
    code: 'crear_orden',
    label: 'Crear ordenes',
    description: 'Registrar pedidos como cliente o vendedor.',
    group: 'Transacciones'
  },
  {
    code: 'buscar_documentos',
    label: 'Buscar documentos',
    description: 'Usar filtros avanzados en la boveda documental.',
    group: 'Boveda'
  },
  {
    code: 'gestionar_boveda',
    label: 'Gestionar boveda',
    description: 'Registrar evidencias, comprobantes y logs documentales.',
    group: 'Boveda'
  },
  {
    code: 'gestionar_usuarios',
    label: 'Gestionar usuarios',
    description: 'Crear usuarios operativos y asignar permisos por accion.',
    group: 'Identidad'
  }
];

const ROLE_PROFILES = [
  {
    code: 'admin',
    name: 'Administrador general',
    description: 'Perfil inicial con todos los permisos activos.',
    permissions: PERMISSION_DEFINITIONS.map(permission => permission.code)
  },
  {
    code: 'transacciones',
    name: 'Encargado de transacciones',
    description: 'Valida pagos, conversa con clientes y revisa la boveda.',
    permissions: ['validar_pagos', 'ver_transacciones', 'ver_costos', 'buscar_documentos', 'gestionar_boveda']
  },
  {
    code: 'retail_stock',
    name: 'Encargado de retail stock',
    description: 'Mantiene productos, stock y puntos de reorden.',
    permissions: ['leer_stock', 'editar_stock']
  },
  {
    code: 'cliente',
    name: 'Cliente',
    description: 'Puede crear ordenes y cargar comprobantes de pago.',
    permissions: ['crear_orden']
  }
];

function permissionCodes() {
  return new Set(PERMISSION_DEFINITIONS.map(permission => permission.code));
}

function normalizePermissionCodes(codes) {
  const allowed = permissionCodes();
  return [...new Set((codes || []).map(code => String(code || '').trim()).filter(code => allowed.has(code)))];
}

function profilePermissions(profileCode) {
  const profile = ROLE_PROFILES.find(item => item.code === profileCode);
  return profile ? [...profile.permissions] : [];
}

function defaultPermissionsForRole(role) {
  if (role === 'admin') return profilePermissions('admin');
  return profilePermissions('cliente');
}

function safeUser(user, userPermissions = []) {
  if (!user) return null;
  const { password, ...safe } = user;
  const explicit = userPermissions
    .filter(item => Number(item.user_id) === Number(user.id))
    .map(item => item.permission_code || item.code)
    .filter(Boolean);
  return {
    ...safe,
    permissions: normalizePermissionCodes(explicit.length ? explicit : defaultPermissionsForRole(user.role))
  };
}

function hasPermission(user, permissionCode) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return normalizePermissionCodes(user.permissions || []).includes(permissionCode);
}

module.exports = {
  PERMISSION_DEFINITIONS,
  ROLE_PROFILES,
  defaultPermissionsForRole,
  hasPermission,
  normalizePermissionCodes,
  safeUser
};
