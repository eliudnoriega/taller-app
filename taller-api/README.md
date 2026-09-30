# 🚗 API REST para Sistema de Gestión de Taller Mecánico y Automotriz

Backend desarrollado en **PHP 8** con conexión nativa a **MySQL / MariaDB** mediante **PDO**, arquitectura modular limpia, transacciones seguras (ACID) y soporte completo de CORS para integración con cualquier frontend (Vue, React, Angular, Flutter, etc.).

---

## 📁 Estructura del Proyecto

```text
taller-api/
├── composer.json               # Configuración Composer y autoloading PSR-4
├── router.php                  # Enrutador para servidor de desarrollo PHP CLI
├── database/
│   └── taller_db.sql           # Esquema relacional completo, DDL, índices, constraints y datos demo
├── config/
│   └── database.php            # Conexión Singleton PDO con soporte de transacciones y UTF-8
├── public/
│   ├── index.php               # Front-controller que mapea y despacha todas las rutas
│   ├── .htaccess               # Reglas de reescritura para Apache / XAMPP
│   └── uploads/                # Directorio para subida y almacenamiento de fotos de inspección
├── scripts/
│   └── setup_db.php            # Script de inicialización y reseteo automático de base de datos
├── tests/
│   └── test_api.php            # Suite de pruebas automatizadas de todos los endpoints
└── src/
    ├── Autoloader.php          # Autocargador PSR-4 nativo
    ├── Controllers/            # Controladores REST por cada módulo
    │   ├── ClienteController.php
    │   ├── VehiculoController.php
    │   ├── OrdenTrabajoController.php
    │   ├── PresupuestoController.php
    │   ├── HistorialClinicoController.php
    │   ├── InventarioController.php
    │   ├── CajaController.php
    │   ├── DashboardController.php
    │   ├── NotificacionController.php
    │   └── UsuarioController.php
    ├── Services/               # Servicios con lógica de negocio desacoplada
    │   ├── OrdenTrabajoService.php
    │   ├── PresupuestoService.php
    │   └── InventarioService.php
    └── Utils/                  # Utilidades comunes
        ├── Router.php          # Enrutador REST con soporte de variables dinámicas
        ├── Response.php        # Emisor JSON estándar y cabeceras CORS
        └── WhatsAppHelper.php  # Generador de enlaces Click-to-Chat y plantillas
```

---

## 🗄️ Base de Datos (`database/taller_db.sql`)

El archivo SQL contiene la creación de la base de datos `taller_db` con charset `utf8mb4` e intercala 15 tablas relacionales con integridad referencial, índices optimizados y datos semilla iniciales:

1. `usuarios`: Administradores, recepcionistas, mecánicos/técnicos y cajeros.
2. `clientes`: Datos de clientes y propietarios.
3. `vehiculos`: Automóviles, camionetas, motos o equipos por cliente (placa, serie/VIN, kilometraje).
4. `categorias_repuestos`: Clasificación de refacciones y fluidos.
5. `repuestos`: Refacciones con costo de compra, precio de venta, stock actual y stock mínimo.
6. `ordenes_trabajo`: Órdenes (OT) con estados en tiempo real, combustible, kilometraje y token de seguimiento.
7. `ot_checklist`: Inspección física de ingreso (carrocería, luces, interiores, llanta de auxilio, gata).
8. `ot_fotografias`: Fotos de recepción, proceso mecánico y entrega.
9. `ot_historial_estados`: Bitácora de cambios de estado en tiempo real.
10. `ot_items`: Desglose de repuestos utilizados y mano de obra imputada por mecánico.
11. `presupuestos`: Cotizaciones rápidas.
12. `presupuesto_detalles`: Detalle de repuestos y mano de obra del presupuesto.
13. `movimientos_inventario`: Kardex con entradas, salidas de OT, devoluciones y ajustes.
14. `pagos`: Caja: anticipos, abonos parciales y liquidación final.
15. `notificaciones_bitacora`: Registro de notificaciones por WhatsApp y correo electrónico.

### Inicialización rápida de la Base de Datos:
```bash
# Ejecutar script CLI incluido
php scripts/setup_db.php
```

---

## 🚀 Puesta en Marcha

### Opción A: Con el servidor integrado de PHP
```bash
cd taller-api
php -S localhost:8000 router.php
```

