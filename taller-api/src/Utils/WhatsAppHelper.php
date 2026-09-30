<?php

namespace App\Utils;

class WhatsAppHelper
{
    /**
     * Limpia y formatea un número de teléfono a formato internacional E.164 básico (solo dígitos)
     */
    public static function formatPhoneNumber(string $phone): string
    {
        $clean = preg_replace('/[^0-9]/', '', $phone);
        // Si tiene 10 dígitos y empieza por común en México/Latam, se puede asegurar prefijo
        return $clean;
    }

    /**
     * Construye un enlace click-to-chat de WhatsApp listo para abrir o enviar
     */
    public static function buildChatUrl(string $phone, string $message): string
    {
        $cleanPhone = self::formatPhoneNumber($phone);
        $encodedMessage = rawurlencode($message);
        return "https://api.whatsapp.com/send?phone={$cleanPhone}&text={$encodedMessage}";
    }

    /**
     * Plantillas predefinidas de mensajes profesionales
     */
    public static function templateRecepcion(array $ot, array $cliente, array $vehiculo, string $trackingUrl): string
    {
        return "👋 ¡Hola, *{$cliente['nombre']}*!\n\n"
             . "🚗 Le confirmamos que su vehículo *{$vehiculo['marca']} {$vehiculo['modelo']}* (Placa: *{$vehiculo['placa']}*) ha ingresado a nuestro taller.\n\n"
             . "📋 *Orden de Trabajo:* #{$ot['numero_ot']}\n"
             . "🔍 *Motivo de Ingreso:* {$ot['motivo_ingreso']}\n"
             . "⏱️ *Estado Actual:* {$ot['estado']}\n\n"
             . "📲 Puede consultar el avance y fotografías en tiempo real desde el siguiente enlace:\n"
             . "👉 {$trackingUrl}\n\n"
             . "¡Estamos para servirle!";
    }

    public static function templateCambioEstado(array $ot, array $cliente, array $vehiculo, string $estadoNuevo, ?string $comentario, string $trackingUrl): string
    {
        $comentarioTexto = !empty($comentario) ? "\n📝 *Nota del técnico:* {$comentario}\n" : "\n";
        return "🔔 *Actualización de Orden de Trabajo #{$ot['numero_ot']}*\n\n"
             . "Estimado(a) *{$cliente['nombre']}*:\n"
             . "Su vehículo *{$vehiculo['marca']} {$vehiculo['modelo']}* ({$vehiculo['placa']}) ha cambiado de estado a:\n"
             . "👉 *{$estadoNuevo}*{$comentarioTexto}\n"
             . "🔎 Revise el avance en línea:\n"
             . "👉 {$trackingUrl}";
    }

    public static function templateListoEntrega(array $ot, array $cliente, array $vehiculo, string $trackingUrl): string
    {
        $saldo = number_format((float)($ot['saldo_pendiente'] ?? 0), 2);
        return "🎉 *¡Su vehículo está LISTO PARA ENTREGA!* 🚗✨\n\n"
             . "Estimado(a) *{$cliente['nombre']}*:\n"
             . "Nos complace informarle que los trabajos en su *{$vehiculo['marca']} {$vehiculo['modelo']}* (Placa: *{$vehiculo['placa']}*) correspondientes a la Orden *#{$ot['numero_ot']}* han finalizado con éxito.\n\n"
             . "💰 *Saldo Pendiente de Pago:* \${$saldo}\n\n"
             . "📍 Puede pasar a retirarlo en nuestro horario habitual.\n"
             . "📄 Revise el detalle final y comprobante aquí:\n"
             . "👉 {$trackingUrl}\n\n"
             . "¡Agradecemos su confianza!";
    }

    public static function templatePresupuesto(array $presupuesto, array $cliente, array $vehiculo): string
    {
        $total = number_format((float)($presupuesto['total'] ?? 0), 2);
        return "📄 *Cotización de Servicio - Taller Mecánico*\n\n"
             . "Estimado(a) *{$cliente['nombre']}*:\n"
             . "Hemos generado el presupuesto *#{$presupuesto['numero_presupuesto']}* para su vehículo *{$vehiculo['marca']} {$vehiculo['modelo']}* (Placa: *{$vehiculo['placa']}*).\n\n"
             . "💵 *Total Estimado:* \${$total}\n"
             . "⏳ *Vigencia:* {$presupuesto['vigencia_dias']} días.\n"
             . "📝 *Observaciones:* " . ($presupuesto['observaciones'] ?: 'Servicio preventivo/correctivo') . "\n\n"
             . "Por favor responda a este mensaje para confirmar y autorizar el inicio de los trabajos.";
    }
}
