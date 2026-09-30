# Taller

Aplicación web para la gestión de un taller. El repositorio se organizará en dos proyectos independientes: una interfaz desarrollada con Angular y una API/backend desarrollada con PHP, conectada a MySQL.

## Estructura prevista

```text
.
├── taller-web/    # Aplicación frontend Angular
└── taller-app/    # Backend PHP y acceso a MySQL
```

## Requisitos

- Node.js y npm, para instalar y ejecutar el frontend.
- PHP, para ejecutar el backend.
- MySQL, para almacenar los datos de la aplicación.
- Un navegador web moderno.

## Puesta en marcha

Los siguientes pasos describen el flujo esperado. Los comandos concretos pueden variar según los scripts y la configuración que se incorporen a cada proyecto.

### Frontend Angular

```bash
cd taller-web
npm install
npx ng serve
```

Por defecto, Angular estará disponible en `http://localhost:4200`.

### Backend PHP

Configura primero la conexión a MySQL con los valores de tu entorno. No guardes contraseñas ni otros secretos en el repositorio. Después, desde la carpeta del backend, inicia el servidor PHP; por ejemplo, si `index.php` está en la raíz del proyecto:

```bash
cd taller-app
php -S localhost:8000
```

El backend estará disponible en `http://localhost:8000`. Si el proyecto utiliza un directorio público o un punto de entrada distinto, ajusta el comando a esa estructura.

## Base de datos

El backend utilizará MySQL. Al incorporar el proyecto PHP, documenta aquí el nombre de la base de datos, el mecanismo de configuración de credenciales y cómo crear o inicializar el esquema (por ejemplo, mediante migraciones o un archivo SQL). Usa valores locales para desarrollo y no publiques credenciales reales.

## Desarrollo

Ejecuta el frontend y el backend en terminales separadas. La URL del backend y cualquier configuración adicional del frontend deberán definirse en los archivos de entorno correspondientes cuando se incorporen al proyecto.
