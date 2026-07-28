# Deploy en AWS

Arquitectura: **1 EC2 (Express + frontend estático + MongoDB)**

```
Usuario → EC2:80/443 → Nginx → Express (API + frontend) → MongoDB local
                             ↓
                       /uploads (imágenes en disco)
```

Tenés dos opciones para la base de datos:

| Opción | Pros | Contras |
|--------|------|---------|
| **A — MongoDB local** (en el mismo EC2) | Sin cuenta externa, menos latencia | Ocupa RAM/CPU del EC2, mantenimiento manual |
| **B — MongoDB Atlas** (nube gratuita) | Backups automáticos, no consume recursos del EC2 | Requiere cuenta en mongodb.com |

Elegí la que te quede más cómoda.

---

## 0. Elegir base de datos

### Opción A — MongoDB local (recomendada, sin cuentas)

Instalás MongoDB directamente en el EC2. No necesitás registrarte en ningún lado.

### Opción B — MongoDB Atlas (nube gratuita)

1. Crear cuenta en https://www.mongodb.com/atlas
2. Crear un cluster **M0** (free tier, 512 MB)
3. **Network Access** → Add IP → `0.0.0.0/0`
4. **Database Access** → Add New Database User → crear usuario/contraseña
5. **Connect** → Drivers → copiar la URI:
   ```
   mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/foro
   ```

---

## 1. EC2 — instancia

### 1.1 Lanzar instancia

- **Nombre:** `foro-prod`
- **AMI:** Ubuntu 22.04 LTS (o Amazon Linux 2023)
- **Tipo:** t2.micro o t3.micro (free tier)
- **Par de claves:** crear o seleccionar una existente (.pem)
- **Security Group:**
  | Puerto | Protocolo | Origen |
  |--------|-----------|--------|
  | 22     | TCP       | 0.0.0.0/0 (solo tu IP en producción) |
  | 80     | TCP       | 0.0.0.0/0 |
  | 443    | TCP       | 0.0.0.0/0 |
  | 27017  | TCP       | 0.0.0.0/0 (solo si usás Atlas, no para local) |
- **Almacenamiento:** 20 GB gp3 (free tier)

### 1.2 Asignar IP elástica (opcional pero recomendado)

1. EC2 → Elastic IPs → Allocate Elastic IP address
2. Associate → seleccionar la instancia

---

## 2. Conectar y preparar

```bash
# Conectar por SSH
ssh -i /ruta/tu-key.pem ubuntu@<IP-ELASTICA>

# Actualizar paquetes
sudo apt update && sudo apt upgrade -y

# Instalar Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs git nginx

# Verificar
node -v    # v22.x
npm -v     # 10.x
```

---

## 3. Instalar MongoDB

Elegí la opción que corresponda:

### Opción A — MongoDB local (en el EC2)

```bash
# Importar clave GPG
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg

# Agregar repositorio
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Instalar
sudo apt update
sudo apt install -y mongodb-org

# Iniciar y habilitar
sudo systemctl start mongod
sudo systemctl enable mongod

# Verificar
sudo systemctl status mongod
mongosh --eval "db.runCommand({ ping: 1 })"
```

> MongoDB 7.0 requiere CPU con AVX. Si usás t2.micro (no tiene AVX), instalá MongoDB 6.0 o usá Atlas.

<details>
<summary>Si tu EC2 no soporta AVX (t2.micro), instalá MongoDB 6.0</summary>

```bash
curl -fsSL https://www.mongodb.org/static/pgp/server-6.0.asc | sudo gpg --dearmor -o /usr/share/keyrings/mongodb-server-6.0.gpg
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-6.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
sudo apt update
sudo apt install -y mongodb-org
sudo systemctl start mongod
sudo systemctl enable mongod
```
</details>

### Opción B — MongoDB Atlas (nube)

No instalás nada. Solo necesitás la URI del paso 0.

---

## 4. Clonar y configurar

```bash
# Clonar el repositorio
git clone <URL-DEL-REPO> foro
cd foro

# Variables de entorno del servidor
cat > server/.env << EOF
MONGO_URI=<VER-ABAJO>
PORT=5001
EOF
```

Elegí la URI según tu opción:

| Opción | MONGO_URI |
|--------|-----------|
| **A — Local** | `mongodb://127.0.0.1:27017/foro` |
| **B — Atlas** | `mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/foro` |

```bash
# Instalar dependencias
npm install
npm run build --prefix client

# Verificar que funciona
node server/index.js
# → "Servidor corriendo en puerto 5001"

# Probar desde otra terminal
curl http://localhost:5001/api/health
# {"db":"connected"}
```

> Si no usás HTTPS y querés que escuche directo en el puerto 80, cambiá `PORT=80` en `.env`.

---

## 5. PM2 — mantener el proceso vivo

```bash
sudo npm install -g pm2

# Iniciar
pm2 start server/index.js --name foro

# Guardar configuración para que persista tras reinicio
pm2 save
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu
```

Comandos útiles:
```bash
pm2 status            # estado
pm2 logs foro         # logs en vivo
pm2 restart foro      # reiniciar
pm2 stop foro         # detener
```

---

## 6. Nginx — proxy inverso

Crear `/etc/nginx/sites-available/foro`:

```nginx
server {
    listen 80;
    server_name _;

    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Activar y reiniciar:

```bash
sudo ln -s /etc/nginx/sites-available/foro /etc/nginx/sites-enabled/
sudo nginx -t               # verificar sintaxis
sudo systemctl restart nginx
```

---

## 7. HTTPS con Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx

# Si tenés dominio apuntando a la IP
sudo certbot --nginx -d tudominio.com

# Probar renovación automática
sudo certbot renew --dry-run
```

---

## 8. DNS (Route 53)

1. Route 53 → Hosted zones → Create hosted zone
2. Crear un registro **A** que apunte a la IP elástica del EC2
3. Esperar propagación (5-30 min)

---

## 9. Despliegues futuros

```bash
cd ~/foro
git pull
npm install
npm run build --prefix client
pm2 restart foro
```

---

## 10. Solución de problemas

```bash
# Ver logs del servidor
pm2 logs foro

# Ver logs de nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Probar Express directo (bypass nginx)
curl http://localhost:5001/api/health

# Verificar que MongoDB se conecta
curl http://localhost/api/health
# → {"db":"connected"}
```

| Síntoma | Causa probable | Solución |
|---------|---------------|----------|
| `ECONNREFUSED` | Express no corriendo | `pm2 start server/index.js --name foro` |
| `db: "disconnected"` | MongoDB URI incorrecta | Verificar `server/.env` |
| `MongoNetworkError` | MongoDB no corriendo (local) | `sudo systemctl restart mongod` |
| 502 Bad Gateway | Nginx no llega a Express | `sudo systemctl restart nginx` |
| 413 Request Entity Too Large | Archivo muy pesado | Ajustar `client_max_body_size` en nginx |

---

## Arquitectura de archivos relevante

```
foro/
├── server/
│   ├── index.js          # Express + sirve frontend estático
│   ├── .env              # MONGO_URI y PORT
│   ├── models/
│   ├── routes/
│   └── uploads/          # imágenes subidas
├── client/
│   ├── src/
│   ├── dist/             # build de producción (generado)
│   └── vite.config.js
├── docs/
│   └── deploy-aws.md     # este archivo
├── package.json          # depends: server
└── README.md
```

El servidor Express sirve el frontend compilado (`client/dist/`) como estático, por lo que no necesitás un servicio separado para el frontend.
