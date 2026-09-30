<?php

namespace App\Controllers;

use App\Config\Database;
use App\Utils\Response;
use App\Utils\Router;
use App\Utils\WhatsAppHelper;
use PDO;

class NotificacionController
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    /**
     * Generar enlace directo e interactivo de WhatsApp con mensaje personalizado y registro en bitácora
     */
    public function generarWhatsApp(): void
    {
        $data = Router::getRequestData();

        $otId = !empty($data['orden_trabajo_id']) ? (int)$data['orden_trabajo_id'] : null;
        $presupuestoId = !empty($data['presupuesto_id']) ? (int)$data['presupuesto_id'] : null;
        $tipoAviso = strtoupper(trim($data['tipo_aviso'] ?? 'SEGUIMIENTO'));
        $comentario = $data['comentario'] ?? null;
        $baseUrl = getenv('APP_URL') ?: 'http://localhost:8000';

        if (!$otId && !$presupuestoId) {
            Response::error('Debe enviar "orden_trabajo_id" o "presupuesto_id"', 422);
        }

        if ($otId) {
            $sql = "SELECT ot.*, 
                    c.nombre AS cliente_nombre, c.telefono AS cliente_telefono, c.email AS cliente_email,
                    v.marca AS vehiculo_marca, v.modelo AS vehiculo_modelo, v.placa AS vehiculo_placa
                    FROM ordenes_trabajo ot
                    INNER JOIN clientes c ON ot.cliente_id = c.id
                    INNER JOIN vehiculos v ON ot.vehiculo_id = v.id
                    WHERE ot.id = :id";
            $stmt = $this->db->prepare($sql);
            $stmt->execute([':id' => $otId]);
            $ot = $stmt->fetch();

            if (!$ot) {
                Response::error('Orden de Trabajo no encontrada', 404);
            }

            $trackingUrl = "{$baseUrl}/api/seguimiento/{$ot['token_seguimiento']}";

            $cliente = [
                'id'       => $ot['cliente_id'],
                'nombre'   => $ot['cliente_nombre'],
                'telefono' => $ot['cliente_telefono']
            ];
            $vehiculo = [
                'marca'  => $ot['vehiculo_marca'],
                'modelo' => $ot['vehiculo_modelo'],
                'placa'  => $ot['vehiculo_placa']
            ];

            // Armar mensaje según tipo
            switch ($tipoAviso) {
                case 'RECEPCION':
                    $mensaje = WhatsAppHelper::templateRecepcion($ot, $cliente, $vehiculo, $trackingUrl);
                    break;
                case 'CAMBIO_ESTADO':
                    $mensaje = WhatsAppHelper::templateCambioEstado($ot, $cliente, $vehiculo, $ot['estado'], $comentario, $trackingUrl);
                    break;
                case 'LISTO_ENTREGA':
                    $mensaje = WhatsAppHelper::templateListoEntrega($ot, $cliente, $vehiculo, $trackingUrl);
                    break;
                default:
                    $mensaje = "👋 Hola *{$cliente['nombre']}*, revise el seguimiento de su vehículo *{$vehiculo['marca']}* ({$vehiculo['placa']}) aquí:\n👉 {$trackingUrl}";
                    break;
            }

            $chatUrl = WhatsAppHelper::buildChatUrl($cliente['telefono'], $mensaje);

            // Registrar en bitácora
            $stmtLog = $this->db->prepare("
                INSERT INTO notificaciones_bitacora 
                (orden_trabajo_id, cliente_id, canal, tipo_aviso, destinatario, mensaje, enlace_accion, estado_envio)
                VALUES (:ot, :cli, 'WHATSAPP', :tipo, :dest, :msg, :link, 'GENERADO')
            ");
            $stmtLog->execute([
                ':ot'   => $otId,
                ':cli'  => $cliente['id'],
                ':tipo' => $tipoAviso,
                ':dest' => $cliente['telefono'],
                ':msg'  => $mensaje,
                ':link' => $chatUrl
            ]);

            Response::json([
                'orden_id'         => $otId,
                'cliente'          => $cliente['nombre'],
                'telefono'         => $cliente['telefono'],
                'tipo_aviso'       => $tipoAviso,
                'mensaje_texto'    => $mensaje,
                'enlace_whatsapp'  => $chatUrl,
                'link_seguimiento' => $trackingUrl
            ], 200, 'Enlace de WhatsApp generado exitosamente');

        } else {
            // Caso Presupuesto
            $sqlPres = "SELECT p.*, 
                        c.nombre AS cliente_nombre, c.telefono AS cliente_telefono,
                        v.marca AS vehiculo_marca, v.modelo AS vehiculo_modelo, v.placa AS vehiculo_placa
                        FROM presupuestos p
                        INNER JOIN clientes c ON p.cliente_id = c.id
                        INNER JOIN vehiculos v ON p.vehiculo_id = v.id
                        WHERE p.id = :id";
            $stmtPres = $this->db->prepare($sqlPres);
            $stmtPres->execute([':id' => $presupuestoId]);
            $pres = $stmtPres->fetch();

            if (!$pres) {
                Response::error('Presupuesto no encontrado', 404);
            }

            $cliente = ['id' => $pres['cliente_id'], 'nombre' => $pres['cliente_nombre'], 'telefono' => $pres['cliente_telefono']];
            $vehiculo = ['marca' => $pres['vehiculo_marca'], 'modelo' => $pres['vehiculo_modelo'], 'placa' => $pres['vehiculo_placa']];
            $mensaje = WhatsAppHelper::templatePresupuesto($pres, $cliente, $vehiculo);
            $chatUrl = WhatsAppHelper::buildChatUrl($cliente['telefono'], $mensaje);

            $stmtLog = $this->db->prepare("
                INSERT INTO notificaciones_bitacora 
                (cliente_id, canal, tipo_aviso, destinatario, mensaje, enlace_accion, estado_envio)
                VALUES (:cli, 'WHATSAPP', 'PRESUPUESTO', :dest, :msg, :link, 'GENERADO')
            ");
            $stmtLog->execute([
                ':cli'  => $cliente['id'],
                ':dest' => $cliente['telefono'],
                ':msg'  => $mensaje,
                ':link' => $chatUrl
            ]);

            Response::json([
                'presupuesto_id'  => $presupuestoId,
                'cliente'         => $cliente['nombre'],
                'telefono'        => $cliente['telefono'],
                'mensaje_texto'   => $mensaje,
                'enlace_whatsapp' => $chatUrl
            ], 200, 'Enlace de cotización de WhatsApp generado con éxito');
        }
    }

    /**
     * Envío de aviso por Correo Electrónico
     */
    public function enviarEmail(): void
    {
        $data = Router::getRequestData();
        $otId = (int)($data['orden_trabajo_id'] ?? 0);
        $asunto = $data['asunto'] ?? 'Actualización de Servicio - Taller Mecánico';

        $sql = "SELECT ot.*, 
                c.nombre AS cliente_nombre, c.email AS cliente_email,
                v.marca AS vehiculo_marca, v.modelo AS vehiculo_modelo, v.placa AS vehiculo_placa
                FROM ordenes_trabajo ot
                INNER JOIN clientes c ON ot.cliente_id = c.id
                INNER JOIN vehiculos v ON ot.vehiculo_id = v.id
                WHERE ot.id = :id";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':id' => $otId]);
        $ot = $stmt->fetch();

        if (!$ot) {
            Response::error('Orden de Trabajo no encontrada', 404);
        }

        if (empty($ot['cliente_email'])) {
            Response::error('El cliente no tiene un correo electrónico registrado', 422);
        }

        $baseUrl = getenv('APP_URL') ?: 'http://localhost:8000';
        $trackingUrl = "{$baseUrl}/api/seguimiento/{$ot['token_seguimiento']}";

        $cuerpo = "Hola {$ot['cliente_nombre']},\n\n"
                . "Su vehículo {$ot['vehiculo_marca']} {$ot['vehiculo_modelo']} ({$ot['vehiculo_placa']}) se encuentra en estado: {$ot['estado']}.\n"
                . "Puede consultar el progreso y fotos en el enlace:\n{$trackingUrl}\n\n"
                . "Atentamente,\nEquipo de Taller Mecánico";

        // Registrar en bitácora
        $stmtLog = $this->db->prepare("
            INSERT INTO notificaciones_bitacora 
            (orden_trabajo_id, cliente_id, canal, tipo_aviso, destinatario, mensaje, enlace_accion, estado_envio)
            VALUES (:ot, :cli, 'EMAIL', 'SEGUIMIENTO', :dest, :msg, :link, 'ENVIADO')
        ");
        $stmtLog->execute([
            ':ot'   => $otId,
            ':cli'  => $ot['cliente_id'],
            ':dest' => $ot['cliente_email'],
            ':msg'  => $cuerpo,
            ':link' => $trackingUrl
        ]);

        Response::json([
            'orden_id'     => $otId,
            'destinatario' => $ot['cliente_email'],
            'asunto'       => $asunto,
            'estado'       => 'ENVIADO',
            'mensaje'      => 'Aviso por correo registrado y despachado con éxito'
        ]);
    }

    /**
     * Consulta pública de seguimiento para el cliente mediante Token (sin requerir login)
     */
    public function consultarSeguimientoPublico(array $params): void
    {
        $token = $params['token'] ?? '';

        if (empty($token)) {
            Response::error('Token de seguimiento no proporcionado', 400);
        }

        $sql = "SELECT ot.numero_ot, ot.estado, ot.motivo_ingreso, ot.diagnostico_inicial, ot.diagnostico_final,
                       ot.kilometraje_ingreso, ot.nivel_combustible, ot.fecha_ingreso, ot.fecha_promesa, ot.fecha_cierre, ot.fecha_entrega,
                       ot.total_repuestos, ot.total_mano_obra, ot.subtotal, ot.impuesto, ot.total_general, ot.total_pagado, ot.saldo_pendiente,
                       c.nombre AS cliente_nombre,
                       v.marca AS vehiculo_marca, v.modelo AS vehiculo_modelo, v.anio AS vehiculo_anio, v.placa AS vehiculo_placa, v.color AS vehiculo_color,
                       u.nombre AS tecnico_nombre
                FROM ordenes_trabajo ot
                INNER JOIN clientes c ON ot.cliente_id = c.id
                INNER JOIN vehiculos v ON ot.vehiculo_id = v.id
                LEFT JOIN usuarios u ON ot.tecnico_id = u.id
                WHERE ot.token_seguimiento = :token";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':token' => $token]);
        $ot = $stmt->fetch();

        if (!$ot) {
            Response::error('Enlace de seguimiento inválido o caducado', 404);
        }

        // Definir escala de avance visual
        $etapasFlujo = [
            'RECEPCIONADO'        => ['paso' => 1, 'porcentaje' => 15, 'titulo' => 'Vehículo Recibido'],
            'EN_DIAGNOSTICO'      => ['paso' => 2, 'porcentaje' => 35, 'titulo' => 'En Diagnóstico'],
            'ESPERANDO_REPUESTOS' => ['paso' => 3, 'porcentaje' => 50, 'titulo' => 'Esperando Repuestos'],
            'EN_REPARACION'       => ['paso' => 4, 'porcentaje' => 70, 'titulo' => 'En Proceso de Reparación'],
            'LISTO_ENTREGA'       => ['paso' => 5, 'porcentaje' => 95, 'titulo' => 'Listo para Entrega'],
            'ENTREGADO'           => ['paso' => 6, 'porcentaje' => 100, 'titulo' => 'Vehículo Entregado'],
            'CANCELADO'           => ['paso' => 0, 'porcentaje' => 0, 'titulo' => 'Cancelado']
        ];

        $progreso = $etapasFlujo[$ot['estado']] ?? ['paso' => 1, 'porcentaje' => 10, 'titulo' => $ot['estado']];

        // Obtener fotografías públicas
        $stmtFotos = $this->db->prepare("
            SELECT f.id, f.url_archivo, f.etapa, f.descripcion, f.fecha_registro
            FROM ot_fotografias f
            INNER JOIN ordenes_trabajo ot ON f.orden_trabajo_id = ot.id
            WHERE ot.token_seguimiento = :token
            ORDER BY f.fecha_registro DESC
        ");
        $stmtFotos->execute([':token' => $token]);
        $fotos = $stmtFotos->fetchAll();

        // Obtener checklist de recepción
        $stmtCheck = $this->db->prepare("
            SELECT ch.seccion, ch.item, ch.estado, ch.observaciones
            FROM ot_checklist ch
            INNER JOIN ordenes_trabajo ot ON ch.orden_trabajo_id = ot.id
            WHERE ot.token_seguimiento = :token
            ORDER BY ch.seccion, ch.item
        ");
        $stmtCheck->execute([':token' => $token]);
        $checklist = $stmtCheck->fetchAll();

        // Obtener items aprobados
        $stmtItems = $this->db->prepare("
            SELECT i.tipo_item, i.descripcion, i.cantidad, i.precio_unitario, i.subtotal
            FROM ot_items i
            INNER JOIN ordenes_trabajo ot ON i.orden_trabajo_id = ot.id
            WHERE ot.token_seguimiento = :token
            ORDER BY i.tipo_item, i.id
        ");
        $stmtItems->execute([':token' => $token]);
        $items = $stmtItems->fetchAll();

        Response::json([
            'orden'     => $ot,
            'progreso'  => $progreso,
            'checklist' => $checklist,
            'items'     => $items,
            'fotos'     => $fotos
        ], 200, 'Datos de seguimiento obtenidos');
    }

    public function historial(): void
    {
        $params = Router::getRequestData();
        $otId = $params['orden_trabajo_id'] ?? null;

        $sql = "SELECT n.*, c.nombre AS cliente_nombre, ot.numero_ot
                FROM notificaciones_bitacora n
                INNER JOIN clientes c ON n.cliente_id = c.id
                LEFT JOIN ordenes_trabajo ot ON n.orden_trabajo_id = ot.id
                WHERE 1=1";
        $binds = [];

        if (!empty($otId)) {
            $sql .= " AND n.orden_trabajo_id = :ot_id";
            $binds[':ot_id'] = (int)$otId;
        }

        $sql .= " ORDER BY n.fecha_envio DESC LIMIT 50";
        $stmt = $this->db->prepare($sql);
        $stmt->execute($binds);

        Response::json($stmt->fetchAll());
    }
}
