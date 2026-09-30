<?php

namespace App\Controllers;

use App\Config\Database;
use App\Utils\JWT;
use App\Utils\Response;
use App\Utils\Router;
use App\Utils\AuthMiddleware;
use PDO;
use Exception;

class AuthController
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    /**
     * Iniciar sesión y generar Token JWT
     */
    public function login(): void
    {
        $data = Router::getRequestData();

        $email = trim($data['email'] ?? '');
        $password = $data['password'] ?? '';

        if (empty($email) || empty($password)) {
            Response::error('Debe ingresar correo electrónico y contraseña', 422);
        }

        // Buscar usuario por correo
        $stmt = $this->db->prepare("SELECT id, nombre, email, password, rol, especialidad, foto_perfil, activo FROM usuarios WHERE email = :email");
        $stmt->execute([':email' => $email]);
        $user = $stmt->fetch();

        if (!$user) {
            Response::error('Credenciales incorrectas.', 401);
        }

        if ((int)$user['activo'] !== 1) {
            Response::error('El usuario se encuentra inactivo. Comuníquese con el administrador.', 403);
        }

        // Validar contraseña con hash bcrypt
        if (!password_verify($password, $user['password'])) {
            Response::error('Credenciales incorrectas.', 401);
        }

        // 24 horas de vigencia (86400 segundos)
        $expiresIn = 86400;

        $baseUrl = getenv('APP_URL') ?: 'http://localhost:8000';
        $fotoUrl = !empty($user['foto_perfil'])
            ? (strpos($user['foto_perfil'], 'http') === 0 ? $user['foto_perfil'] : rtrim($baseUrl, '/') . $user['foto_perfil'])
            : null;

        $payload = [
            'sub'          => (int)$user['id'],
            'nombre'       => $user['nombre'],
            'email'        => $user['email'],
            'rol'          => $user['rol'],
            'especialidad' => $user['especialidad'],
            'foto_perfil'  => $user['foto_perfil']
        ];

        $token = JWT::encode($payload, $expiresIn);

        Response::json([
            'token'      => $token,
            'token_type' => 'Bearer',
            'expires_in' => $expiresIn,
            'user'       => [
                'id'           => (int)$user['id'],
                'nombre'       => $user['nombre'],
                'email'        => $user['email'],
                'rol'          => $user['rol'],
                'especialidad' => $user['especialidad'],
                'foto_perfil'  => $user['foto_perfil'],
                'foto_url'     => $fotoUrl
            ]
        ], 200, 'Autenticación exitosa');
    }

    /**
     * Obtener el perfil del usuario autenticado a partir del Token JWT
     */
    public function me(): void
    {
        $token = JWT::getBearerToken();

        if (!$token) {
            Response::error('Token de autorización no proporcionado en la cabecera Authorization: Bearer <token>', 401);
        }

        try {
            $payload = JWT::decode($token);
            $userId = (int)($payload['sub'] ?? 0);

            $stmt = $this->db->prepare("SELECT id, nombre, email, rol, especialidad, telefono, foto_perfil, activo, created_at FROM usuarios WHERE id = :id");
            $stmt->execute([':id' => $userId]);
            $user = $stmt->fetch();

            if (!$user || (int)$user['activo'] !== 1) {
                Response::error('El usuario asociado a este token no existe o ha sido desactivado.', 401);
            }

            $baseUrl = getenv('APP_URL') ?: 'http://localhost:8000';
            $user['foto_url'] = !empty($user['foto_perfil'])
                ? (strpos($user['foto_perfil'], 'http') === 0 ? $user['foto_perfil'] : rtrim($baseUrl, '/') . $user['foto_perfil'])
                : null;

            Response::json([
                'user'  => $user,
                'token' => [
                    'exp' => $payload['exp'] ?? null,
                    'iat' => $payload['iat'] ?? null
                ]
            ], 200, 'Datos de usuario autenticado obtenidos correctamente');
        } catch (Exception $e) {
            Response::error('Token inválido o expirado: ' . $e->getMessage(), 401);
        }
    }

    /**
     * Subir o actualizar la foto de perfil del usuario que tiene la sesión iniciada
     */
    public function subirMiFoto(): void
    {
        $userAuth = AuthMiddleware::authenticate();
        $userId = (int)($userAuth['sub'] ?? 0);

        $usuarioCtrl = new UsuarioController();
        $usuarioCtrl->subirFoto(['id' => $userId]);
    }
}
