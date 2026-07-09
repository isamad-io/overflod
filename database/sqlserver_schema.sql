IF DB_ID(N'Overflod') IS NULL
BEGIN
    CREATE DATABASE Overflod;
END
GO

USE Overflod;
GO

IF OBJECT_ID(N'dbo.providers', N'U') IS NULL
BEGIN
CREATE TABLE dbo.providers (
    id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_providers PRIMARY KEY,
    name NVARCHAR(120) NOT NULL CONSTRAINT UQ_providers_name UNIQUE,
    description NVARCHAR(500) NOT NULL CONSTRAINT DF_providers_description DEFAULT N'',
    product_lines NVARCHAR(500) NOT NULL CONSTRAINT DF_providers_product_lines DEFAULT N''
);
END;

IF OBJECT_ID(N'dbo.products', N'U') IS NULL
BEGIN
CREATE TABLE dbo.products (
    id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_products PRIMARY KEY,
    sku NVARCHAR(20) NOT NULL CONSTRAINT UQ_products_sku UNIQUE,
    name NVARCHAR(160) NOT NULL,
    unit NVARCHAR(40) NOT NULL,
    provider_id INT NOT NULL,
    purchase_cost DECIMAL(12,2) NOT NULL,
    sale_price DECIMAL(12,2) NOT NULL,
    category NVARCHAR(80) NOT NULL,
    brand NVARCHAR(120) NOT NULL CONSTRAINT DF_products_brand DEFAULT N'',
    material NVARCHAR(100) NOT NULL CONSTRAINT DF_products_material DEFAULT N'',
    stock INT NOT NULL CONSTRAINT DF_products_stock DEFAULT 0,
    image_url NVARCHAR(800) NOT NULL CONSTRAINT DF_products_image_url DEFAULT N'',
    source_url NVARCHAR(800) NOT NULL CONSTRAINT DF_products_source_url DEFAULT N'',
    detail NVARCHAR(1000) NOT NULL CONSTRAINT DF_products_detail DEFAULT N'',
    created_at DATETIME2(0) NOT NULL,
    CONSTRAINT FK_products_providers FOREIGN KEY (provider_id) REFERENCES dbo.providers(id),
    CONSTRAINT CK_products_purchase_cost CHECK (purchase_cost >= 0),
    CONSTRAINT CK_products_sale_price CHECK (sale_price > 0),
    CONSTRAINT CK_products_stock CHECK (stock >= 0)
);
END;

IF OBJECT_ID(N'dbo.users', N'U') IS NULL
BEGIN
CREATE TABLE dbo.users (
    id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_users PRIMARY KEY,
    name NVARCHAR(120) NOT NULL,
    email NVARCHAR(160) NOT NULL CONSTRAINT UQ_users_email UNIQUE,
    phone NVARCHAR(30) NOT NULL,
    password NVARCHAR(120) NOT NULL,
    role NVARCHAR(20) NOT NULL,
    created_at DATETIME2(0) NOT NULL,
    CONSTRAINT CK_users_role CHECK (role IN (N'admin', N'cliente'))
);
END;

IF OBJECT_ID(N'dbo.orders', N'U') IS NULL
BEGIN
CREATE TABLE dbo.orders (
    id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_orders PRIMARY KEY,
    user_id INT NOT NULL,
    customer_name NVARCHAR(120) NOT NULL,
    customer_email NVARCHAR(160) NOT NULL,
    order_date DATETIME2(0) NOT NULL,
    status NVARCHAR(30) NOT NULL,
    total DECIMAL(12,2) NOT NULL,
    CONSTRAINT FK_orders_users FOREIGN KEY (user_id) REFERENCES dbo.users(id),
    CONSTRAINT CK_orders_status CHECK (status IN (N'Pendiente', N'En proceso', N'Entregado')),
    CONSTRAINT CK_orders_total CHECK (total >= 0)
);
END;

