<?php

namespace App\Controllers;

use App\Config\Database;
use App\Services\OrdenTrabajoService;
use App\Utils\Response;
use App\Utils\Router;
use PDO;

class CajaController
{
    private PDO $db;
    private OrdenTrabajoService $otService;

    public function __construct()
    {
        $this->db = Database::getConnection();
        $this->otService = new OrdenTrabajoService();
    }

    /**
     * Registrar anticipo, pago parcial o liquidación de una orden
     */
    public function registrarPago(array $params): void
    {
        $otId = (int)($params['id'] ?? 0);
        $data = Router::getRequestData();

        $monto = (float)($data['monto'] ?? 0);
        $metodoPago = strtoupper(trim($data['metodo_pago'] ?? 'EFECTIVO'));
        $tipoPago = strtoupper(trim($data['tipo_pago'] ?? 'PAGO_PARCIAL'));
        $referencia = $data['numero_referencia'] ?? null;
        $notas = $data['notas'] ?? null;
        $usuarioId = !empty($data['usuario_id']) ? (int)$data['usuario_id'] : null;

        if ($monto <= 0) {
            Response::error('El monto del pago debe ser mayor a 0', 422);
        }

        $validMetodos = ['EFECTIVO', 'TARJETA_DEBITO', 'TARJETA_CREDITO', 'TRANSFERENCIA', 'OTRO'];
        if (!in_array($metodoPago, $validMetodos)) {
            Response::error("Método de pago inválido. Permitidos: " . implode(', ', $validMetodos), 422);
        }

        $validTipos = ['ANTICIPO', 'PAGO_PARCIAL', 'LIQUIDACION'];
        if (!in_array($tipoPago, $validTipos)) {
            Response::error("Tipo de pago inválido. Permitidos: " . implode(', ', $validTipos), 422);
        }

        $this->db->beginTransaction();

        try {
            // Verificar OT y saldo
            $stmtOt = $this->db->prepare("SELECT id, cliente_id, total_general, total_pagado, saldo_pendiente FROM ordenes_trabajo WHERE id = :id FOR UPDATE");
            $stmtOt->execute([':id' => $otId]);
            $ot = $stmtOt->fetch();

            if (!$ot) {
                Response::error('Orden de Trabajo no encontrada', 404);
            }

            $saldoActual = (float)$ot['saldo_pendiente'];

            // Registrar pago
            $sqlPago = "INSERT INTO pagos (orden_trabajo_id, cliente_id, usuario_id, tipo_pago, metodo_pago, monto, numero_referencia, notas)
                        VALUES (:ot_id, :cliente_id, :user_id, :tipo, :metodo, :monto, :ref, :notas)";
            $stmtPago = $this->db->prepare($sqlPago);
            $stmtPago->execute([
                ':ot_id'      => $otId,
                ':cliente_id' => $ot['cliente_id'],
                ':user_id'    => $usuarioId,
                ':tipo'       => $tipoPago,
                ':metodo'     => $metodoPago,
                ':monto'      => $monto,
                ':ref'        => $referencia,
                ':notas'      => $notas
            ]);
            $pagoId = (int)$this->db->lastInsertId();

            // Recalcular saldo y totales de la orden
            $this->otService->recalcularTotales($otId);

            // Obtener datos actualizados
            $stmtUpdated = $this->db->prepare("SELECT total_general, total_pagado, saldo_pendiente FROM ordenes_trabajo WHERE id = :id");
            $stmtUpdated->execute([':id' => $otId]);
            $otActualizada = $stmtUpdated->fetch();

            $this->db->commit();

            Response::json([
                'pago_id'         => $pagoId,
                'orden_id'        => $otId,
                'monto_abonado'   => $monto,
                'total_general'   => (float)$otActualizada['total_general'],
                'total_pagado'    => (float)$otActualizada['total_pagado'],
                'saldo_pendiente' => (float)$otActualizada['saldo_pendiente'],
                'esta_liquidada'  => (float)$otActualizada['saldo_pendiente'] <= 0.001
            ], 201, 'Pago registrado correctamente');
        } catch (\Throwable $e) {
            $this->db->rollBack();
            Response::error($e->getMessage(), 500);
        }
    }

    public function obtenerPagos(array $params): void
    {
        $otId = (int)($params['id'] ?? 0);
        $sql = "SELECT p.*, u.nombre AS cajero_nombre, c.nombre AS cliente_nombre
                FROM pagos p
                LEFT JOIN usuarios u ON p.usuario_id = u.id
                LEFT JOIN clientes c ON p.cliente_id = c.id
                WHERE p.orden_trabajo_id = :ot_id
                ORDER BY p.fecha_pago DESC";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':ot_id' => $otId]);
        Response::json($stmt->fetchAll());
    }

    /**
     * Listado de cuentas por cobrar (órdenes con saldo pendiente)
     */
    public function cuentasPorCobrar(): void
    {
        $sql = "SELECT ot.id AS orden_id, ot.numero_ot, ot.estado, ot.fecha_ingreso, ot.fecha_cierre,
                       ot.total_general, ot.total_pagado, ot.saldo_pendiente,
                       DATEDIFF(NOW(), ot.fecha_ingreso) AS dias_antiguedad,
                       c.id AS cliente_id, c.nombre AS cliente_nombre, c.telefono AS cliente_telefono, c.email AS cliente_email,
                       v.placa AS vehiculo_placa, v.marca AS vehiculo_marca, v.modelo AS vehiculo_modelo
                FROM ordenes_trabajo ot
                INNER JOIN clientes c ON ot.cliente_id = c.id
                INNER JOIN vehiculos v ON ot.vehiculo_id = v.id
                WHERE ot.saldo_pendiente > 0 AND ot.estado != 'CANCELADO'
                ORDER BY ot.saldo_pendiente DESC";

        $stmt = $this->db->query($sql);
        $cuentas = $stmt->fetchAll();

        $totalPorCobrar = array_sum(array_column($cuentas, 'saldo_pendiente'));

        Response::json([
            'total_cuentas'          => count($cuentas),
            'monto_total_por_cobrar' => round($totalPorCobrar, 2),
            'cuentas'                => $cuentas
        ]);
    }

