<?php

namespace App\Controllers;

use App\Config\Database;
use App\Services\InventarioService;
use App\Utils\Response;
use App\Utils\Router;
use PDO;

class InventarioController
{
    private PDO $db;
    private InventarioService $inventarioService;

    public function __construct()
    {
        $this->db = Database::getConnection();
        $this->inventarioService = new InventarioService();
    }

    /**
     * Listar categorías disponibles en el taller
     */
    public function categorias(): void
    {
        $sql = "SELECT c.id, c.nombre, c.descripcion, COUNT(r.id) AS total_repuestos
                FROM categorias_repuestos c
                LEFT JOIN repuestos r ON r.categoria_id = c.id AND r.activo = 1
                GROUP BY c.id, c.nombre, c.descripcion
                ORDER BY c.nombre ASC";
        $stmt = $this->db->query($sql);
        Response::json($stmt->fetchAll(), 200, 'Listado de categorías de insumos y refacciones');
    }

    /**
     * Crear una nueva categoría directamente
     */
    public function crearCategoria(): void
    {
        $data = Router::getRequestData();
        $nombre = trim($data['nombre'] ?? '');
        $descripcion = trim($data['descripcion'] ?? '');

        if (empty($nombre)) {
            Response::error('El nombre de la categoría es obligatorio', 422);
        }

        // Verificar si ya existe
        $stmtCheck = $this->db->prepare("SELECT id FROM categorias_repuestos WHERE LOWER(TRIM(nombre)) = LOWER(TRIM(:nombre))");
        $stmtCheck->execute([':nombre' => $nombre]);
        $existente = $stmtCheck->fetch();

        if ($existente) {
            Response::json(['id' => (int)$existente['id'], 'nombre' => $nombre, 'ya_existia' => true], 200, 'La categoría ya existía');
        }

        $stmt = $this->db->prepare("INSERT INTO categorias_repuestos (nombre, descripcion) VALUES (:nombre, :descripcion)");
        $stmt->execute([
            ':nombre'      => $nombre,
            ':descripcion' => !empty($descripcion) ? $descripcion : null
        ]);

        $newId = (int)$this->db->lastInsertId();
        Response::json(['id' => $newId, 'nombre' => $nombre, 'ya_existia' => false], 201, 'Categoría creada con éxito');
    }

    /**
     * Listar productos y refacciones con filtros
     */
    public function index(): void
    {
        $params = Router::getRequestData();
        $query = $params['q'] ?? '';
        $categoriaId = $params['categoria_id'] ?? null;
        $soloBajoStock = isset($params['bajo_stock']) && $params['bajo_stock'] == '1';

        $sql = "SELECT r.id, r.codigo_sku, r.categoria_id, r.nombre, r.descripcion,
                r.costo_compra, r.precio_venta, r.stock_actual, r.stock_minimo,
                r.unidad_medida, r.ubicacion_estante AS ubicacion_almacen, r.foto_producto,
                r.activo, r.created_at, r.updated_at,
                c.nombre AS categoria_nombre,
                ROUND((r.precio_venta - r.costo_compra), 2) AS margen_bruto_unitario,
                CASE 
                    WHEN r.precio_venta > 0 THEN ROUND(((r.precio_venta - r.costo_compra) / r.precio_venta) * 100, 2)
                    ELSE 0.00
                END AS margen_porcentual,
                CASE 
                    WHEN r.stock_actual <= r.stock_minimo THEN 1
                    ELSE 0
                END AS es_alerta_stock
                FROM repuestos r
                LEFT JOIN categorias_repuestos c ON r.categoria_id = c.id
                WHERE r.activo = 1";
        $binds = [];

        if (!empty($query)) {
            $sql .= " AND (r.nombre LIKE :q OR r.codigo_sku LIKE :q OR r.descripcion LIKE :q OR r.ubicacion_estante LIKE :q)";
            $binds[':q'] = "%{$query}%";
        }

        if (!empty($categoriaId)) {
            $sql .= " AND r.categoria_id = :cat_id";
            $binds[':cat_id'] = (int)$categoriaId;
        }

        if ($soloBajoStock) {
            $sql .= " AND r.stock_actual <= r.stock_minimo";
        }

        $sql .= " ORDER BY (r.stock_actual <= r.stock_minimo) DESC, r.nombre ASC";
        $stmt = $this->db->prepare($sql);
        $stmt->execute($binds);

        Response::json($stmt->fetchAll(), 200, 'Listado de inventario obtenido con éxito');
    }

