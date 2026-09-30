# MELECSA - Sistema de Gestión Integral para Taller

Sistema web moderno desarrollado en **Angular 21** con componentes standalone, señales reactivas (`Signals`) y diseño limpio para la administración completa del taller MELECSA.

---

## 🚀 Inicio Rápido

Para iniciar el servidor de desarrollo local:

```bash
npm start
# o bien:
ng serve
```

Navega en tu navegador a: **`http://localhost:4200/`**

---

## 🔐 1. Pantalla Inicial: Login y Autenticación

El sistema inicia obligatoriamente en la pantalla de inicio de sesión (`/login`):
- **Diseño corporativo**: Imagen alusiva al taller, resumen de características y selector de acceso rápido.
- **Credenciales por defecto**:
  - **Email:** `admin@melecsa.com`
  - **Password:** `admin` (o cualquier contraseña de 4+ caracteres)
- **Botones de Acceso Rápido Demo (1 Clic)**:
  - 👨‍💼 **Administrador General** (Ing. Carlos Mendoza)
  - 👩‍💼 **Asesora de Recepción y Servicio** (Sofía Herrera)
  - 👨‍🔧 **Mecánico Maestro / Jefe de Taller** (Miguel Ángel Torres)
- **Seguridad**: Rutas protegidas mediante `authGuard`, persistencia en `localStorage` y cierre de sesión seguro.

---

## 🚗 2. Módulos del Sistema (Sidebar)

### 📊 Panel de Control (Dashboard) y Notificaciones (`/dashboard`)
- **Métricas de rentabilidad y actividad en tiempo real**:
  - Órdenes activas en taller y desglose de estatus.
  - Vehículos listos para entrega hoy con alerta destacada.
  - Recaudación del día vs. mes y cuentas pendientes por cobrar.
  - Alerta de insumos en stock crítico.
- **Gráfico de barras de progreso operativo**: visualización de porcentaje por cada etapa de trabajo.
- **Centro de Notificaciones y Avisos a Clientes**:
  - Generación de enlace único de seguimiento en tiempo real (`/seguimiento/:token`).
  - Envío automático de avisos al cliente mediante **WhatsApp** (abriendo plantilla personalizada) y **Correo Electrónico**.
  - Registro cronológico de avisos emitidos.

### 🚗 Recepción y Órdenes de Trabajo (OT) (`/ordenes`)
- **Registro de clientes y vehículos**: Nombre, teléfono, correo, placa, marca/modelo/año y kilometraje.
- **Checklist digital de ingreso**:
  - Indicador interactivo de **nivel de combustible** (0% Reserva, 25% 1/4, 50% 1/2, 75% 3/4, 100% Lleno).
  - Estado físico de carrocería (rayones, golpes, abolladuras previas).
  - Verificación de accesorios: rueda de auxilio, gato hidráulico, llave de tuercas, tarjeta de circulación, luces, batería y aire acondicionado.
  - **Registro fotográfico**: carga y visualización de fotografías de evidencia al momento de recibir la unidad.
- **Asignación de técnicos**: Mecánicos especialistas con carga de órdenes activas visible.
- **Estados en tiempo real**:
  - *En diagnóstico* 🟣
  - *Esperando repuestos* 🟡
  - *En reparación* 🔵
  - *Listo para entrega* 🟢
  - *Entregado / Cerrado* ⚪
- Filtros por estado, buscador dinámico por placa o cliente y modal de detalle completo.

### 📝 Presupuestos e Historial Clínico (`/presupuestos`)
- **Sub-módulo 1: Cotizaciones Rápidas**:
  - Creación dinámica con buscador de repuestos del catálogo e ítems de mano de obra.
  - Cálculo automático de subtotales, IVA (16%) y total.
  - **⚡ Botón de 1 Clic "Convertir a OT"**: Transforma automáticamente la cotización aprobada en una Orden de Trabajo activa en el taller.
  - Compartir cotización por WhatsApp con el cliente.
- **Sub-módulo 2: Historial Clínico del Vehículo**:
  - Buscador inteligente por **Placa** (ej. `ABC-1234`, `NXY-7721`) o número de serie **VIN**.
  - Expediente del vehículo: propietario, visitas acumuladas, total invertido.
  - **Línea de tiempo cronológica**: historial detallado de todas las intervenciones previas, kilometraje en cada ingreso, diagnósticos, repuestos reemplazados, mano de obra realizada, técnico responsable y póliza de garantía.

### 📦 Control de Inventario y Repuestos (`/inventario`)
- **Gestión de catálogo**: Insumos y refacciones clasificados por categoría (Filtros, Frenos, Lubricantes, Suspensión, Eléctrico, Motor, Insumos).
- **Alertas de Stock Mínimo**:
  - Detección reactiva de productos con stock `<= minStock`.
  - Banner de advertencia en color ámbar/rojo con filtro rápido "Ver Insumos Críticos".
- **Comparativa de Costo vs. Precio de Venta**:
  - Cálculo automático de margen de utilidad en porcentaje (%) y ganancia bruta por pieza ($).
- **Descarga automática de inventario**:
  - Registro de trazabilidad y movimientos de inventario (`salida_ot`).
  - Al completar o descargar insumos de una orden de trabajo, se descuentan automáticamente las cantidades en bodega.
- Modal de alta de productos y ajuste/entrada de compras.

### 💳 Caja, Pagos y Cuentas por Cobrar (`/caja`)
- **Control de pagos**: Registro de anticipos, abonos parciales y liquidación total con número de recibo.
- **Cuentas por cobrar**:
  - Listado de órdenes con saldo pendiente y días transcurridos.
  - Botón directo **"Cobrar WhatsApp"** con mensaje formal preformateado hacia el cliente.
- **Reportes financieros**:
  - Reporte de ingresos diarios y mensuales.
  - Desglose por método de pago: *Efectivo*, *Tarjeta de Débito/Crédito*, *Transferencia SPEI*, *Enlace Digital / QR*.
  - Reporte de productividad y **comisiones por mecánico** (18% de comisión sobre mano de obra facturada).

### 📱 Portal Público de Seguimiento para el Cliente (`/seguimiento/:token`)
- Vista optimizada para móvil y escritorio donde el cliente accede mediante el enlace de WhatsApp:
  - Stepper visual con el progreso en tiempo real de su auto.
  - Checklist y fotografías tomadas al momento de la recepción.
  - Detalle de refacciones y trabajos autorizados.
  - Saldo pendiente y botón para comunicarse directamente con el taller por WhatsApp.

---

## 🛠️ Tecnologías Utilizadas

- **Angular 21** (Standalone Components, Signals, Router)
- **TypeScript 5.9**
- **HTML5 & CSS3** con variables personalizadas y responsive design
- **Iconos SVG nativos** de alto rendimiento y cero dependencias externas
