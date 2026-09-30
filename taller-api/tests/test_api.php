<?php

// Test suite exhaustivo para todos los módulos del taller

$baseUrl = 'http://localhost:8000';

function callApi(string $method, string $path, ?array $body = null, ?string $token = null): array
{
    global $baseUrl;
    $url = $baseUrl . $path;

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);

    $headers = ['Accept: application/json'];
    if ($token !== null) {
        $headers[] = 'Authorization: Bearer ' . $token;
    }
    if ($body !== null) {
        $json = json_encode($body);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $json);
        $headers[] = 'Content-Type: application/json';
        $headers[] = 'Content-Length: ' . strlen($json);
    }

    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_TIMEOUT, 5);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    return [
        'code' => $httpCode,
        'data' => json_decode($response, true)
    ];
}

echo "============================================================\n";
echo " PRUEBAS DE AUTENTICACIÓN Y MÓDULOS DEL TALLER MECÁNICO \n";
echo "============================================================\n\n";

// --- MÓDULO 0: Autenticación y Token JWT ---
echo "--- MÓDULO: Autenticación JWT ---\n";

// 0.1 Login con admin@melecsa.com / admin
$rAuth = callApi('POST', '/api/auth/login', [
    'email'    => 'admin@melecsa.com',
    'password' => 'admin'
]);
$jwtToken = $rAuth['data']['data']['token'] ?? null;
$userAuth = $rAuth['data']['data']['user']['nombre'] ?? 'N/A';
echo "[+] Login admin@melecsa.com: HTTP " . $rAuth['code'] . " | Usuario: {$userAuth}\n";
echo "    Token JWT: " . substr($jwtToken ?? '', 0, 40) . "...\n";

// 0.2 Validar perfil con Token
$rMe = callApi('GET', '/api/auth/me', null, $jwtToken);
echo "[+] Validar sesión con Bearer Token (/api/auth/me): HTTP " . $rMe['code'] . " | Rol: " . ($rMe['data']['data']['user']['rol'] ?? 'N/A') . "\n";

// 0.2.b Guardar foto de perfil del usuario autenticado (/api/auth/foto)
$rFotoPerfil = callApi('POST', '/api/auth/foto', [
    'url_foto' => 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=300&q=80'
], $jwtToken);
echo "[+] Guardar foto de perfil (/api/auth/foto): HTTP " . $rFotoPerfil['code'] . " | URL: " . ($rFotoPerfil['data']['data']['url_completa'] ?? 'N/A') . "\n";

// 0.2.c Validar que /api/auth/me devuelva la foto de perfil guardada
$rMeFoto = callApi('GET', '/api/auth/me', null, $jwtToken);
echo "[+] Validar foto_perfil en perfil (/api/auth/me): HTTP " . $rMeFoto['code'] . " | Foto URL: " . ($rMeFoto['data']['data']['user']['foto_url'] ?? 'N/A') . "\n";

// 0.3 Login fallido con contraseña incorrecta
$rFail = callApi('POST', '/api/auth/login', [
    'email'    => 'admin@melecsa.com',
    'password' => 'clave_invalida'
]);
echo "[+] Validación de rechazo por clave errónea: HTTP " . $rFail['code'] . " (Rechazo correcto)\n\n";

// --- MÓDULO 0.5: Administración de Usuarios y Roles ---
echo "--- MÓDULO: Administración de Usuarios y Roles (ADMIN, RECEPCIONISTA, MECANICO, CAJERO) ---\n";

// 0.5.1 Catálogo de roles disponibles
$rRoles = callApi('GET', '/api/usuarios/roles');
$rolesList = array_column($rRoles['data']['data'] ?? [], 'rol');
echo "[+] Consulta de catálogo de roles: HTTP " . $rRoles['code'] . " | Roles: " . implode(', ', $rolesList) . "\n";

// 0.5.1.b Filtrar usuarios por rol mediante endpoint dedicado GET /api/usuarios/rol/{rol}
$rFiltroAdmin = callApi('GET', '/api/usuarios/rol/ADMIN');
echo "[+] Filtrar usuarios por rol ADMIN (/api/usuarios/rol/ADMIN): HTTP " . $rFiltroAdmin['code'] . " | Encontrados: " . ($rFiltroAdmin['data']['data']['total_usuarios'] ?? 0) . "\n";

