<?php

// Script para inicialización y migración de la base de datos de taller mecánico

$host = getenv('DB_HOST') ?: 'localhost';
$port = getenv('DB_PORT') ?: '3306';
$dbname = getenv('DB_NAME') ?: 'taller_db';
$user = getenv('DB_USER') ?: 'root';
$pass = getenv('DB_PASS') !== false ? getenv('DB_PASS') : '';

echo "========================================================\n";
echo " INICIALIZADOR DE BASE DE DATOS: TALLER MECÁNICO API \n";
echo "========================================================\n";
echo "Conectando a MySQL en {$host}:{$port} con usuario '{$user}'...\n";

try {
    $pdo = new PDO("mysql:host={$host};port={$port};charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);
    echo "✔ Conexión con servidor MySQL establecida exitosamente.\n";

    $sqlFile = dirname(__DIR__) . '/database/taller_db.sql';
    if (!file_exists($sqlFile)) {
        throw new Exception("No se encontró el archivo SQL en: {$sqlFile}");
    }

    echo "Cargando archivo SQL ({$sqlFile})...\n";
    $sqlContent = file_get_contents($sqlFile);

    // Ejecutar lote SQL
    $pdo->exec($sqlContent);

    echo "✔ Base de datos '{$dbname}' creada/actualizada y esquema cargado con éxito.\n";

    // Verificar tablas
    $pdo->exec("USE `{$dbname}`");
    $stmt = $pdo->query("SHOW TABLES");
    $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);

    echo "\nTablas creadas (" . count($tables) . "):\n";
    foreach ($tables as $t) {
        echo "  - {$t}\n";
    }

    echo "\n✔ ¡Proceso finalizado con éxito! El sistema está listo para operar.\n";
} catch (Exception $e) {
    echo "\n❌ ERROR: " . $e->getMessage() . "\n";
    exit(1);
}
