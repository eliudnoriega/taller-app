<?php

namespace App\Controllers;

use App\Config\Database;
use App\Utils\Response;
use App\Utils\Router;
use PDO;

class UsuarioController
{
    private PDO $db;

    // Roles oficiales del sistema
    public const ROLES_VALIDOS = ['ADMIN', 'RECEPCIONISTA', 'MECANICO', 'CAJERO'];

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    /**
     * Listar usuarios con filtros por rol, estado activo y búsqueda
     */
    public function index(): void
    {
        $params = Router::getRequestData();
        $rol = $params['rol'] ?? null;
        $activo = $params['activo'] ?? null;
        $query = $params['q'] ?? '';

        $sql = "SELECT id, nombre, email, rol, telefono, especialidad, foto_perfil, activo, created_at, updated_at FROM usuarios WHERE 1=1";
        $binds = [];

        if (!empty($rol)) {
            $sql .= " AND rol = :rol";
            $binds[':rol'] = strtoupper(trim($rol));
        }

        if ($activo !== null && $activo !== '') {
            $sql .= " AND activo = :activo";
            $binds[':activo'] = (int)$activo;
        }

        if (!empty($query)) {
            $sql .= " AND (nombre LIKE :q OR email LIKE :q OR especialidad LIKE :q OR telefono LIKE :q)";
            $binds[':q'] = "%{$query}%";
        }

        $sql .= " ORDER BY nombre ASC";
        $stmt = $this->db->prepare($sql);
        $stmt->execute($binds);

        Response::json($stmt->fetchAll(), 200, 'Lista de usuarios obtenida exitosamente');
    }

    /**
     * Filtrar listado de usuarios según el rol especificado en la ruta (ADMIN, RECEPCIONISTA, MECANICO, CAJERO)
     */
    public function porRol(array $params): void
    {
        $rol = strtoupper(trim($params['rol'] ?? ''));

        if (!in_array($rol, self::ROLES_VALIDOS)) {
            Response::error('Rol no válido. Los roles permitidos son: ' . implode(', ', self::ROLES_VALIDOS), 422);
        }

        $queryData = Router::getRequestData();
        $activo = $queryData['activo'] ?? null;

        $sql = "SELECT id, nombre, email, rol, telefono, especialidad, foto_perfil, activo, created_at, updated_at 
                FROM usuarios 
                WHERE rol = :rol";
        $binds = [':rol' => $rol];

        if ($activo !== null && $activo !== '') {
            $sql .= " AND activo = :activo";
            $binds[':activo'] = (int)$activo;
        }

        $sql .= " ORDER BY nombre ASC";
        $stmt = $this->db->prepare($sql);
        $stmt->execute($binds);
        $usuarios = $stmt->fetchAll();

        Response::json([
            'rol'            => $rol,
            'total_usuarios' => count($usuarios),
            'usuarios'       => $usuarios
        ], 200, "Listado de usuarios con rol {$rol}");
    }

    /**
     * Catálogo descriptivo de roles disponibles y sus privilegios
     */
    public function roles(): void
    {
        $rolesInfo = [
            [
                'rol'         => 'ADMIN',
                'nombre'      => 'Administrador',
                'descripcion' => 'Acceso total al sistema: gestión de usuarios, caja, reportes financieros, inventario y métricas.',
                'permisos'    => ['usuarios.crud', 'ordenes.crud', 'caja.crud', 'inventario.crud', 'dashboard.view', 'reportes.view']
            ],
            [
                'rol'         => 'RECEPCIONISTA',
                'nombre'      => 'Recepcionista / Asesor de Servicio',
                'descripcion' => 'Registro de clientes, recepción vehicular, checklist de ingreso, cotizaciones y avisos por WhatsApp.',
                'permisos'    => ['clientes.crud', 'vehiculos.crud', 'ordenes.create', 'ordenes.view', 'presupuestos.crud', 'notificaciones.send']
            ],
            [
                'rol'         => 'MECANICO',
                'nombre'      => 'Técnico / Mecánico',
                'descripcion' => 'Inspección técnica, diagnóstico, ejecución de reparaciones, imputación de repuestos y mano de obra.',
                'permisos'    => ['ordenes.view', 'ordenes.estado.update', 'ordenes.items.add', 'checklist.view']
            ],
            [
                'rol'         => 'CAJERO',
                'nombre'      => 'Cajero / Cobranzas',
                'descripcion' => 'Control de caja, recepción de anticipos, abonos parciales, liquidación de órdenes y reportes diarios.',
                'permisos'    => ['caja.pagos.create', 'caja.reportes.view', 'cuentas_por_cobrar.view', 'ordenes.view']
            ]
        ];

        Response::json($rolesInfo, 200, 'Catálogo de roles de usuario del taller');
    }