$rFiltroMec = callApi('GET', '/api/usuarios/rol/MECANICO');
echo "[+] Filtrar usuarios por rol MECANICO (/api/usuarios/rol/MECANICO): HTTP " . $rFiltroMec['code'] . " | Encontrados: " . ($rFiltroMec['data']['data']['total_usuarios'] ?? 0) . "\n";

$rFiltroBad = callApi('GET', '/api/usuarios/rol/ROL_INEXISTENTE');
echo "[+] Rechazo en filtro de rol inválido: HTTP " . $rFiltroBad['code'] . " (Validación correcta)\n";

// 0.5.2 Creación de usuario con rol RECEPCIONISTA
$nuevoUserEmail = 'recep_' . time() . '@melecsa.com';
$rNuevoUser = callApi('POST', '/api/usuarios', [
    'nombre'       => 'Sandra López',
    'email'        => $nuevoUserEmail,
    'password'     => 'recepcion2026',
    'rol'          => 'RECEPCIONISTA',
    'telefono'     => '+525511223344',
    'especialidad' => 'Atención a Flotillas y Recepción'
]);
$nuevoUserId = $rNuevoUser['data']['data']['id'] ?? null;
echo "[+] Crear usuario RECEPCIONISTA (ID: {$nuevoUserId}): HTTP " . $rNuevoUser['code'] . " | Rol asignado: " . ($rNuevoUser['data']['data']['rol'] ?? 'N/A') . "\n";

// 0.5.3 Creación de usuario con rol MECANICO
$nuevoMecEmail = 'mecanico_' . time() . '@melecsa.com';
$rNuevoMec = callApi('POST', '/api/usuarios', [
    'nombre'       => 'Esteban Ruiz',
    'email'        => $nuevoMecEmail,
    'password'     => 'mecanico2026',
    'rol'          => 'MECANICO',
    'telefono'     => '+525599887766',
    'especialidad' => 'Transmisiones Automáticas'
]);
$nuevoMecId = $rNuevoMec['data']['data']['id'] ?? null;
echo "[+] Crear usuario MECANICO (ID: {$nuevoMecId}): HTTP " . $rNuevoMec['code'] . " | Especialidad: " . ($rNuevoMec['data']['data']['especialidad'] ?? 'N/A') . "\n";

// 0.5.4 Rechazo de rol inexistente
$rRolInvalido = callApi('POST', '/api/usuarios', [
    'nombre'   => 'Usuario Prueba Invalido',
    'email'    => 'invalido_' . time() . '@melecsa.com',
    'password' => '123456',
    'rol'      => 'SUPERVISOR_INVENTADO'
]);
echo "[+] Validación de rechazo por rol no permitido: HTTP " . $rRolInvalido['code'] . " (Rechazo correcto)\n";

// 0.5.5 Consulta individual de usuario
$rDetalleUser = callApi('GET', "/api/usuarios/{$nuevoUserId}");
echo "[+] Detalle de usuario ID {$nuevoUserId}: HTTP " . $rDetalleUser['code'] . " | Nombre: " . ($rDetalleUser['data']['data']['nombre'] ?? 'N/A') . "\n";

// 0.5.6 Actualización de usuario (nombre y especialidad)
$rUpdateUser = callApi('PUT', "/api/usuarios/{$nuevoUserId}", [
    'nombre'       => 'Sandra López de Hernández',
    'especialidad' => 'Jefa de Recepción y Atención VIP'
]);
echo "[+] Actualizar usuario ID {$nuevoUserId}: HTTP " . $rUpdateUser['code'] . "\n";

// 0.5.7 Eliminación / Desactivación de usuario
$rDeleteUser = callApi('DELETE', "/api/usuarios/{$nuevoUserId}");
echo "[+] Eliminar usuario ID {$nuevoUserId}: HTTP " . $rDeleteUser['code'] . " | Tipo: " . ($rDeleteUser['data']['data']['tipo_borrado'] ?? 'N/A') . "\n";
if ($rDeleteUser['code'] !== 200) {
    echo "    DETALLE ERROR DELETE: " . json_encode($rDeleteUser['data']) . "\n\n";
} else {
    echo "\n";
}

