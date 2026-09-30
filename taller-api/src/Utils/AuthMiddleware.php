<?php

namespace App\Utils;

use Exception;

class AuthMiddleware
{
    /**
     * Valida que la petición incluya un token JWT válido. Si falla, corta la ejecución con error 401.
     * 
     * @return array Payload del usuario autenticado
     */
    public static function authenticate(): array
    {
        $token = JWT::getBearerToken();

        if (!$token) {
            Response::error('Acceso no autorizado. Debe enviar la cabecera Authorization: Bearer <token>', 401);
        }

        try {
            return JWT::decode($token);
        } catch (Exception $e) {
            Response::error('Token inválido o expirado: ' . $e->getMessage(), 401);
        }
    }

    /**
     * Valida que el usuario tenga un rol específico (ej: ADMIN)
     * 
     * @param string|array $allowedRoles Rol o lista de roles permitidos
     * @return array Payload del usuario autenticado
     */
    public static function requireRole($allowedRoles): array
    {
        $user = self::authenticate();
        $roles = is_array($allowedRoles) ? $allowedRoles : [$allowedRoles];
        $userRole = strtoupper($user['rol'] ?? '');

        if (!in_array($userRole, array_map('strtoupper', $roles))) {
            Response::error('Acceso denegado. Se requiere rol: ' . implode(' o ', $roles), 403, [
                'rol_actual'      => $userRole,
                'roles_requeridos' => $roles
            ]);
        }

        return $user;
    }
}
