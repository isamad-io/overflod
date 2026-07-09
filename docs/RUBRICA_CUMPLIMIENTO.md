# Cumplimiento de Rubrica - Overflod

## 1. Analisis del problema y diseno de solucion

Evidencia:
- Emprendimiento elegido: Overflod, venta de materiales de construccion para clientes de zona.
- Usuarios definidos: cliente comprador, administrador de tienda, proveedor y visitante que solicita cotizacion.
- Flujos implementados: navegacion, catalogo, filtros, detalle, carrito, registro, login, pedido, contacto, administracion, compra a proveedor e inventario.
- Arquitectura cliente-servidor documentada en `docs/INFORME_TECNICO_OVERFLOD.md`.
- Mapa de empatia incluido en el informe tecnico.

## 2. Prototipo responsivo con HTML, CSS y Bootstrap

Evidencia:
- Vistas HTML: `index.html`, `catalogo.html`, `nosotros.html`, `contacto.html`, `faq.html`, `IniciarSesion.html`, `admin.html`.
- CSS modular: `public/css/styles.css`.
- Bootstrap 5 integrado en todas las vistas.
- Diseno responsivo con grillas Bootstrap, navbar colapsable y media queries.
- Catalogo con productos, imagenes, filtros y tarjetas responsivas.

## 3. Interactividad con JavaScript

Mas de 10 funcionalidades interactivas:
1. Busqueda de productos.
2. Filtro por categoria.
3. Filtro por marca/proveedor.
4. Filtro por material.
5. Filtro por precio maximo.
6. Modal de detalle de producto.
7. Carrito de compras.
8. Cambio de cantidad en carrito.
9. Eliminacion de productos del carrito.
10. Registro de usuario.
11. Inicio y cierre de sesion.
12. Confirmacion de pedido.
13. Formulario de contacto.
14. Busqueda de preguntas frecuentes.
15. Panel administrador con tabs.
16. Edicion de stock/costo/precio.
17. Registro de compras a proveedor.
18. Cambio de estado de pedidos.
19. Marcado de mensajes como respondidos.
20. Reportes de ventas, utilidad, clientes y alertas.

Codigo: `public/js/catalago.js`.

## 4. Back-end con Node.js y Express.js

Evidencia:
- Servidor principal: `server.js`.
- Framework: Express.js.
- Rutas GET, POST y PATCH implementadas para productos, proveedores, usuarios, login, pedidos, mensajes y compras.
- Procesamiento y validacion de formularios en backend.
- Modo local de demostracion: `DB_ENGINE=local`.
- Modo SQL Server: `DB_ENGINE=sqlserver` con paquete `mssql`.
- Script SQL Server: `database/sqlserver_schema.sql`.

## 5. Accesibilidad y buenas practicas

Evidencia:
- HTML semantico con `nav`, `header`, `main`, `section`, `footer`.
- Enlace "Saltar al contenido principal".
- Botones de navegacion, carrito, usuario y cierre con `aria-label`.
- Modales y offcanvas con `aria-labelledby`.
- Regiones dinamicas con `aria-live`.
- Labels asociados a inputs mediante `for`.
- Contraste reforzado y foco visible en CSS.
- Validaciones en cliente y servidor.
- Respuestas JSON uniformes: `{ ok: true }` o `{ ok: false, error }`.
- Validacion Lighthouse en `catalogo.html`: accesibilidad 96/100.

## 6. Informe tecnico y documentacion

Evidencia:
- Informe tecnico: `docs/INFORME_TECNICO_OVERFLOD.md`.
- Guia de sustentacion: `docs/GUIA_SUSTENTACION.md`.
- Guia SQL Server: `README_SQL_SERVER.md`.

## 7. Sustentacion oral

Evidencia:
- Guion de 12 a 15 minutos en `docs/GUIA_SUSTENTACION.md`.
- Demostracion en vivo sugerida: inicio, catalogo, registro/login, carrito, contacto, admin, inventario, pedidos, compras y SQL Server.
