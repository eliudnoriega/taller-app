<?php

namespace App\Controllers;

use App\Config\Database;
use App\Services\OrdenTrabajoService;
use App\Services\InventarioService;
use App\Utils\Response;
use App\Utils\Router;
use PDO;

class OrdenTrabajoController
{
    private PDO $db;
    private OrdenTrabajoService $otService;
    private InventarioService $inventarioService;

    public function __construct()
    {
        $this->db = Database::getConnection();
        $this->otService = new OrdenTrabajoService();
        $this->inventarioService = new InventarioService();
    }

    public function index(): void
    {
        $params = Router::getRequestData();
        $estado = $params['estado'] ?? null;
        $tecnicoId = $params['tecnico_id'] ?? null;
        $clienteId = $params['cliente_id'] ?? null;
        $query = $params['q'] ?? '';

        $sql = "SELECT ot.*, 
                c.nombre AS cliente_nombre, c.telefono AS cliente_telefono,
                v.placa AS vehiculo_placa, v.marca AS vehiculo_marca, v.modelo AS vehiculo_modelo,
                u.nombre AS tecnico_nombre
                FROM ordenes_trabajo ot
                INNER JOIN clientes c ON ot.cliente_id = c.id
                INNER JOIN vehiculos v ON ot.vehiculo_id = v.id
                LEFT JOIN usuarios u ON ot.tecnico_id = u.id
                WHERE 1=1";
        $binds = [];

        if (!empty($estado)) {
            $sql .= " AND ot.estado = :estado";
            $binds[':estado'] = strtoupper($estado);
        }

        if (!empty($tecnicoId)) {
            $sql .= " AND ot.tecnico_id = :tecnico_id";
            $binds[':tecnico_id'] = (int)$tecnicoId;
        }

        if (!empty($clienteId)) {
            $sql .= " AND ot.cliente_id = :cliente_id";
            $binds[':cliente_id'] = (int)$clienteId;
        }

        if (!empty($query)) {
            $sql .= " AND (ot.numero_ot LIKE :q OR c.nombre LIKE :q OR v.placa LIKE :q)";
            $binds[':q'] = "%{$query}%";
        }

        $sql .= " ORDER BY ot.id DESC";
        $stmt = $this->db->prepare($sql);
        $stmt->execute($binds);

        Response::json($stmt->fetchAll());
    }

