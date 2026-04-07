# Cuenta corriente · Ferretería — Documentación para análisis (IA / equipo)

Aplicación web para gestionar **cuentas corrientes de clientes** (obras, ventas, pagos, PDFs) y **cuentas de proveedores**, con autenticación **Supabase**, base **PostgreSQL** vía **Prisma**, desplegable en **Vercel**.

---

## 1. Stack tecnológico

| Capa | Tecnología |
|------|------------|
| Framework | Next.js 16 (App Router, React 19) |
| Estilos | Tailwind CSS 4 (`@import "tailwindcss"` en `globals.css`) |
| Base de datos | PostgreSQL |
| ORM | Prisma 7 (`prisma/schema.prisma`, adapter `pg`) |
| Auth | Supabase Auth (`@supabase/ssr`, cookies en servidor) |
| Tests | Vitest |
| Otros | `pdf-parse` (extracción PDF), `xlsx` (export Excel), `zod` (validación) |

---

## 2. Estructura de carpetas (resumen)

```
cuenta-corriente-ferreteria/
├── prisma/
│   └── schema.prisma          # Modelos y enums
├── src/
│   ├── app/
│   │   ├── layout.tsx         # Root: fuentes, viewport, body
│   │   ├── globals.css        # Tailwind + componentes (.btn-*, .table-app, .segmented, …)
│   │   ├── page.tsx           # Landing pública (si existe)
│   │   ├── login/             # Login Supabase
│   │   ├── dashboard/         # App autenticada
│   │   │   ├── layout.tsx     # Sidebar + nav móvil + main
│   │   │   ├── actions.ts     # Server Actions (p. ej. signOut)
│   │   │   └── **/page.tsx y *Client.tsx
│   │   └── api/               # Route Handlers REST
│   ├── components/            # UI reutilizable (DashboardNav, DashboardSidebar, modales, …)
│   ├── lib/                   # Utilidades, Supabase server/client, auth bypass, formatos
│   ├── services/              # Lógica de negocio + acceso Prisma (listados, métricas, importación)
│   └── domain/                # Reglas puras (p. ej. normalización comprobantes)
├── scripts/                   # dotenv override para CLI Prisma
└── package.json
```

---

## 3. Autenticación (single-tenant)

- **Sesión:** Supabase Auth (`auth.users`); las rutas API usan `requireAuth()` (cookie en servidor). Los datos de negocio **no** llevan `userId` por fila.
- **Desarrollo local:** si `AUTH_BYPASS_LOCAL=1` (solo cuando `NODE_ENV !== "production"`), se usa un id fijo de bypass y no hace falta Supabase.
- **Login:** `src/app/login` + `createClient` de `@/lib/supabase/server` para sesión en cookies.

---

## 4. Navegación responsive (lógica importante)

- **Sidebar fijo (`DashboardSidebar`):** solo desde **`xl` (1280px)** — `hidden xl:block` en `dashboard/layout.tsx`.
- **Barra móvil + cajón (`DashboardNav`):** **`xl:hidden`**. El menú lateral se renderiza con **`createPortal` a `document.body`** para que `position:fixed` no quede afectado por `backdrop-filter` del header (evita que el listado de enlaces “ocupe el flujo” y media pantalla).
- **Problema histórico:** el corte en `md` (768px) mostraba sidebar en muchos móviles horizontales; además el header móvil llegó a quedar con **`md:hidden`** desalineado respecto del layout en `lg`/`xl`.

---

## 5. Modelo de datos (Prisma) — conceptos

- **Cliente:** `tipo` (particular | constructor), datos fiscales/contacto.
- **Obra:** pertenece a un cliente; agrupa movimientos y archivos.
- **Movimiento:** venta | pago | devolución | ajuste; montos, comprobante, opcionalmente vinculado a **Archivo** (PDF). Incluye liquidación (`liquidadoAt`, `liquidadoPorPagoId`) para marcar ventas pagadas contra un pago.
- **Archivo:** PDF subido (URL en storage), metadatos extraídos (comprobante, CAE, etc.), estado de pipeline (`subido` → `extraido` → `importado` / `error`).
- **Proveedor / MovimientoProveedor / ArchivoProveedor:** espejo del flujo de compras y facturas de proveedor.
- **LogCambio / LogEliminacion:** auditoría de cambios y eliminaciones.

Índices relevantes en `Movimiento` y `MovimientoProveedor` para listados por fecha, comprobante normalizado y liquidaciones.

