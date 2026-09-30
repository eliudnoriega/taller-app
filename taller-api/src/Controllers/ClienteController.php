<?php

namespace App\Controllers;

use App\Config\Database;
use App\Utils\Response;
use App\Utils\Router;
use PDO;

class ClienteController
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    public function index(): void
    {
        $query = Router::getRequestData()['q'] ?? '';

        $sql = "SELECT c.*, 
                (SELECT COUNT(*) FROM vehiculos v WHERE v.cliente_id = c.id) AS total_vehiculos,
                (SELECT COUNT(*) FROM ordenes_trabajo ot WHERE ot.cliente_id = c.id) AS total_ordenes
                FROM clientes c WHERE 1=1";
        $binds = [];

        if (!empty($query)) {
            $sql .= " AND (c.nombre LIKE :q OR c.numero_documento LIKE :q OR c.telefono LIKE :q OR c.email LIKE :q)";
            $binds[':q'] = "%{$query}%";
        }

        $sql .= " ORDER BY c.nombre ASC";
        $stmt = $this->db->prepare($sql);
        $stmt->execute($binds);

        Response::json($stmt->fetchAll());
    }

    public function show(array $params): void
    {
        $id = (int)($params['id'] ?? 0);
        $stmt = $this->db->prepare("SELECT * FROM clientes WHERE id = :id");
        $stmt->execute([':id' => $id]);
        $cliente = $stmt->fetch();

        if (!$cliente) {
            Response::error('Cliente no encontrado', 404);
        }

        // Obtener vehículos registrados
        $stmtVeh = $this->db->prepare("SELECT * FROM vehiculos WHERE cliente_id = :id ORDER BY id DESC");
        $stmtVeh->execute([':id' => $id]);
        $cliente['vehiculos'] = $stmtVeh->fetchAll();

        Response::json($cliente);
    }

    public function create(): void
    {
        $data = Router::getRequestData();

        if (empty($data['nombre']) || empty($data['telefono']) || empty($data['numero_documento'])) {
            Response::error('Los campos nombre, teléfono y número de documento son obligatorios', 422);
        }

        // Verificar documento duplicado
        $stmtCheck = $this->db->prepare("SELECT id FROM clientes WHERE numero_documento = :doc");
        $stmtCheck->execute([':doc' => $data['numero_documento']]);
        if ($stmtCheck->fetch()) {
            Response::error('Ya existe un cliente con este número de documento', 409);
        }

        $sql = "INSERT INTO clientes (tipo_documento, numero_documento, nombre, telefono, email, direccion) 
                VALUES (:tipo_doc, :doc, :nombre, :telefono, :email, :direccion)";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            ':tipo_doc'  => $data['tipo_documento'] ?? 'DNI',
            ':doc'       => trim($data['numero_documento']),
            ':nombre'    => trim($data['nombre']),
            ':telefono'  => trim($data['telefono']),
            ':email'     => !empty($data['email']) ? trim($data['email']) : null,
            ':direccion' => !empty($data['direccion']) ? trim($data['direccion']) : null
        ]);

        $newId = (int)$this->db->lastInsertId();
        Response::json(['id' => $newId], 201, 'Cliente registrado exitosamente');
    }

    public function update(array $params): void
    {
        $id = (int)($params['id'] ?? 0);
        $data = Router::getRequestData();

        $stmt = $this->db->prepare("SELECT id FROM clientes WHERE id = :id");
        $stmt->execute([':id' => $id]);
        if (!$stmt->fetch()) {
            Response::error('Cliente no encontrado', 404);
        }

        $sql = "UPDATE clientes SET 
                tipo_documento = COALESCE(:tipo_doc, tipo_documento),
                numero_documento = COALESCE(:doc, numero_documento),
                nombre = COALESCE(:nombre, nombre),
                telefono = COALESCE(:telefono, telefono),
                email = COALESCE(:email, email),
                direccion = COALESCE(:direccion, direccion)
                WHERE id = :id";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            ':id'        => $id,
            ':tipo_doc'  => $data['tipo_documento'] ?? null,
            ':doc'       => isset($data['numero_documento']) ? trim($data['numero_documento']) : null,
            ':nombre'    => isset($data['nombre']) ? trim($data['nombre']) : null,
            ':telefono'  => isset($data['telefono']) ? trim($data['telefono']) : null,
            ':email'     => isset($data['email']) ? trim($data['email']) : null,
            ':direccion' => isset($data['direccion']) ? trim($data['direccion']) : null
        ]);

        Response::json(['id' => $id], 200, 'Cliente actualizado con éxito');
    }

    public function vehiculos(array $params): void
    {
        $id = (int)($params['id'] ?? 0);
        $stmt = $this->db->prepare("SELECT * FROM vehiculos WHERE cliente_id = :id ORDER BY marca, modelo");
        $stmt->execute([':id' => $id]);
        Response::json($stmt->fetchAll());
    }
}