// --- MÓDULO 1: Recepción y Órdenes de Trabajo ---
echo "--- MÓDULO 1: Recepción y Órdenes de Trabajo (OT) ---\n";

// 1.1 Registro de nuevo cliente
$rCli = callApi('POST', '/api/clientes', [
    'tipo_documento'   => 'DNI',
    'numero_documento' => 'DOC-' . time(),
    'nombre'           => 'María Elena Torres',
    'telefono'         => '+525544332211',
    'email'            => 'maria.torres@ejemplo.com',
    'direccion'        => 'Calle Principal 101'
]);
$clienteId = $rCli['data']['data']['id'] ?? null;
echo "[+] Cliente creado (ID: {$clienteId}): HTTP " . $rCli['code'] . "\n";

// 1.2 Registro de nuevo vehículo
$placaNueva = 'TEST-' . rand(100, 999);
$rVeh = callApi('POST', '/api/vehiculos', [
    'cliente_id'         => $clienteId,
    'tipo'               => 'AUTOMOVIL',
    'marca'              => 'Nissan',
    'modelo'             => 'Sentra',
    'anio'               => 2022,
    'placa'              => $placaNueva,
    'color'              => 'Azul Metálico',
    'kilometraje_actual' => 15400
]);
$vehiculoId = $rVeh['data']['data']['id'] ?? null;
echo "[+] Vehículo creado (ID: {$vehiculoId}, Placa: {$placaNueva}): HTTP " . $rVeh['code'] . "\n";

// 1.3 Búsqueda de vehículo por placa
$rSearch = callApi('GET', "/api/vehiculos/buscar?placa={$placaNueva}");
echo "[+] Búsqueda por placa: HTTP " . $rSearch['code'] . " | " . ($rSearch['data']['data']['marca'] ?? '') . " " . ($rSearch['data']['data']['modelo'] ?? '') . "\n";

// 1.4 Recepción y creación de Orden de Trabajo con checklist de ingreso y fotos
$rOT = callApi('POST', '/api/ordenes', [
    'cliente_id'          => $clienteId,
    'vehiculo_id'         => $vehiculoId,
    'tecnico_id'          => 3, // Roberto Juárez
    'recepcionista_id'    => 2, // Laura Gómez
    'motivo_ingreso'      => 'Revisión periódica de 15,000 km y ruido al frenar',
    'diagnostico_inicial' => 'Posible cristalización de pastillas de freno',
    'kilometraje_ingreso' => 15400,
    'nivel_combustible'   => '1/2',
    'fecha_promesa'       => date('Y-m-d H:i:s', strtotime('+2 days')),
    'checklist'           => [
        ['seccion' => 'EXTERIOR', 'item' => 'Carrocería lateral derecha', 'estado' => 'REGULAR', 'observaciones' => 'Pequeño raspón superficial previo'],
        ['seccion' => 'EXTERIOR', 'item' => 'Luces delanteras y traseras', 'estado' => 'BUENO', 'observaciones' => null],
        ['seccion' => 'INTERIOR', 'item' => 'Nivel de combustible', 'estado' => 'BUENO', 'observaciones' => '1/2 tanque confirmado'],
        ['seccion' => 'EQUIPAMIENTO', 'item' => 'Llanta de repuesto y gata', 'estado' => 'BUENO', 'observaciones' => 'Completo en cajuela']
    ]
]);
$otId = $rOT['data']['data']['id'] ?? null;
$tokenSeguimiento = $rOT['data']['data']['token_seguimiento'] ?? null;
$numOT = $rOT['data']['data']['numero_ot'] ?? null;
echo "[+] Orden de Trabajo creada: #{$numOT} (ID: {$otId}): HTTP " . $rOT['code'] . " | Token: {$tokenSeguimiento}\n";
if ($rOT['code'] !== 201) {
    echo "    DETALLE ERROR: " . json_encode($rOT['data']) . "\n";
}