    /**
     * Detalle de un producto específico
     */
    public function show(array $params): void
    {
        $id = (int)($params['id'] ?? 0);
        $sql = "SELECT r.id, r.codigo_sku, r.categoria_id, r.nombre, r.descripcion,
                r.costo_compra, r.precio_venta, r.stock_actual, r.stock_minimo,
                r.unidad_medida, r.ubicacion_estante AS ubicacion_almacen, r.foto_producto,
                r.activo, r.created_at, r.updated_at,
                c.nombre AS categoria_nombre,
                ROUND((r.precio_venta - r.costo_compra), 2) AS margen_bruto_unitario,
                CASE 
                    WHEN r.precio_venta > 0 THEN ROUND(((r.precio_venta - r.costo_compra) / r.precio_venta) * 100, 2)
                    ELSE 0.00
                END AS margen_porcentual
                FROM repuestos r
                LEFT JOIN categorias_repuestos c ON r.categoria_id = c.id
                WHERE r.id = :id";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':id' => $id]);
        $repuesto = $stmt->fetch();

        if (!$repuesto) {
            Response::error('Producto o refacción no encontrado', 404);
        }

        Response::json($repuesto, 200, 'Detalle del producto obtenido con éxito');
    }

    /**
     * Crear un nuevo producto/refacción en inventario
     * Soporta auto-creación o vinculación de categoría y almacenamiento de foto en Base64
     */
    public function create(): void
    {
        $data = Router::getRequestData();

        $sku = strtoupper(trim($data['codigo_sku'] ?? ''));
        $nombre = trim($data['nombre'] ?? ($data['nombre_producto'] ?? ''));

        if (empty($sku) || empty($nombre)) {
            Response::error('El Código SKU y el Nombre del Producto son obligatorios', 422);
        }

        // Validar SKU único
        $stmtCheck = $this->db->prepare("SELECT id FROM repuestos WHERE codigo_sku = :sku");
        $stmtCheck->execute([':sku' => $sku]);
        if ($stmtCheck->fetch()) {
            Response::error('Ya existe un producto o refacción registrado con este Código SKU: ' . $sku, 409);
        }

        // ==============================================================================
        // LÓGICA DE CATEGORÍA:
        // Si no existe, se crea dinámicamente. Si ya existe, se escoge automáticamente.
        // ==============================================================================
        $categoriaId = !empty($data['categoria_id']) ? (int)$data['categoria_id'] : null;
        $categoriaNombre = trim($data['categoria'] ?? ($data['categoria_nombre'] ?? ''));

        if (empty($categoriaId) && !empty($categoriaNombre)) {
            $stmtCat = $this->db->prepare("SELECT id FROM categorias_repuestos WHERE LOWER(TRIM(nombre)) = LOWER(TRIM(:cat)) LIMIT 1");
            $stmtCat->execute([':cat' => $categoriaNombre]);
            $catEncontrada = $stmtCat->fetch();

            if ($catEncontrada) {
                // Categoría ya existe, se escoge
                $categoriaId = (int)$catEncontrada['id'];
            } else {
                // Categoría no existe, se agrega automáticamente
                $stmtAddCat = $this->db->prepare("INSERT INTO categorias_repuestos (nombre) VALUES (:nombre)");
                $stmtAddCat->execute([':nombre' => $categoriaNombre]);
                $categoriaId = (int)$this->db->lastInsertId();
            }
        }

        // Campos del formulario
        $stockInicial = (float)($data['stock_inicial'] ?? ($data['stock_actual'] ?? 0));
        $stockMinimo = (float)($data['stock_minimo'] ?? 4);
        $costoCompra = (float)($data['costo_compra'] ?? 0);
        $precioVenta = (float)($data['precio_venta'] ?? 0);
        $ubicacionAlmacen = !empty($data['ubicacion_almacen']) ? trim($data['ubicacion_almacen']) : (!empty($data['ubicacion_estante']) ? trim($data['ubicacion_estante']) : null);
        $unidadMedida = !empty($data['unidad_medida']) ? trim($data['unidad_medida']) : 'Pieza';
        $descripcion = !empty($data['descripcion']) ? trim($data['descripcion']) : null;

        // Campo para foto en Base64
        $fotoProducto = !empty($data['foto_producto']) ? trim($data['foto_producto']) : null;

        $sql = "INSERT INTO repuestos 
                (categoria_id, codigo_sku, nombre, descripcion, costo_compra, precio_venta, stock_actual, stock_minimo, unidad_medida, ubicacion_estante, foto_producto)
                VALUES 
                (:cat, :sku, :nombre, :desc, :costo, :precio, :stock, :min, :unidad, :ubicacion, :foto)";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            ':cat'       => $categoriaId,
            ':sku'       => $sku,
            ':nombre'    => $nombre,
            ':desc'      => $descripcion,
            ':costo'     => $costoCompra,
            ':precio'    => $precioVenta,
            ':stock'     => $stockInicial,
            ':min'       => $stockMinimo,
            ':unidad'    => $unidadMedida,
            ':ubicacion' => $ubicacionAlmacen,
            ':foto'      => $fotoProducto
        ]);

        $newId = (int)$this->db->lastInsertId();

        // Si se especificó stock inicial > 0, registrar automáticamente en Kardex
        if ($stockInicial > 0) {
            $stmtMov = $this->db->prepare("
                INSERT INTO movimientos_inventario 
                (repuesto_id, tipo_movimiento, cantidad, costo_unitario, precio_unitario, stock_anterior, stock_posterior, motivo)
                VALUES (:id, 'ENTRADA_COMPRA', :cant, :costo, :precio, 0, :cant_post, 'Inventario inicial al registrar insumo')
            ");
            $stmtMov->execute([
                ':id'        => $newId,
                ':cant'      => $stockInicial,
                ':costo'     => $costoCompra,
                ':precio'    => $precioVenta,
                ':cant_post' => $stockInicial
            ]);
        }

        // Obtener nombre de la categoría asignada
        $catNombreResult = null;
        if ($categoriaId) {
            $stmtCatName = $this->db->prepare("SELECT nombre FROM categorias_repuestos WHERE id = :id");
            $stmtCatName->execute([':id' => $categoriaId]);
            $rowC = $stmtCatName->fetch();
            $catNombreResult = $rowC ? $rowC['nombre'] : null;
        }

        Response::json([
            'id'                => $newId,
            'codigo_sku'        => $sku,
            'nombre'            => $nombre,
            'categoria_id'      => $categoriaId,
            'categoria_nombre'  => $catNombreResult,
            'stock_actual'      => $stockInicial,
            'stock_minimo'      => $stockMinimo,
            'costo_compra'      => $costoCompra,
            'precio_venta'      => $precioVenta,
            'ubicacion_almacen' => $ubicacionAlmacen,
            'unidad_medida'     => $unidadMedida,
            'tiene_foto'        => !empty($fotoProducto)
        ], 201, 'Producto registrado correctamente en el inventario');
    }

    /**
     * Actualizar datos del producto/refacción
     */
    public function update(array $params): void
    {
        $id = (int)($params['id'] ?? 0);
        $data = Router::getRequestData();

        $stmt = $this->db->prepare("SELECT id, codigo_sku FROM repuestos WHERE id = :id");
        $stmt->execute([':id' => $id]);
        if (!$stmt->fetch()) {
            Response::error('Producto o refacción no encontrado', 404);
        }

        // Resolver categoría si se envía por nombre
        $categoriaId = isset($data['categoria_id']) ? (int)$data['categoria_id'] : null;
        $categoriaNombre = isset($data['categoria']) ? trim($data['categoria']) : (isset($data['categoria_nombre']) ? trim($data['categoria_nombre']) : null);

        if ($categoriaId === null && !empty($categoriaNombre)) {
            $stmtCat = $this->db->prepare("SELECT id FROM categorias_repuestos WHERE LOWER(TRIM(nombre)) = LOWER(TRIM(:cat)) LIMIT 1");
            $stmtCat->execute([':cat' => $categoriaNombre]);
            $catEncontrada = $stmtCat->fetch();

            if ($catEncontrada) {
                $categoriaId = (int)$catEncontrada['id'];
            } else {
                $stmtAddCat = $this->db->prepare("INSERT INTO categorias_repuestos (nombre) VALUES (:nombre)");
                $stmtAddCat->execute([':nombre' => $categoriaNombre]);
                $categoriaId = (int)$this->db->lastInsertId();
            }
        }

        $nombre = isset($data['nombre']) ? trim($data['nombre']) : (isset($data['nombre_producto']) ? trim($data['nombre_producto']) : null);
        $ubicacion = isset($data['ubicacion_almacen']) ? trim($data['ubicacion_almacen']) : (isset($data['ubicacion_estante']) ? trim($data['ubicacion_estante']) : null);

        $sql = "UPDATE repuestos SET
                categoria_id = COALESCE(:cat, categoria_id),
                nombre = COALESCE(:nombre, nombre),
                descripcion = COALESCE(:desc, descripcion),
                costo_compra = COALESCE(:costo, costo_compra),
                precio_venta = COALESCE(:precio, precio_venta),
                stock_minimo = COALESCE(:min, stock_minimo),
                unidad_medida = COALESCE(:unidad, unidad_medida),
                ubicacion_estante = COALESCE(:ubicacion, ubicacion_estante),
                foto_producto = COALESCE(:foto, foto_producto),
                activo = COALESCE(:activo, activo)
                WHERE id = :id";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            ':id'        => $id,
            ':cat'       => $categoriaId,
            ':nombre'    => $nombre,
            ':desc'      => $data['descripcion'] ?? null,
            ':costo'     => isset($data['costo_compra']) ? (float)$data['costo_compra'] : null,
            ':precio'    => isset($data['precio_venta']) ? (float)$data['precio_venta'] : null,
            ':min'       => isset($data['stock_minimo']) ? (float)$data['stock_minimo'] : null,
            ':unidad'    => $data['unidad_medida'] ?? null,
            ':ubicacion' => $ubicacion,
            ':foto'      => isset($data['foto_producto']) ? $data['foto_producto'] : null,
            ':activo'    => isset($data['activo']) ? (int)$data['activo'] : null
        ]);

        Response::json(['id' => $id], 200, 'Producto actualizado correctamente');
    }

    /**
     * Alertas de stock crítico
     */
    public function alertasStockMinimo(): void
    {
        $sql = "SELECT r.id, r.codigo_sku, r.nombre, r.stock_actual, r.stock_minimo,
                (r.stock_minimo - r.stock_actual) AS deficit_unidades,
                r.costo_compra,
                ROUND((r.stock_minimo - r.stock_actual) * r.costo_compra, 2) AS costo_reposicion_estimado,
                r.unidad_medida, r.ubicacion_estante AS ubicacion_almacen,
                c.nombre AS categoria_nombre
                FROM repuestos r
                LEFT JOIN categorias_repuestos c ON r.categoria_id = c.id
                WHERE r.activo = 1 AND r.stock_actual <= r.stock_minimo
                ORDER BY (r.stock_actual / NULLIF(r.stock_minimo, 0)) ASC, r.nombre ASC";

        $stmt = $this->db->query($sql);
        $alertas = $stmt->fetchAll();

        Response::json([
            'total_alertas' => count($alertas),
            'repuestos_criticos' => $alertas
        ], 200, 'Alertas de stock mínimo obtenidas exitosamente');
    }

    /**
     * Registrar movimiento manual (compra, ajuste, devolución)
     */
    public function registrarMovimiento(array $params): void
    {
        $id = (int)($params['id'] ?? 0);
        $data = Router::getRequestData();

        $tipo = $data['tipo_movimiento'] ?? 'ENTRADA_COMPRA';
        $cantidad = (float)($data['cantidad'] ?? 0);
        $costo = isset($data['costo_unitario']) ? (float)$data['costo_unitario'] : null;
        $motivo = $data['motivo'] ?? 'Ajuste manual de inventario';
        $usuarioId = !empty($data['usuario_id']) ? (int)$data['usuario_id'] : null;

        if ($cantidad <= 0) {
            Response::error('La cantidad debe ser mayor a 0', 422);
        }

        $validTipos = ['ENTRADA_COMPRA', 'SALIDA_OT', 'AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO', 'DEVOLUCION'];
        if (!in_array($tipo, $validTipos)) {
            Response::error("Tipo de movimiento inválido. Permitidos: " . implode(', ', $validTipos), 422);
        }

        try {
            $this->db->beginTransaction();
            $resultado = $this->inventarioService->registrarMovimientoManual($id, $tipo, $cantidad, $costo, $motivo, $usuarioId);
            $this->db->commit();
            Response::json($resultado, 201, 'Movimiento de inventario registrado con éxito');
        } catch (\Throwable $e) {
            $this->db->rollBack();
            Response::error($e->getMessage(), 500);
        }
    }

    /**
     * Consultar Kardex de movimientos de un repuesto
     */
    public function kardex(array $params): void
    {
        $id = (int)($params['id'] ?? 0);
        $sql = "SELECT m.*, u.nombre AS usuario_nombre, ot.numero_ot
                FROM movimientos_inventario m
                LEFT JOIN usuarios u ON m.usuario_id = u.id
                LEFT JOIN ordenes_trabajo ot ON m.orden_trabajo_id = ot.id
                WHERE m.repuesto_id = :id
                ORDER BY m.fecha_movimiento DESC, m.id DESC";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([':id' => $id]);
        Response::json($stmt->fetchAll(), 200, 'Kardex del producto obtenido');
    }
}