    /**
     * Ver detalle de un usuario específico
     */
    public function show(array $params): void
    {
        $id = (int)($params['id'] ?? 0);
        $stmt = $this->db->prepare("SELECT id, nombre, email, rol, telefono, especialidad, foto_perfil, activo, created_at, updated_at FROM usuarios WHERE id = :id");
        $stmt->execute([':id' => $id]);
        $user = $stmt->fetch();

        if (!$user) {
            Response::error('Usuario no encontrado', 404);
        }

        // Estadísticas de actividad del usuario
        if ($user['rol'] === 'MECANICO') {
            $stmtOt = $this->db->prepare("SELECT COUNT(*) AS total_asignadas FROM ordenes_trabajo WHERE tecnico_id = :id");
            $stmtOt->execute([':id' => $id]);
            $user['ordenes_asignadas'] = (int)$stmtOt->fetch()['total_asignadas'];
        } elseif ($user['rol'] === 'RECEPCIONISTA') {
            $stmtOt = $this->db->prepare("SELECT COUNT(*) AS total_recibidas FROM ordenes_trabajo WHERE recepcionista_id = :id");
            $stmtOt->execute([':id' => $id]);
            $user['ordenes_recepcionadas'] = (int)$stmtOt->fetch()['total_recibidas'];
        }

        Response::json($user, 200, 'Detalle de usuario');
    }

