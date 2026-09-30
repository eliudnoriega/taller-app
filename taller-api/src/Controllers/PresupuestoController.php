<?php

namespace App\Controllers;

use App\Config\Database;
use App\Services\PresupuestoService;
use App\Utils\Response;
use App\Utils\Router;
use PDO;

class PresupuestoController
{
    private PDO $db;
    private PresupuestoService $presupuestoService;

    public function __construct()
    {
        $this->db = Database::getConnection();
        $this->presupuestoService = new PresupuestoService();
    }

    public function index(): void
    {
        $params = Router::getRequestData();
        $estado = $params['estado'] ?? null;
        $clienteId = $params['cliente_id'] ?? null;
        $vehiculoId = $params['vehiculo_id'] ?? null;

        $sql = "SELECT p.*, 
                c.nombre AS cliente_nombre, c.telefono AS cliente_telefono,
                v.marca AS vehiculo_marca, v.modelo AS vehiculo_modelo, v.placa AS vehiculo_placa,
                u.nombre AS tecnico_nombre,
                ot.numero_ot
                FROM presupuestos p
                INNER JOIN clientes c ON p.cliente_id = c.id
                INNER JOIN vehiculos v ON p.vehiculo_id = v.id
                LEFT JOIN usuarios u ON p.tecnico_id = u.id
                LEFT JOIN ordenes_trabajo ot ON p.orden_trabajo_id = ot.id
                WHERE 1=1";
        $binds = [];

        if (!empty($estado)) {
            $sql .= " AND p.estado = :estado";
            $binds[':estado'] = strtoupper($estado);
        }

        if (!empty($clienteId)) {
            $sql .= " AND p.cliente_id = :cliente_id";
            $binds[':cliente_id'] = (int)$clienteId;
        }

        if (!empty($vehiculoId)) {
            $sql .= " AND p.vehiculo_id = :vehiculo_id";
            $binds[':vehiculo_id'] = (int)$vehiculoId;
        }

        $sql .= " ORDER BY p.id DESC";
        $stmt = $this->db->prepare($sql);
        $stmt->execute($binds);

        Response::json($stmt->fetchAll());
    }

