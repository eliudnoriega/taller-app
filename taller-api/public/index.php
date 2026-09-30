<?php

// Front Controller - API Taller Mecánico

// 1. Cargar autocargadores
if (file_exists(dirname(__DIR__) . '/vendor/autoload.php')) {
    require_once dirname(__DIR__) . '/vendor/autoload.php';
}
require_once dirname(__DIR__) . '/src/Autoloader.php';
\App\Autoloader::register();

use App\Utils\Router;
use App\Controllers\ClienteController;
use App\Controllers\VehiculoController;
use App\Controllers\OrdenTrabajoController;
use App\Controllers\PresupuestoController;
use App\Controllers\HistorialClinicoController;
use App\Controllers\InventarioController;
use App\Controllers\CajaController;
use App\Controllers\DashboardController;
use App\Controllers\NotificacionController;
use App\Controllers\UsuarioController;
use App\Controllers\AuthController;

$router = new Router();

// ==============================================================================
// RUTAS: AUTENTICACIÓN Y CONTROL DE ACCESO (JWT)
// ==============================================================================
$router->post('/api/auth/login',          [AuthController::class, 'login']);
$router->get('/api/auth/me',              [AuthController::class, 'me']);
$router->post('/api/auth/foto',           [AuthController::class, 'subirMiFoto']);

// ==============================================================================
// RUTAS: MÓDULO 1 - RECEPCIÓN Y ÓRDENES DE TRABAJO (OT)
// ==============================================================================

// Clientes
$router->get('/api/clientes',             [ClienteController::class, 'index']);
$router->post('/api/clientes',            [ClienteController::class, 'create']);
$router->get('/api/clientes/{id}',        [ClienteController::class, 'show']);
$router->put('/api/clientes/{id}',        [ClienteController::class, 'update']);
$router->get('/api/clientes/{id}/vehiculos', [ClienteController::class, 'vehiculos']);

// Vehículos
$router->get('/api/vehiculos',            [VehiculoController::class, 'index']);
$router->post('/api/vehiculos',           [VehiculoController::class, 'create']);
$router->get('/api/vehiculos/buscar',     [VehiculoController::class, 'buscar']);
$router->get('/api/vehiculos/{id}',       [VehiculoController::class, 'show']);
$router->put('/api/vehiculos/{id}',       [VehiculoController::class, 'update']);

// Órdenes de Trabajo (OT)
$router->get('/api/ordenes',              [OrdenTrabajoController::class, 'index']);
$router->post('/api/ordenes',             [OrdenTrabajoController::class, 'create']);
$router->get('/api/ordenes/{id}',         [OrdenTrabajoController::class, 'show']);
$router->put('/api/ordenes/{id}/estado',  [OrdenTrabajoController::class, 'cambiarEstado']);
$router->put('/api/ordenes/{id}/asignar-tecnico', [OrdenTrabajoController::class, 'asignarTecnico']);

// Checklist y Fotografías de la OT
$router->get('/api/ordenes/{id}/checklist',  [OrdenTrabajoController::class, 'obtenerChecklist']);
$router->post('/api/ordenes/{id}/checklist', [OrdenTrabajoController::class, 'guardarChecklist']);
$router->get('/api/ordenes/{id}/fotos',      [OrdenTrabajoController::class, 'obtenerFotos']);
$router->post('/api/ordenes/{id}/fotos',     [OrdenTrabajoController::class, 'agregarFoto']);

// Items (Repuestos y Mano de Obra) de la OT
$router->post('/api/ordenes/{id}/items',             [OrdenTrabajoController::class, 'agregarItem']);
$router->delete('/api/ordenes/{id}/items/{itemId}',  [OrdenTrabajoController::class, 'eliminarItem']);
$router->get('/api/ordenes/{id}/historial-estados',  [OrdenTrabajoController::class, 'obtenerHistorialEstados']);

// Cierre de orden y descarga automática de inventario
$router->post('/api/ordenes/{id}/cerrar',            [OrdenTrabajoController::class, 'cerrarOrden']);

// ==============================================================================
// RUTAS: MÓDULO 2 - PRESUPUESTOS E HISTORIAL CLÍNICO
// ==============================================================================

// Presupuestos y conversión en 1 clic a OT
$router->get('/api/presupuestos',                    [PresupuestoController::class, 'index']);
$router->post('/api/presupuestos',                   [PresupuestoController::class, 'create']);
$router->get('/api/presupuestos/{id}',               [PresupuestoController::class, 'show']);
$router->post('/api/presupuestos/{id}/convertir-a-ot', [PresupuestoController::class, 'convertirAOrdenTrabajo']);

// Historial Clínico completo por Placa o VIN
$router->get('/api/historial-clinico',               [HistorialClinicoController::class, 'consultar']);
$router->get('/api/historial-clinico/{vehiculo_id}', [HistorialClinicoController::class, 'consultar']);

