<?php

namespace App\Controllers;

use App\Config\Database;
use App\Utils\Response;
use App\Utils\Router;
use PDO;

class VehiculoController
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    public function index(): void
    {
        $params = Router::getRequestData();
        $query = $params['q'] ?? '';
        $clienteId = $params['cliente_id'] ?? null;

        $sql = "SELECT v.*, c.nombre AS cliente_nombre, c.telefono AS cliente_telefono, c.email AS cliente_email
                FROM vehiculos v
                INNER JOIN clientes c ON v.cliente_id = c.id
                WHERE 1=1";
        $binds = [];

        if (!empty($query)) {
            $sql .= " AND (v.placa LIKE :q OR v.numero_serie_vin LIKE :q OR v.marca LIKE :q OR v.modelo LIKE :q)";
            $binds[':q'] = "%{$query}%";
        }

        if (!empty($clienteId)) {
            $sql .= " AND v.cliente_id = :cliente_id";
            $binds[':cliente_id'] = (int)$clienteId;
        }

        $sql .= " ORDER BY v.id DESC";
        $stmt = $this->db->prepare($sql);
        $stmt->execute($binds);

        Response::json($stmt->fetchAll());
    }

    public function show(array $params): void
    {
        $id = (int)($params['id'] ?? 0);
        $sql = "SELECT v.*, c.nombre AS cliente_nombre, c.telefono AS cliente_telefono, c.email AS cliente_email, c.numero_documento AS cliente_documento
                FROM vehiculos v
                INNER JOIN clientes c ON v.cliente_id = c.id
                WHERE v.id = :id";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':id' => $id]);
        $vehiculo = $stmt->fetch();

        if (!$vehiculo) {
            Response::error('Vehículo no encontrado', 404);
        }

        // Historial resumido de órdenes
        $stmtOt = $this->db->prepare("SELECT id, numero_ot, estado, fecha_ingreso, kilometraje_ingreso, total_general, saldo_pendiente 
                                      FROM ordenes_trabajo WHERE vehiculo_id = :id ORDER BY fecha_ingreso DESC");
        $stmtOt->execute([':id' => $id]);
        $vehiculo['ordenes'] = $stmtOt->fetchAll();

        Response::json($vehiculo);
    }

    public function create(): void
    {
        $data = Router::getRequestData();

        if (empty($data['cliente_id']) || empty($data['marca']) || empty($data['modelo']) || empty($data['placa']) || empty($data['anio'])) {
            Response::error('Los campos cliente_id, marca, modelo, anio y placa son obligatorios', 422);
        }

        // Validar si placa ya existe
        $stmtCheck = $this->db->prepare("SELECT id FROM vehiculos WHERE placa = :placa");
        $stmtCheck->execute([':placa' => strtoupper(trim($data['placa']))]);
        if ($stmtCheck->fetch()) {
            Response::error('Ya existe un vehículo registrado con esta placa', 409);
        }

        $sql = "INSERT INTO vehiculos (cliente_id, tipo, marca, modelo, anio, placa, numero_serie_vin, color, kilometraje_actual, notas) 
                VALUES (:cliente_id, :tipo, :marca, :modelo, :anio, :placa, :vin, :color, :km, :notas)";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            ':cliente_id' => (int)$data['cliente_id'],
            ':tipo'       => $data['tipo'] ?? 'AUTOMOVIL',
            ':marca'      => trim($data['marca']),
            ':modelo'     => trim($data['modelo']),
            ':anio'       => (int)$data['anio'],
            ':placa'      => strtoupper(trim($data['placa'])),
            ':vin'        => !empty($data['numero_serie_vin']) ? strtoupper(trim($data['numero_serie_vin'])) : null,
            ':color'      => !empty($data['color']) ? trim($data['color']) : null,
            ':km'         => (int)($data['kilometraje_actual'] ?? 0),
            ':notas'      => !empty($data['notas']) ? trim($data['notas']) : null
        ]);

        $newId = (int)$this->db->lastInsertId();
        Response::json(['id' => $newId], 201, 'Vehículo registrado correctamente');
    }

    public function update(array $params): void
    {
        $id = (int)($params['id'] ?? 0);
        $data = Router::getRequestData();

        $stmt = $this->db->prepare("SELECT id FROM vehiculos WHERE id = :id");
        $stmt->execute([':id' => $id]);
        if (!$stmt->fetch()) {
            Response::error('Vehículo no encontrado', 404);
        }

        $sql = "UPDATE vehiculos SET
                tipo = COALESCE(:tipo, tipo),
                marca = COALESCE(:marca, marca),
                modelo = COALESCE(:modelo, modelo),
                anio = COALESCE(:anio, anio),
                color = COALESCE(:color, color),
                kilometraje_actual = COALESCE(:km, kilometraje_actual),
                numero_serie_vin = COALESCE(:vin, numero_serie_vin),
                notas = COALESCE(:notas, notas)
                WHERE id = :id";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            ':id'    => $id,
            ':tipo'  => $data['tipo'] ?? null,
            ':marca' => $data['marca'] ?? null,
            ':modelo'=> $data['modelo'] ?? null,
            ':anio'  => isset($data['anio']) ? (int)$data['anio'] : null,
            ':color' => $data['color'] ?? null,
            ':km'    => isset($data['kilometraje_actual']) ? (int)$data['kilometraje_actual'] : null,
            ':vin'   => isset($data['numero_serie_vin']) ? strtoupper(trim($data['numero_serie_vin'])) : null,
            ':notas' => $data['notas'] ?? null
        ]);

        Response::json(['id' => $id], 200, 'Vehículo actualizado con éxito');
    }

    public function buscar(): void
    {
        $data = Router::getRequestData();
        $placa = $data['placa'] ?? null;
        $vin = $data['vin'] ?? null;

        if (empty($placa) && empty($vin)) {
            Response::error('Debe proporcionar el parámetro "placa" o "vin"', 400);
        }

        $sql = "SELECT v.*, c.nombre AS cliente_nombre, c.telefono AS cliente_telefono, c.email AS cliente_email
                FROM vehiculos v
                INNER JOIN clientes c ON v.cliente_id = c.id
                WHERE 1=1";
        $binds = [];

        if (!empty($placa)) {
            $sql .= " AND v.placa = :placa";
            $binds[':placa'] = strtoupper(trim($placa));
        }

        if (!empty($vin)) {
            $sql .= " AND v.numero_serie_vin = :vin";
            $binds[':vin'] = strtoupper(trim($vin));
        }

        $stmt = $this->db->prepare($sql);
        $stmt->execute($binds);
        $vehiculo = $stmt->fetch();

        if (!$vehiculo) {
            Response::error('Vehículo no encontrado con los criterios especificados', 404);
        }

        Response::json($vehiculo);
    }
}
