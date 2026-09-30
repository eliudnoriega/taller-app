<?php

// Enrutador para servidor de desarrollo integrado de PHP: php -S localhost:8000 router.php

$uri = urldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));
$publicDir = __DIR__ . '/public';

// Si es un archivo físico existente en /public (ej: imágenes subidas en /uploads/), servirlo directamente
if ($uri !== '/' && file_exists($publicDir . $uri)) {
    return false;
}

// Enviar todo al front-controller
require_once $publicDir . '/index.php';