// ==============================================================================
// RUTAS: MÓDULO 3 - CONTROL DE INVENTARIO, REPUESTOS Y PRODUCTOS
// ==============================================================================
// Categorías (listado dinámico y creación)
$router->get('/api/categorias',                      [InventarioController::class, 'categorias']);
$router->post('/api/categorias',                     [InventarioController::class, 'crearCategoria']);

// Insumos y Productos (Soporte Base64 en foto_producto y categorías dinámicas)
$router->get('/api/productos',                       [InventarioController::class, 'index']);
$router->post('/api/productos',                      [InventarioController::class, 'create']);
$router->get('/api/productos/{id}',                  [InventarioController::class, 'show']);
$router->put('/api/productos/{id}',                  [InventarioController::class, 'update']);

// Repuestos
$router->get('/api/repuestos',                       [InventarioController::class, 'index']);
$router->post('/api/repuestos',                      [InventarioController::class, 'create']);
$router->get('/api/repuestos/alertas-stock',         [InventarioController::class, 'alertasStockMinimo']);
$router->get('/api/repuestos/{id}',                  [InventarioController::class, 'show']);
$router->put('/api/repuestos/{id}',                  [InventarioController::class, 'update']);
$router->post('/api/repuestos/{id}/movimiento',      [InventarioController::class, 'registrarMovimiento']);
$router->get('/api/repuestos/{id}/kardex',           [InventarioController::class, 'kardex']);

// ==============================================================================
// RUTAS: MÓDULO 4 - CAJA, PAGOS Y CUENTAS POR COBRAR
// ==============================================================================
$router->post('/api/ordenes/{id}/pagos',             [CajaController::class, 'registrarPago']);
$router->get('/api/ordenes/{id}/pagos',              [CajaController::class, 'obtenerPagos']);
$router->get('/api/caja/cuentas-por-cobrar',         [CajaController::class, 'cuentasPorCobrar']);
$router->get('/api/reportes/ingresos-diarios',       [CajaController::class, 'reporteIngresosDiarios']);
$router->get('/api/reportes/ingresos-mensuales',     [CajaController::class, 'reporteIngresosMensuales']);
$router->get('/api/reportes/ingresos-por-mecanico',  [CajaController::class, 'reporteIngresosPorMecanico']);

// ==============================================================================
// RUTAS: MÓDULO 5 - DASHBOARD Y NOTIFICACIONES (WHATSAPP, CORREO, SEGUIMIENTO)
// ==============================================================================
$router->get('/api/dashboard/metricas',              [DashboardController::class, 'metricas']);
$router->get('/api/seguimiento/{token}',             [NotificacionController::class, 'consultarSeguimientoPublico']);
$router->post('/api/notificaciones/whatsapp',        [NotificacionController::class, 'generarWhatsApp']);
$router->post('/api/notificaciones/email',           [NotificacionController::class, 'enviarEmail']);
$router->get('/api/notificaciones/historial',        [NotificacionController::class, 'historial']);

// ==============================================================================
// RUTAS: ADMINISTRACIÓN DE USUARIOS Y ROLES (ADMIN, RECEPCIONISTA, MECANICO, CAJERO)
// ==============================================================================
$router->get('/api/usuarios',                        [UsuarioController::class, 'index']);
$router->get('/api/usuarios/roles',                  [UsuarioController::class, 'roles']);
$router->get('/api/usuarios/rol/{rol}',              [UsuarioController::class, 'porRol']);
$router->get('/api/usuarios/mecanicos',              [UsuarioController::class, 'mecanicos']);
$router->post('/api/usuarios',                       [UsuarioController::class, 'create']);
$router->get('/api/usuarios/{id}',                   [UsuarioController::class, 'show']);
$router->put('/api/usuarios/{id}',                   [UsuarioController::class, 'update']);
$router->delete('/api/usuarios/{id}',                [UsuarioController::class, 'delete']);
$router->post('/api/usuarios/{id}/foto',              [UsuarioController::class, 'subirFoto']);
$router->delete('/api/usuarios/{id}/foto',            [UsuarioController::class, 'eliminarFoto']);

// Ruta raíz de prueba de estado de la API
$router->get('/', function() {
    \App\Utils\Response::json([
        'api'     => 'API de Gestión Integral para Taller Mecánico',
        'version' => '1.0.0',
        'status'  => 'OPERATIONAL',
        'modulos' => [
            '1. Recepción y Órdenes de Trabajo (OT)',
            '2. Presupuestos e Historial Clínico Vehicular',
            '3. Control de Inventario, Repuestos y Alertas de Stock',
            '4. Caja, Pagos, Cuentas por Cobrar y Reportes',
            '5. Panel de Control (Dashboard), Seguimiento Público y Notificaciones (WhatsApp)'
        ]
    ]);
});

// Despachar la solicitud actual
$router->dispatch();
