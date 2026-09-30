<?php

namespace App\Utils;

use Exception;

class JWT
{
    private static string $defaultSecret = 'taller_mecanico_jwt_secret_key_2026_xyz!#@';

    public static function getSecret(): string
    {
        return getenv('JWT_SECRET') ?: self::$defaultSecret;
    }

    /**
     * Codificar a formato Base64 URL Safe
     */
    private static function base64UrlEncode(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    /**
     * Decodificar formato Base64 URL Safe
     */
    private static function base64UrlDecode(string $data): string
    {
        return base64_decode(strtr($data, '-_', '+/') . str_repeat('=', 3 - (3 + strlen($data)) % 4));
    }

    /**
     * Generar un token JWT firmado con HS256
     * 
     * @param array $payload Datos a incluir en el token
     * @param int $expirySeconds Tiempo de expiración en segundos (por defecto 24 horas = 86400s)
     * @param string|null $secret Clave secreta (opcional)
     * @return string Token JWT
     */
    public static function encode(array $payload, int $expirySeconds = 86400, ?string $secret = null): string
    {
        $secretKey = $secret ?: self::getSecret();
        $now = time();

        $header = [
            'typ' => 'JWT',
            'alg' => 'HS256'
        ];

        // Añadir marcas de tiempo estándar si no vienen
        if (!isset($payload['iat'])) {
            $payload['iat'] = $now;
        }
        if (!isset($payload['exp'])) {
            $payload['exp'] = $now + $expirySeconds;
        }

        $headerEncoded = self::base64UrlEncode(json_encode($header, JSON_UNESCAPED_SLASHES));
        $payloadEncoded = self::base64UrlEncode(json_encode($payload, JSON_UNESCAPED_SLASHES));

        $signature = hash_hmac('sha256', "{$headerEncoded}.{$payloadEncoded}", $secretKey, true);
        $signatureEncoded = self::base64UrlEncode($signature);

        return "{$headerEncoded}.{$payloadEncoded}.{$signatureEncoded}";
    }

    /**
     * Decodificar y validar la firma y vigencia de un token JWT
     * 
     * @param string $token
     * @param string|null $secret
     * @return array Payload decodificado
     * @throws Exception Si el token es inválido, manipulado o expiró
     */
    public static function decode(string $token, ?string $secret = null): array
    {
        $secretKey = $secret ?: self::getSecret();
        $parts = explode('.', $token);

        if (count($parts) !== 3) {
            throw new Exception('Estructura de Token JWT inválida.');
        }

        [$headerEncoded, $payloadEncoded, $signatureEncoded] = $parts;

        // Validar firma criptográfica
        $signatureExpected = hash_hmac('sha256', "{$headerEncoded}.{$payloadEncoded}", $secretKey, true);
        $signatureProvided = self::base64UrlDecode($signatureEncoded);

        if (!hash_equals($signatureExpected, $signatureProvided)) {
            throw new Exception('Firma de Token inválida o manipulada.');
        }

        // Obtener payload
        $payload = json_decode(self::base64UrlDecode($payloadEncoded), true);
        if (!is_array($payload)) {
            throw new Exception('Contenido del Token no es un JSON válido.');
        }

        // Validar expiración
        if (isset($payload['exp']) && $payload['exp'] < time()) {
            throw new Exception('El Token de autenticación ha expirado.');
        }

        return $payload;
    }

    /**
     * Extraer el Bearer token de los headers HTTP
     */
    public static function getBearerToken(): ?string
    {
        $authHeader = null;

        if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
            $authHeader = $_SERVER['HTTP_AUTHORIZATION'];
        } elseif (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
            $authHeader = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
        } elseif (function_exists('apache_request_headers')) {
            $headers = apache_request_headers();
            $authHeader = $headers['Authorization'] ?? ($headers['authorization'] ?? null);
        }

        if (!empty($authHeader) && preg_match('/Bearer\s(\S+)/i', $authHeader, $matches)) {
            return $matches[1];
        }

        return null;
    }
}