IF OBJECT_ID(N'dbo.order_items', N'U') IS NULL
BEGIN
CREATE TABLE dbo.order_items (
    id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_order_items PRIMARY KEY,
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    sku NVARCHAR(20) NOT NULL,
    name NVARCHAR(160) NOT NULL,
    unit NVARCHAR(40) NOT NULL,
    provider_name NVARCHAR(120) NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(12,2) NOT NULL,
    unit_cost DECIMAL(12,2) NOT NULL,
    CONSTRAINT FK_order_items_orders FOREIGN KEY (order_id) REFERENCES dbo.orders(id) ON DELETE CASCADE,
    CONSTRAINT FK_order_items_products FOREIGN KEY (product_id) REFERENCES dbo.products(id),
    CONSTRAINT CK_order_items_quantity CHECK (quantity > 0),
    CONSTRAINT CK_order_items_unit_price CHECK (unit_price >= 0),
    CONSTRAINT CK_order_items_unit_cost CHECK (unit_cost >= 0)
);
END;

IF OBJECT_ID(N'dbo.queries', N'U') IS NULL
BEGIN
CREATE TABLE dbo.queries (
    id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_queries PRIMARY KEY,
    name NVARCHAR(120) NOT NULL,
    email NVARCHAR(160) NOT NULL,
    phone NVARCHAR(30) NOT NULL,
    subject NVARCHAR(140) NOT NULL,
    message NVARCHAR(1200) NOT NULL,
    status NVARCHAR(30) NOT NULL,
    response NVARCHAR(1200) NOT NULL CONSTRAINT DF_queries_response DEFAULT N'',
    created_at DATETIME2(0) NOT NULL,
    CONSTRAINT CK_queries_status CHECK (status IN (N'Pendiente', N'Respondida'))
);
END;

IF OBJECT_ID(N'dbo.purchases', N'U') IS NULL
BEGIN
CREATE TABLE dbo.purchases (
    id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_purchases PRIMARY KEY,
    product_id INT NOT NULL,
    provider_id INT NOT NULL,
    sku NVARCHAR(20) NOT NULL,
    name NVARCHAR(160) NOT NULL,
    unit NVARCHAR(40) NOT NULL,
    quantity INT NOT NULL,
    unit_cost DECIMAL(12,2) NOT NULL,
    total DECIMAL(12,2) NOT NULL,
    note NVARCHAR(240) NOT NULL CONSTRAINT DF_purchases_note DEFAULT N'',
    created_at DATETIME2(0) NOT NULL,
    CONSTRAINT FK_purchases_products FOREIGN KEY (product_id) REFERENCES dbo.products(id),
    CONSTRAINT FK_purchases_providers FOREIGN KEY (provider_id) REFERENCES dbo.providers(id),
    CONSTRAINT CK_purchases_quantity CHECK (quantity > 0),
    CONSTRAINT CK_purchases_unit_cost CHECK (unit_cost >= 0),
    CONSTRAINT CK_purchases_total CHECK (total >= 0)
);
END;
GO

INSERT INTO dbo.providers (name, description, product_lines)
SELECT v.name, v.description, v.product_lines
FROM (VALUES
(N'Cementos Andinos S.A.', N'Proveedor de cemento embolsado para obras generales.', N'Cemento Portland Tipo I'),
(N'Aceros del Sur', N'Proveedor de acero corrugado y alambre para estructura.', N'Fierros corrugados, alambre recocido'),
(N'Ladrillera Norte', N'Proveedor de ladrillos de arcilla para muros.', N'Ladrillo King Kong 18 Huecos'),
(N'Áridos del Valle', N'Proveedor de agregados para mezclas y acabados.', N'Arena gruesa, arena fina, piedra chancada'),
(N'Maderera Selva', N'Proveedor de madera para encofrado y carpintería.', N'Madera tornillo'),
(N'Ferretería Industrial', N'Proveedor de accesorios de ferretería.', N'Clavos, bisagras, lijas'),
(N'Plásticos del Perú', N'Proveedor de tuberías PVC para agua y desagüe.', N'Tubos PVC SAL y agua'),
(N'Pinturas Andinas', N'Proveedor de pinturas para acabados.', N'Pintura látex lavable'),
(N'Adhesivos Construcción', N'Proveedor de adhesivos y selladores.', N'Pegamento para porcelanato, silicona'),
(N'Electrónica Nacional', N'Proveedor de materiales eléctricos.', N'Cable THW, cajas PVC'),
(N'Sanitarios del Centro', N'Proveedor de grifería y accesorios sanitarios.', N'Mezcladoras para lavatorio')
) AS v(name, description, product_lines)
WHERE NOT EXISTS (
    SELECT 1
    FROM dbo.providers existing
    WHERE existing.name = v.name
);

