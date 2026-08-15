# LRV Automotores

Sitio de venta de vehículos con catálogo público y panel administrador persistente.

Al guardar un vehículo, el Worker crea un único commit atómico con esta estructura:

```text
vehiculos/marca-modelo-año/
├── datos.json
└── fotos/
    ├── foto-01.jpg
    └── foto-02.jpg
```

## Variables secretas de Cloudflare

El Worker requiere tres secretos que nunca deben guardarse en GitHub:

- `ADMIN_PASSWORD`: contraseña del panel.
- `SESSION_SECRET`: texto aleatorio largo para firmar sesiones.
- `GITHUB_TOKEN`: token de acceso limitado únicamente a este repositorio con permiso **Contents: Read and write**.

## Desarrollo

```bash
npm install
npm run types
npm run check
npm run dev
```

## Publicación

Conectar este repositorio desde **Cloudflare Workers & Pages → Create → Import a repository**. Usar `npm run deploy` como comando de publicación y agregar los tres secretos en **Settings → Variables and Secrets**.
