# AnimalForo 🐾

Foro abierto de animales tipo Reddit/Pinterest. Sin registro, solo compartir imágenes y texto sobre animales.

## Stack

| Capa      | Tecnología                  |
| --------- | --------------------------- |
| Frontend  | React + Vite                |
| Backend   | Express + Mongoose           |
| BD        | MongoDB (localhost:27017)   |
| Imágenes  | Multer (`server/uploads/`)  |

## Requisitos

- Node.js 18+
- MongoDB corriendo en `localhost:27017`

## Inicio rápido

```bash
# 1. Iniciar MongoDB (si no está como servicio)
mongod

# 2. Backend (puerto 5001)
cd server
npm install
node index.js

# 3. Frontend (puerto 5173)
cd client
npm install
npx vite
```

Abrir `http://localhost:5173`.

## Puerto

El backend corre en **5001** porque el 5000 suele estar ocupado. Vite redirige `/api` y `/uploads` a ese puerto mediante proxy.

## API

### `GET /api/posts`
Devuelve todas las publicaciones ordenadas por fecha descendente.

### `POST /api/posts`
Crea una publicación (multipart/form-data).

| Campo      | Tipo   | Obligatorio |
| ---------- | ------ | ----------- |
| `username` | string | No (por defecto "Anónimo") |
| `message`  | string | Sí (máx 500 caracteres) |
| `image`    | file   | No (JPG, PNG, GIF, WebP, máx 5 MB) |

### `PUT /api/posts/:id/react`
Incrementa o decrementa una reacción.

```json
{ "emoji": "❤️", "dir": 1 }
```

`dir` debe ser `1` (sumar) o `-1` (restar).

## Estructura del proyecto

```
foro/
├── client/              # React + Vite
│   └── src/
│       ├── App.jsx      # Componente principal
│       └── App.css      # Estilos
├── server/
│   ├── index.js         # Entry point Express
│   ├── models/Post.js   # Schema Mongoose
│   ├── routes/posts.js  # Rutas CRUD
│   └── uploads/         # Imágenes subidas
└── README.md
```

## Frontend

- Las publicaciones se muestran en un feed vertical con tarjetas.
- Cada tarjeta muestra: avatar (emoji determinístico según el nombre), usuario, tiempo relativo, texto e imagen opcional.
- Las tarjetas tienen un patrón de huellas en el fondo que se adapta al modo claro/oscuro del sistema.
- Las publicaciones se refrescan automáticamente cada 8 segundos.
- Para crear una publicación se abre un drawer inferior con formulario.
- No hay hover ni animaciones — diseño plano y directo.

## Modelo de datos

```js
{
  username: String,        // "Anónimo" por defecto
  message: String,         // requerido
  image: String || null,   // ruta al archivo
  reactions: {             // Mapa { emoji: count }
    type: Map,
    of: Number
  },
  timestamps: true         // createdAt, updatedAt
}
```