INSERT INTO dbo.products
(sku, name, unit, provider_id, purchase_cost, sale_price, category, brand, material, stock, image_url, source_url, detail, created_at)
SELECT v.sku, v.name, v.unit, p.id, v.purchase_cost, v.sale_price, v.category, v.provider_name, v.material, v.stock, v.image_url, N'', v.detail, SYSDATETIME()
FROM (VALUES
(N'001', N'Cemento Portland Tipo I (42.5kg)', N'Bolsa', N'Cementos Andinos S.A.', CAST(25.00 AS DECIMAL(12,2)), CAST(32.50 AS DECIMAL(12,2)), N'Cemento', N'Cemento', 120, N'https://media.sodimac.com.pe/sodimacPE/207756_00/public', N'Bolsa de cemento Portland Tipo I para estructuras, columnas, vigas y obras generales.'),
(N'002', N'Fierro Corrugado 1/2"', N'Varilla', N'Aceros del Sur', CAST(38.00 AS DECIMAL(12,2)), CAST(49.40 AS DECIMAL(12,2)), N'Acero', N'Acero corrugado', 80, N'https://media.sodimac.com.pe/sodimacPE/211230_01/public', N'Varilla de fierro corrugado de 1/2 pulgada para refuerzo estructural.'),
(N'003', N'Fierro Corrugado 3/8"', N'Varilla', N'Aceros del Sur', CAST(22.00 AS DECIMAL(12,2)), CAST(28.60 AS DECIMAL(12,2)), N'Acero', N'Acero corrugado', 100, N'https://media.sodimac.com.pe/sodimacPE/84247_01/public', N'Varilla de fierro corrugado de 3/8 pulgada para columnas, vigas y amarres.'),
(N'004', N'Ladrillo King Kong 18 Huecos', N'Millar', N'Ladrillera Norte', CAST(1200.00 AS DECIMAL(12,2)), CAST(1560.00 AS DECIMAL(12,2)), N'Ladrillos', N'Arcilla cocida', 12, N'https://media.sodimac.com.pe/sodimacPE/397997_01/public', N'Millar de ladrillo King Kong de 18 huecos para muros y tabiquería.'),
(N'005', N'Arena Gruesa', N'm3', N'Áridos del Valle', CAST(50.00 AS DECIMAL(12,2)), CAST(75.00 AS DECIMAL(12,2)), N'Agregados', N'Arena', 40, N'https://media.sodimac.com.pe/sodimacPE/391905_01/public', N'Arena gruesa por metro cúbico para mezclas de concreto y asentado.'),
(N'006', N'Piedra Chancada 1/2"', N'm3', N'Áridos del Valle', CAST(65.00 AS DECIMAL(12,2)), CAST(95.00 AS DECIMAL(12,2)), N'Agregados', N'Piedra chancada', 35, N'https://media.sodimac.com.pe/sodimacPE/391913_01/public', N'Piedra chancada de 1/2 pulgada por metro cúbico para concreto.'),
(N'007', N'Madera Tornillo (Tablas 1x8x10'')', N'Unidad', N'Maderera Selva', CAST(45.00 AS DECIMAL(12,2)), CAST(60.00 AS DECIMAL(12,2)), N'Madera', N'Madera tornillo', 70, N'https://media.sodimac.com.pe/sodimacPE/1193724_1/public', N'Tabla de madera tornillo 1x8x10 pies para encofrados y carpintería.'),
(N'008', N'Clavos para madera 3" con cabeza', N'Kg', N'Ferretería Industrial', CAST(6.50 AS DECIMAL(12,2)), CAST(9.50 AS DECIMAL(12,2)), N'Ferretería', N'Acero', 90, N'https://media.sodimac.com.pe/sodimacPE/120421_01/public', N'Clavos de 3 pulgadas con cabeza para trabajos en madera.'),
(N'009', N'Alambre Recocido #16', N'Kg', N'Aceros del Sur', CAST(7.00 AS DECIMAL(12,2)), CAST(10.50 AS DECIMAL(12,2)), N'Acero', N'Alambre recocido', 85, N'https://media.sodimac.com.pe/sodimacPE/1554433_01/public', N'Alambre recocido #16 por kilogramo para amarres de acero.'),
(N'010', N'Tubo PVC Sal (4" x 3m)', N'Unidad', N'Plásticos del Perú', CAST(35.00 AS DECIMAL(12,2)), CAST(48.00 AS DECIMAL(12,2)), N'PVC', N'PVC sal', 60, N'https://media.sodimac.com.pe/sodimacPE/344850_01/public', N'Tubo PVC SAL de 4 pulgadas por 3 metros para desagüe.'),
(N'011', N'Tubo PVC Agua (1/2" x 5m)', N'Unidad', N'Plásticos del Perú', CAST(12.00 AS DECIMAL(12,2)), CAST(17.50 AS DECIMAL(12,2)), N'PVC', N'PVC agua', 75, N'https://media.sodimac.com.pe/sodimacPE/308765_01/public', N'Tubo PVC de agua de 1/2 pulgada por 5 metros para instalaciones sanitarias.'),
(N'012', N'Pintura Látex Lavable (Galón)', N'Galón', N'Pinturas Andinas', CAST(42.00 AS DECIMAL(12,2)), CAST(65.00 AS DECIMAL(12,2)), N'Pinturas', N'Pintura látex', 45, N'https://media.sodimac.com.pe/sodimacPE/4043618_12/public', N'Galón de pintura látex lavable para interiores y exteriores.'),
(N'013', N'Pegamento para Porcelanato', N'Bolsa 25kg', N'Adhesivos Construcción', CAST(28.00 AS DECIMAL(12,2)), CAST(42.00 AS DECIMAL(12,2)), N'Adhesivos', N'Mortero adhesivo', 65, N'https://media.sodimac.com.pe/sodimacPE/1263943_01/public', N'Bolsa de pegamento para porcelanato de 25 kg.'),
(N'014', N'Arena Fina', N'm3', N'Áridos del Valle', CAST(45.00 AS DECIMAL(12,2)), CAST(68.00 AS DECIMAL(12,2)), N'Agregados', N'Arena fina', 38, N'https://media.sodimac.com.pe/sodimacPE/391891_01/public', N'Arena fina por metro cúbico para tarrajeos y acabados.'),
(N'015', N'Cable Eléctrico THW 4mm', N'Rollo 100m', N'Electrónica Nacional', CAST(180.00 AS DECIMAL(12,2)), CAST(240.00 AS DECIMAL(12,2)), N'Electricidad', N'Cobre y PVC', 25, N'https://media.sodimac.com.pe/sodimacPE/2277794_01/public', N'Rollo de cable eléctrico THW 4mm de 100 metros.'),
(N'016', N'Cajas Rectangulares PVC', N'Unidad', N'Electrónica Nacional', CAST(1.50 AS DECIMAL(12,2)), CAST(2.80 AS DECIMAL(12,2)), N'Electricidad', N'PVC', 150, N'https://media.sodimac.com.pe/sodimacPE/360953_01/public', N'Caja rectangular PVC para puntos eléctricos.'),
(N'017', N'Bisagra de acero 3"', N'Unidad', N'Ferretería Industrial', CAST(4.00 AS DECIMAL(12,2)), CAST(7.50 AS DECIMAL(12,2)), N'Ferretería', N'Acero', 100, N'https://media.sodimac.com.pe/sodimacPE/9072284_01/public', N'Bisagra de acero de 3 pulgadas para puertas y muebles.'),
(N'018', N'Lija para madera (Grano 80)', N'Unidad', N'Ferretería Industrial', CAST(1.20 AS DECIMAL(12,2)), CAST(2.50 AS DECIMAL(12,2)), N'Ferretería', N'Lija', 180, N'https://media.sodimac.com.pe/sodimacPE/63258_01/public', N'Lija para madera grano 80 para preparación y acabado.'),
(N'019', N'Mezcladora para lavatorio', N'Unidad', N'Sanitarios del Centro', CAST(85.00 AS DECIMAL(12,2)), CAST(130.00 AS DECIMAL(12,2)), N'Sanitarios', N'Metal cromado', 30, N'https://media.sodimac.com.pe/sodimacPE/4326148_01/public', N'Mezcladora para lavatorio con acabado cromado.'),
(N'020', N'Silicona Selladora Multiuso', N'Unidad', N'Adhesivos Construcción', CAST(15.00 AS DECIMAL(12,2)), CAST(24.00 AS DECIMAL(12,2)), N'Adhesivos', N'Silicona', 55, N'https://media.sodimac.com.pe/sodimacPE/428691X_1/public', N'Silicona selladora multiuso para juntas, baños, cocinas y acabados.')
) AS v(sku, name, unit, provider_name, purchase_cost, sale_price, category, material, stock, image_url, detail)
JOIN dbo.providers p ON p.name = v.provider_name
WHERE NOT EXISTS (
    SELECT 1
    FROM dbo.products existing
    WHERE existing.sku = v.sku
);