### Opción B: Con Apache / XAMPP
1. Colocar el proyecto en `C:\xampp\htdocs\taller-api`.
2. Acceder mediante `http://localhost/taller-api/public/`.
3. El archivo `.htaccess` redirige automáticamente todas las solicitudes a `public/index.php`.

---

## 📋 Catálogo Completo de Endpoints por Módulo

### 0. Módulo: Autenticación y Seguridad (JWT)

| Método | Endpoint | Cabeceras / Payload | Descripción |
|---|---|---|---|
| `POST` | `/api/auth/login` | Body JSON: `{"email": "admin@melecsa.com", "password": "admin"}` | **Inicio de sesión**: Valida credenciales con hash bcrypt y emite Token JWT firmado con HS256 (vigencia 24h) |
| `GET` | `/api/auth/me` | Header: `Authorization: Bearer <token>` | **Perfil del usuario autenticado**: Valida la firma del token JWT y devuelve los datos del usuario actual incluyendo su foto de perfil |
| `POST` | `/api/auth/foto` | Header: `Authorization: Bearer <token>`, Form/JSON: `foto` (archivo) o `url_foto` | **Subir mi foto de perfil**: Actualiza la fotografía del usuario que tiene la sesión activa |

> **Credenciales por defecto**:
> - **Usuario**: `admin@melecsa.com`
> - **Contraseña**: `admin`
> - **Rol**: `ADMIN`

---

### 1. Módulo: Recepción y Órdenes de Trabajo (OT)

| Método | Endpoint | Descripción |
|---|---|---|
| `POST` | `/api/clientes` | Registrar nuevo cliente (`nombre`, `telefono`, `numero_documento`, `email`) |
| `GET` | `/api/clientes` | Listar clientes (admite filtro de búsqueda `?q=`) |
| `GET` | `/api/clientes/{id}` | Ver detalle del cliente y sus vehículos asociados |
| `PUT` | `/api/clientes/{id}` | Actualizar datos del cliente |
| `GET` | `/api/clientes/{id}/vehiculos` | Listar vehículos registrados a nombre de un cliente |
| `POST` | `/api/vehiculos` | Registrar vehículo (`cliente_id`, `marca`, `modelo`, `placa`, `anio`, `kilometraje_actual`) |
| `GET` | `/api/vehiculos` | Listar vehículos con datos de sus propietarios |
| `GET` | `/api/vehiculos/{id}` | Detalle del vehículo y su historial de órdenes |
| `GET` | `/api/vehiculos/buscar?placa=...` | Búsqueda rápida de vehículo por placa o serie VIN |
| `POST` | `/api/ordenes` | **Recepción completa**: Crea OT, asigna técnico, kilometraje, combustible, genera token de seguimiento y checklist |
| `GET` | `/api/ordenes` | Listar OTs (filtros: `?estado=`, `?tecnico_id=`, `?cliente_id=`, `?q=`) |
| `GET` | `/api/ordenes/{id}` | Detalle completo de la OT (cliente, vehículo, checklist, fotos, items, pagos, saldos) |
| `PUT` | `/api/ordenes/{id}/estado` | **Cambio de estado en tiempo real** (`EN_DIAGNOSTICO`, `ESPERANDO_REPUESTOS`, `EN_REPARACION`, `LISTO_ENTREGA`, `ENTREGADO`, `CANCELADO`) |
| `PUT` | `/api/ordenes/{id}/asignar-tecnico` | Asignar o reasignar técnico mecánico a la OT |
| `POST` | `/api/ordenes/{id}/checklist` | Guardar o actualizar checklist físico de ingreso |
| `GET` | `/api/ordenes/{id}/checklist` | Obtener checklist de inspección de la OT |
| `POST` | `/api/ordenes/{id}/fotos` | Subir fotografía (archivo multipart en `archivo` o URL en `url_archivo`, etapa: `RECEPCION`, `DIAGNOSTICO`, `REPARACION`, `ENTREGA`) |
| `GET` | `/api/ordenes/{id}/fotos` | Obtener galería de fotos de la orden |
| `POST` | `/api/ordenes/{id}/items` | Agregar repuesto o mano de obra a la orden (recalcula automáticamente subtotales, impuestos y saldo) |
| `DELETE` | `/api/ordenes/{id}/items/{itemId}` | Eliminar repuesto o labor de la orden (recalcula totales) |
| `GET` | `/api/ordenes/{id}/historial-estados` | Bitácora cronológica de transiciones de estado y comentarios del técnico |
| `POST` | `/api/ordenes/{id}/cerrar` | Cierre de orden y **descarga automática del inventario** |

