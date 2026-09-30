<?php

namespace App\Services;

use App\Config\Database;
use PDO;
use Exception;

class PresupuestoService
{
    private PDO $db;
    private OrdenTrabajoService $otService;

    public function __construct()
    {
        $this->db = Database::getConnection();
        $this->otService = new OrdenTrabajoService();
    }

    public function generarNumeroPresupuesto(): string
    {
        $anio = date('Y');
        $prefix = "COT-{$anio}-";
        $stmt = $this->db->prepare("SELECT numero_presupuesto FROM presupuestos WHERE numero_presupuesto LIKE :prefix ORDER BY id DESC LIMIT 1");
        $stmt->execute([':prefix' => "{$prefix}%"]);
        $last = $stmt->fetch();

        if ($last) {
            $lastNum = (int)str_replace($prefix, '', $last['numero_presupuesto']);
            $nextNum = str_pad((string)($lastNum + 1), 4, '0', STR_PAD_LEFT);
        } else {
            $nextNum = '0001';
        }

        return "{$prefix}{$nextNum}";
    }

    /**
     * CONVERSIÓN EN 1 CLIC: De Presupuesto / Cotización a Orden de Trabajo
     */
    public function convertirAOrdenTrabajo(int $presupuestoId, ?int $recepcionistaId = null): array
    {
        $this->db->beginTransaction();

        try {
            // 1. Obtener presupuesto con bloqueo
            $stmtPres = $this->db->prepare("SELECT * FROM presupuestos WHERE id = :id FOR UPDATE");
            $stmtPres->execute([':id' => $presupuestoId]);
            $presupuesto = $stmtPres->fetch();

            if (!$presupuesto) {
                throw new Exception("El presupuesto #{$presupuestoId} no existe.");
            }

            if ($presupuesto['estado'] === 'CONVERTIDO_OT' && !empty($presupuesto['orden_trabajo_id'])) {
                throw new Exception("Este presupuesto ya fue convertido previamente a la Orden de Trabajo #{$presupuesto['orden_trabajo_id']}.");
            }

            // Obtener vehículo para kilometraje actual
            $stmtVeh = $this->db->prepare("SELECT kilometraje_actual FROM vehiculos WHERE id = :id");
            $stmtVeh->execute([':id' => $presupuesto['vehiculo_id']]);
            $vehiculo = $stmtVeh->fetch();
            $kmActual = $vehiculo ? (int)$vehiculo['kilometraje_actual'] : 0;

            // 2. Generar datos de la nueva OT
            $numeroOT = $this->otService->generarNumeroOT();
            $tokenSeguimiento = 'track_' . bin2hex(random_bytes(16));

            $motivoIngreso = "Conversión de Presupuesto #" . $presupuesto['numero_presupuesto'];
            if (!empty($presupuesto['observaciones'])) {
                $motivoIngreso .= " - " . $presupuesto['observaciones'];
            }

            $sqlInsertOT = "
                INSERT INTO ordenes_trabajo (
                    numero_ot, cliente_id, vehiculo_id, tecnico_id, recepcionista_id,
                    estado, motivo_ingreso, diagnostico_inicial, kilometraje_ingreso,
                    nivel_combustible, token_seguimiento, subtotal, impuesto, total_general, saldo_pendiente
                ) VALUES (
                    :num_ot, :cliente_id, :vehiculo_id, :tecnico_id, :rec_id,
                    'EN_DIAGNOSTICO', :motivo, :diag, :km,
                    '1/2', :token, :subtotal, :impuesto, :total, :saldo
                )
            ";

            $stmtOT = $this->db->prepare($sqlInsertOT);
            $stmtOT->execute([
                ':num_ot'      => $numeroOT,
                ':cliente_id'  => $presupuesto['cliente_id'],
                ':vehiculo_id' => $presupuesto['vehiculo_id'],
                ':tecnico_id'  => $presupuesto['tecnico_id'],
                ':rec_id'      => $recepcionistaId,
                ':motivo'      => $motivoIngreso,
                ':diag'        => 'Aprobado según cotización: ' . $presupuesto['numero_presupuesto'],
                ':km'          => $kmActual,
                ':token'       => $tokenSeguimiento,
                ':subtotal'    => $presupuesto['subtotal'],
                ':impuesto'    => $presupuesto['impuesto'],
                ':total'       => $presupuesto['total'],
                ':saldo'       => $presupuesto['total']
            ]);

            $nuevaOtId = (int)$this->db->lastInsertId();

            // 3. Migrar líneas de detalle del presupuesto a ot_items
            $stmtDet = $this->db->prepare("SELECT * FROM presupuesto_detalles WHERE presupuesto_id = :id");
            $stmtDet->execute([':id' => $presupuestoId]);
            $detalles = $stmtDet->fetchAll();

            $stmtInsertItem = $this->db->prepare("
                INSERT INTO ot_items 
                (orden_trabajo_id, tipo_item, repuesto_id, descripcion, cantidad, costo_unitario, precio_unitario, subtotal, mecanico_id)
                VALUES 
                (:ot_id, :tipo, :rep_id, :desc, :cant, :costo, :precio, :subtotal, :mecanico_id)
            ");

            foreach ($detalles as $det) {
                $stmtInsertItem->execute([
                    ':ot_id'       => $nuevaOtId,
                    ':tipo'        => $det['tipo_item'],
                    ':rep_id'      => $det['repuesto_id'],
                    ':desc'        => $det['descripcion'],
                    ':cant'        => $det['cantidad'],
                    ':costo'       => $det['costo_estimado'],
                    ':precio'      => $det['precio_unitario'],
                    ':subtotal'    => $det['subtotal'],
                    ':mecanico_id' => $presupuesto['tecnico_id']
                ]);
            }

            // 4. Actualizar estado del Presupuesto a CONVERTIDO_OT y enlazar
            $stmtUpPres = $this->db->prepare("
                UPDATE presupuestos 
                SET estado = 'CONVERTIDO_OT', orden_trabajo_id = :ot_id 
                WHERE id = :pres_id
            ");
            $stmtUpPres->execute([
                ':ot_id'   => $nuevaOtId,
                ':pres_id' => $presupuestoId
            ]);

            // 5. Registrar bitácora de estado inicial
            $stmtHist = $this->db->prepare("
                INSERT INTO ot_historial_estados (orden_trabajo_id, estado_anterior, estado_nuevo, usuario_id, comentario)
                VALUES (:ot_id, NULL, 'RECEPCIONADO', :user, 'Orden creada automáticamente a partir de Cotización')
            ");
            $stmtHist->execute([
                ':ot_id' => $nuevaOtId,
                ':user'  => $recepcionistaId
            ]);

            // 6. Recalcular totales con precisión
            $this->otService->recalcularTotales($nuevaOtId);

            $this->db->commit();

            return [
                'presupuesto_id'    => $presupuestoId,
                'orden_trabajo_id'  => $nuevaOtId,
                'numero_ot'         => $numeroOT,
                'token_seguimiento' => $tokenSeguimiento,
                'total_items'       => count($detalles),
                'total_general'     => (float)$presupuesto['total']
            ];
        } catch (\Throwable $e) {
            $this->db->rollBack();
            throw $e;
        }
    }
}