IF NOT EXISTS (SELECT 1 FROM dbo.users WHERE role = N'admin')
BEGIN
INSERT INTO dbo.users (name, email, phone, password, role, created_at)
VALUES (N'Administrador Overflod', N'admin@overflod.com', N'960152072', N'admin123', N'admin', SYSDATETIME());
END;
GO

/* Modulos ERP: RBAC por accion, transacciones universales, boveda logica e inventario ROP */
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_users_role')
BEGIN
    ALTER TABLE dbo.users DROP CONSTRAINT CK_users_role;
END;
GO

IF COL_LENGTH('dbo.products', 'purchase_cost_base') IS NULL ALTER TABLE dbo.products ADD purchase_cost_base DECIMAL(12,2) NOT NULL CONSTRAINT DF_products_purchase_cost_base_m DEFAULT 0;
IF COL_LENGTH('dbo.products', 'freight_cost') IS NULL ALTER TABLE dbo.products ADD freight_cost DECIMAL(12,2) NOT NULL CONSTRAINT DF_products_freight_cost_m DEFAULT 0;
IF COL_LENGTH('dbo.products', 'tax_cost') IS NULL ALTER TABLE dbo.products ADD tax_cost DECIMAL(12,2) NOT NULL CONSTRAINT DF_products_tax_cost_m DEFAULT 0;
IF COL_LENGTH('dbo.products', 'landed_units') IS NULL ALTER TABLE dbo.products ADD landed_units DECIMAL(12,2) NOT NULL CONSTRAINT DF_products_landed_units_m DEFAULT 1;
IF COL_LENGTH('dbo.products', 'daily_consumption') IS NULL ALTER TABLE dbo.products ADD daily_consumption DECIMAL(12,2) NOT NULL CONSTRAINT DF_products_daily_consumption_m DEFAULT 1;
IF COL_LENGTH('dbo.products', 'lead_time_days') IS NULL ALTER TABLE dbo.products ADD lead_time_days DECIMAL(12,2) NOT NULL CONSTRAINT DF_products_lead_time_days_m DEFAULT 7;
IF COL_LENGTH('dbo.products', 'safety_stock') IS NULL ALTER TABLE dbo.products ADD safety_stock DECIMAL(12,2) NOT NULL CONSTRAINT DF_products_safety_stock_m DEFAULT 20;
IF COL_LENGTH('dbo.products', 'stock_minimo') IS NULL ALTER TABLE dbo.products ADD stock_minimo DECIMAL(12,2) NOT NULL CONSTRAINT DF_products_stock_minimo_m DEFAULT 20;
IF COL_LENGTH('dbo.products', 'stock_maximo') IS NULL ALTER TABLE dbo.products ADD stock_maximo DECIMAL(12,2) NOT NULL CONSTRAINT DF_products_stock_maximo_m DEFAULT 0;
IF COL_LENGTH('dbo.products', 'reorder_point') IS NULL ALTER TABLE dbo.products ADD reorder_point DECIMAL(12,2) NOT NULL CONSTRAINT DF_products_reorder_point_m DEFAULT 27;
GO

