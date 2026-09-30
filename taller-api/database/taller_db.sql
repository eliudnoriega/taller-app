-- ==============================================================================
-- SISTEMA DE GESTIÓN INTEGRAL PARA TALLER MECÁNICO / AUTOMOTRIZ
-- Esquema de Base de Datos relacional para MySQL / MariaDB
-- Charset: utf8mb4 / Collation: utf8mb4_unicode_ci
-- ==============================================================================

CREATE DATABASE IF NOT EXISTS `taller_db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `taller_db`;

-- Desactivar verificación de llaves foráneas temporalmente para recarga limpia
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `notificaciones_bitacora`;
DROP TABLE IF EXISTS `pagos`;
DROP TABLE IF EXISTS `movimientos_inventario`;
DROP TABLE IF EXISTS `presupuesto_detalles`;
DROP TABLE IF EXISTS `presupuestos`;
DROP TABLE IF EXISTS `ot_items`;
DROP TABLE IF EXISTS `ot_fotografias`;
DROP TABLE IF EXISTS `ot_checklist`;
DROP TABLE IF EXISTS `ot_historial_estados`;
DROP TABLE IF EXISTS `ordenes_trabajo`;
DROP TABLE IF EXISTS `repuestos`;
DROP TABLE IF EXISTS `categorias_repuestos`;
DROP TABLE IF EXISTS `vehiculos`;
DROP TABLE IF EXISTS `clientes`;
DROP TABLE IF EXISTS `usuarios`;

SET FOREIGN_KEY_CHECKS = 1;

-- ==============================================================================
-- 1. TABLA: usuarios
-- Gestión de administradores, recepcionistas, mecánicos/técnicos y cajeros
-- ==============================================================================
CREATE TABLE `usuarios` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `nombre` VARCHAR(100) NOT NULL,
  `email` VARCHAR(100) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  `rol` ENUM('ADMIN', 'RECEPCIONISTA', 'MECANICO', 'CAJERO') NOT NULL DEFAULT 'MECANICO',
  `telefono` VARCHAR(25) NULL,
  `especialidad` VARCHAR(100) NULL COMMENT 'Ej: Frenos y Suspensión, Motor, Electricidad automotriz, Diagnóstico computarizado',
  `foto_perfil` VARCHAR(255) NULL COMMENT 'Ruta o URL de la fotografía de perfil del usuario',
  `activo` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_usuarios_rol` (`rol`),
  INDEX `idx_usuarios_activo` (`activo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- 2. TABLA: clientes
-- Propietarios de los vehículos o equipos
-- ==============================================================================
CREATE TABLE `clientes` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `tipo_documento` VARCHAR(20) NOT NULL DEFAULT 'DNI' COMMENT 'DNI, RUC, RFC, CI, Pasaporte',
  `numero_documento` VARCHAR(30) NOT NULL UNIQUE,
  `nombre` VARCHAR(150) NOT NULL,
  `telefono` VARCHAR(25) NOT NULL,
  `email` VARCHAR(100) NULL,
  `direccion` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_clientes_nombre` (`nombre`),
  INDEX `idx_clientes_doc` (`numero_documento`),
  INDEX `idx_clientes_telefono` (`telefono`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- 3. TABLA: vehiculos
-- Vehículos o equipos asociados a clientes
-- ==============================================================================
CREATE TABLE `vehiculos` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `cliente_id` INT NOT NULL,
  `tipo` ENUM('AUTOMOVIL', 'CAMIONETA', 'MOTOCICLETA', 'CAMION', 'MAQUINARIA', 'OTRO') NOT NULL DEFAULT 'AUTOMOVIL',
  `marca` VARCHAR(60) NOT NULL,
  `modelo` VARCHAR(60) NOT NULL,
  `anio` INT NOT NULL,
  `placa` VARCHAR(20) NOT NULL UNIQUE,
  `numero_serie_vin` VARCHAR(50) NULL,
  `color` VARCHAR(40) NULL,
  `kilometraje_actual` INT NOT NULL DEFAULT 0,
  `notas` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX `idx_vehiculos_placa` (`placa`),
  INDEX `idx_vehiculos_vin` (`numero_serie_vin`),
  INDEX `idx_vehiculos_cliente` (`cliente_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- 4. TABLA: categorias_repuestos
-- Categorías de refacciones e insumos
-- ==============================================================================
CREATE TABLE `categorias_repuestos` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `nombre` VARCHAR(80) NOT NULL UNIQUE,
  `descripcion` VARCHAR(255) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- 5. TABLA: repuestos
-- Inventario de refacciones, insumos y repuestos con costo y precio
-- ==============================================================================
CREATE TABLE `repuestos` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `categoria_id` INT NULL,
  `codigo_sku` VARCHAR(50) NOT NULL UNIQUE,
  `nombre` VARCHAR(150) NOT NULL,
  `descripcion` TEXT NULL,
  `costo_compra` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT 'Costo al que se adquiere el repuesto',
  `precio_venta` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT 'Precio de venta al cliente en la OT',
  `stock_actual` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `stock_minimo` DECIMAL(10,2) NOT NULL DEFAULT 2.00 COMMENT 'Umbral para disparar alerta',
  `unidad_medida` VARCHAR(25) NOT NULL DEFAULT 'UNIDAD' COMMENT 'UNIDAD, LITRO, GALON, JUEGO, METRO',
  `ubicacion_estante` VARCHAR(60) NULL,
  `foto_producto` LONGTEXT NULL COMMENT 'Imagen del producto en formato Base64',
  `activo` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`categoria_id`) REFERENCES `categorias_repuestos`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX `idx_repuestos_sku` (`codigo_sku`),
  INDEX `idx_repuestos_nombre` (`nombre`),
  INDEX `idx_repuestos_stock` (`stock_actual`, `stock_minimo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- 6. TABLA: ordenes_trabajo (OT)
-- Núcleo del taller: recepción, estados en tiempo real, liquidación y seguimiento
-- ==============================================================================
CREATE TABLE `ordenes_trabajo` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `numero_ot` VARCHAR(30) NOT NULL UNIQUE COMMENT 'Ej: OT-2026-0001',
  `cliente_id` INT NOT NULL,
  `vehiculo_id` INT NOT NULL,
  `tecnico_id` INT NULL COMMENT 'Técnico / Mecánico principal asignado',
  `recepcionista_id` INT NULL COMMENT 'Usuario que recibió el vehículo',
  `estado` ENUM(
    'RECEPCIONADO',
    'EN_DIAGNOSTICO',
    'ESPERANDO_REPUESTOS',
    'EN_REPARACION',
    'LISTO_ENTREGA',
    'ENTREGADO',
    'CANCELADO'
  ) NOT NULL DEFAULT 'RECEPCIONADO',
  `motivo_ingreso` TEXT NOT NULL,
  `diagnostico_inicial` TEXT NULL,
  `diagnostico_final` TEXT NULL,
  `trabajo_realizado` TEXT NULL,
  `kilometraje_ingreso` INT NOT NULL DEFAULT 0,
  `nivel_combustible` ENUM('VACIO', 'RESERVA', '1/4', '1/2', '3/4', 'LLENO') NOT NULL DEFAULT '1/4',
  `token_seguimiento` VARCHAR(64) NOT NULL UNIQUE COMMENT 'Hash seguro para que el cliente consulte sin login',
  `total_repuestos` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `total_mano_obra` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `subtotal` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `descuento` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `impuesto` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `total_general` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `total_pagado` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `saldo_pendiente` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `inventario_descargado` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 si ya se descontó automáticamente el stock',
  `fecha_ingreso` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_promesa` DATETIME NULL,
  `fecha_cierre` DATETIME NULL COMMENT 'Momento en que finalizan los trabajos mecánicos',
  `fecha_entrega` DATETIME NULL COMMENT 'Momento de entrega efectiva al cliente',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (`vehiculo_id`) REFERENCES `vehiculos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (`tecnico_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY (`recepcionista_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX `idx_ot_estado` (`estado`),
  INDEX `idx_ot_cliente` (`cliente_id`),
  INDEX `idx_ot_vehiculo` (`vehiculo_id`),
  INDEX `idx_ot_tecnico` (`tecnico_id`),
  INDEX `idx_ot_token` (`token_seguimiento`),
  INDEX `idx_ot_fechas` (`fecha_ingreso`, `fecha_cierre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- 7. TABLA: ot_checklist
-- Inspección física detallada al ingresar el vehículo
-- ==============================================================================
CREATE TABLE `ot_checklist` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `orden_trabajo_id` INT NOT NULL,
  `seccion` VARCHAR(50) NOT NULL COMMENT 'EXTERIOR, INTERIOR, MECANICA_BASICA, EQUIPAMIENTO',
  `item` VARCHAR(100) NOT NULL COMMENT 'Ej: Luces principales, Rayones en puertas, Llanta repuesto, Gato/Llaves',
  `estado` ENUM('BUENO', 'REGULAR', 'MALO', 'NO_APLICA') NOT NULL DEFAULT 'BUENO',
  `observaciones` VARCHAR(255) NULL,
  FOREIGN KEY (`orden_trabajo_id`) REFERENCES `ordenes_trabajo`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX `idx_checklist_ot` (`orden_trabajo_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- 8. TABLA: ot_fotografias
-- Fotografías de recepción, daños previos, avances de reparación y entrega
-- ==============================================================================
CREATE TABLE `ot_fotografias` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `orden_trabajo_id` INT NOT NULL,
  `url_archivo` VARCHAR(255) NOT NULL,
  `etapa` ENUM('RECEPCION', 'DIAGNOSTICO', 'REPARACION', 'ENTREGA') NOT NULL DEFAULT 'RECEPCION',
  `descripcion` VARCHAR(255) NULL,
  `fecha_registro` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`orden_trabajo_id`) REFERENCES `ordenes_trabajo`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX `idx_fotos_ot` (`orden_trabajo_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- 9. TABLA: ot_historial_estados
-- Bitácora de cambios de estado en tiempo real
-- ==============================================================================
CREATE TABLE `ot_historial_estados` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `orden_trabajo_id` INT NOT NULL,
  `estado_anterior` VARCHAR(50) NULL,
  `estado_nuevo` VARCHAR(50) NOT NULL,
  `usuario_id` INT NULL,
  `comentario` TEXT NULL,
  `fecha_cambio` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`orden_trabajo_id`) REFERENCES `ordenes_trabajo`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX `idx_historial_ot` (`orden_trabajo_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- 10. TABLA: ot_items
-- Desglose de repuestos utilizados y mano de obra/servicios por mecánico
-- ==============================================================================
CREATE TABLE `ot_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `orden_trabajo_id` INT NOT NULL,
  `tipo_item` ENUM('REPUESTO', 'MANO_OBRA', 'SERVICIO_EXTERNO') NOT NULL,
  `repuesto_id` INT NULL,
  `descripcion` VARCHAR(255) NOT NULL,
  `cantidad` DECIMAL(10,2) NOT NULL DEFAULT 1.00,
  `costo_unitario` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `precio_unitario` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `subtotal` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `mecanico_id` INT NULL COMMENT 'Mecánico que ejecutó la tarea para reporte de comisiones/productividad',
  FOREIGN KEY (`orden_trabajo_id`) REFERENCES `ordenes_trabajo`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`repuesto_id`) REFERENCES `repuestos`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY (`mecanico_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX `idx_items_ot` (`orden_trabajo_id`),
  INDEX `idx_items_mecanico` (`mecanico_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- 11. TABLA: presupuestos (Cotizaciones)
-- Cotizaciones rápidas con conversión en 1 clic a Orden de Trabajo
-- ==============================================================================
CREATE TABLE `presupuestos` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `numero_presupuesto` VARCHAR(30) NOT NULL UNIQUE COMMENT 'Ej: PRES-2026-0001',
  `cliente_id` INT NOT NULL,
  `vehiculo_id` INT NOT NULL,
  `tecnico_id` INT NULL,
  `estado` ENUM('PENDIENTE', 'APROBADO', 'RECHAZADO', 'CONVERTIDO_OT') NOT NULL DEFAULT 'PENDIENTE',
  `orden_trabajo_id` INT NULL COMMENT 'ID de la OT generada tras conversión',
  `vigencia_dias` INT NOT NULL DEFAULT 15,
  `observaciones` TEXT NULL,
  `subtotal` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `impuesto` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `total` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `fecha_emision` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (`vehiculo_id`) REFERENCES `vehiculos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (`tecnico_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY (`orden_trabajo_id`) REFERENCES `ordenes_trabajo`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX `idx_presupuestos_estado` (`estado`),
  INDEX `idx_presupuestos_cliente` (`cliente_id`),
  INDEX `idx_presupuestos_vehiculo` (`vehiculo_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- 12. TABLA: presupuesto_detalles
-- Líneas de repuestos y mano de obra del presupuesto
-- ==============================================================================
CREATE TABLE `presupuesto_detalles` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `presupuesto_id` INT NOT NULL,
  `tipo_item` ENUM('REPUESTO', 'MANO_OBRA', 'SERVICIO_EXTERNO') NOT NULL,
  `repuesto_id` INT NULL,
  `descripcion` VARCHAR(255) NOT NULL,
  `cantidad` DECIMAL(10,2) NOT NULL DEFAULT 1.00,
  `costo_estimado` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `precio_unitario` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `subtotal` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  FOREIGN KEY (`presupuesto_id`) REFERENCES `presupuestos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`repuesto_id`) REFERENCES `repuestos`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX `idx_detalles_presupuesto` (`presupuesto_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- 13. TABLA: movimientos_inventario
-- Kardex y trazabilidad total: entradas, salidas de OT, devoluciones y ajustes
-- ==============================================================================
CREATE TABLE `movimientos_inventario` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `repuesto_id` INT NOT NULL,
  `tipo_movimiento` ENUM('ENTRADA_COMPRA', 'SALIDA_OT', 'AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO', 'DEVOLUCION') NOT NULL,
  `cantidad` DECIMAL(10,2) NOT NULL,
  `costo_unitario` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `precio_unitario` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `stock_anterior` DECIMAL(10,2) NOT NULL,
  `stock_posterior` DECIMAL(10,2) NOT NULL,
  `orden_trabajo_id` INT NULL COMMENT 'Vinculado a OT en descarga automática',
  `usuario_id` INT NULL,
  `motivo` VARCHAR(255) NULL,
  `fecha_movimiento` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`repuesto_id`) REFERENCES `repuestos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`orden_trabajo_id`) REFERENCES `ordenes_trabajo`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX `idx_mov_repuesto` (`repuesto_id`),
  INDEX `idx_mov_ot` (`orden_trabajo_id`),
  INDEX `idx_mov_fecha` (`fecha_movimiento`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- 14. TABLA: pagos
-- Caja y cobranzas: anticipos, abonos parciales y liquidación final
-- ==============================================================================
CREATE TABLE `pagos` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `orden_trabajo_id` INT NOT NULL,
  `cliente_id` INT NOT NULL,
  `usuario_id` INT NULL COMMENT 'Cajero o usuario que recibe el pago',
  `tipo_pago` ENUM('ANTICIPO', 'PAGO_PARCIAL', 'LIQUIDACION') NOT NULL,
  `metodo_pago` ENUM('EFECTIVO', 'TARJETA_DEBITO', 'TARJETA_CREDITO', 'TRANSFERENCIA', 'OTRO') NOT NULL DEFAULT 'EFECTIVO',
  `monto` DECIMAL(12,2) NOT NULL,
  `numero_referencia` VARCHAR(100) NULL COMMENT 'Voucher, número de operación o transferencia',
  `notas` TEXT NULL,
  `fecha_pago` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`orden_trabajo_id`) REFERENCES `ordenes_trabajo`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX `idx_pagos_ot` (`orden_trabajo_id`),
  INDEX `idx_pagos_fecha` (`fecha_pago`),
  INDEX `idx_pagos_metodo` (`metodo_pago`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- 15. TABLA: notificaciones_bitacora
-- Registro y generación de enlaces de seguimiento y avisos por WhatsApp y Correo
-- ==============================================================================
CREATE TABLE `notificaciones_bitacora` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `orden_trabajo_id` INT NULL,
  `cliente_id` INT NOT NULL,
  `canal` ENUM('WHATSAPP', 'EMAIL', 'SMS') NOT NULL DEFAULT 'WHATSAPP',
  `tipo_aviso` ENUM('RECEPCION', 'CAMBIO_ESTADO', 'LISTO_ENTREGA', 'SEGUIMIENTO', 'PRESUPUESTO') NOT NULL,
  `destinatario` VARCHAR(100) NOT NULL COMMENT 'Teléfono con prefijo internacional o email',
  `mensaje` TEXT NOT NULL,
  `enlace_accion` VARCHAR(255) NULL COMMENT 'Link de seguimiento público o URL de WhatsApp web/api',
  `estado_envio` ENUM('GENERADO', 'ENVIADO', 'FALLIDO') NOT NULL DEFAULT 'GENERADO',
  `fecha_envio` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`orden_trabajo_id`) REFERENCES `ordenes_trabajo`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX `idx_notif_ot` (`orden_trabajo_id`),
  INDEX `idx_notif_cliente` (`cliente_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- DATOS SEMILLA / DEMOSTRACIÓN INICIAL
-- ==============================================================================

-- Usuarios de prueba
-- Clave 'admin': $2y$10$6qhq/bk6W7tPqG1I9Bsqr..dg52SJTRuefESC69aF4ZrIZykdOcX2
-- Clave 'admin123': $2y$10$N/Y0rQ4V5rBvN/18bL34keg0Zk38F6F/qjE4kYgU7t2t8I9M.Oa12
INSERT INTO `usuarios` (`id`, `nombre`, `email`, `password`, `rol`, `telefono`, `especialidad`, `activo`) VALUES
(1, 'Administrador Melecsa', 'admin@melecsa.com', '$2y$10$6qhq/bk6W7tPqG1I9Bsqr..dg52SJTRuefESC69aF4ZrIZykdOcX2', 'ADMIN', '+525500112233', 'Administración General', 1),
(2, 'Carlos Mendoza', 'admin@taller.com', '$2y$10$N/Y0rQ4V5rBvN/18bL34keg0Zk38F6F/qjE4kYgU7t2t8I9M.Oa12', 'ADMIN', '+525512345678', 'Gerencia y Diagnóstico', 1),
(3, 'Laura Gómez', 'recepcion@taller.com', '$2y$10$N/Y0rQ4V5rBvN/18bL34keg0Zk38F6F/qjE4kYgU7t2t8I9M.Oa12', 'RECEPCIONISTA', '+525523456789', 'Atención al Cliente', 1),
(4, 'Roberto Juárez', 'mecanico1@taller.com', '$2y$10$N/Y0rQ4V5rBvN/18bL34keg0Zk38F6F/qjE4kYgU7t2t8I9M.Oa12', 'MECANICO', '+525534567890', 'Frenos y Suspensión', 1),
(5, 'Miguel Ángel Santos', 'mecanico2@taller.com', '$2y$10$N/Y0rQ4V5rBvN/18bL34keg0Zk38F6F/qjE4kYgU7t2t8I9M.Oa12', 'MECANICO', '+525545678901', 'Motor y Afinación', 1),
(6, 'Ana Morales', 'caja@taller.com', '$2y$10$N/Y0rQ4V5rBvN/18bL34keg0Zk38F6F/qjE4kYgU7t2t8I9M.Oa12', 'CAJERO', '+525556789012', 'Caja y Cobranzas', 1);

-- Clientes
INSERT INTO `clientes` (`id`, `tipo_documento`, `numero_documento`, `nombre`, `telefono`, `email`, `direccion`) VALUES
(1, 'RFC', 'PERJ850101XYZ', 'Juan Pérez Rodríguez', '+525598765432', 'juan.perez@email.com', 'Av. Insurgentes Sur 1234, CDMX'),
(2, 'RFC', 'GAML920415ABC', 'Lucía García Méndez', '+525587654321', 'lucia.garcia@email.com', 'Calle Reforma 567, Guadalajara'),
(3, 'RFC', 'HEFS791120DEF', 'Fernando Hernández Soto', '+525576543210', 'fernando.h@email.com', 'Col. Lindavista 890, Monterrey');

-- Vehículos
INSERT INTO `vehiculos` (`id`, `cliente_id`, `tipo`, `marca`, `modelo`, `anio`, `placa`, `numero_serie_vin`, `color`, `kilometraje_actual`, `notas`) VALUES
(1, 1, 'AUTOMOVIL', 'Toyota', 'Corolla', 2020, 'ABC-123', '3TY12345678901234', 'Plata', 48500, 'Mantenimiento regular en agencia anteriormente'),
(2, 2, 'CAMIONETA', 'Honda', 'CR-V', 2021, 'XYZ-789', '2HGF9876543210987', 'Blanco', 32000, 'Sonido extraño al frenar en frío'),
(3, 3, 'AUTOMOVIL', 'Volkswagen', 'Jetta', 2019, 'DEF-456', '3VW45678901234567', 'Rojo', 65000, 'Falla en encendido matutino y testigo Check Engine');

-- Categorías
INSERT INTO `categorias_repuestos` (`id`, `nombre`, `descripcion`) VALUES
(1, 'Frenos y Seguridad', 'Pastillas, discos, líquidos de frenos y zapatas'),
(2, 'Motor y Afinación', 'Bujías, filtros de aceite, filtros de aire y correas'),
(3, 'Suspensión y Dirección', 'Amortiguadores, terminales, rótulas y bujes'),
(4, 'Fluidos y Lubricantes', 'Aceites sintéticos, anticongelante y aditivos');

-- Repuestos con costos vs precios y stock
INSERT INTO `repuestos` (`id`, `categoria_id`, `codigo_sku`, `nombre`, `descripcion`, `costo_compra`, `precio_venta`, `stock_actual`, `stock_minimo`, `unidad_medida`, `ubicacion_estante`) VALUES
(1, 1, 'FRE-PAS-001', 'Juego de Pastillas Delanteras Cerámica', 'Pastillas cerámicas alta durabilidad para sedán', 320.00, 650.00, 12.00, 4.00, 'JUEGO', 'E-01-A'),
(2, 1, 'FRE-LIQ-DOT4', 'Líquido de Frenos DOT 4 500ml', 'Líquido sintético para sistema hidráulico de frenos', 60.00, 140.00, 3.00, 5.00, 'UNIDAD', 'E-01-B'),
(3, 2, 'ACE-5W30-SYN', 'Aceite Sintético 5W-30 Galón (3.78L)', 'Aceite 100% sintético para motor a gasolina', 380.00, 750.00, 18.00, 6.00, 'GALON', 'E-02-A'),
(4, 2, 'FIL-ACE-PH4967', 'Filtro de Aceite Blindado PH4967', 'Filtro de aceite alto flujo para Toyota/Honda', 65.00, 160.00, 1.00, 5.00, 'UNIDAD', 'E-02-B'),
(5, 2, 'BUJ-IRI-004', 'Juego de 4 Bujías de Iridio NGK', 'Bujías de encendido de larga duración', 280.00, 620.00, 8.00, 3.00, 'JUEGO', 'E-02-C'),
(6, 3, 'SUS-AMO-DEL', 'Amortiguador Delantero Gas Premium', 'Amortiguador de gas presurizado', 650.00, 1350.00, 2.00, 4.00, 'UNIDAD', 'E-03-A');

-- Orden de Trabajo 1 (En Reparación)
INSERT INTO `ordenes_trabajo` (`id`, `numero_ot`, `cliente_id`, `vehiculo_id`, `tecnico_id`, `recepcionista_id`, `estado`, `motivo_ingreso`, `diagnostico_inicial`, `diagnostico_final`, `kilometraje_ingreso`, `nivel_combustible`, `token_seguimiento`, `total_repuestos`, `total_mano_obra`, `subtotal`, `descuento`, `impuesto`, `total_general`, `total_pagado`, `saldo_pendiente`, `inventario_descargado`, `fecha_ingreso`, `fecha_promesa`) VALUES
(1, 'OT-2026-0001', 1, 1, 3, 2, 'EN_REPARACION', 'Cambio de balatas y revisión general de frenos', 'Desgaste en pastillas delanteras al 15% de vida útil', 'Requiere cambio de pastillas y rectificado de discos', 48500, '1/2', 'track_7fa8b9c0d1e2f3a4b5c6d7e8', 650.00, 450.00, 1100.00, 0.00, 176.00, 1276.00, 500.00, 776.00, 0, '2026-09-25 09:30:00', '2026-09-28 17:00:00');

-- Checklist OT 1
INSERT INTO `ot_checklist` (`orden_trabajo_id`, `seccion`, `item`, `estado`, `observaciones`) VALUES
(1, 'EXTERIOR', 'Carrocería y pintura', 'BUENO', 'Sin abolladuras visibles'),
(1, 'EXTERIOR', 'Luces principales y direccionales', 'BUENO', 'Operativas'),
(1, 'INTERIOR', 'Tapicería y asientos', 'BUENO', 'Limpio'),
(1, 'INTERIOR', 'Radio y pantalla táctil', 'BUENO', 'Operativa'),
(1, 'EQUIPAMIENTO', 'Llanta de refacción', 'BUENO', 'Presión correcta'),
(1, 'EQUIPAMIENTO', 'Gato hidráulico y llave de cruz', 'BUENO', 'Completo en cajuela');

-- Items OT 1
INSERT INTO `ot_items` (`orden_trabajo_id`, `tipo_item`, `repuesto_id`, `descripcion`, `cantidad`, `costo_unitario`, `precio_unitario`, `subtotal`, `mecanico_id`) VALUES
(1, 'REPUESTO', 1, 'Juego de Pastillas Delanteras Cerámica', 1.00, 320.00, 650.00, 650.00, 3),
(1, 'MANO_OBRA', NULL, 'Servicio de cambio de pastillas y purgado de frenos', 1.00, 0.00, 450.00, 450.00, 3);

-- Pago inicial (Anticipo) OT 1
INSERT INTO `pagos` (`orden_trabajo_id`, `cliente_id`, `usuario_id`, `tipo_pago`, `metodo_pago`, `monto`, `numero_referencia`, `notas`, `fecha_pago`) VALUES
(1, 1, 5, 'ANTICIPO', 'TRANSFERENCIA', 500.00, 'TRANS-998822', 'Anticipo para compra de refacciones e inicio de labor', '2026-09-25 10:15:00');

-- Historial estado OT 1
INSERT INTO `ot_historial_estados` (`orden_trabajo_id`, `estado_anterior`, `estado_nuevo`, `usuario_id`, `comentario`, `fecha_cambio`) VALUES
(1, NULL, 'RECEPCIONADO', 2, 'Vehículo ingresado a patio', '2026-09-25 09:30:00'),
(1, 'RECEPCIONADO', 'EN_DIAGNOSTICO', 3, 'Revisión en rampa de frenos', '2026-09-25 10:00:00'),
(1, 'EN_DIAGNOSTICO', 'EN_REPARACION', 3, 'Anticipo confirmado, inicio de desmontaje', '2026-09-25 10:30:00');

-- Presupuesto de ejemplo convertible
INSERT INTO `presupuestos` (`id`, `numero_presupuesto`, `cliente_id`, `vehiculo_id`, `tecnico_id`, `estado`, `vigencia_dias`, `observaciones`, `subtotal`, `impuesto`, `total`, `fecha_emision`) VALUES
(1, 'COT-2026-0001', 2, 2, 4, 'PENDIENTE', 15, 'Afinación mayor recomendada a los 30,000 KM', 1530.00, 244.80, 1774.80, '2026-09-26 11:00:00');

INSERT INTO `presupuesto_detalles` (`presupuesto_id`, `tipo_item`, `repuesto_id`, `descripcion`, `cantidad`, `costo_estimado`, `precio_unitario`, `subtotal`) VALUES
(1, 'REPUESTO', 3, 'Aceite Sintético 5W-30 Galón (3.78L)', 1.00, 380.00, 750.00, 750.00),
(1, 'REPUESTO', 4, 'Filtro de Aceite Blindado PH4967', 1.00, 65.00, 160.00, 160.00),
(1, 'REPUESTO', 5, 'Juego de 4 Bujías de Iridio NGK', 1.00, 280.00, 620.00, 620.00),
(1, 'MANO_OBRA', NULL, 'Mano de obra afinación mayor por computadora', 1.00, 0.00, 500.00, 500.00);