    /**
     * Reporte de ingresos diarios agrupados por método de pago
     */
    public function reporteIngresosDiarios(): void
    {
        $data = Router::getRequestData();
        $desde = $data['desde'] ?? date('Y-m-d');
        $hasta = $data['hasta'] ?? date('Y-m-d');

        // Resumen por método de pago
        $sqlMetodos = "SELECT metodo_pago, COUNT(*) AS cantidad_transacciones, SUM(monto) AS total_monto
                       FROM pagos
                       WHERE DATE(fecha_pago) BETWEEN :desde AND :hasta
                       GROUP BY metodo_pago";
        $stmtMetodos = $this->db->prepare($sqlMetodos);
        $stmtMetodos->execute([':desde' => $desde, ':hasta' => $hasta]);
        $porMetodo = $stmtMetodos->fetchAll();

        // Detalle de transacciones
        $sqlDetalle = "SELECT p.id, p.fecha_pago, p.tipo_pago, p.metodo_pago, p.monto, p.numero_referencia,
                              ot.numero_ot, c.nombre AS cliente_nombre, u.nombre AS cajero_nombre
                       FROM pagos p
                       INNER JOIN ordenes_trabajo ot ON p.orden_trabajo_id = ot.id
                       INNER JOIN clientes c ON p.cliente_id = c.id
                       LEFT JOIN usuarios u ON p.usuario_id = u.id
                       WHERE DATE(p.fecha_pago) BETWEEN :desde AND :hasta
                       ORDER BY p.fecha_pago DESC";
        $stmtDetalle = $this->db->prepare($sqlDetalle);
        $stmtDetalle->execute([':desde' => $desde, ':hasta' => $hasta]);
        $transacciones = $stmtDetalle->fetchAll();

        $granTotal = array_sum(array_column($porMetodo, 'total_monto'));

        Response::json([
            'periodo' => ['desde' => $desde, 'hasta' => $hasta],
            'gran_total_ingresos' => round($granTotal, 2),
            'resumen_por_metodo' => $porMetodo,
            'transacciones' => $transacciones
        ]);
    }

    /**
     * Reporte de ingresos mensuales
     */
    public function reporteIngresosMensuales(): void
    {
        $data = Router::getRequestData();
        $anio = (int)($data['anio'] ?? date('Y'));

        $sql = "SELECT 
                    MONTH(fecha_pago) AS mes_numero,
                    DATE_FORMAT(fecha_pago, '%Y-%m') AS periodo_mes,
                    metodo_pago,
                    COUNT(*) AS total_transacciones,
                    SUM(monto) AS total_recaudado
                FROM pagos
                WHERE YEAR(fecha_pago) = :anio
                GROUP BY mes_numero, periodo_mes, metodo_pago
                ORDER BY mes_numero ASC, metodo_pago ASC";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([':anio' => $anio]);
        $filas = $stmt->fetchAll();

        // Agrupar por mes
        $meses = [];
        $totalAnual = 0.00;

        foreach ($filas as $f) {
            $mes = $f['periodo_mes'];
            if (!isset($meses[$mes])) {
                $meses[$mes] = [
                    'periodo' => $mes,
                    'mes_numero' => (int)$f['mes_numero'],
                    'total_mes' => 0.00,
                    'metodos' => []
                ];
            }
            $monto = (float)$f['total_recaudado'];
            $meses[$mes]['total_mes'] += $monto;
            $meses[$mes]['metodos'][$f['metodo_pago']] = $monto;
            $totalAnual += $monto;
        }

        Response::json([
            'anio' => $anio,
            'total_anual' => round($totalAnual, 2),
            'meses' => array_values($meses)
        ]);
    }

    /**
     * Reporte de ingresos y mano de obra por mecánico
     */
    public function reporteIngresosPorMecanico(): void
    {
        $data = Router::getRequestData();
        $desde = $data['desde'] ?? date('Y-m-01');
        $hasta = $data['hasta'] ?? date('Y-m-d');

        $sql = "SELECT 
                    u.id AS mecanico_id,
                    u.nombre AS mecanico_nombre,
                    u.especialidad,
                    COUNT(DISTINCT i.orden_trabajo_id) AS total_ordenes_intervenidas,
                    COUNT(i.id) AS total_tareas_realizadas,
                    COALESCE(SUM(i.subtotal), 0) AS total_mano_obra_producida
                FROM usuarios u
                LEFT JOIN ot_items i ON i.mecanico_id = u.id AND i.tipo_item IN ('MANO_OBRA', 'SERVICIO_EXTERNO')
                LEFT JOIN ordenes_trabajo ot ON i.orden_trabajo_id = ot.id AND DATE(ot.fecha_ingreso) BETWEEN :desde AND :hasta
                WHERE u.rol = 'MECANICO' AND u.activo = 1
                GROUP BY u.id, u.nombre, u.especialidad
                ORDER BY total_mano_obra_producida DESC";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([':desde' => $desde, ':hasta' => $hasta]);
        $mecanicos = $stmt->fetchAll();

        $totalProducido = array_sum(array_column($mecanicos, 'total_mano_obra_producida'));

        Response::json([
            'periodo' => ['desde' => $desde, 'hasta' => $hasta],
            'total_mano_obra_global' => round($totalProducido, 2),
            'mecanicos' => $mecanicos
        ]);
    }
}
