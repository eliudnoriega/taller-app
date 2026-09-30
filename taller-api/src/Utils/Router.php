<?php

namespace App\Utils;

class Router
{
    private array $routes = [];

    /**
     * @param string $path
     * @param callable|array $handler
     */
    public function get(string $path, $handler): void
    {
        $this->addRoute('GET', $path, $handler);
    }

    /**
     * @param string $path
     * @param callable|array $handler
     */
    public function post(string $path, $handler): void
    {
        $this->addRoute('POST', $path, $handler);
    }

    /**
     * @param string $path
     * @param callable|array $handler
     */
    public function put(string $path, $handler): void
    {
        $this->addRoute('PUT', $path, $handler);
    }

    /**
     * @param string $path
     * @param callable|array $handler
     */
    public function delete(string $path, $handler): void
    {
        $this->addRoute('DELETE', $path, $handler);
    }

    private function addRoute(string $method, string $path, $handler): void
    {
        // Convertir {param} en regex (?P<param>[^/]+)
        $pattern = preg_replace('/\{([a-zA-Z0-9_]+)\}/', '(?P<$1>[^/]+)', $path);
        $pattern = "#^" . $pattern . "$#";

        $this->routes[] = [
            'method'  => $method,
            'pattern' => $pattern,
            'path'    => $path,
            'handler' => $handler
        ];
    }

    public static function getRequestData(): array
    {
        $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
        $data = [];

        if (stripos($contentType, 'application/json') !== false) {
            $rawInput = file_get_contents('php://input');
            $data = json_decode($rawInput, true) ?? [];
        } else {
            $data = $_POST;
            if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
                $rawInput = file_get_contents('php://input');
                parse_str($rawInput, $putData);
                $data = is_array($putData) ? $putData : [];
            }
        }

        return array_merge($_GET, $data);
    }

    public function dispatch(): void
    {
        $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

        // Manejo inmediato de CORS Preflight
        if ($method === 'OPTIONS') {
            header('Access-Control-Allow-Origin: *');
            header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
            header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
            http_response_code(200);
            exit;
        }

        $uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);

        // Si se incluye index.php en la URL, removerlo
        if (strpos($uri, '/index.php') === 0) {
            $uri = substr($uri, strlen('/index.php'));
        }

        // Si se ejecuta en Apache en un subdirectorio (ej: /taller-api/public/)
        $scriptName = str_replace('\\', '/', $_SERVER['SCRIPT_NAME'] ?? '');
        $baseDir = rtrim(dirname($scriptName), '/');
        if (!empty($baseDir) && $baseDir !== '/' && strpos($uri, $baseDir) === 0 && basename($scriptName) === 'index.php') {
            $uri = substr($uri, strlen($baseDir));
        }

        $uri = rtrim($uri, '/');
        if (empty($uri)) {
            $uri = '/';
        }

        foreach ($this->routes as $route) {
            if ($route['method'] === $method && preg_match($route['pattern'], $uri, $matches)) {
                $params = [];
                foreach ($matches as $key => $value) {
                    if (!is_int($key)) {
                        $params[$key] = $value;
                    }
                }

                $handler = $route['handler'];

                try {
                    if (is_callable($handler) && !is_array($handler)) {
                        call_user_func($handler, $params);
                        return;
                    }

                    if (is_array($handler)) {
                        [$controllerClass, $action] = $handler;

                        if (!class_exists($controllerClass)) {
                            Response::error("Controlador {$controllerClass} no encontrado", 500);
                        }

                        $controller = new $controllerClass();

                        if (!method_exists($controller, $action)) {
                            Response::error("Método {$action} no existe en {$controllerClass}", 500);
                        }

                        $controller->$action($params);
                        return;
                    }
                } catch (\Throwable $e) {
                    Response::error($e->getMessage(), 500, [
                        'file' => $e->getFile(),
                        'line' => $e->getLine(),
                        'trace' => $e->getTraceAsString()
                    ]);
                }
            }
        }

        Response::error("Ruta no encontrada para {$method} {$uri}", 404);
    }
}