    public function show(array $params): void
    {
        $id = (int)($params['id'] ?? 0);
        $sql = "SELECT p.*, 
                c.nombre AS cliente_nombre, c.telefono AS cliente_telefono, c.email AS cliente_email,
                v.marca AS vehiculo_marca, v.modelo AS vehiculo_modelo, v.anio AS vehiculo_anio, v.placa AS vehiculo_placa,
                u.nombre AS tecnico_nombre,
                ot.numero_ot
                FROM presupuestos p
                INNER JOIN clientes c ON p.cliente_id = c.id
                INNER JOIN vehiculos v ON p.vehiculo_id = v.id
                LEFT JOIN usuarios u ON p.tecnico_id = u.id
                LEFT JOIN ordenes_trabajo ot ON p.orden_trabajo_id = ot.id
                WHERE p.id = :id";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':id' => $id]);
        $presupuesto = $stmt->fetch();

        if (!$presupuesto) {
            Response::error('Presupuesto no encontrado', 404);
        }

        // Obtener detalles de repuestos y mano de obra
        $stmtDet = $this->db->prepare("
            SELECT d.*, r.codigo_sku, r.nombre AS repuesto_nombre, r.stock_actual
            FROM presupuesto_detalles d
            LEFT JOIN repuestos r ON d.repuesto_id = r.id
            WHERE d.presupuesto_id = :id
        ");
        $stmtDet->execute([':id' => $id]);
        $presupuesto['detalles'] = $stmtDet->fetchAll();

        Response::json($presupuesto);
    }

    public function create(): void
    {
        $data = Router::getRequestData();

        if (empty($data['cliente_id']) || empty($data['vehiculo_id']) || empty($data['items']) || !is_array($data['items'])) {
            Response::error('Se requieren cliente_id, vehiculo_id y una lista de items', 422);
        }

        $this->db->beginTransaction();

        try {
            $numeroPresupuesto = $this->presupuestoService->generarNumeroPresupuesto();
            $vigenciaDias = (int)($data['vigencia_dias'] ?? 15);
            $observaciones = $data['observaciones'] ?? null;
            $tecnicoId = !empty($data['tecnico_id']) ? (int)$data['tecnico_id'] : null;

            // Calcular totales a partir de los items
            $subtotal = 0.00;
            $detallesProcesados = [];

            foreach ($data['items'] as $item) {
                $tipoItem = $item['tipo_item'] ?? 'REPUESTO';
                $repuestoId = !empty($item['repuesto_id']) ? (int)$item['repuesto_id'] : null;
                $descripcion = trim($item['descripcion'] ?? '');
                $cantidad = (float)($item['cantidad'] ?? 1);
                $precioUnitario = (float)($item['precio_unitario'] ?? 0);
                $costoEstimado = (float)($item['costo_estimado'] ?? 0);

                // Si es repuesto y no trae descripción o costo, intentar obtenerlo de base de datos
                if ($repuestoId && (empty($descripcion) || $precioUnitario <= 0)) {
                    $stmtR = $this->db->prepare("SELECT nombre, precio_venta, costo_compra FROM repuestos WHERE id = :id");
                    $stmtR->execute([':id' => $repuestoId]);
                    $r = $stmtR->fetch();
                    if ($r) {
                        if (empty($descripcion)) $descripcion = $r['nombre'];
                        if ($precioUnitario <= 0) $precioUnitario = (float)$r['precio_venta'];
                        if ($costoEstimado <= 0) $costoEstimado = (float)$r['costo_compra'];
                    }
                }

                $itemSubtotal = round($cantidad * $precioUnitario, 2);
                $subtotal += $itemSubtotal;

                $detallesProcesados[] = [
                    'tipo_item'      => $tipoItem,
                    'repuesto_id'    => $repuestoId,
                    'descripcion'    => $descripcion,
                    'cantidad'       => $cantidad,
                    'costo_estimado' => $costoEstimado,
                    'precio_unitario'=> $precioUnitario,
                    'subtotal'       => $itemSubtotal
                ];
            }

            $impuesto = round($subtotal * 0.16, 2);
            $total = round($subtotal + $impuesto, 2);

            $sqlPres = "INSERT INTO presupuestos 
                        (numero_presupuesto, cliente_id, vehiculo_id, tecnico_id, vigencia_dias, observaciones, subtotal, impuesto, total)
                        VALUES 
                        (:num, :cliente, :vehiculo, :tecnico, :vigencia, :obs, :subtotal, :impuesto, :total)";
            $stmtPres = $this->db->prepare($sqlPres);
            $stmtPres->execute([
                ':num'      => $numeroPresupuesto,
                ':cliente'  => (int)$data['cliente_id'],
                ':vehiculo' => (int)$data['vehiculo_id'],
                ':tecnico'  => $tecnicoId,
                ':vigencia' => $vigenciaDias,
                ':obs'      => $observaciones,
                ':subtotal' => $subtotal,
                ':impuesto' => $impuesto,
                ':total'    => $total
            ]);

            $presupuestoId = (int)$this->db->lastInsertId();

            $sqlDet = "INSERT INTO presupuesto_detalles 
                       (presupuesto_id, tipo_item, repuesto_id, descripcion, cantidad, costo_estimado, precio_unitario, subtotal)
                       VALUES 
                       (:pres_id, :tipo, :rep_id, :desc, :cant, :costo, :precio, :subtotal)";
            $stmtDet = $this->db->prepare($sqlDet);

            foreach ($detallesProcesados as $det) {
                $stmtDet->execute([
                    ':pres_id'  => $presupuestoId,
                    ':tipo'     => $det['tipo_item'],
                    ':rep_id'   => $det['repuesto_id'],
                    ':desc'     => $det['descripcion'],
                    ':cant'     => $det['cantidad'],
                    ':costo'    => $det['costo_estimado'],
                    ':precio'   => $det['precio_unitario'],
                    ':subtotal' => $det['subtotal']
                ]);
            }

            $this->db->commit();

            Response::json([
                'id'                 => $presupuestoId,
                'numero_presupuesto' => $numeroPresupuesto,
                'total'              => $total
            ], 201, 'Presupuesto creado con éxito');
        } catch (\Throwable $e) {
            $this->db->rollBack();
            Response::error($e->getMessage(), 500);
        }
    }

    public function convertirAOrdenTrabajo(array $params): void
    {
        $id = (int)($params['id'] ?? 0);
        $data = Router::getRequestData();
        $recepcionistaId = !empty($data['recepcionista_id']) ? (int)$data['recepcionista_id'] : null;

        try {
            $resultado = $this->presupuestoService->convertirAOrdenTrabajo($id, $recepcionistaId);
            Response::json($resultado, 201, 'Presupuesto convertido exitosamente a Orden de Trabajo');
        } catch (\Throwable $e) {
            Response::error($e->getMessage(), 400);
        }
    }
}
