<?php

namespace App\Services;

use App\Config\Database;
use PDO;
use Exception;

class InventarioService
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    /**
     * Descarga automática de inventario para una Orden de Trabajo
     */
    public function descargarInventarioPorOT(int $ordenTrabajoId, ?int $usuarioId = null): array
    {
        // 1. Obtener la orden de trabajo
        $stmtOt = $this->db->prepare("SELECT id, numero_ot, inventario_descargado FROM ordenes_trabajo WHERE id = :id FOR UPDATE");
        $stmtOt->execute([':id' => $ordenTrabajoId]);
        $ot = $stmtOt->fetch();

        if (!$ot) {
            throw new Exception("La Orden de Trabajo #{$ordenTrabajoId} no existe.");
        }

        if ((int)$ot['inventario_descargado'] === 1) {
            return [
                'descargado' => false,
                'mensaje'    => "El inventario para la orden {$ot['numero_ot']} ya fue descargado previamente."
            ];
        }

        // 2. Obtener los repuestos de la orden
        $stmtItems = $this->db->prepare("
            SELECT i.id, i.repuesto_id, i.descripcion, i.cantidad, i.precio_unitario, r.nombre, r.stock_actual, r.costo_compra
            FROM ot_items i
            INNER JOIN repuestos r ON i.repuesto_id = r.id
            WHERE i.orden_trabajo_id = :ot_id AND i.tipo_item = 'REPUESTO' AND i.repuesto_id IS NOT NULL
        ");
        $stmtItems->execute([':ot_id' => $ordenTrabajoId]);
        $items = $stmtItems->fetchAll();

        $movimientosRegistrados = [];

        foreach ($items as $item) {
            $repuestoId = (int)$item['repuesto_id'];
            $cantidad = (float)$item['cantidad'];
            $stockActual = (float)$item['stock_actual'];
            $stockPosterior = $stockActual - $cantidad;

            // Descontar de repuestos
            $stmtUpdate = $this->db->prepare("UPDATE repuestos SET stock_actual = stock_actual - :cantidad WHERE id = :id");
            $stmtUpdate->execute([
                ':cantidad' => $cantidad,
                ':id'       => $repuestoId
            ]);

            // Registrar movimiento en Kardex
            $stmtMov = $this->db->prepare("
                INSERT INTO movimientos_inventario 
                (repuesto_id, tipo_movimiento, cantidad, costo_unitario, precio_unitario, stock_anterior, stock_posterior, orden_trabajo_id, usuario_id, motivo)
                VALUES 
                (:repuesto_id, 'SALIDA_OT', :cantidad, :costo, :precio, :stock_ant, :stock_post, :ot_id, :usuario_id, :motivo)
            ");
            $stmtMov->execute([
                ':repuesto_id' => $repuestoId,
                ':cantidad'    => $cantidad,
                ':costo'       => $item['costo_compra'],
                ':precio'      => $item['precio_unitario'],
                ':stock_ant'   => $stockActual,
                ':stock_post'  => $stockPosterior,
                ':ot_id'       => $ordenTrabajoId,
                ':usuario_id'  => $usuarioId,
                ':motivo'      => "Descarga automática por cierre de OT #{$ot['numero_ot']}"
            ]);

            $movimientosRegistrados[] = [
                'repuesto_id'     => $repuestoId,
                'nombre'          => $item['nombre'],
                'cantidad'        => $cantidad,
                'stock_anterior'  => $stockActual,
                'stock_posterior' => $stockPosterior
            ];
        }

        // 3. Marcar la OT con inventario descargado
        $stmtMark = $this->db->prepare("UPDATE ordenes_trabajo SET inventario_descargado = 1 WHERE id = :id");
        $stmtMark->execute([':id' => $ordenTrabajoId]);

        return [
            'descargado'  => true,
            'mensaje'     => "Se descargaron " . count($movimientosRegistrados) . " repuesto(s) del stock con éxito.",
            'movimientos' => $movimientosRegistrados
        ];
    }

    /**
     * Registrar movimiento manual (compra, ajuste, etc.)
     */
    public function registrarMovimientoManual(int $repuestoId, string $tipo, float $cantidad, ?float $costo, ?string $motivo, ?int $usuarioId): array
    {
        $stmt = $this->db->prepare("SELECT id, nombre, stock_actual, costo_compra, precio_venta FROM repuestos WHERE id = :id FOR UPDATE");
        $stmt->execute([':id' => $repuestoId]);
        $repuesto = $stmt->fetch();

        if (!$repuesto) {
            throw new Exception("Repuesto con ID {$repuestoId} no encontrado.");
        }

        $stockAnterior = (float)$repuesto['stock_actual'];
        $costoUnitario = $costo !== null ? $costo : (float)$repuesto['costo_compra'];

        if (in_array($tipo, ['ENTRADA_COMPRA', 'AJUSTE_POSITIVO', 'DEVOLUCION'])) {
            $stockPosterior = $stockAnterior + $cantidad;
            $updateSql = "UPDATE repuestos SET stock_actual = stock_actual + :cant";
            if ($costo !== null && $costo > 0) {
                $updateSql .= ", costo_compra = :costo";
            }
            $updateSql .= " WHERE id = :id";
            $stmtUp = $this->db->prepare($updateSql);
            $binds = [':cant' => $cantidad, ':id' => $repuestoId];
            if ($costo !== null && $costo > 0) {
                $binds[':costo'] = $costo;
            }
            $stmtUp->execute($binds);
        } else {
            $stockPosterior = $stockAnterior - $cantidad;
            $stmtUp = $this->db->prepare("UPDATE repuestos SET stock_actual = stock_actual - :cant WHERE id = :id");
            $stmtUp->execute([':cant' => $cantidad, ':id' => $repuestoId]);
        }

        $stmtMov = $this->db->prepare("
            INSERT INTO movimientos_inventario 
            (repuesto_id, tipo_movimiento, cantidad, costo_unitario, precio_unitario, stock_anterior, stock_posterior, usuario_id, motivo)
            VALUES 
            (:repuesto_id, :tipo, :cantidad, :costo, :precio, :stock_ant, :stock_post, :usuario_id, :motivo)
        ");
        $stmtMov->execute([
            ':repuesto_id' => $repuestoId,
            ':tipo'        => $tipo,
            ':cantidad'    => $cantidad,
            ':costo'       => $costoUnitario,
            ':precio'      => (float)$repuesto['precio_venta'],
            ':stock_ant'   => $stockAnterior,
            ':stock_post'  => $stockPosterior,
            ':usuario_id'  => $usuarioId,
            ':motivo'      => $motivo
        ]);

        return [
            'repuesto_id'     => $repuestoId,
            'stock_anterior'  => $stockAnterior,
            'stock_posterior' => $stockPosterior,
            'tipo_movimiento' => $tipo
        ];
    }
}