UPDATE dbo.products
SET purchase_cost_base = CASE WHEN purchase_cost_base = 0 THEN purchase_cost ELSE purchase_cost_base END,
    reorder_point = CEILING((daily_consumption * lead_time_days) + safety_stock),
    stock_minimo = safety_stock,
    stock_maximo = CASE WHEN stock_maximo < CEILING((daily_consumption * lead_time_days) + safety_stock) THEN CEILING((daily_consumption * lead_time_days) + safety_stock) ELSE stock_maximo END;
GO

IF COL_LENGTH('dbo.orders', 'payment_status') IS NULL ALTER TABLE dbo.orders ADD payment_status NVARCHAR(30) NOT NULL CONSTRAINT DF_orders_payment_status_m DEFAULT N'Pendiente';
IF COL_LENGTH('dbo.purchases', 'base_cost') IS NULL ALTER TABLE dbo.purchases ADD base_cost DECIMAL(12,2) NOT NULL CONSTRAINT DF_purchases_base_cost_m DEFAULT 0;
IF COL_LENGTH('dbo.purchases', 'freight_cost') IS NULL ALTER TABLE dbo.purchases ADD freight_cost DECIMAL(12,2) NOT NULL CONSTRAINT DF_purchases_freight_cost_m DEFAULT 0;
IF COL_LENGTH('dbo.purchases', 'tax_cost') IS NULL ALTER TABLE dbo.purchases ADD tax_cost DECIMAL(12,2) NOT NULL CONSTRAINT DF_purchases_tax_cost_m DEFAULT 0;
IF COL_LENGTH('dbo.purchases', 'landed_units') IS NULL ALTER TABLE dbo.purchases ADD landed_units DECIMAL(12,2) NOT NULL CONSTRAINT DF_purchases_landed_units_m DEFAULT 1;
IF COL_LENGTH('dbo.purchases', 'landed_cost') IS NULL ALTER TABLE dbo.purchases ADD landed_cost DECIMAL(12,2) NOT NULL CONSTRAINT DF_purchases_landed_cost_m DEFAULT 0;
GO

