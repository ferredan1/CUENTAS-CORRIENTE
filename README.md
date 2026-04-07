# Cuenta corriente — Ferretería

Aplicación Next.js (App Router) para gestionar clientes, obras y movimientos con PostgreSQL, Prisma y Supabase Auth + Storage.

## Requisitos

- Node.js 20+
- Base PostgreSQL (`DATABASE_URL`)
- Proyecto Supabase (Auth + opcional Storage)

## Configuración local

1. Copie `.env.example` a `.env` y complete las variables.

2. **Base de datos PostgreSQL** (elige una opción):

   **A) Docker** (recomendado; requiere Docker Desktop iniciado en Windows):

   ```bash
   npm run db:up
   npm run db:push
   ```

   Si `npx prisma db push` usa otra base/usuario, suele ser porque **Windows tiene `DATABASE_URL` en variables de entorno**. Los scripts `npm run db:push` y `npm run dev` cargan el `.env` del proyecto **con prioridad** (`scripts/dotenv-override.cjs`). Opcionalmente borre la variable de usuario o reinicie la terminal.

   **B) Otra instancia** (Neon, Supabase Postgres, Postgres instalado localmente): ponga su `DATABASE_URL` en `.env` y ejecute `npx prisma db push`.

3. Aplique el esquema si usáis migraciones nominales:

   ```bash
   npx prisma migrate dev --name init
   ```

   (Si solo queréis sincronizar el schema sin historial de migraciones, `npx prisma db push` basta.)

4. **Subir PDFs:** en **desarrollo** (`npm run dev`), si no hay Supabase, los archivos se guardan en `public/uploads/` (ignorado por Git). En **producción** use Supabase Storage (`NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` y bucket `comprobantes`) o defina `UPLOAD_STORAGE=local` si sirve archivos desde disco de forma consciente. Para login en desarrollo puede usar `AUTH_BYPASS_LOCAL=1`.

5. Ejecute `npm run dev`.

## Deploy en Vercel

1. Conecte el repositorio y defina las mismas variables de entorno que en `.env.example`.
2. Use Vercel Postgres u otra base compatible con `postgresql://`.
3. El build ejecuta `prisma generate` vía script `build` / `postinstall`.

## API (autenticación cookie Supabase)

- `GET/POST /api/clientes`, `GET/DELETE /api/clientes/:id`
- `GET/POST /api/obras?clienteId=`
- `GET/POST /api/movimientos`, `PATCH/DELETE /api/movimientos/:id`
- `POST /api/pagos`, `POST /api/devoluciones`
- `POST /api/upload` (multipart: `file`, `clienteId`, `obraId` opcional)
- `DELETE /api/archivos/:id` (borrar comprobante y archivo en Storage o disco local)
- `POST /api/importar-comprobante` (JSON para automatización / n8n)

La API exige sesión válida; los datos de negocio son single-tenant (sin columna de usuario por fila).