    /**
     * Crear un nuevo usuario en el sistema
     */
    public function create(): void
    {
        $data = Router::getRequestData();

        $nombre = trim($data['nombre'] ?? '');
        $email = strtolower(trim($data['email'] ?? ''));
        $password = $data['password'] ?? '';
        $rol = strtoupper(trim($data['rol'] ?? 'MECANICO'));
        $telefono = !empty($data['telefono']) ? trim($data['telefono']) : null;
        $especialidad = !empty($data['especialidad']) ? trim($data['especialidad']) : null;
        $fotoPerfil = !empty($data['foto_perfil']) ? trim($data['foto_perfil']) : null;
        $activo = isset($data['activo']) ? (int)$data['activo'] : 1;

        if (empty($nombre) || empty($email) || empty($password)) {
            Response::error('Nombre, correo electrónico y contraseña son campos obligatorios', 422);
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            Response::error('El formato del correo electrónico no es válido', 422);
        }

        if (!in_array($rol, self::ROLES_VALIDOS)) {
            Response::error('Rol inválido. Los roles permitidos son: ' . implode(', ', self::ROLES_VALIDOS), 422);
        }

        if (strlen($password) < 4) {
            Response::error('La contraseña debe tener al menos 4 caracteres', 422);
        }

        // Verificar si correo ya existe
        $stmtCheck = $this->db->prepare("SELECT id FROM usuarios WHERE email = :email");
        $stmtCheck->execute([':email' => $email]);
        if ($stmtCheck->fetch()) {
            Response::error('Ya existe un usuario registrado con este correo electrónico', 409);
        }

        // Encriptar contraseña con BCRYPT
        $passwordHash = password_hash($password, PASSWORD_BCRYPT);

        $sql = "INSERT INTO usuarios (nombre, email, password, rol, telefono, especialidad, foto_perfil, activo) 
                VALUES (:nombre, :email, :password, :rol, :telefono, :especialidad, :foto, :activo)";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            ':nombre'       => $nombre,
            ':email'        => $email,
            ':password'     => $passwordHash,
            ':rol'          => $rol,
            ':telefono'     => $telefono,
            ':especialidad' => $especialidad,
            ':foto'         => $fotoPerfil,
            ':activo'       => $activo
        ]);

        $newId = (int)$this->db->lastInsertId();

        Response::json([
            'id'           => $newId,
            'nombre'       => $nombre,
            'email'        => $email,
            'rol'          => $rol,
            'especialidad' => $especialidad,
            'foto_perfil'  => $fotoPerfil,
            'activo'       => $activo
        ], 201, 'Usuario registrado con éxito');
    }

    /**
     * Actualizar datos de un usuario existente
     */
    public function update(array $params): void
    {
        $id = (int)($params['id'] ?? 0);
        $data = Router::getRequestData();

        $stmt = $this->db->prepare("SELECT id, email, password FROM usuarios WHERE id = :id");
        $stmt->execute([':id' => $id]);
        $user = $stmt->fetch();

        if (!$user) {
            Response::error('Usuario no encontrado', 404);
        }

        $email = isset($data['email']) ? strtolower(trim($data['email'])) : null;
        if ($email !== null) {
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                Response::error('El formato del correo electrónico no es válido', 422);
            }
            // Verificar duplicado en otro usuario
            $stmtCheck = $this->db->prepare("SELECT id FROM usuarios WHERE email = :email AND id != :id");
            $stmtCheck->execute([':email' => $email, ':id' => $id]);
            if ($stmtCheck->fetch()) {
                Response::error('El correo electrónico ya está en uso por otro usuario', 409);
            }
        }

        $rol = isset($data['rol']) ? strtoupper(trim($data['rol'])) : null;
        if ($rol !== null && !in_array($rol, self::ROLES_VALIDOS)) {
            Response::error('Rol inválido. Los roles permitidos son: ' . implode(', ', self::ROLES_VALIDOS), 422);
        }

        $passwordHash = null;
        if (!empty($data['password'])) {
            if (strlen($data['password']) < 4) {
                Response::error('La contraseña debe tener al menos 4 caracteres', 422);
            }
            $passwordHash = password_hash($data['password'], PASSWORD_BCRYPT);
        }

        $sql = "UPDATE usuarios SET 
                nombre = COALESCE(:nombre, nombre),
                email = COALESCE(:email, email),
                password = COALESCE(:password, password),
                rol = COALESCE(:rol, rol),
                telefono = COALESCE(:telefono, telefono),
                especialidad = COALESCE(:especialidad, especialidad),
                foto_perfil = COALESCE(:foto, foto_perfil),
                activo = COALESCE(:activo, activo)
                WHERE id = :id";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            ':id'           => $id,
            ':nombre'       => isset($data['nombre']) ? trim($data['nombre']) : null,
            ':email'        => $email,
            ':password'     => $passwordHash,
            ':rol'          => $rol,
            ':telefono'     => isset($data['telefono']) ? trim($data['telefono']) : null,
            ':especialidad' => isset($data['especialidad']) ? trim($data['especialidad']) : null,
            ':foto'         => isset($data['foto_perfil']) ? trim($data['foto_perfil']) : null,
            ':activo'       => isset($data['activo']) ? (int)$data['activo'] : null
        ]);

        Response::json(['id' => $id], 200, 'Usuario actualizado exitosamente');
    }

    /**
     * Subir o actualizar fotografía de perfil del usuario
     */
    public function subirFoto(array $params): void
    {
        $id = (int)($params['id'] ?? 0);
        $stmt = $this->db->prepare("SELECT id, nombre, foto_perfil FROM usuarios WHERE id = :id");
        $stmt->execute([':id' => $id]);
        $user = $stmt->fetch();

        if (!$user) {
            Response::error('Usuario no encontrado', 404);
        }

        $urlArchivo = null;
        $fileKey = isset($_FILES['foto']) ? 'foto' : (isset($_FILES['archivo']) ? 'archivo' : null);

        // Caso A: Subida de archivo físico (multipart/form-data)
        if ($fileKey !== null && $_FILES[$fileKey]['error'] === UPLOAD_ERR_OK) {
            $file = $_FILES[$fileKey];

            // Validar extensiones y tipos permitidos
            $allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
            $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));

            if (!in_array($ext, $allowedExtensions)) {
                Response::error('Formato de imagen no permitido. Formatos válidos: ' . implode(', ', $allowedExtensions), 422);
            }

            // Validar tamaño máximo (5MB)
            if ($file['size'] > 5 * 1024 * 1024) {
                Response::error('La imagen excede el tamaño máximo permitido de 5MB', 422);
            }

            $uploadDir = dirname(__DIR__, 2) . '/public/uploads/perfiles/';
            if (!is_dir($uploadDir)) {
                mkdir($uploadDir, 0777, true);
            }

            $filename = 'perfil_' . $id . '_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
            $destination = $uploadDir . $filename;

            if (move_uploaded_file($file['tmp_name'], $destination)) {
                $urlArchivo = '/uploads/perfiles/' . $filename;

                // Eliminar foto anterior si era un archivo local
                if (!empty($user['foto_perfil']) && strpos($user['foto_perfil'], '/uploads/perfiles/') === 0) {
                    $oldPath = dirname(__DIR__, 2) . '/public' . $user['foto_perfil'];
                    if (file_exists($oldPath)) {
                        @unlink($oldPath);
                    }
                }
            } else {
                Response::error('Error al mover el archivo subido al servidor', 500);
            }
        } else {
            // Caso B: URL directa de imagen enviada en JSON / Formulario
            $data = Router::getRequestData();
            $urlDirecta = $data['url_foto'] ?? ($data['foto_perfil'] ?? null);

            if (!empty($urlDirecta)) {
                $urlArchivo = trim($urlDirecta);
            } else {
                Response::error('Debe enviar un archivo en "foto" o una URL en "url_foto"', 422);
            }
        }

        // Actualizar base de datos
        $stmtUp = $this->db->prepare("UPDATE usuarios SET foto_perfil = :foto WHERE id = :id");
        $stmtUp->execute([
            ':foto' => $urlArchivo,
            ':id'   => $id
        ]);

        $baseUrl = getenv('APP_URL') ?: 'http://localhost:8000';
        $fullUrl = strpos($urlArchivo, 'http') === 0 ? $urlArchivo : rtrim($baseUrl, '/') . $urlArchivo;

        Response::json([
            'id'           => $id,
            'nombre'       => $user['nombre'],
            'foto_perfil'  => $urlArchivo,
            'url_completa' => $fullUrl
        ], 200, 'Fotografía de perfil actualizada con éxito');
    }

    /**
     * Eliminar foto de perfil del usuario
     */
    public function eliminarFoto(array $params): void
    {
        $id = (int)($params['id'] ?? 0);
        $stmt = $this->db->prepare("SELECT id, foto_perfil FROM usuarios WHERE id = :id");
        $stmt->execute([':id' => $id]);
        $user = $stmt->fetch();

        if (!$user) {
            Response::error('Usuario no encontrado', 404);
        }

        if (!empty($user['foto_perfil']) && strpos($user['foto_perfil'], '/uploads/perfiles/') === 0) {
            $filePath = dirname(__DIR__, 2) . '/public' . $user['foto_perfil'];
            if (file_exists($filePath)) {
                @unlink($filePath);
            }
        }

        $stmtUp = $this->db->prepare("UPDATE usuarios SET foto_perfil = NULL WHERE id = :id");
        $stmtUp->execute([':id' => $id]);

        Response::json(['id' => $id, 'foto_perfil' => null], 200, 'Foto de perfil eliminada correctamente');
    }

    /**
     * Desactivar o eliminar usuario (soft-delete seguro si tiene registros asociados)
     */
    public function delete(array $params): void
    {
        $id = (int)($params['id'] ?? 0);

        $stmt = $this->db->prepare("SELECT id, nombre, email, rol FROM usuarios WHERE id = :id");
        $stmt->execute([':id' => $id]);
        $user = $stmt->fetch();

        if (!$user) {
            Response::error('Usuario no encontrado', 404);
        }

        // Verificar si tiene órdenes o pagos vinculados para decidir borrado físico o desactivación
        $stmtOt = $this->db->prepare("SELECT COUNT(*) AS total FROM ordenes_trabajo WHERE tecnico_id = :tec_id OR recepcionista_id = :rec_id");
        $stmtOt->execute([':tec_id' => $id, ':rec_id' => $id]);
        $tieneOrdenes = (int)$stmtOt->fetch()['total'] > 0;

        $stmtPagos = $this->db->prepare("SELECT COUNT(*) AS total FROM pagos WHERE usuario_id = :id");
        $stmtPagos->execute([':id' => $id]);
        $tienePagos = (int)$stmtPagos->fetch()['total'] > 0;

        if ($tieneOrdenes || $tienePagos) {
            // Desactivación lógica (soft delete) para proteger integridad de auditoría histórica
            $stmtDeactivate = $this->db->prepare("UPDATE usuarios SET activo = 0 WHERE id = :id");
            $stmtDeactivate->execute([':id' => $id]);

            Response::json([
                'id'           => $id,
                'activo'       => 0,
                'tipo_borrado' => 'LOGICO',
                'motivo'       => 'El usuario posee órdenes o transacciones históricas registradas, por lo que fue desactivado de forma segura.'
            ], 200, 'Usuario desactivado correctamente');
        } else {
            // Borrado físico si no tiene dependencias
            $stmtDelete = $this->db->prepare("DELETE FROM usuarios WHERE id = :id");
            $stmtDelete->execute([':id' => $id]);

            Response::json([
                'id'           => $id,
                'tipo_borrado' => 'FISICO'
            ], 200, 'Usuario eliminado definitivamente de la base de datos');
        }
    }

    /**
     * Lista rápida de mecánicos activos para asignación en órdenes de trabajo
     */
    public function mecanicos(): void
    {
        $stmt = $this->db->query("SELECT id, nombre, email, telefono, especialidad, foto_perfil FROM usuarios WHERE rol = 'MECANICO' AND activo = 1 ORDER BY nombre ASC");
        Response::json($stmt->fetchAll(), 200, 'Lista de técnicos y mecánicos activos');
    }
}