---

## 6. Rutas principales de la UI (`/dashboard/...`)

| Ruta | Función aproximada |
|------|---------------------|
| `/dashboard` | Panel: KPIs, clientes con saldo, actividad, accesos rápidos |
| `/dashboard/clientes` | Listado buscable, orden, export |
| `/dashboard/clientes/[id]` | Ficha cliente: tabs resumen / movimientos / datos / … |
| `/dashboard/clientes/[id]/estado-cuenta` | Vista tipo estado de cuenta |
| `/dashboard/obras/[id]` | Movimientos tipo planilla (Excel-like), liquidaciones, cheques |
| `/dashboard/upload` | Subida PDF e importación |
| `/dashboard/carga` | Alta manual de movimientos |
| `/dashboard/caja` | Caja |
| `/dashboard/cheques` | Cheques |
| `/dashboard/proveedores` | Proveedores |
| `/dashboard/proveedores/[id]` | Ficha proveedor |
| `/dashboard/buscar` | Búsqueda global (⌘K en UI) |
| `/dashboard/auditoria` | Consulta de logs de auditoría |

---

## 7. API (`src/app/api/**`)

Patrón habitual: validar sesión (`requireAuth`), operar con servicios Prisma, devolver JSON.

Ejemplos de prefijos:

- `/api/clientes`, `/api/clientes/[id]`, `/api/clientes/export`
- `/api/movimientos`, `/api/movimientos/[id]`, `/api/movimientos/resumen`
- `/api/archivos`, `/api/archivos/[id]`, `/api/archivos/[id]/file`, `/api/archivos/[id]/liquidar`
- `/api/upload`, `/api/extraer-pdf`, `/api/importar-comprobante`
- `/api/pagos` — pagos / liquidaciones
- `/api/proveedores` y subrutas de movimientos
- `/api/obras`, `/api/obras/[id]`
- `/api/busqueda`
- `/api/audit/cambios`, `/api/audit/eliminaciones`
- `/api/export/datos` (respaldo JSON), `/api/cron/vencimientos`

---

## 8. Servicios (`src/services/`)

Contienen la mayor parte de la lógica de negocio: consultas agregadas, paginación cursor, importación desde texto/PDF, métricas del dashboard, exportaciones, etc. Las **Route Handlers** y **Server Components** delegan aquí para mantener el código de UI delgado.

---

## 9. Variables de entorno (típicas)

- `DATABASE_URL` — PostgreSQL para Prisma.
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — cliente y SSR.
- Cookies / servidor Supabase según convención del proyecto en `src/lib/supabase/`.
- `AUTH_BYPASS_LOCAL`, `LOCAL_DEV_USER_ID` — solo desarrollo.
- Storage: URLs de archivos suelen apuntar a bucket Supabase u origen configurado en upload.

(Revisar `.env.example` si existe en el repo; nunca commitear secretos.)

---

## 10. Scripts npm

- `npm run dev` — desarrollo.
- `npm run build` — `prisma generate` + `next build`.
- `npm run test` — Vitest.
- `db:migrate`, `db:push`, `db:studio` — Prisma con override de dotenv del proyecto.

---

## 11. Tema claro / oscuro (estado actual)

- El componente **`ThemeToggle` fue eliminado** (botón roto / no deseado).
- Se quitó el script en `layout` que leía `localStorage` y aplicaba la clase `dark` en `<html>`.
- Quedan clases Tailwind `dark:*` en muchos componentes por si en el futuro se reintroduce tema vía sistema u otro mecanismo; **sin toggle manual**, la UI por defecto es **claro** salvo que el navegador o CSS global apliquen algo distinto.

---

## 12. Despliegue (Vercel)

- Build: `npm run build`.
- Ejecutar migraciones Prisma contra la DB de producción tras cambios de schema.
- Variables de entorno alineadas con local (Supabase, `DATABASE_URL`).

---

## 13. Cómo seguir analizando con otra IA

1. Pegar este archivo + la pregunta concreta.
2. Para bugs de UI: indicar **viewport en px** y si es **portrait/landscape** (el corte `lg` es 1024px).
3. Para datos: adjuntar fragmentos de `schema.prisma` y el `service` o `route.ts` involucrado.

---

*Última actualización del documento: alineado con corrección de breakpoint `lg`, eliminación de ThemeToggle y script de tema en root layout.*