---

### 2. Módulo: Presupuestos e Historial Clínico

| Método | Endpoint | Descripción |
|---|---|---|
| `POST` | `/api/presupuestos` | Crear cotización rápida con desglose de repuestos y mano de obra |
| `GET` | `/api/presupuestos` | Listar presupuestos con filtros por estado, cliente o vehículo |
| `GET` | `/api/presupuestos/{id}` | Ver detalle del presupuesto, repuestos y precios calculados |
| `POST` | `/api/presupuestos/{id}/convertir-a-ot` | **¡Conversión con 1 clic a Orden de Trabajo!** Crea la OT correlativa, migra todos los repuestos y mano de obra, asigna token y actualiza estado a `CONVERTIDO_OT` |
| `GET` | `/api/historial-clinico?placa=...` | **Historial Clínico Vehicular Completo**: Consulta por placa o VIN la ficha técnica, evolución de kilometraje, diagnósticos históricos, repuestos reemplazados con SKU, mano de obra y costos |

---

### 3. Módulo: Control de Inventario, Repuestos y Catálogo de Productos

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/api/categorias` | **Listado de categorías**: Retorna el catálogo completo de categorías para alimentar el selector/combobox en el formulario |
| `POST` | `/api/categorias` | **Crear categoría**: Registra una nueva categoría (`{"nombre": "Aceites y Fluidos"}`) |
| `GET` | `/api/repuestos` o `/api/productos` | Listar repuestos/productos (muestra costo de compra, precio de venta, margen bruto, margen % y `foto_producto` en Base64) |
| `POST` | `/api/repuestos` o `/api/productos` | **Registrar producto/insumo**: Admite categoría dinámica (si no existe la crea automáticamente; si existe la asocia) y foto en Base64 (`foto_producto`). Campos: `codigo_sku`, `categoria` o `categoria_id`, `nombre_producto` o `nombre`, `stock_inicial` o `stock_actual`, `stock_minimo`, `costo_compra`, `precio_venta`, `ubicacion_almacen`, `unidad_medida`, `foto_producto` |
| `GET` | `/api/repuestos/{id}` o `/api/productos/{id}` | Detalle del producto con su `foto_producto` en Base64, categoría y cálculo de utilidad unitaria |
| `PUT` | `/api/repuestos/{id}` o `/api/productos/{id}` | Actualizar datos, precios, stocks, categoría y foto Base64 del producto |
| `GET` | `/api/repuestos/alertas-stock` | **Alertas de stock mínimo**: Lista repuestos donde `stock_actual <= stock_minimo`, déficit de unidades y costo estimado de reposición |
| `POST` | `/api/repuestos/{id}/movimiento` | Registrar movimiento manual en Kardex (`ENTRADA_COMPRA`, `AJUSTE_POSITIVO`, `AJUSTE_NEGATIVO`, `DEVOLUCION`) |
| `GET` | `/api/repuestos/{id}/kardex` | Historial completo de movimientos de un repuesto con trazabilidad por OT y usuario |
| `POST` | `/api/ordenes/{id}/cerrar` | **Descarga automática de inventario**: Descuenta del stock los repuestos usados en la OT, registra movimientos `SALIDA_OT` y sella la orden |

---

### 4. Módulo: Caja, Pagos y Cuentas por Cobrar

| Método | Endpoint | Descripción |
|---|---|---|
| `POST` | `/api/ordenes/{id}/pagos` | Registrar pago (`ANTICIPO`, `PAGO_PARCIAL`, `LIQUIDACION`) con método (`EFECTIVO`, `TARJETA_DEBITO`, `TARJETA_CREDITO`, `TRANSFERENCIA`), actualiza saldo pendiente en tiempo real |
| `GET` | `/api/ordenes/{id}/pagos` | Historial de recibos y comprobantes de pago de una OT |
| `GET` | `/api/caja/cuentas-por-cobrar` | **Cuentas por cobrar**: Lista órdenes con saldo pendiente > 0, días de antigüedad y contacto de los clientes |
| `GET` | `/api/reportes/ingresos-diarios` | **Reporte diario de ingresos**: Recaudación del día o rango de fechas desglosado por método de pago y detalle de recibos |
| `GET` | `/api/reportes/ingresos-mensuales?anio=2026` | **Reporte mensual**: Recaudación mes a mes por método de pago |
| `GET` | `/api/reportes/ingresos-por-mecanico` | **Productividad por mecánico**: Mano de obra producida y órdenes atendidas por cada técnico |

---

### 5. Módulo: Panel de Control (Dashboard) y Notificaciones

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/api/dashboard/metricas` | **Métricas de rentabilidad**: Facturación bruta, costo de refacciones, ganancia neta en repuestos, ingresos por mano de obra, margen de utilidad global %, conteo de OTs por estado, cuentas por cobrar y alertas de stock |
| `GET` | `/api/seguimiento/{token}` | **Portal público de seguimiento para el cliente**: Consulta en tiempo real sin requerir contraseña (estado con barra de progreso, checklist, fotos de avance y saldo pendiente) |
| `POST` | `/api/notificaciones/whatsapp` | **Integración WhatsApp**: Genera enlace Click-to-Chat (`https://api.whatsapp.com/send?phone=...&text=...`) con plantilla pre-armada (Ingreso, Cambio de estado, Listo para entrega o Presupuesto) y lo guarda en bitácora |
| `POST` | `/api/notificaciones/email` | Despacho de notificación por correo electrónico con enlace de seguimiento |
| `GET` | `/api/notificaciones/historial` | Bitácora de avisos enviados a clientes |