IF OBJECT_ID(N'dbo.permissions', N'U') IS NULL
BEGIN
CREATE TABLE dbo.permissions (
    id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_permissions PRIMARY KEY,
    code NVARCHAR(80) NOT NULL CONSTRAINT UQ_permissions_code UNIQUE,
    label NVARCHAR(120) NOT NULL,
    description NVARCHAR(500) NOT NULL,
    [group] NVARCHAR(80) NOT NULL
);
END;

IF OBJECT_ID(N'dbo.roles', N'U') IS NULL
BEGIN
CREATE TABLE dbo.roles (
    id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_roles PRIMARY KEY,
    code NVARCHAR(80) NOT NULL CONSTRAINT UQ_roles_code UNIQUE,
    name NVARCHAR(120) NOT NULL,
    description NVARCHAR(500) NOT NULL,
    permission_codes_json NVARCHAR(MAX) NOT NULL
);
END;

IF OBJECT_ID(N'dbo.user_permissions', N'U') IS NULL
BEGIN
CREATE TABLE dbo.user_permissions (
    id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_user_permissions PRIMARY KEY,
    user_id INT NOT NULL,
    permission_code NVARCHAR(80) NOT NULL,
    assigned_at DATETIME2(0) NOT NULL,
    CONSTRAINT FK_user_permissions_users FOREIGN KEY (user_id) REFERENCES dbo.users(id) ON DELETE CASCADE,
    CONSTRAINT FK_user_permissions_permissions FOREIGN KEY (permission_code) REFERENCES dbo.permissions(code),
    CONSTRAINT UQ_user_permissions UNIQUE (user_id, permission_code)
);
END;

IF OBJECT_ID(N'dbo.transactions', N'U') IS NULL
BEGIN
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
);
END;