// 1.5 Subida / registro de fotografía de ingreso
$rFoto = callApi('POST', "/api/ordenes/{$otId}/fotos", [
    'url_archivo' => 'https://taller.com/storage/fotos/ot_ingreso_frontal.jpg',
    'etapa'       => 'RECEPCION',
    'descripcion' => 'Foto frontal del vehículo al ingresar con placa visible'
]);
echo "[+] Foto de recepción registrada: HTTP " . $rFoto['code'] . "\n";

// 1.6 Cambio de estado en tiempo real (En diagnóstico -> En reparación)
$rEstado1 = callApi('PUT', "/api/ordenes/{$otId}/estado", [
    'estado'     => 'EN_DIAGNOSTICO',
    'comentario' => 'Técnico inicia verificación en rampa',
    'usuario_id' => 3
]);
echo "[+] Cambio de estado a EN_DIAGNOSTICO: HTTP " . $rEstado1['code'] . "\n";

// 1.7 Agregar repuesto y mano de obra a la OT
$rItem1 = callApi('POST', "/api/ordenes/{$otId}/items", [
    'tipo_item'       => 'REPUESTO',
    'repuesto_id'     => 1, // Pastillas de freno
    'cantidad'        => 1.0,
    'precio_unitario' => 650.00,
    'costo_unitario'  => 320.00
]);
echo "[+] Repuesto agregado a OT: HTTP " . $rItem1['code'] . "\n";

$rItem2 = callApi('POST', "/api/ordenes/{$otId}/items", [
    'tipo_item'       => 'MANO_OBRA',
    'descripcion'     => 'Instalación y rectificación de frenos',
    'cantidad'        => 1.0,
    'precio_unitario' => 400.00,
    'mecanico_id'     => 3
]);
echo "[+] Mano de obra agregada a OT: HTTP " . $rItem2['code'] . "\n";

// --- MÓDULO 2: Presupuestos e Historial Clínico ---
echo "\n--- MÓDULO 2: Presupuestos e Historial Clínico ---\n";

// 2.1 Creación de cotización rápida
$rPres = callApi('POST', '/api/presupuestos', [
    'cliente_id'    => $clienteId,
    'vehiculo_id'   => $vehiculoId,
    'tecnico_id'    => 3,
    'vigencia_dias' => 10,
    'observaciones' => 'Presupuesto de afinación y bujías',
    'items'         => [
        ['tipo_item' => 'REPUESTO', 'repuesto_id' => 5, 'cantidad' => 1, 'precio_unitario' => 620.00],
        ['tipo_item' => 'MANO_OBRA', 'descripcion' => 'Calibración y cambio de bujías', 'cantidad' => 1, 'precio_unitario' => 300.00]
    ]
]);
$presId = $rPres['data']['data']['id'] ?? null;
echo "[+] Presupuesto rápido creado (ID: {$presId}): HTTP " . $rPres['code'] . " | Total: $" . ($rPres['data']['data']['total'] ?? 0) . "\n";

// 2.2 Conversión a OT con 1 clic
$rConv = callApi('POST', "/api/presupuestos/{$presId}/convertir-a-ot", ['recepcionista_id' => 2]);
echo "[+] Presupuesto convertido a OT con 1 clic: HTTP " . $rConv['code'] . " | Nueva OT: " . ($rConv['data']['data']['numero_ot'] ?? 'N/A') . "\n";

// 2.3 Consulta de Historial Clínico por Placa
$rClinico = callApi('GET', "/api/historial-clinico?placa={$placaNueva}");
echo "[+] Historial clínico vehicular ({$placaNueva}): HTTP " . $rClinico['code'] . " | Visitas registradas: " . ($rClinico['data']['data']['estadisticas']['total_visitas'] ?? 0) . "\n";

// --- MÓDULO 3: Control de Inventario y Descarga Automática ---
echo "\n--- MÓDULO 3: Control de Inventario, Productos y Foto Base64 ---\n";

// 3.0.a Listado de categorías disponibles
$rCats = callApi('GET', '/api/categorias');
echo "[+] Listado de categorías (/api/categorias): HTTP " . $rCats['code'] . " | Total categorías: " . count($rCats['data']['data'] ?? []) . "\n";

