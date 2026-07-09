# Overflod con Node.js, Express.js y SQL Server

El backend principal es `server.js` con Node.js + Express.js, como solicita la rubrica del curso.

## Modos de base de datos

- `DB_ENGINE=local`: crea una base local JSON en `data/overflod.local.json`. Sirve para desarrollar y sustentar sin instalar SQL Server.
- `DB_ENGINE=sqlserver`: conecta el mismo sistema a Microsoft SQL Server usando el paquete `mssql`.

## Instalacion

```bash
npm install
```

## Ejecutar en Mac o Windows

```bash
npm run dev
```

La aplicacion queda en:

```text
http://127.0.0.1:5501/
```

Credenciales de administrador:

```text
admin@overflod.com
admin123
```

## Configurar SQL Server

1. Ejecuta `database/sqlserver_schema.sql` en SQL Server Management Studio o Azure Data Studio.
2. Copia `.env.example` como `.env`.
3. Cambia el motor a SQL Server y coloca tus credenciales:

```env
DB_ENGINE=sqlserver
SQLSERVER_SERVER=localhost,1433
SQLSERVER_DATABASE=Overflod
SQLSERVER_USER=sa
SQLSERVER_PASSWORD=TuPasswordSeguro
SQLSERVER_ENCRYPT=yes
SQLSERVER_TRUST_CERTIFICATE=yes
```

En Mac, SQL Server normalmente corre en Docker, Azure, una maquina Windows o un servidor remoto. En Windows puede correr localmente con SQL Server Developer/Express.

## Endpoints Express implementados

- `GET /api/bootstrap`
- `GET /api/products`
- `POST /api/products`
- `PATCH /api/products/:id`
- `GET /api/providers`
- `GET /api/users`
- `POST /api/register`
- `POST /api/login`
- `GET /api/orders`
- `POST /api/orders`
- `PATCH /api/orders/:id/status`
- `GET /api/queries`
- `POST /api/queries`
- `PATCH /api/queries/:id/respond`
- `GET /api/purchases`
- `POST /api/purchases`
- `GET /api/auth/permissions`
- `POST /api/auth/users`
- `PATCH /api/auth/users/:id/permissions`
- `GET /api/transactions`
- `GET /api/transactions/pending-validation`
- `POST /api/transactions/:id/voucher`
- `POST /api/transactions/:id/notes`
- `PATCH /api/transactions/:id/status`
- `GET /api/vault/tree`
- `GET /api/vault/search`
- `GET /api/inventory/alerts`

## Modulos ERP agregados

- `src/modules/auth`: RBAC por permisos de accion como `editar_stock`, `validar_pagos` y `gestionar_usuarios`.
- `src/modules/transactions`: transacciones universales para compras/ventas, validacion de pagos y notas internas.
- `src/modules/vault`: boveda logica con rutas `/almacen/{tipo}/{año}/{mes}/{dia}/{hora}/{id}/` y busqueda combinada.
- `src/modules/inventory`: landed cost, punto de reorden y alertas ROP.
