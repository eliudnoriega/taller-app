<?php

namespace App\Services;

use App\Config\Database;
use PDO;
use Exception;

class OrdenTrabajoService
{
    private PDO $db;
    private InventarioService $inventarioService;

    public function __construct()
    {
        $this->db = Database::getConnection();
        $this->inventarioService = new InventarioService();
    }

    /**
     * Generar un número de OT secuencial con el año en curso: OT-YYYY-NNNN
     */
    public function generarNumeroOT(): string
    {
        $anio = date('Y');
        $prefix = "OT-{$anio}-";
        $stmt = $this->db->prepare("SELECT numero_ot FROM ordenes_trabajo WHERE numero_ot LIKE :prefix ORDER BY id DESC LIMIT 1");
        $stmt->execute([':prefix' => "{$prefix}%"]);
        $last = $stmt->fetch();

        if ($last) {
            $lastNum = (int)str_replace($prefix, '', $last['numero_ot']);
            $nextNum = str_pad((string)($lastNum + 1), 4, '0', STR_PAD_LEFT);
        } else {
            $nextNum = '0001';
        }

        return "{$prefix}{$nextNum}";
    }

    /**
     * Recalcula y actualiza los totales de una Orden de Trabajo
     */
    public function recalcularTotales(int $otId): void
    {
        $stmt = $this->db->prepare("
            SELECT 
                COALESCE(SUM(CASE WHEN tipo_item = 'REPUESTO' THEN subtotal ELSE 0 END), 0) AS total_repuestos,
                COALESCE(SUM(CASE WHEN tipo_item IN ('MANO_OBRA', 'SERVICIO_EXTERNO') THEN subtotal ELSE 0 END), 0) AS total_mano_obra
            FROM ot_items
            WHERE orden_trabajo_id = :ot_id
        ");
        $stmt->execute([':ot_id' => $otId]);
        $totalesItems = $stmt->fetch();

        $totalRepuestos = (float)$totalesItems['total_repuestos'];
        $totalManoObra = (float)$totalesItems['total_mano_obra'];
        $subtotal = $totalRepuestos + $totalManoObra;

        // Consultar descuento e impuesto configurado en la OT
        $stmtOt = $this->db->prepare("SELECT descuento, total_pagado FROM ordenes_trabajo WHERE id = :id");
        $stmtOt->execute([':id' => $otId]);
        $otData = $stmtOt->fetch();

        $descuento = (float)($otData['descuento'] ?? 0);
        $baseImponible = max(0, $subtotal - $descuento);
        // Tasa de impuesto sugerida (ej. 16% IVA)
        $impuesto = round($baseImponible * 0.16, 2);
        $totalGeneral = round($baseImponible + $impuesto, 2);

        // Calcular total pagado sumando pagos reales
        $stmtPagos = $this->db->prepare("SELECT COALESCE(SUM(monto), 0) AS pagado FROM pagos WHERE orden_trabajo_id = :ot_id");
        $stmtPagos->execute([':ot_id' => $otId]);
        $totalPagado = (float)$stmtPagos->fetch()['pagado'];

        $saldoPendiente = max(0, $totalGeneral - $totalPagado);

        $stmtUp = $this->db->prepare("
            UPDATE ordenes_trabajo SET
                total_repuestos = :tot_rep,
                total_mano_obra = :tot_mo,
                subtotal = :subtotal,
                impuesto = :impuesto,
                total_general = :tot_gen,
                total_pagado = :tot_pag,
                saldo_pendiente = :saldo
            WHERE id = :id
        ");
        $stmtUp->execute([
            ':tot_rep'  => $totalRepuestos,
            ':tot_mo'   => $totalManoObra,
            ':subtotal' => $subtotal,
            ':impuesto' => $impuesto,
            ':tot_gen'  => $totalGeneral,
            ':tot_pag'  => $totalPagado,
            ':saldo'    => $saldoPendiente,
            ':id'       => $otId
        ]);
    }

    /**
     * Cambiar el estado de una OT y registrar en bitácora de historial
     */
    public function cambiarEstado(int $otId, string $nuevoEstado, ?int $usuarioId = null, ?string $comentario = null): array
    {
        $validEstados = ['RECEPCIONADO', 'EN_DIAGNOSTICO', 'ESPERANDO_REPUESTOS', 'EN_REPARACION', 'LISTO_ENTREGA', 'ENTREGADO', 'CANCELADO'];
        if (!in_array($nuevoEstado, $validEstados)) {
            throw new Exception("Estado inválido. Debe ser uno de: " . implode(', ', $validEstados));
        }

        $stmt = $this->db->prepare("SELECT id, numero_ot, estado, inventario_descargado FROM ordenes_trabajo WHERE id = :id FOR UPDATE");
        $stmt->execute([':id' => $otId]);
        $ot = $stmt->fetch();

        if (!$ot) {
            throw new Exception("Orden de Trabajo no encontrada");
        }

        $estadoAnterior = $ot['estado'];

        // Actualizar estado
        $sqlUp = "UPDATE ordenes_trabajo SET estado = :nuevo_estado";
        if ($nuevoEstado === 'LISTO_ENTREGA' || $nuevoEstado === 'ENTREGADO') {
            $sqlUp .= ", fecha_cierre = COALESCE(fecha_cierre, NOW())";
        }
        if ($nuevoEstado === 'ENTREGADO') {
            $sqlUp .= ", fecha_entrega = NOW()";
        }
        $sqlUp .= " WHERE id = :id";
        $stmtUp = $this->db->prepare($sqlUp);
        $stmtUp->execute([':nuevo_estado' => $nuevoEstado, ':id' => $otId]);

        // Guardar historial
        $stmtHist = $this->db->prepare("
            INSERT INTO ot_historial_estados (orden_trabajo_id, estado_anterior, estado_nuevo, usuario_id, comentario)
            VALUES (:ot_id, :ant, :nuevo, :user, :comentario)
        ");
        $stmtHist->execute([
            ':ot_id'      => $otId,
            ':ant'        => $estadoAnterior,
            ':nuevo'      => $nuevoEstado,
            ':user'       => $usuarioId,
            ':comentario' => $comentario
        ]);

        $resultadoInventario = null;

        // Descarga automática de inventario al pasar a LISTO_ENTREGA o ENTREGADO
        if (($nuevoEstado === 'LISTO_ENTREGA' || $nuevoEstado === 'ENTREGADO') && (int)$ot['inventario_descargado'] === 0) {
            $resultadoInventario = $this->inventarioService->descargarInventarioPorOT($otId, $usuarioId);
        }

        return [
            'orden_trabajo_id'     => $otId,
            'estado_anterior'      => $estadoAnterior,
            'estado_nuevo'         => $nuevoEstado,
            'descarga_inventario'  => $resultadoInventario
        ];
    }
}
