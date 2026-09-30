<?php

namespace App;

class Autoloader
{
    public static function register(): void
    {
        spl_autoload_register(function ($class) {
            $prefix = 'App\\';
            $baseDir = __DIR__ . '/';

            $len = strlen($prefix);
            if (strncmp($prefix, $class, $len) !== 0) {
                return;
            }

            $relativeClass = substr($class, $len);
            
            // Reemplazar subnamespace Config para apuntar a config/
            if (str_starts_value('Config\\', $relativeClass)) {
                $file = dirname(__DIR__) . '/config/' . str_replace('\\', '/', substr($relativeClass, 7)) . '.php';
            } else {
                $file = $baseDir . str_replace('\\', '/', $relativeClass) . '.php';
            }

            if (file_exists($file)) {
                require_once $file;
            }
        });
    }
}

if (!function_exists('str_starts_value')) {
    function str_starts_value(string $needle, string $haystack): bool {
        return substr($haystack, 0, strlen($needle)) === $needle;
    }
}