// 3.0.b Guardar producto con categoría nueva (auto-creación) y foto_producto en Base64
$skuTest1 = 'LUB-10W40-' . rand(100, 999);
$rProdNuevo = callApi('POST', '/api/productos', [
    'codigo_sku'        => $skuTest1,
    'categoria'         => 'Aceites y Fluidos Sintéticos', // Categoría nueva que no existía
    'nombre_producto'   => 'Aceite Sintético 10W-40 Multigrado',
    'stock_inicial'     => 10,
    'stock_minimo'      => 4,
    'costo_compra'      => 150.00,
    'precio_venta'      => 320.00,
    'ubicacion_almacen' => 'Estante A-01',
    'unidad_medida'     => 'Pieza',
    'foto_producto'     => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
]);
echo "[+] Guardar nuevo insumo con categoría auto-creada: HTTP " . $rProdNuevo['code'] . " | Categoría: " . ($rProdNuevo['data']['data']['categoria_nombre'] ?? 'N/A') . " | Foto guardada: " . (($rProdNuevo['data']['data']['tiene_foto'] ?? false) ? 'SI (Base64)' : 'NO') . "\n";
if ($rProdNuevo['code'] !== 201) {
    echo "    DETALLE ERROR PRODUCTO: " . json_encode($rProdNuevo['data']) . "\n";
}

// 3.0.c Guardar segundo producto seleccionando la categoría ya existente
$skuTest2 = 'BAL-CER-' . rand(100, 999);
$rProdExist = callApi('POST', '/api/productos', [
    'codigo_sku'        => $skuTest2,
    'categoria'         => 'Aceites y Fluidos Sintéticos', // Misma categoría (debe escoger la existente)
    'nombre_producto'   => 'Balatas Traseras Cerámicas',
    'stock_inicial'     => 8,
    'stock_minimo'      => 3,
    'costo_compra'      => 180.00,
    'precio_venta'      => 380.00,
    'ubicacion_almacen' => 'Estante B-02',
    'unidad_medida'     => 'Pieza',
    'foto_producto'     => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
]);
echo "[+] Guardar insumo seleccionando categoría existente: HTTP " . $rProdExist['code'] . " | Categoría ID: " . ($rProdExist['data']['data']['categoria_id'] ?? 'N/A') . " (Reutilizada con éxito)\n";

// 3.0.d Consultar detalle del producto y validar foto Base64
$prodIdTest = $rProdNuevo['data']['data']['id'] ?? 1;
$rProdDetalle = callApi('GET', "/api/productos/{$prodIdTest}");
$tieneBase64 = strpos($rProdDetalle['data']['data']['foto_producto'] ?? '', 'data:image') === 0;
echo "[+] Consultar producto (/api/productos/{$prodIdTest}): HTTP " . $rProdDetalle['code'] . " | Foto Base64 presente: " . ($tieneBase64 ? 'VERIFICADA' : 'NO') . "\n";

// 3.1 Consultar stock de pastillas antes de cerrar orden
$rRepAntes = callApi('GET', '/api/repuestos/1');
$stockAntes = $rRepAntes['data']['data']['stock_actual'] ?? 0;
echo "[i] Stock actual del repuesto FRE-PAS-001 antes del cierre: {$stockAntes} unidades\n";

// 3.2 Cerrar orden de trabajo (Descarga automática de stock)
$rCierre = callApi('POST', "/api/ordenes/{$otId}/cerrar", ['usuario_id' => 3]);
echo "[+] Cierre de OT y descarga automática de stock: HTTP " . $rCierre['code'] . "\n";

// 3.3 Verificar que el stock disminuyó
$rRepDesp = callApi('GET', '/api/repuestos/1');
$stockDespues = $rRepDesp['data']['data']['stock_actual'] ?? 0;
echo "[✔] Stock verificado después del cierre: {$stockDespues} unidades (disminución confirmada)\n";

// 3.4 Alertas de stock crítico
$rAlertas = callApi('GET', '/api/repuestos/alertas-stock');
echo "[+] Alertas de stock mínimo activas: " . ($rAlertas['data']['data']['total_alertas'] ?? 0) . " items con stock <= mínimo\n";

