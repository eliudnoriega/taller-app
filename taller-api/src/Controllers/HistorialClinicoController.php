<?php

namespace App\Controllers;

use App\Config\Database;
use App\Utils\Response;
use App\Utils\Router;
use PDO;

class HistorialClinicoController
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    /**
     * Consulta del historial clínico / ficha técnica vehicular por placa, serie o ID
     */
    public function consultar(array $params = []): void
    {
        $queryData = Router::getRequestData();
        $placa = $queryData['placa'] ?? null;
        $vin = $queryData['vin'] ?? null;
        $vehiculoId = $params['vehiculo_id'] ?? ($queryData['vehiculo_id'] ?? null);

        if (empty($placa) && empty($vin) && empty($vehiculoId)) {
            Response::error('Debe especificar "placa", "vin" o "vehiculo_id" para consultar el historial clínico', 400);
        }

        // 1. Buscar vehículo
        $sqlVeh = "SELECT v.*, c.nombre AS cliente_nombre, c.telefono AS cliente_telefono, c.email AS cliente_email, c.numero_documento AS cliente_documento
                   FROM vehiculos v
                   INNER JOIN clientes c ON v.cliente_id = c.id
                   WHERE 1=1";
        $bindsVeh = [];

        if (!empty($placa)) {
            $sqlVeh .= " AND v.placa = :placa";
            $bindsVeh[':placa'] = strtoupper(trim($placa));
        } elseif (!empty($vin)) {
            $sqlVeh .= " AND v.numero_serie_vin = :vin";
            $bindsVeh[':vin'] = strtoupper(trim($vin));
        } elseif (!empty($vehiculoId)) {
            $sqlVeh .= " AND v.id = :id";
            $bindsVeh[':id'] = (int)$vehiculoId;
        }

        $stmtVeh = $this->db->prepare($sqlVeh);
        $stmtVeh->execute($bindsVeh);
        $vehiculo = $stmtVeh->fetch();

        if (!$vehiculo) {
            Response::error('No se encontró ningún vehículo con los datos proporcionados', 404);
        }

        $vId = (int)$vehiculo['id'];

        // 2. Obtener todas las órdenes de trabajo ordenadas cronológicamente
        $sqlOTs = "SELECT ot.id, ot.numero_ot, ot.estado, ot.motivo_ingreso, ot.diagnostico_inicial,
                          ot.diagnostico_final, ot.trabajo_realizado, ot.kilometraje_ingreso,
                          ot.fecha_ingreso, ot.fecha_cierre, ot.fecha_entrega,
                          ot.total_repuestos, ot.total_mano_obra, ot.total_general, ot.total_pagado, ot.saldo_pendiente,
                          u.nombre AS tecnico_principal
                   FROM ordenes_trabajo ot
                   LEFT JOIN usuarios u ON ot.tecnico_id = u.id
                   WHERE ot.vehiculo_id = :vid
                   ORDER BY ot.fecha_ingreso DESC";
        $stmtOTs = $this->db->prepare($sqlOTs);
        $stmtOTs->execute([':vid' => $vId]);
        $ordenes = $stmtOTs->fetchAll();

        // 3. Para cada orden, obtener items detallados (repuestos sustituidos y servicios ejecutados) y fotos
        $historialAtenciones = [];
        $totalInvertidoHistorial = 0.00;

        foreach ($ordenes as $ot) {
            $otId = (int)$ot['id'];
            $totalInvertidoHistorial += (float)$ot['total_general'];

            // Items
            $stmtItems = $this->db->prepare("
                SELECT i.id, i.tipo_item, i.descripcion, i.cantidad, i.precio_unitario, i.subtotal,
                       r.codigo_sku, r.nombre AS repuesto_nombre,
                       m.nombre AS mecanico_nombre
                FROM ot_items i
                LEFT JOIN repuestos r ON i.repuesto_id = r.id
                LEFT JOIN usuarios m ON i.mecanico_id = m.id
                WHERE i.orden_trabajo_id = :otid
                ORDER BY i.tipo_item ASC, i.id ASC
            ");
            $stmtItems->execute([':otid' => $otId]);
            $items = $stmtItems->fetchAll();

            $repuestosInstalados = array_filter($items, fn($it) => $it['tipo_item'] === 'REPUESTO');
            $serviciosEjecutados = array_filter($items, fn($it) => $it['tipo_item'] !== 'REPUESTO');

            // Fotografías de la atención
            $stmtFotos = $this->db->prepare("SELECT id, url_archivo, etapa, descripcion, fecha_registro FROM ot_fotografias WHERE orden_trabajo_id = :otid");
            $stmtFotos->execute([':otid' => $otId]);
            $fotos = $stmtFotos->fetchAll();

            $ot['repuestos_reemplazados'] = array_values($repuestosInstalados);
            $ot['mano_obra_servicios'] = array_values($serviciosEjecutados);
            $ot['fotografias'] = $fotos;

            $historialAtenciones[] = $ot;
        }

        // 4. Consolidar informe clínico integral
        $resumenClinico = [
            'vehiculo' => [
                'id'                 => $vehiculo['id'],
                'placa'              => $vehiculo['placa'],
                'marca'              => $vehiculo['marca'],
                'modelo'             => $vehiculo['modelo'],
                'anio'               => $vehiculo['anio'],
                'color'              => $vehiculo['color'],
                'vin'                => $vehiculo['numero_serie_vin'],
                'kilometraje_actual' => (int)$vehiculo['kilometraje_actual'],
                'propietario'        => [
                    'nombre'    => $vehiculo['cliente_nombre'],
                    'telefono'  => $vehiculo['cliente_telefono'],
                    'email'     => $vehiculo['cliente_email'],
                    'documento' => $vehiculo['cliente_documento']
                ]
            ],
            'estadisticas' => [
                'total_visitas'             => count($ordenes),
                'total_invertido_historico' => round($totalInvertidoHistorial, 2),
                'primera_visita'            => !empty($ordenes) ? end($ordenes)['fecha_ingreso'] : null,
                'ultima_visita'             => !empty($ordenes) ? $ordenes[0]['fecha_ingreso'] : null
            ],
            'historial_intervenciones' => $historialAtenciones
        ];

        Response::json($resumenClinico, 200, 'Historial clínico del vehículo obtenido con éxito');
    }
}