    public function show(array $params): void
    {
        $id = (int)($params['id'] ?? 0);
        $sql = "SELECT ot.*, 
                c.nombre AS cliente_nombre, c.telefono AS cliente_telefono, c.email AS cliente_email, c.numero_documento AS cliente_documento,
                v.placa AS vehiculo_placa, v.marca AS vehiculo_marca, v.modelo AS vehiculo_modelo, v.anio AS vehiculo_anio, v.color AS vehiculo_color, v.numero_serie_vin AS vehiculo_vin,
                u.nombre AS tecnico_nombre, u.especialidad AS tecnico_especialidad,
                r.nombre AS recepcionista_nombre
                FROM ordenes_trabajo ot
                INNER JOIN clientes c ON ot.cliente_id = c.id
                INNER JOIN vehiculos v ON ot.vehiculo_id = v.id
                LEFT JOIN usuarios u ON ot.tecnico_id = u.id
                LEFT JOIN usuarios r ON ot.recepcionista_id = r.id
                WHERE ot.id = :id";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':id' => $id]);
        $ot = $stmt->fetch();

        if (!$ot) {
            Response::error('Orden de Trabajo no encontrada', 404);
        }

        // Checklist de ingreso
        $stmtCheck = $this->db->prepare("SELECT * FROM ot_checklist WHERE orden_trabajo_id = :id ORDER BY seccion, item");
        $stmtCheck->execute([':id' => $id]);
        $ot['checklist'] = $stmtCheck->fetchAll();

        // Fotografías
        $stmtFotos = $this->db->prepare("SELECT * FROM ot_fotografias WHERE orden_trabajo_id = :id ORDER BY fecha_registro DESC");
        $stmtFotos->execute([':id' => $id]);
        $ot['fotografias'] = $stmtFotos->fetchAll();

        // Items (repuestos y mano de obra)
        $stmtItems = $this->db->prepare("
            SELECT i.*, r.codigo_sku, r.nombre AS repuesto_nombre, r.stock_actual,
                   m.nombre AS mecanico_nombre
            FROM ot_items i
            LEFT JOIN repuestos r ON i.repuesto_id = r.id
            LEFT JOIN usuarios m ON i.mecanico_id = m.id
            WHERE i.orden_trabajo_id = :id
            ORDER BY i.id ASC
        ");
        $stmtItems->execute([':id' => $id]);
        $ot['items'] = $stmtItems->fetchAll();

        // Pagos realizados
        $stmtPagos = $this->db->prepare("SELECT * FROM pagos WHERE orden_trabajo_id = :id ORDER BY fecha_pago ASC");
        $stmtPagos->execute([':id' => $id]);
        $ot['pagos'] = $stmtPagos->fetchAll();

        // Historial de cambios de estado
        $stmtHist = $this->db->prepare("
            SELECT h.*, u.nombre AS usuario_nombre
            FROM ot_historial_estados h
            LEFT JOIN usuarios u ON h.usuario_id = u.id
            WHERE h.orden_trabajo_id = :id
            ORDER BY h.fecha_cambio ASC
        ");
        $stmtHist->execute([':id' => $id]);
        $ot['historial_estados'] = $stmtHist->fetchAll();

        Response::json($ot);
    }

    public function create(): void
    {
        $data = Router::getRequestData();

        if (empty($data['cliente_id']) || empty($data['vehiculo_id']) || empty($data['motivo_ingreso'])) {
            Response::error('Se requieren cliente_id, vehiculo_id y motivo_ingreso', 422);
        }

        $this->db->beginTransaction();

        try {
            $numeroOT = $this->otService->generarNumeroOT();
            $tokenSeguimiento = 'track_' . bin2hex(random_bytes(16));
            $nivelCombustible = $data['nivel_combustible'] ?? '1/4';
            $kmIngreso = (int)($data['kilometraje_ingreso'] ?? 0);
            $tecnicoId = !empty($data['tecnico_id']) ? (int)$data['tecnico_id'] : null;
            $recepcionistaId = !empty($data['recepcionista_id']) ? (int)$data['recepcionista_id'] : null;

            // Actualizar kilometraje actual en el vehículo
            if ($kmIngreso > 0) {
                $stmtVeh = $this->db->prepare("UPDATE vehiculos SET kilometraje_actual = GREATEST(COALESCE(kilometraje_actual, 0), :km) WHERE id = :id");
                $stmtVeh->execute([':km' => $kmIngreso, ':id' => (int)$data['vehiculo_id']]);
            }

            $sql = "INSERT INTO ordenes_trabajo (
                        numero_ot, cliente_id, vehiculo_id, tecnico_id, recepcionista_id,
                        estado, motivo_ingreso, diagnostico_inicial, kilometraje_ingreso,
                        nivel_combustible, token_seguimiento, fecha_promesa
                    ) VALUES (
                        :num, :cliente, :vehiculo, :tecnico, :recepcionista,
                        'RECEPCIONADO', :motivo, :diag, :km,
                        :combustible, :token, :promesa
                    )";
            
            $stmt = $this->db->prepare($sql);
            $stmt->execute([
                ':num'           => $numeroOT,
                ':cliente'       => (int)$data['cliente_id'],
                ':vehiculo'      => (int)$data['vehiculo_id'],
                ':tecnico'       => $tecnicoId,
                ':recepcionista' => $recepcionistaId,
                ':motivo'        => trim($data['motivo_ingreso']),
                ':diag'          => !empty($data['diagnostico_inicial']) ? trim($data['diagnostico_inicial']) : null,
                ':km'            => $kmIngreso,
                ':combustible'   => $nivelCombustible,
                ':token'         => $tokenSeguimiento,
                ':promesa'       => !empty($data['fecha_promesa']) ? $data['fecha_promesa'] : null
            ]);

            $otId = (int)$this->db->lastInsertId();

            // Insertar checklist de ingreso si viene en el payload
            if (!empty($data['checklist']) && is_array($data['checklist'])) {
                $stmtCheck = $this->db->prepare("
                    INSERT INTO ot_checklist (orden_trabajo_id, seccion, item, estado, observaciones)
                    VALUES (:ot_id, :seccion, :item, :estado, :obs)
                ");
                foreach ($data['checklist'] as $chk) {
                    $stmtCheck->execute([
                        ':ot_id'   => $otId,
                        ':seccion' => $chk['seccion'] ?? 'GENERAL',
                        ':item'    => $chk['item'] ?? '',
                        ':estado'  => $chk['estado'] ?? 'BUENO',
                        ':obs'     => $chk['observaciones'] ?? null
                    ]);
                }
            } else {
                // Registrar checklist base por defecto
                $checklistBase = [
                    ['EXTERIOR', 'Carrocería y pintura', 'BUENO'],
                    ['EXTERIOR', 'Luces principales y direccionales', 'BUENO'],
                    ['EXTERIOR', 'Espejos retrovisores', 'BUENO'],
                    ['INTERIOR', 'Tapicería y alfombras', 'BUENO'],
                    ['INTERIOR', 'Tablero e instrumentos', 'BUENO'],
                    ['EQUIPAMIENTO', 'Llanta de refacción', 'BUENO'],
                    ['EQUIPAMIENTO', 'Gata hidráulica y llaves', 'BUENO'],
                ];
                $stmtCheck = $this->db->prepare("
                    INSERT INTO ot_checklist (orden_trabajo_id, seccion, item, estado)
                    VALUES (:ot_id, :seccion, :item, :estado)
                ");
                foreach ($checklistBase as [$sec, $it, $st]) {
                    $stmtCheck->execute([
                        ':ot_id'   => $otId,
                        ':seccion' => $sec,
                        ':item'    => $it,
                        ':estado'  => $st
                    ]);
                }
            }

            // Registrar historial de recepción
            $stmtHist = $this->db->prepare("
                INSERT INTO ot_historial_estados (orden_trabajo_id, estado_anterior, estado_nuevo, usuario_id, comentario)
                VALUES (:ot_id, NULL, 'RECEPCIONADO', :user, 'Vehículo ingresado al taller e inspección inicial')
            ");
            $stmtHist->execute([':ot_id' => $otId, ':user' => $recepcionistaId]);

            $this->db->commit();

            Response::json([
                'id'                => $otId,
                'numero_ot'         => $numeroOT,
                'token_seguimiento' => $tokenSeguimiento
            ], 201, 'Orden de Trabajo creada exitosamente');
        } catch (\Throwable $e) {
            $this->db->rollBack();
            Response::error($e->getMessage(), 500);
        }
    }

    public function cambiarEstado(array $params): void
    {
        $id = (int)($params['id'] ?? 0);
        $data = Router::getRequestData();

        if (empty($data['estado'])) {
            Response::error('El campo estado es requerido', 422);
        }

        $nuevoEstado = strtoupper(trim($data['estado']));
        $comentario = $data['comentario'] ?? null;
        $usuarioId = !empty($data['usuario_id']) ? (int)$data['usuario_id'] : null;

        try {
            $this->db->beginTransaction();
            $resultado = $this->otService->cambiarEstado($id, $nuevoEstado, $usuarioId, $comentario);
            $this->db->commit();

            Response::json($resultado, 200, "Estado de la orden actualizado a {$nuevoEstado}");
        } catch (\Throwable $e) {
            $this->db->rollBack();
            Response::error($e->getMessage(), 400);
        }
    }

    public function asignarTecnico(array $params): void
    {
        $id = (int)($params['id'] ?? 0);
        $data = Router::getRequestData();

        if (empty($data['tecnico_id'])) {
            Response::error('El campo tecnico_id es obligatorio', 422);
        }

        $tecnicoId = (int)$data['tecnico_id'];

        $stmt = $this->db->prepare("UPDATE ordenes_trabajo SET tecnico_id = :tec WHERE id = :id");
        $stmt->execute([':tec' => $tecnicoId, ':id' => $id]);

        Response::json(['orden_id' => $id, 'tecnico_id' => $tecnicoId], 200, 'Técnico asignado exitosamente');
    }

    public function guardarChecklist(array $params): void
    {
        $id = (int)($params['id'] ?? 0);
        $data = Router::getRequestData();

        if (empty($data['items']) || !is_array($data['items'])) {
            Response::error('Se requiere un array de items para el checklist', 422);
        }

        $this->db->beginTransaction();

        try {
            // Eliminar anteriores y reemplazar
            $this->db->prepare("DELETE FROM ot_checklist WHERE orden_trabajo_id = :id")->execute([':id' => $id]);

            $stmt = $this->db->prepare("
                INSERT INTO ot_checklist (orden_trabajo_id, seccion, item, estado, observaciones)
                VALUES (:id, :sec, :item, :estado, :obs)
            ");

            foreach ($data['items'] as $item) {
                $stmt->execute([
                    ':id'     => $id,
                    ':sec'    => $item['seccion'] ?? 'GENERAL',
                    ':item'   => $item['item'] ?? '',
                    ':estado' => $item['estado'] ?? 'BUENO',
                    ':obs'    => $item['observaciones'] ?? null
                ]);
            }

            $this->db->commit();
            Response::json(['orden_id' => $id, 'items_guardados' => count($data['items'])], 200, 'Checklist actualizado correctamente');
        } catch (\Throwable $e) {
            $this->db->rollBack();
            Response::error($e->getMessage(), 500);
        }
    }

    public function obtenerChecklist(array $params): void
    {
        $id = (int)($params['id'] ?? 0);
        $stmt = $this->db->prepare("SELECT * FROM ot_checklist WHERE orden_trabajo_id = :id ORDER BY seccion, id");
        $stmt->execute([':id' => $id]);
        Response::json($stmt->fetchAll());
    }

    public function agregarFoto(array $params): void
    {
        $id = (int)($params['id'] ?? 0);
        $data = Router::getRequestData();

        $urlArchivo = null;
        $etapa = $data['etapa'] ?? 'RECEPCION';
        $descripcion = $data['descripcion'] ?? null;

        // Soporte para subida de archivo multipart
        if (isset($_FILES['archivo']) && $_FILES['archivo']['error'] === UPLOAD_ERR_OK) {
            $uploadDir = dirname(__DIR__, 2) . '/public/uploads/';
            if (!is_dir($uploadDir)) {
                mkdir($uploadDir, 0777, true);
            }

            $ext = strtolower(pathinfo($_FILES['archivo']['name'], PATHINFO_EXTENSION));
            $filename = 'ot_' . $id . '_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
            $destination = $uploadDir . $filename;

            if (move_uploaded_file($_FILES['archivo']['tmp_name'], $destination)) {
                $urlArchivo = '/uploads/' . $filename;
            } else {
                Response::error('Error al subir la fotografía al servidor', 500);
            }
        } elseif (!empty($data['url_archivo'])) {
            $urlArchivo = trim($data['url_archivo']);
        } else {
            Response::error('Debe enviar un archivo en "archivo" o una dirección en "url_archivo"', 422);
        }

        $stmt = $this->db->prepare("
            INSERT INTO ot_fotografias (orden_trabajo_id, url_archivo, etapa, descripcion)
            VALUES (:id, :url, :etapa, :desc)
        ");
        $stmt->execute([
            ':id'    => $id,
            ':url'   => $urlArchivo,
            ':etapa' => $etapa,
            ':desc'  => $descripcion
        ]);

        $fotoId = (int)$this->db->lastInsertId();
        Response::json(['foto_id' => $fotoId, 'url' => $urlArchivo], 201, 'Fotografía registrada con éxito');
    }

    public function obtenerFotos(array $params): void
    {
        $id = (int)($params['id'] ?? 0);
        $stmt = $this->db->prepare("SELECT * FROM ot_fotografias WHERE orden_trabajo_id = :id ORDER BY fecha_registro DESC");
        $stmt->execute([':id' => $id]);
        Response::json($stmt->fetchAll());
    }

    public function agregarItem(array $params): void
    {
        $id = (int)($params['id'] ?? 0);
        $data = Router::getRequestData();

        $tipo = $data['tipo_item'] ?? 'REPUESTO';
        $repuestoId = !empty($data['repuesto_id']) ? (int)$data['repuesto_id'] : null;
        $descripcion = trim($data['descripcion'] ?? '');
        $cantidad = (float)($data['cantidad'] ?? 1);
        $precioUnitario = (float)($data['precio_unitario'] ?? 0);
        $costoUnitario = (float)($data['costo_unitario'] ?? 0);
        $mecanicoId = !empty($data['mecanico_id']) ? (int)$data['mecanico_id'] : null;

        if ($repuestoId && (empty($descripcion) || $precioUnitario <= 0)) {
            $stmtR = $this->db->prepare("SELECT nombre, precio_venta, costo_compra FROM repuestos WHERE id = :rid");
            $stmtR->execute([':rid' => $repuestoId]);
            $rep = $stmtR->fetch();
            if ($rep) {
                if (empty($descripcion)) $descripcion = $rep['nombre'];
                if ($precioUnitario <= 0) $precioUnitario = (float)$rep['precio_venta'];
                if ($costoUnitario <= 0) $costoUnitario = (float)$rep['costo_compra'];
            }
        }

        if (empty($descripcion) || $cantidad <= 0) {
            Response::error('Descripción y cantidad mayor a cero requeridas', 422);
        }

        $subtotal = round($cantidad * $precioUnitario, 2);

        $this->db->beginTransaction();

        try {
            $sql = "INSERT INTO ot_items (orden_trabajo_id, tipo_item, repuesto_id, descripcion, cantidad, costo_unitario, precio_unitario, subtotal, mecanico_id)
                    VALUES (:ot, :tipo, :rep, :desc, :cant, :costo, :precio, :sub, :mec)";
            $stmt = $this->db->prepare($sql);
            $stmt->execute([
                ':ot'     => $id,
                ':tipo'   => $tipo,
                ':rep'    => $repuestoId,
                ':desc'   => $descripcion,
                ':cant'   => $cantidad,
                ':costo'  => $costoUnitario,
                ':precio' => $precioUnitario,
                ':sub'    => $subtotal,
                ':mec'    => $mecanicoId
            ]);

            $itemId = (int)$this->db->lastInsertId();

            // Recalcular totales de la OT
            $this->otService->recalcularTotales($id);

            $this->db->commit();

            Response::json(['item_id' => $itemId, 'subtotal' => $subtotal], 201, 'Item agregado a la orden');
        } catch (\Throwable $e) {
            $this->db->rollBack();
            Response::error($e->getMessage(), 500);
        }
    }

    public function eliminarItem(array $params): void
    {
        $id = (int)($params['id'] ?? 0);
        $itemId = (int)($params['itemId'] ?? 0);

        $this->db->beginTransaction();

        try {
            $stmt = $this->db->prepare("DELETE FROM ot_items WHERE id = :item_id AND orden_trabajo_id = :ot_id");
            $stmt->execute([':item_id' => $itemId, ':ot_id' => $id]);

            $this->otService->recalcularTotales($id);

            $this->db->commit();
            Response::json(['eliminado' => true], 200, 'Item eliminado y totales recalculados');
        } catch (\Throwable $e) {
            $this->db->rollBack();
            Response::error($e->getMessage(), 500);
        }
    }

    /**
     * Cierre de orden con descarga automática de repuestos del inventario
     */
    public function cerrarOrden(array $params): void
    {
        $id = (int)($params['id'] ?? 0);
        $data = Router::getRequestData();
        $usuarioId = !empty($data['usuario_id']) ? (int)$data['usuario_id'] : null;

        $this->db->beginTransaction();

        try {
            // Descargar stock
            $resultadoDescarga = $this->inventarioService->descargarInventarioPorOT($id, $usuarioId);

            // Actualizar estado a LISTO_ENTREGA si estaba en reparación
            $this->otService->cambiarEstado($id, 'LISTO_ENTREGA', $usuarioId, 'Cierre de trabajos mecánicos y descarga de inventario');

            $this->db->commit();

            Response::json([
                'orden_id'  => $id,
                'resultado' => $resultadoDescarga
            ], 200, 'Orden cerrada e inventario descargado con éxito');
        } catch (\Throwable $e) {
            $this->db->rollBack();
            Response::error($e->getMessage(), 500);
        }
    }

    public function obtenerHistorialEstados(array $params): void
    {
        $id = (int)($params['id'] ?? 0);
        $sql = "SELECT h.*, u.nombre AS usuario_nombre
                FROM ot_historial_estados h
                LEFT JOIN usuarios u ON h.usuario_id = u.id
                WHERE h.orden_trabajo_id = :id
                ORDER BY h.fecha_cambio ASC";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':id' => $id]);
        Response::json($stmt->fetchAll());
    }
}