---

### 6. Módulo: Administración de Usuarios y Roles (RBAC)

El sistema soporta 4 roles con privilegios específicos:
- 👑 **`ADMIN`**: Acceso total al taller, configuración, usuarios, caja, inventario y métricas.
- 📋 **`RECEPCIONISTA`**: Gestión de clientes, recepción vehicular, checklist de ingreso, cotizaciones y WhatsApp.
- 🔧 **`MECANICO`**: Diagnóstico, reparación de vehículos, checklist de inspección y registro de repuestos/mano de obra.
- 💵 **`CAJERO`**: Caja, registro de anticipos, abonos parciales, liquidación de órdenes y reportes diarios.

| Método | Endpoint | Parámetros / Payload | Descripción |
|---|---|---|---|
| `GET` | `/api/usuarios` | Query: `?rol=`, `?activo=`, `?q=` | Listar usuarios del taller con filtros por rol y estado |
| `GET` | `/api/usuarios/rol/{rol}` | Parámetro URL: `rol` (`ADMIN`, `RECEPCIONISTA`, `MECANICO`, `CAJERO`) | **Filtrar por rol**: Listado específico de usuarios con contador y validación de rol permitido |
| `GET` | `/api/usuarios/roles` | Ninguno | **Catálogo de roles**: Devuelve descripción detallada y lista de permisos por cada rol |
| `GET` | `/api/usuarios/mecanicos` | Ninguno | Lista rápida de mecánicos activos para asignación de órdenes |
| `POST` | `/api/usuarios` | Body JSON: `nombre`, `email`, `password`, `rol`, `telefono`, `especialidad` | **Registrar usuario**: Valida unicidad de correo, valida rol permitido y encripta con bcrypt |
| `GET` | `/api/usuarios/{id}` | Parámetro URL: `id` | Detalle del usuario y métricas de órdenes asignadas/recibidas |
| `PUT` | `/api/usuarios/{id}` | Body JSON: campos a modificar | **Actualizar usuario**: Modifica datos, rol, especialidad o contraseña |
| `DELETE` | `/api/usuarios/{id}` | Parámetro URL: `id` | **Eliminación inteligente**: Borrado físico si no tiene historial o desactivación segura (`activo=0`) si tiene transacciones vinculadas |
| `POST` | `/api/usuarios/{id}/foto` | Multipart: `foto` (archivo) o Body JSON: `url_foto` | **Subir foto de perfil**: Sube imagen (`jpg, png, webp, gif`) a `public/uploads/perfiles/` o asigna URL |
| `DELETE` | `/api/usuarios/{id}/foto` | Parámetro URL: `id` | **Eliminar foto de perfil**: Elimina el archivo del servidor y restablece a NULL |

---

## 🧪 Pruebas Automatizadas

Se incluye un script que prueba los flujos completos de los módulos:
```bash
php tests/test_api.php
```
Respuesta esperada: Todos los endpoints responden con código HTTP `200` o `201`.