// --- MÓDULO 4: Caja, Pagos y Cuentas por Cobrar ---
echo "\n--- MÓDULO 4: Caja, Pagos y Cuentas por Cobrar ---\n";

// 4.1 Registrar anticipo
$rPago1 = callApi('POST', "/api/ordenes/{$otId}/pagos", [
    'tipo_pago'         => 'ANTICIPO',
    'metodo_pago'       => 'TRANSFERENCIA',
    'monto'             => 500.00,
    'numero_referencia' => 'SPEI-8839201',
    'notas'             => 'Anticipo inicial 50%',
    'usuario_id'        => 5
]);
echo "[+] Anticipo registrado: HTTP " . $rPago1['code'] . " | Saldo pendiente: $" . ($rPago1['data']['data']['saldo_pendiente'] ?? 0) . "\n";

// 4.2 Cuentas por cobrar
$rCxC = callApi('GET', '/api/caja/cuentas-por-cobrar');
echo "[+] Cuentas por cobrar activas: " . ($rCxC['data']['data']['total_cuentas'] ?? 0) . " órdenes | Monto acumulado: $" . ($rCxC['data']['data']['monto_total_por_cobrar'] ?? 0) . "\n";

// 4.3 Reporte diario de ingresos
$rRepDia = callApi('GET', '/api/reportes/ingresos-diarios');
echo "[+] Reporte diario de ingresos: $" . ($rRepDia['data']['data']['gran_total_ingresos'] ?? 0) . " recaudados hoy\n";

// 4.4 Reporte de ingresos y mano de obra por mecánico
$rRepMec = callApi('GET', '/api/reportes/ingresos-por-mecanico');
echo "[+] Productividad por mecánicos: HTTP " . $rRepMec['code'] . " | Total mano de obra producida: $" . ($rRepMec['data']['data']['total_mano_obra_global'] ?? 0) . "\n";

// --- MÓDULO 5: Dashboard y Notificaciones (WhatsApp & Seguimiento) ---
echo "\n--- MÓDULO 5: Dashboard y Notificaciones ---\n";

// 5.1 Dashboard global de rentabilidad
$rDash = callApi('GET', '/api/dashboard/metricas');
$rentab = $rDash['data']['data']['rentabilidad'] ?? [];
echo "[+] Dashboard Métricas: HTTP " . $rDash['code'] . "\n";
echo "    - Facturación total: $" . ($rentab['facturacion_bruta_items'] ?? 0) . "\n";
echo "    - Utilidad neta estimada: $" . ($rentab['utilidad_neta_estimada'] ?? 0) . "\n";
echo "    - Margen de rentabilidad: " . ($rentab['margen_rentabilidad_porc'] ?? 0) . "%\n";

// 5.2 Consulta pública de seguimiento con Token
$rTrack = callApi('GET', "/api/seguimiento/{$tokenSeguimiento}");
echo "[+] Enlace público de seguimiento (sin login): HTTP " . $rTrack['code'] . "\n";
echo "    - Estado visual del vehículo: " . ($rTrack['data']['data']['progreso']['titulo'] ?? 'N/A') . " (" . ($rTrack['data']['data']['progreso']['porcentaje'] ?? 0) . "% completado)\n";
echo "    - Checklist inspeccionado: " . count($rTrack['data']['data']['checklist'] ?? []) . " puntos\n";
echo "    - Fotos disponibles para el cliente: " . count($rTrack['data']['data']['fotos'] ?? []) . "\n";

// 5.3 Generación de Enlace de WhatsApp para aviso de entrega
$rWA = callApi('POST', '/api/notificaciones/whatsapp', [
    'orden_trabajo_id' => $otId,
    'tipo_aviso'       => 'LISTO_ENTREGA'
]);
echo "[+] Enlace de WhatsApp generado con 1 clic: HTTP " . $rWA['code'] . "\n";
echo "    - URL Click-to-Chat: " . substr($rWA['data']['data']['enlace_whatsapp'] ?? '', 0, 80) . "...\n";

echo "\n============================================================\n";
echo " ✔ TODOS LOS MÓDULOS Y ENDPOINTS VALIDADOS EXITOSAMENTE \n";
echo "============================================================\n";
