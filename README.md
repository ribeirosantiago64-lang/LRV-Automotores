# LRV Automotores

## Distribución del sistema

| Servicio | Contenido |
| --- | --- |
| GitHub | Código, configuración y pruebas |
| Cloudflare Pages | Sitio público, desde `pages/dist` |
| Cloudflare Workers | Backend `lrv-automotores`, autenticación, catálogo y solicitudes |
| Cloudflare D1 | Base existente `lrv-inquiries`: vehículos, contactos, consultas, vistas y estado de migración |
| Cloudflare R2 | Bucket privado `lrv-vehicle-photos`: fotografías |

Los contactos de la tabla `users` se crean al enviar una consulta. No son cuentas con contraseña ni se requiere registrar una cuenta para consultar un vehículo. La autenticación del administrador sigue usando los secretos actuales del Worker.

## Migración del catálogo existente

La importación es automática, aditiva y reanudable. Al consultar el catálogo, el Worker guarda un manifiesto del catálogo anterior, fijando sus fotos al mismo commit de GitHub. Importa hasta dos vehículos por ejecución, verifica el formato de cada imagen y la copia a R2. Un disparador cada cinco minutos también continúa la importación.

Mientras la copia esté pendiente, el catálogo anterior permanece visible y no se permite editarlo, para evitar cambios que queden fuera de la migración. Solo se activa el catálogo D1 cuando todos los vehículos del manifiesto y sus fotografías están copiados.

Se reutiliza la base `lrv-inquiries`; las consultas y vistas existentes no se borran ni se vuelven a generar. Los contactos anteriores se derivan de las consultas conservadas. Los vehículos retirados se archivan, conservando sus fotografías y solicitudes.

El proceso no elimina archivos del repositorio. Las carpetas antiguas quedan como respaldo hasta comprobar la importación en producción; los nuevos vehículos y fotos ya no generan commits. Una vez confirmado el cambio, esas carpetas pueden retirarse del árbol actual manteniendo su historial de Git.

### Comprobar o reanudar la importación

Con una sesión de administrador:

- `GET /api/storage`: estado, conexión de R2 y cantidad de vehículos importados.
- `POST /api/storage/migrate`: continúa hasta dos vehículos; requiere el mismo origen y la cookie del administrador.

Después de completar la importación, `GET /api/vehicles` devuelve fotografías con rutas `/media/vehicles/...`. El Worker las sirve desde R2 con tipo de contenido validado, ETag y caché. El bucket no necesita acceso público ni CORS.

## Backend

El archivo `wrangler.jsonc` conserva el nombre y la base D1 actuales. Añade el binding `VEHICLE_PHOTOS` para R2. Wrangler provisiona el bucket al desplegar cuando la cuenta tiene R2 habilitado. Si Cloudflare solicita activar R2 o agregar facturación, debe completarlo el titular de la cuenta; no hay que borrar ni recrear D1.

Secretos actuales:

- `ADMIN_PASSWORD`: contraseña del administrador.
- `SESSION_SECRET`: firma de las sesiones.
- `GITHUB_TOKEN`: se utiliza únicamente para leer el catálogo anterior durante la importación. Ya no se escribe en GitHub desde el sitio.

El enlace Worker actual sigue sirviendo el sitio como respaldo mientras se configura Pages, para conservar el acceso existente.

## Cloudflare Pages

Crear un proyecto Pages conectado al mismo repositorio:

- Nombre: `lrv-automotores-web`.
- Rama de producción: `main`.
- Directorio raíz: `pages`.
- Framework: ninguno.
- Comando de compilación: `node ../scripts/build-pages.mjs`.
- Directorio de salida: `dist`.

El archivo `pages/wrangler.jsonc` configura el binding de servicio `BACKEND` hacia el Worker `lrv-automotores`. El sitio Pages envía `/api/*` y `/media/*` al backend mediante ese binding, conservando el mismo origen para formularios y cookies privadas. No se copian secretos al frontend, no se permite CORS abierto y no se duplica la base de datos.

La preparación del código no crea por sí sola el proyecto Pages: hay que realizar el primer despliegue en la cuenta de Cloudflare. Con acceso autenticado también se puede ejecutar `npm run deploy:pages`.

## Desarrollo y comprobaciones

```bash
npm install
npm test
npm run check
npm run build:pages
npm run dev
```

Las pruebas usan D1 y R2 locales y un GitHub simulado; no crean consultas ni envían mensajes en producción.
