# ManadaLab — backend

API Express + TypeScript + Prisma 7 + PostgreSQL 17. Este repositorio contiene únicamente el backend y lo necesario para ejecutarlo. El frontend Next.js se integra por HTTP. La carga de datos reales está pendiente: no hay cuentas precargadas ni registro público de administradores.

Todos los comandos siguientes se ejecutan desde la raíz de este repositorio, `manadalab-backend`.

## Configuración y ejecución

Requisitos: Docker con motor Linux y Compose. Para desarrollar fuera del contenedor, Node.js 24 o 26 y npm.

1. Crear un archivo local `.env`, excluido de Git, con estas variables:

   ```dotenv
   POSTGRES_DB=manadalab
   POSTGRES_USER=manadalab_admin
   POSTGRES_PASSWORD=DEFINIR_LOCALMENTE
   DATABASE_URL=postgresql://manadalab_admin:CONTRASENA_CODIFICADA@127.0.0.1:5432/manadalab?schema=public
   NODE_ENV=development
   BACKEND_NODE_ENV=development
   HOST=127.0.0.1
   PORT=4000
   APP_ORIGIN=http://127.0.0.1:4000
   TRUST_PROXY=0
   JWT_SECRET=DEFINIR_LOCALMENTE
   MATRICULA_KEY=DEFINIR_LOCALMENTE
   IDEMPOTENCY_SECRET=DEFINIR_LOCALMENTE
   ```

2. Ajustar `DATABASE_URL` con las mismas credenciales de `POSTGRES_*`. Codificar los caracteres especiales de la contraseña como componentes de URL.
3. Definir `JWT_SECRET`, `MATRICULA_KEY` e `IDEMPOTENCY_SECRET` con tres valores aleatorios distintos de 32 bytes en hexadecimal. Para generar cada uno localmente:

   ```powershell
   node -p "require('node:crypto').randomBytes(32).toString('hex')"
   ```

4. Configurar `APP_ORIGIN` con el origen visible en el navegador, sin rutas. Predeterminado: `http://127.0.0.1:4000`.
5. Levantar PostgreSQL y el backend:

   ```powershell
   docker compose up -d --build
   docker compose ps
   ```

API: `http://127.0.0.1:4000`. Ambos servicios deben aparecer saludables. Compose aplica las migraciones antes del arranque; no carga inventario ni crea cuentas. El mismo `.env` configura Compose y la aplicación. Dentro del contenedor, `DATABASE_HOST=db` sustituye únicamente el host de `DATABASE_URL`.

Para desarrollar con recarga automática:

```powershell
docker compose up -d db
docker compose stop backend
npm ci
npm run prisma:generate
npm run migrate:deploy
npm run dev
```

Para ejecutar la versión compilada:

```powershell
npm run build
npm start
```

No ejecutar dos servidores en el puerto 4000. `Ctrl+C` detiene HTTP y luego desconecta Prisma, con límite de diez segundos. No definir `DATABASE_HOST=db` al ejecutar Node directamente en el host.

## Código

`src` separa rutas, controladores, validación, middleware, servicios, repositorios y configuración. `prisma` contiene esquema y migraciones; `scripts`, la herramienta administrativa; `tests`, las pruebas de integración.

No se versionan dependencias instaladas, compilados, cliente Prisma generado, credenciales ni datos locales. `package-lock.json` fija dependencias; generar el cliente después de instalar.

## Contrato HTTP

Respuestas JSON, salvo cierre de sesión (`204`). Fechas ISO 8601. Estados de incidencias: `PENDIENTE`, `VISTO`, `SOLUCIONADO`. Se rechazan los campos no declarados.

| Método y ruta | Acceso y resultado |
|---|---|
| `GET /salud` | Proceso HTTP activo |
| `GET /salud/listo` | PostgreSQL disponible: `200`; fallo: `503` |
| `GET /api/emas` | EMAs paginados |
| `GET /api/aulas` | Aulas, EMA y conteos por estado |
| `GET /api/aulas/:id/recursos` | Dispositivos reportables del aula y reporte activo |
| `GET /api/incidencias` | Listado público paginado |
| `GET /api/incidencias/:id` | Detalle público por id numérico o folio UUID |
| `POST /api/incidencias` | Alta pública con `Idempotency-Key` UUID; `201` o `409` |
| `POST /api/sesion` | Acceso; cookie, usuario y `csrfToken` |
| `GET /api/sesion` | Contexto vigente y token CSRF; requiere sesión |
| `DELETE /api/sesion` | Revoca sesión y caduca cookie; requiere origen y CSRF |
| `GET /api/admin/incidencias` | Listado privado limitado por permisos |
| `GET /api/admin/incidencias/:id` | Descripción, versión e historial privados |
| `PATCH /api/incidencias/:id/estado` | Cambio de estado e historial atómicos |
| `GET /api/admin/prestamos` | Préstamos del EMA propio |
| `GET /api/admin/prestamos/dispositivos` | Prestables disponibles del EMA propio |
| `GET /api/admin/prestamos/:id` | Detalle privado del préstamo |
| `POST /api/admin/prestamos` | Registra entrega presencial |
| `PATCH /api/admin/prestamos/:id/devolucion` | Registra devolución; repetir conserva la fecha |

