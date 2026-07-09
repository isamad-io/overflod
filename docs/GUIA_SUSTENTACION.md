# Guia de Sustentacion Oral - Overflod

Duracion objetivo: 12 a 15 minutos.

## 1. Introduccion - 2 a 3 minutos

Presentar:
- Emprendimiento elegido: Overflod, materiales de construccion.
- Problema: falta de canal digital para consultar productos, hacer pedidos y controlar inventario.
- Comunidad objetivo: clientes de obra, familias, maestros de construccion y administradores del negocio.
- Objetivo: implementar una aplicacion web responsiva, accesible y conectada a backend.

Frase sugerida:

> Nuestro proyecto digitaliza el proceso de venta y gestion de Overflod: el cliente encuentra productos y confirma pedidos, mientras el administrador controla inventario, proveedores, ventas, clientes y mensajes.

## 2. Demostracion tecnica - 7 a 8 minutos

Orden recomendado:

1. Abrir `http://127.0.0.1:5501/`.
2. Mostrar pagina de inicio y navegacion responsiva.
3. Entrar al catalogo.
4. Usar busqueda y filtros.
5. Abrir detalle de producto.
6. Agregar producto al carrito.
7. Crear cuenta o iniciar sesion.
8. Confirmar pedido.
9. Enviar mensaje desde contacto.
10. Ingresar como administrador:
   - Correo: `admin@overflod.com`
   - Clave: `admin123`
11. Mostrar resumen general.
12. Editar stock/costo/precio.
13. Registrar compra a proveedor.
14. Cambiar estado de pedido.
15. Marcar mensaje como respondido.
16. Mostrar clientes y ventas.

Codigo a mencionar:
- `server.js`: servidor Node.js + Express.js.
- `public/js/catalago.js`: interactividad y consumo API.
- `public/css/styles.css`: estilos y responsividad.
- `database/sqlserver_schema.sql`: estructura SQL Server.

## 3. Validacion y conclusiones - 3 a 4 minutos

Explicar:
- Validaciones en formularios: correo, telefono, contrasena, cantidades, precios y stock.
- Accesibilidad: labels, aria-labels, aria-live, foco visible y texto alternativo.
- Buenas practicas: rutas API organizadas, respuestas JSON uniformes y separacion front-end/back-end.
- Impacto social: el emprendimiento puede vender y atender consultas con mayor orden.

## Preguntas probables y respuestas

### Por que Node.js y Express.js?

Porque la rubrica pide back-end con Node.js y Express.js. Express permite definir rutas API claras para productos, usuarios, pedidos, consultas y compras.

### Por que hay modo local y modo SQL Server?

El modo local permite sustentar el proyecto sin instalar SQL Server. El modo SQL Server permite usar una base real en Windows, Mac con servidor remoto/Docker o un entorno institucional.

### Que validaciones tiene?

Valida email, telefono, contrasena, stock entero, cantidades positivas, precio mayor que cero, costo no negativo, precio de venta mayor o igual al costo, estados permitidos y duplicidad de correo/producto.

### Que procesos del emprendimiento sistematiza?

Catalogo, pedidos, clientes, mensajes de contacto, inventario, compras a proveedores, ventas y utilidad.

### Que mejoras futuras harian?

Hash de contrasenas, reportes PDF/Excel, pasarela de pagos, correos automaticos y dashboard grafico.
