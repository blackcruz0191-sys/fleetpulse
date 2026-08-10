# Desplegar FleetPulse a internet (gratis)

Esto hace que el backend sea accesible desde cualquier lugar con internet, no solo tu red WiFi.
Yo no puedo crear estas cuentas por ti — son pasos que tienes que hacer tú mismo (5-10 minutos).

## 1. Base de datos: Neon (Postgres gratis, sin tarjeta)

1. Ve a https://neon.tech y crea una cuenta gratis (con GitHub o Google es más rápido).
2. Crea un proyecto nuevo (cualquier nombre, ej. "fleetpulse").
3. En el dashboard del proyecto, copia el **Connection String** (empieza con `postgresql://...`).
4. Guárdalo — lo vas a necesitar en el paso 3.

## 2. Sube este proyecto a GitHub

1. Ve a https://github.com/new y crea un repositorio (puede ser privado).
2. En una terminal, dentro de esta carpeta (`fleet-tracker/`), corre:
   ```
   git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
   git add -A
   git commit -m "FleetPulse listo para desplegar"
   git branch -M main
   git push -u origin main
   ```

## 3. Backend: Render (gratis)

1. Ve a https://render.com y crea una cuenta gratis (con GitHub es más rápido, y no pide tarjeta para el plan gratuito).
2. Click en "New +" → "Web Service".
3. Conecta el repositorio de GitHub que subiste en el paso 2.
4. Render debería detectar automáticamente `render.yaml` y preconfigurar todo. Si no, configura a mano:
   - **Root Directory**: `server`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. En "Environment Variables", agrega:
   - `DATABASE_URL` = el connection string que copiaste de Neon en el paso 1
   - `JWT_SECRET` = cualquier texto largo y aleatorio (o deja que Render lo genere si usó el Blueprint)
6. Click "Create Web Service" y espera a que termine el deploy (2-5 minutos).
7. Cuando termine, Render te da una URL pública tipo `https://fleetpulse-backend-xxxx.onrender.com`.

## 4. Dame la URL

Pásame esa URL (`https://fleetpulse-backend-xxxx.onrender.com`) y yo actualizo:
- La app Android (`BASE_URL` en `FleetApiService.kt`) y la recompilo a APK.
- El dashboard web (`API_BASE` en `auth.js`).

## Nota sobre el plan gratuito de Render

El servicio gratuito "se duerme" tras 15 minutos sin uso, y la primera petición después de dormir tarda ~30-50 segundos en responder mientras despierta. Es normal, no es un error. Para producción real sin ese retraso, se necesita un plan pago.