Las operaciones administrativas requieren sesión. Las escrituras verifican `Origin` igual a `APP_ORIGIN`; las administrativas también exigen `X-CSRF-Token`. Los cuerpos deben ser `application/json`, con máximo 16 KiB. El navegador debe enviar la cookie de sesión.

### Consultas

- Listados: `pagina=1` y `limite=20` predeterminados; máximo 100 por página.
- Aulas: filtro opcional `emaId`.
- Incidencias: filtros opcionales `emaId`, `aulaId`, `tipoId`, `estado`.
- Préstamos: `dispositivoId` y `estado=PENDIENTE` o `DEVUELTO`.
- Aulas se ordenan por EMA, número de texto e id. El orden del número es lexicográfico.
- Una página sin resultados devuelve `datos: []`. Los conteos de aulas incluyen incidencias, no préstamos.
- Página, total y conteos se consultan bajo una vista `RepeatableRead`.

```json
{
  "datos": [],
  "paginacion": {"pagina": 1, "limite": 20, "total": 0, "totalPaginas": 0}
}
```

Identificador inválido: `400`; recurso inexistente: `404`. Los parámetros de detalle/estado de incidencias aceptan id numérico o folio UUID; los de aula y préstamo, id numérico.

### Cuerpos de escritura

`POST /api/incidencias`:

```json
{"dispositivoId": 1, "matricula": "20260001", "descripcion": "Descripción de la falla"}
```

Descripción de 5–2000 caracteres y matrícula de 1–32, después de recortar espacios. `MATRICULA_PATTERN` define el formato aceptado; confirmar el institucional antes de usar datos personales reales. La matrícula es declarada y no acredita identidad.

Generar una `Idempotency-Key` UUID por intención y conservarla al reenviar el mismo contenido. Se reproduce el resultado original `201`/`409`, incluso si después se soluciona el reporte. Otro contenido con la misma clave: `409`. `Idempotency-Replayed` indica una respuesta reproducida. Alta e historial son atómicos y solo se admite un reporte activo por dispositivo.

`POST /api/sesion`:

```json
{"correo": "administrador@institucion.example", "contrasena": "su contraseña"}
```

La respuesta proporciona el usuario, vencimiento y token CSRF; el JWT viaja exclusivamente en la cookie. La sesión dura 15 minutos. Al vencer debe iniciarse sesión de nuevo. `DELETE /api/sesion` no necesita cuerpo.

`PATCH /api/incidencias/:id/estado`:

```json
{"estado": "VISTO", "version": 1}
```

Transiciones: `PENDIENTE → VISTO → SOLUCIONADO`. Obtener la versión mediante el detalle privado. Versión obsoleta, salto o reporte cerrado: `409`. Cada cambio incrementa la versión y agrega un evento.

`POST /api/admin/prestamos`:

```json
{"dispositivoId": 1, "profesorNombre": "Nombre del profesor"}
```

Profesor de 2–150 caracteres. El administrador y la fecha se obtienen del servidor. El dispositivo debe ser prestable, estar disponible y pertenecer al EMA propio. Para devolverlo, enviar `PATCH /api/admin/prestamos/:id/devolucion` con `{}`. No hay solicitudes públicas de préstamos.

## Permisos y seguridad

- Administrador normal: detalle privado de los reportes de su EMA; cambia estados de los tipos distintos de computadora de ese EMA.
- Técnico: funciones normales en su EMA y lectura/cambio de reportes de computadoras de cualquier EMA. Ese alcance adicional no permite gestionar otros tipos ni préstamos de otros EMAs.
- En cada petición privada se verifica el JWT y se consultan sesión, usuario activo, EMA y `esTecnico` vigentes en PostgreSQL.
- Las respuestas públicas excluyen descripción libre, matrícula y cuentas. El detalle privado incluye descripción, versión e historial, pero no matrícula cifrada ni hashes.
- Contraseñas Argon2id, matrícula AES-256-GCM con IV aleatorio, huellas y CSRF protegidos con HMAC. No se aceptan privilegios ni fechas declaradas por el cliente.
- Respuestas API `no-store`, cabeceras Helmet y SQL parametrizado. Los errores inesperados devuelven `500` e `idError`, sin detalles internos.
- Otros códigos: `400`, `401`, `403`, `404`, `409`, `413`, `415` y `429`.
- Límites por proceso: 300 peticiones/minuto/IP; acceso 30/15 minutos/IP y 10/15 minutos/correo; altas 60/15 minutos/IP y 20/minuto/dispositivo. El almacén se reinicia con el proceso; antes de usar varias réplicas debe sustituirse por uno compartido.

