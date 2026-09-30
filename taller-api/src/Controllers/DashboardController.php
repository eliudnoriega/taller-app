<?php

namespace App\Controllers;

use App\Config\Database;
use App\Utils\Response;
use App\Utils\Router;
use PDO;

class DashboardController
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    /**
     * Métricas globales de rentabilidad, estados y alertas del taller
     */
    public function metricas(): void
    {
        $params = Router::getRequestData();
        $mes = $params['mes'] ?? date('m');
        $anio = $params['anio'] ?? date('Y');

        // 1. Conteo de órdenes por estado
        $sqlEstados = "SELECT estado, COUNT(*) AS total
                       FROM ordenes_trabajo
                       GROUP BY estado";
        $stmtEstados = $this->db->query($sqlEstados);
        $conteoPorEstado = [
            'RECEPCIONADO'        => 0,
            'EN_DIAGNOSTICO'      => 0,
            'ESPERANDO_REPUESTOS' => 0,
            'EN_REPARACION'       => 0,
            'LISTO_ENTREGA'       => 0,
            'ENTREGADO'           => 0,
            'CANCELADO'           => 0
        ];
        foreach ($stmtEstados->fetchAll() as $row) {
            $conteoPorEstado[$row['estado']] = (int)$row['total'];
        }

        // 2. Métricas de rentabilidad del periodo (Órdenes creadas o cerradas en el mes)
        $sqlRentabilidad = "
            SELECT 
                COALESCE(SUM(i.subtotal), 0) AS facturacion_total_items,
                COALESCE(SUM(CASE WHEN i.tipo_item = 'REPUESTO' THEN i.subtotal ELSE 0 END), 0) AS venta_repuestos,
                COALESCE(SUM(CASE WHEN i.tipo_item = 'REPUESTO' THEN (i.costo_unitario * i.cantidad) ELSE 0 END), 0) AS costo_repuestos,
                COALESCE(SUM(CASE WHEN i.tipo_item IN ('MANO_OBRA', 'SERVICIO_EXTERNO') THEN i.subtotal ELSE 0 END), 0) AS ingresos_mano_obra
            FROM ot_items i
            INNER JOIN ordenes_trabajo ot ON i.orden_trabajo_id = ot.id
            WHERE MONTH(ot.fecha_ingreso) = :mes AND YEAR(ot.fecha_ingreso) = :anio AND ot.estado != 'CANCELADO'
        ";
        $stmtRent = $this->db->prepare($sqlRentabilidad);
        $stmtRent->execute([':mes' => $mes, ':anio' => $anio]);
        $rent = $stmtRent->fetch();

        $ventaRepuestos = (float)$rent['venta_repuestos'];
        $costoRepuestos = (float)$rent['costo_repuestos'];
        $gananciaRepuestos = round($ventaRepuestos - $costoRepuestos, 2);
        $ingresosManoObra = (float)$rent['ingresos_mano_obra'];
        
        // La utilidad total es la ganancia en repuestos más la mano de obra producida
        $utilidadEstimada = round($gananciaRepuestos + $ingresosManoObra, 2);
        $facturacionTotal = (float)$rent['facturacion_total_items'];
        $margenRentabilidadPorcentaje = $facturacionTotal > 0 ? round(($utilidadEstimada / $facturacionTotal) * 100, 2) : 0.00;

        // 3. Flujo de Caja en el mes (pagos reales recaudados)
        $sqlCajaMes = "SELECT COALESCE(SUM(monto), 0) AS total_recaudado FROM pagos WHERE MONTH(fecha_pago) = :mes AND YEAR(fecha_pago) = :anio";
        $stmtCajaMes = $this->db->prepare($sqlCajaMes);
        $stmtCajaMes->execute([':mes' => $mes, ':anio' => $anio]);
        $recaudacionMes = (float)$stmtCajaMes->fetch()['total_recaudado'];

        // 4. Recaudación del día de hoy
        $sqlCajaHoy = "SELECT COALESCE(SUM(monto), 0) AS total_hoy FROM pagos WHERE DATE(fecha_pago) = CURDATE()";
        $recaudacionHoy = (float)$this->db->query($sqlCajaHoy)->fetch()['total_hoy'];

        // 5. Cuentas por cobrar acumuladas totales
        $sqlCxC = "SELECT COALESCE(SUM(saldo_pendiente), 0) AS total_por_cobrar, COUNT(*) AS ordenes_pendientes_pago 
                   FROM ordenes_trabajo WHERE saldo_pendiente > 0 AND estado != 'CANCELADO'";
        $cxcData = $this->db->query($sqlCxC)->fetch();

        // 6. Alertas de stock crítico
        $sqlStock = "SELECT COUNT(*) AS total_criticos FROM repuestos WHERE stock_actual <= stock_minimo AND activo = 1";
        $alertasStock = (int)$this->db->query($sqlStock)->fetch()['total_criticos'];

        // 7. Resumen de clientes y vehículos
        $totalClientes = (int)$this->db->query("SELECT COUNT(*) AS total FROM clientes")->fetch()['total'];
        $totalVehiculos = (int)$this->db->query("SELECT COUNT(*) AS total FROM vehiculos")->fetch()['total'];

        Response::json([
            'periodo' => [
                'mes'  => (int)$mes,
                'anio' => (int)$anio
            ],
            'rentabilidad' => [
                'facturacion_bruta_items'     => $facturacionTotal,
                'venta_repuestos'             => $ventaRepuestos,
                'costo_compra_repuestos'      => $costoRepuestos,
                'utilidad_repuestos'          => $gananciaRepuestos,
                'ingresos_mano_obra'          => $ingresosManoObra,
                'utilidad_neta_estimada'      => $utilidadEstimada,
                'margen_rentabilidad_porc'    => $margenRentabilidadPorcentaje
            ],
            'flujo_caja' => [
                'recaudacion_hoy'             => $recaudacionHoy,
                'recaudacion_mes'             => $recaudacionMes,
                'cuentas_por_cobrar_total'    => (float)$cxcData['total_por_cobrar'],
                'ordenes_con_deuda'           => (int)$cxcData['ordenes_pendientes_pago']
            ],
            'ordenes_por_estado'              => $conteoPorEstado,
            'inventario' => [
                'repuestos_alerta_stock_bajo' => $alertasStock
            ],
            'base_instalada' => [
                'total_clientes'              => $totalClientes,
                'total_vehiculos'             => $totalVehiculos
            ]
        ], 200, 'Métricas del dashboard obtenidas exitosamente');
    }
}