IF OBJECT_ID(N'dbo.transaction_notes', N'U') IS NULL
BEGIN
CREATE TABLE dbo.transaction_notes (
    id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_transaction_notes PRIMARY KEY,
    transaction_id INT NOT NULL,
    author_name NVARCHAR(120) NOT NULL,
    author_email NVARCHAR(160) NOT NULL CONSTRAINT DF_transaction_notes_author_email DEFAULT N'',
    message NVARCHAR(1000) NOT NULL,
    created_at DATETIME2(0) NOT NULL,
    CONSTRAINT FK_transaction_notes_transactions FOREIGN KEY (transaction_id) REFERENCES dbo.transactions(id) ON DELETE CASCADE
);
END;

IF OBJECT_ID(N'dbo.vault_documents', N'U') IS NULL
BEGIN
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
);
END;
GO

INSERT INTO dbo.permissions (code, label, description, [group])
SELECT v.code, v.label, v.description, v.[group]
FROM (VALUES
(N'leer_stock', N'Ver stock', N'Consultar inventario, existencias y alertas ROP.', N'Inventario'),
(N'editar_stock', N'Editar stock', N'Actualizar productos, costos, entradas y salidas de almacen.', N'Inventario'),
(N'ver_costos', N'Ver costos', N'Revisar costos de compra, landed cost y margen operativo.', N'Inventario'),
(N'validar_pagos', N'Validar pagos', N'Aprobar o rechazar vouchers de compras pendientes.', N'Transacciones'),
(N'ver_transacciones', N'Ver transacciones', N'Consultar compras, ventas y sus estados.', N'Transacciones'),
(N'crear_orden', N'Crear ordenes', N'Registrar pedidos como cliente o vendedor.', N'Transacciones'),
(N'buscar_documentos', N'Buscar documentos', N'Usar filtros avanzados en la boveda documental.', N'Boveda'),
(N'gestionar_boveda', N'Gestionar boveda', N'Registrar evidencias, comprobantes y logs documentales.', N'Boveda'),
(N'gestionar_usuarios', N'Gestionar usuarios', N'Crear usuarios operativos y asignar permisos por accion.', N'Identidad')
) AS v(code, label, description, [group])
WHERE NOT EXISTS (SELECT 1 FROM dbo.permissions p WHERE p.code = v.code);
GO

INSERT INTO dbo.roles (code, name, description, permission_codes_json)
SELECT v.code, v.name, v.description, v.permission_codes_json
FROM (VALUES
(N'admin', N'Administrador general', N'Perfil inicial con todos los permisos activos.', N'["leer_stock","editar_stock","ver_costos","validar_pagos","ver_transacciones","crear_orden","buscar_documentos","gestionar_boveda","gestionar_usuarios"]'),
(N'transacciones', N'Encargado de transacciones', N'Valida pagos, conversa con clientes y revisa la boveda.', N'["validar_pagos","ver_transacciones","ver_costos","buscar_documentos","gestionar_boveda"]'),
(N'retail_stock', N'Encargado de retail stock', N'Mantiene productos, stock y puntos de reorden.', N'["leer_stock","editar_stock"]'),
(N'cliente', N'Cliente', N'Puede crear ordenes y cargar comprobantes de pago.', N'["crear_orden"]')
) AS v(code, name, description, permission_codes_json)
WHERE NOT EXISTS (SELECT 1 FROM dbo.roles r WHERE r.code = v.code);
GO

INSERT INTO dbo.user_permissions (user_id, permission_code, assigned_at)
SELECT u.id, p.code, SYSDATETIME()
FROM dbo.users u
CROSS JOIN dbo.permissions p
WHERE u.role = N'admin'
  AND NOT EXISTS (
    SELECT 1
    FROM dbo.user_permissions up
    WHERE up.user_id = u.id AND up.permission_code = p.code
  );
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_transactions_search' AND object_id = OBJECT_ID(N'dbo.transactions'))
    CREATE INDEX IX_transactions_search ON dbo.transactions(type, status, [timestamp]);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_vault_documents_transaction' AND object_id = OBJECT_ID(N'dbo.vault_documents'))
    CREATE INDEX IX_vault_documents_transaction ON dbo.vault_documents(transaction_id, kind);
GO