En desarrollo HTTP la cookie es `manadalab_sesion`, `HttpOnly` y `SameSite=Strict`. Para producción, configurar `BACKEND_NODE_ENV=production` y `APP_ORIGIN=https://tu-dominio` en `.env`, HTTPS en el proxy y `TRUST_PROXY` según los proxies confiables. La cookie será `__Host-manadalab_sesion`, `Secure`, `HttpOnly`, `SameSite=Strict`, `Path=/`, sin `Domain`. El backend debe ser accesible solo por el proxy.

No se habilita CORS. Next.js debe reenviar `/api` bajo el mismo origen y enviar el token CSRF en escrituras administrativas. El frontend y el proxy HTTPS no se incluyen en este repositorio.

Usar credenciales separadas para migraciones y ejecución en producción, con los permisos mínimos necesarios sobre tablas y secuencias. Compose local utiliza la cuenta de desarrollo. Con credenciales separadas, ejecutar `migrate:deploy` como tarea previa y arrancar el servidor directamente, sin migraciones con la cuenta limitada.

## Carga privada de datos reales

La carga no se ejecuta automáticamente. Después de compilar:

```powershell
npm run administrar -- catalogo
npm run administrar -- inventario RUTA_AL_ARCHIVO_JSON_REAL
```

El inventario es un arreglo de EMAs con `nombre`, `aulas` (objetos con `numero`) y `dispositivos` (`clave`, `tipo`, `aula`). `aula` puede ser `null` únicamente para antenas Wi-Fi; los otros dispositivos requieren aula del mismo EMA. El importador registra primero las aulas.

Catálogo: `Computadora`, `TV`, `Aire acondicionado`, `Enchufe`, `Iluminación`, `Antena Wi-Fi`, `Control de TV` y `Control de aire acondicionado`. Los tres últimos son prestables. El importador usa una transacción, admite repetir el mismo archivo sin duplicados y rechaza reasignar claves existentes a otro EMA, tipo o aula.

Para crear una cuenta, definir temporalmente `ADMIN_NOMBRE`, `ADMIN_CORREO`, `ADMIN_EMA_ID`, `ADMIN_ES_TECNICO` (`true`/`false`) y `ADMIN_PASSWORD` en el entorno de la terminal:

```powershell
npm run administrar -- usuario
```

Contraseña de 12–128 caracteres y correo único. Eliminar `ADMIN_PASSWORD` del entorno después del uso. No incluirlo en comandos, archivos de inventario, Git ni documentación. No existe cuenta predeterminada.

Para deshabilitar una cuenta y revocar sus sesiones:

```powershell
npm run administrar -- deshabilitar correo@institucion.example
```

En Docker, usar `docker compose exec backend npm run administrar -- ...`; el archivo de inventario debe estar disponible en el contenedor. Mantener los archivos de datos reales fuera del repositorio.

## Pruebas

Con el PostgreSQL de Compose disponible:

```powershell
npm run typecheck
npm test
npm audit
```

`npm test` compila, crea bases `manadalab_test_<identificador>` distintas de `DATABASE_URL`, aplica las migraciones, carga fixtures únicamente en ellas y las elimina al finalizar. La cuenta de pruebas debe poder crear bases. Las pruebas de respaldo/restauración usan el servicio `db` del Compose de este repositorio: no ejecutar contra una base remota diferente.

Se comprueban consultas, paginación, conteos, validación, privacidad, altas/reenvíos concurrentes, historial, permisos entre EMAs y técnicos, sesiones, CSRF, versiones, préstamos, restricciones PostgreSQL, límites de acceso, carga privada y respaldo/restauración. La base real no recibe fixtures.

Prisma 7.10.1 con pg 8.23.1 puede emitir un aviso interno de deprecación por consultas relacionales concurrentes. No actualizar pg a una versión mayor sin repetir las pruebas de compatibilidad.

## Respaldos y operación

Conservar las claves separadas de los respaldos. Cambiar `MATRICULA_KEY` sin conservar la anterior impide recuperar matrículas; cambiar `JWT_SECRET` invalida sesiones y CSRF; conservar `IDEMPOTENCY_SECRET` durante la vida de los folios. Acordar conservación y rotación antes de usar datos personales reales.

Respaldar con `pg_dump -Fc` dentro de `db`, copiar con `docker cp` y guardar cifrado fuera de Git. Restaurar con `pg_restore --no-owner` en otra base y verificar antes de sustituir la activa. Evitar redirección binaria en PowerShell antiguo.

Detener con `docker compose stop` o `docker compose down` sin `-v`. `-v` elimina el volumen; el reinicio normal conserva los datos.
