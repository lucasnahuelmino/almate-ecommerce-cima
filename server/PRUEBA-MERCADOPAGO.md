# Probar Mercado Pago en modo TEST

Guía para probar el pago de Mercado Pago **sin cobrar dinero real**, en tu computadora, sin tocar el sitio publicado.

> **Importante:** este documento es una guía técnica. Los nombres de los menús de Mercado Pago pueden cambiar. Si algo no coincide, buscá la sección equivalente en el panel oficial del titular de la cuenta.

---

## 0. Qué se prueba y qué no

| Se prueba | No se prueba |
| --- | --- |
| Que el servidor cree una preferencia de pago real en el **sandbox** | Cobros reales |
| Que la tienda redirija al checkout de prueba | Credenciales de producción (`APP_USR-`) |
| Que el webhook firmado actualice el pedido a `paid` | Reembolsos |
| Que un pago rechazado no marque el pedido como pagado | Facturación o envío de correos |
| Que una notificación repetida no duplique el cobro | Impuestos o conciliación contable |

El servidor **rechaza** cualquier credencial que no empiece con `TEST-` (ver `server/runtime-config.js` y `server/services/mercadopago.js`). Aun así, la regla de oro es tuya: **nunca uses una tarjeta real en esta prueba**.

### Cómo se ve el flujo completo

```
Navegador (tienda)                     Backend (API)                  Mercado Pago
        |                                    |                             |
        | 1. POST /api/checkout              |                             |
        |    (solo producto, cantidad,       |                             |
        |     variantes, cliente, envío)     |                             |
        |----------------------------------->|                             |
        |                                    | 2. valida precios y stock   |
        |                                    |    contra SU catálogo       |
        |                                    | 3. crea preferencia ------->|
        |                                    |<---------- sandbox_init_point
        |<---------- initPoint + orderId ----|                             |
        |                                                                  |
        | 4. redirige al checkout de prueba ------------------------------>|
        |                                                                  |
        | 5. pagás con un usuario y tarjeta de prueba                      |
        |                                                                  |
        |                                    |<-- 6. webhook firmado ------|
        |                                    | 7. consulta el pago a la API|
        |                                    | 8. marca paid / failed      |
        | 9. gracias.html?order=...          |                             |
        |    GET /api/orders/:id ----------->|                             |
        |<---------- estado real ------------|                             |
```

---

## 1. Antes de empezar

Necesitás:

- [ ] Node.js 20 o posterior instalado (`node --version`).
- [ ] Python instalado (solo para servir la tienda), o cualquier servidor estático.
- [ ] `cloudflared` instalado (para el túnel HTTPS).
- [ ] Acceso al panel de desarrolladores de **Mercado Pago del titular**.
- [ ] Las dependencias del backend instaladas.

Instalaciones en Windows (PowerShell), si te falta algo:

```powershell
# Dependencias del backend (una sola vez)
cd server
npm install
cd ..

# Túnel HTTPS (una sola vez)
winget install --id Cloudflare.cloudflared
```

Después de instalar `cloudflared`, **cerrá y volvé a abrir la terminal** para que reconozca el comando.

> **Por qué un túnel:** Mercado Pago necesita una dirección HTTPS pública para avisarle a tu servidor que el pago se aprobó. Tu `localhost` no es accesible desde internet. `cloudflared` crea un puente temporal y gratuito. Es solo para pruebas: no se usa en producción.

---

## 2. Paso 1 — Obtener las credenciales TEST

En el panel de desarrolladores de Mercado Pago, entrá a **Tus integraciones** (o **Tus aplicaciones**) y seleccioná la aplicación de prueba. Si no existe, creá una.

1. Buscá la sección **Credenciales de prueba** (no "Credenciales de producción").
2. Copiá el **Access Token** de prueba. Empieza con `TEST-`.
3. Buscá **Webhooks** / **Notificaciones** dentro de esa misma aplicación.
4. Configurá la URL de prueba (la vas a obtener en el Paso 4):

   ```
   https://<tu-tunel-de-api>/api/webhooks/mercadopago
   ```

5. Habilitá el evento **Pagos** (`payment`) y guardá.
6. Copiá la **clave secreta** que muestra el panel. Es la que va en `MP_WEBHOOK_SECRET`.

> **Cuidado:** el secreto del webhook no es el Access Token. Si los confundís, el servidor devolverá `401` en cada notificación y el pedido quedará `pending`.

**Nunca** pegues estas credenciales en un chat, en una captura de pantalla, en `js/config.js`, en un HTML ni en el repositorio. Van únicamente en `server/.env`, que está ignorado por Git.

---

## 3. Paso 2 — Crear usuarios de prueba

El pago en sandbox se hace con un **usuario de prueba**, no con tu cuenta real. En el panel de la aplicación buscá **Usuarios de prueba** (o **Cuentas de prueba**).

1. Creá dos usuarios:
   - **Vendedor** (si el panel lo pide para la aplicación).
   - **Comprador**.
2. Anotá el **usuario (email)** y la **contraseña** del comprador. Son datos ficticios.
3. Para pagar, usá una **ventana de incógnito** e iniciá sesión con ese comprador. Así no se mezcla con tu sesión real.

> Si el checkout te muestra tu cuenta real o te pide una tarjeta tuya, **detené la prueba**: estás fuera del sandbox.

---

## 4. Paso 3 — Levantar la tienda y la API

Abrí **tres terminales** (una para la tienda, una para la API y una para los túneles). En la raíz del proyecto:

```powershell
# Terminal 1 — tienda estática en el puerto 8080
python -m http.server 8080 --bind 127.0.0.1
```

```powershell
# Terminal 2 — backend en el puerto 3000
cd server
npm start
```

Comprobá la API en otra terminal:

```powershell
Invoke-RestMethod http://localhost:3000/api/health
# Debe responder: status ok, database ok
```

> Si el puerto 3000 está ocupado, cambiá `PORT` en `server/.env`. Si cambiás el puerto, también cambia la URL del túnel del Paso 4.

---

## 5. Paso 4 — Abrir dos túneles HTTPS

Mercado Pago exige HTTPS tanto para el aviso del webhook como para las direcciones de retorno (`back_urls`). Por eso se exponen **dos** túneles: uno para la API y otro para la tienda.

```powershell
# Terminal 3 — túnel de la API
cloudflared tunnel --url http://localhost:3000
```

```powershell
# Terminal 4 — túnel de la tienda
cloudflared tunnel --url http://localhost:8080
```

Cada comando imprime una dirección parecida a:

```
https://palabras-random-1234.trycloudflare.com
```

Anotá las dos:

- **API:** `https://<api>.trycloudflare.com`
- **Tienda:** `https://<tienda>.trycloudflare.com`

Cada vez que reinicies un túnel, **la dirección cambia**. Cuando eso pase hay que actualizar `server/.env` y la URL del webhook en Mercado Pago, y reiniciar la API.

> Los túneles gratuitos son temporales y no tienen garantía de disponibilidad. Sirven para esta prueba, no para vender.

---

## 6. Paso 5 — Configurar `server/.env`

Si todavía no existe, copiá la plantilla:

```powershell
cd server
Copy-Item .env.example .env
```

Editá `server/.env` con estos valores (reemplazá las URLs y credenciales por las tuyas):

```env
PORT=3000
NODE_ENV=development
DB_PATH=./data/orders.sqlite
TRUST_PROXY_HOPS=0

# Direcciones del túnel (Paso 4)
FRONTEND_URL=https://<tienda>.trycloudflare.com
PUBLIC_API_URL=https://<api>.trycloudflare.com
CORS_ORIGIN=https://<tienda>.trycloudflare.com

# Credenciales TEST (Paso 1)
MP_ACCESS_TOKEN=TEST-0000000000000000-000000-00000000000000000000000000000000-000000000
MP_WEBHOOK_SECRET=0000000000000000000000000000000000000000000000000000000000000000

# Opcional: panel de pedidos en /admin
ADMIN_PASSWORD=
```

Notas:

- `NODE_ENV=development` es lo correcto para una prueba local: no exige base de datos en ruta absoluta ni CORS de producción. La validación estricta se activa recién con `NODE_ENV=production` (despliegue).
- `CORS_ORIGIN` debe ser **exactamente** el origen de la tienda: `https://...`, sin barra final ni ruta. Si no coincide, el navegador bloquea la llamada a la API.
- `FRONTEND_URL` se usa para volver a `gracias.html` después del pago.
- `PUBLIC_API_URL` se usa para construir la URL del webhook. **No puede ser `localhost`.**
- `ADMIN_PASSWORD` es opcional. Si la ponés, debe tener 16 caracteres o más y te permite ver los pedidos en `/admin`.

---

## 7. Paso 6 — Verificar la configuración

Antes de arrancar, corré el verificador incluido:

```powershell
cd server
npm run check:mp
```

Qué hace: lee `server/.env`, revisa token, secreto, URLs, CORS y contraseña del panel, **sin conectarse a internet y sin mostrar los valores secretos**.

Salida esperada:

```
Verificación de configuración para Mercado Pago TEST

[ok]    Access Token de prueba presente (no se muestra su valor).
[ok]    Secreto del webhook presente (no se muestra su valor).
[ok]    Webhook esperado en https://<api>.trycloudflare.com/api/webhooks/mercadopago
[ok]    El pago vuelve a https://<tienda>.trycloudflare.com/gracias.html
[ok]    CORS permite el origen del sitio de prueba.
[info]  Sin ADMIN_PASSWORD el panel /admin queda deshabilitado (es válido para una prueba).
[info]  Solo credenciales y usuarios de prueba. Nunca uses una tarjeta real: el servidor bloquea cobros reales.

Todo listo para empezar la prueba. Siguiente paso: npm start
```

Si aparece un `[error]`, corregilo y volvé a ejecutar. El comando termina con código 1 cuando falta algo, así que también sirve para automatizar.

---

## 8. Paso 7 — Apuntar la tienda a la API de prueba

En `js/config.js` hay dos direcciones que durante la prueba deben apuntar al túnel de la API:

```js
catalog: {
  apiBaseUrl: "https://<api>.trycloudflare.com"     // catálogo del backend
},
payments: {
  provider: "mercadopago",                          // antes: "whatsapp"
  apiBaseUrl: "https://<api>.trycloudflare.com"     // antes: ""
}
```

Y en `server/.env`, `FRONTEND_URL` y `CORS_ORIGIN` deben ser el túnel de la **tienda**.

> **Estos cambios son temporales.** Anotá los valores originales (`provider: "whatsapp"`, `apiBaseUrl: ""` en pagos y la URL local del catálogo) para restaurarlos al terminar. No los commitees: son direcciones efímeras de túnel.

Comprobá que el catálogo cargue desde el backend abriendo la tienda por el túnel y mirando que los productos aparezcan. Si la tienda quedó en blanco, revisá `CORS_ORIGIN` y la consola del navegador.

---

## 9. Paso 8 — Probar el pago

1. Abrí la tienda **por el túnel HTTPS** (no por `localhost`): `https://<tienda>.trycloudflare.com`.
2. Agregá un producto al carrito y andá al checkout.
3. Completá los datos con información ficticia. El DNI y el teléfono deben tener formato válido, pero no tienen que ser reales.
4. En **Pago**, elegí **Mercado Pago (prueba)**.
5. Aceptá los términos y confirmá. Te va a redirigir al checkout de Mercado Pago.
6. Si te pide iniciar sesión, usá la **ventana de incógnito** con el usuario **comprador** de prueba.
7. Pagá con una **tarjeta de prueba**:

| Dato | Valor de prueba |
| --- | --- |
| Tarjeta (Mastercard) | `5031 7557 3453 0604` |
| Vencimiento | `11/30` (cualquier fecha futura) |
| Código de seguridad | `123` |
| Nombre del titular | `APRO` para aprobar, `OTHE` para rechazar |

> Los números de tarjeta de prueba son públicos y no cobran nada. Si el formulario te pide datos reales o el importe se descuenta de una cuenta tuya, **cancelá**.

8. Al terminar, Mercado Pago vuelve a `https://<tienda>.trycloudflare.com/gracias.html?order=<id>`.
9. La página de gracias consulta `GET /api/orders/:id` y muestra el estado real del pedido, no el que diga la URL.

---

## 10. Paso 9 — Verificar el resultado

### En la página de gracias

Debe decir que el pago fue aprobado (o el estado real que informó Mercado Pago). Si dice "pendiente" para siempre, el webhook no llegó: ver la sección de problemas frecuentes.

### En la API

```powershell
Invoke-RestMethod "http://localhost:3000/api/orders/<orderId>"
```

La respuesta incluye `orderId`, `status`, `total`, `currency`, `createdAt`, los ítems y el envío. **No** incluye email, DNI, teléfono ni dirección: es la vista pública.

### En el panel (si configuraste `ADMIN_PASSWORD`)

Abrí `http://localhost:3000/admin`, iniciá sesión y buscá el pedido. Debe figurar como pagado. El panel no cobra, no reembolsa y no cambia el estado de pago.

### En el túnel de la API

La terminal de `cloudflared` del backend muestra cada notificación entrante. Si el webhook falla, la API responde un error y Mercado Pago reintenta.

### En la base de datos

Opcional, para ver el registro de eventos:

```powershell
cd server
node -e "const {openDatabase}=require('./db');const db=openDatabase('./data/orders.sqlite');console.log(db.prepare('SELECT order_id,status,payment_id,received_at FROM payment_events ORDER BY received_at DESC LIMIT 5').all());db.close();"
```

---

## 11. Qué más conviene probar

| Caso | Cómo | Resultado esperado |
| --- | --- | --- |
| **Pago rechazado** | Nombre del titular `OTHE` | Pedido `failed`; la tienda no lo muestra como pagado |
| **Pago pendiente** | Medio de pago con revisión (si el sandbox lo permite) | Pedido `pending` hasta que se resuelva |
| **Webhook repetido** | Reenviar la notificación desde el panel de Mercado Pago, si está disponible | Sin error, sin duplicar el estado; la operación es idempotente |
| **Preferencia vencida** | No pagar y esperar más de 30 minutos | Mercado Pago rechaza el pago vencido |
| **Stock** | Comprar la última unidad y volver a intentar | El servidor rechaza por falta de stock |
| **Total manipulado** | Cambiar el precio en el navegador (herramientas de desarrollo) | El servidor recalcula y cobra el precio real; nunca confía en el navegador |

Los seis casos anteriores están cubiertos por pruebas automatizadas (`npm test`), pero la prueba manual confirma que el sandbox real se comporta igual.

---

## 12. Problemas frecuentes

| Síntoma | Causa probable | Solución |
| --- | --- | --- |
| `El pago de prueba no está configurado` (503) | Falta `MP_ACCESS_TOKEN` o `MP_WEBHOOK_SECRET`, o la API no se reinició | Completar `.env`, reiniciar `npm start` y correr `npm run check:mp` |
| `Configurá un Access Token de prueba TEST-` | El token es de producción (`APP_USR-`) o está mal copiado | Usar el Access Token de **credenciales de prueba** |
| El navegador bloquea la llamada (error de CORS) | `CORS_ORIGIN` no coincide con el origen exacto de la tienda | Copiar el origen del túnel sin barra final y reiniciar la API |
| `La firma de la notificación no es válida` (401) | `MP_WEBHOOK_SECRET` no corresponde a esa aplicación, o se regeneró el secreto | Copiar de nuevo el secreto del panel y reiniciar |
| Pedido `pending` aunque el pago se aprobó | El webhook no llega: túnel caído, URL vieja o servidor apagado | Revisar la terminal de `cloudflared`, actualizar la URL en Mercado Pago y reiniciar |
| Mercado Pago rechaza `back_urls` | `FRONTEND_URL` no es HTTPS | Usar el túnel de la tienda, no `localhost` |
| `Mercado Pago no devolvió un enlace de pago sandbox` | La preferencia se creó fuera del sandbox (token incorrecto) | Revisar que el token sea `TEST-` y la aplicación sea de prueba |
| El túnel cambió de dirección | `cloudflared` se reinició | Actualizar `.env`, la URL del webhook y reiniciar la API |
| La tienda no muestra productos | `catalog.apiBaseUrl` vacío o CORS mal configurado | Apuntar el catálogo al túnel de la API |
| `Invoke-RestMethod` falla con "conexión rechazada" | La API no está corriendo o el puerto es otro | Revisar la terminal de `npm start` y `PORT` |
| El pago pide una tarjeta real | Estás en el checkout de producción | Cerrar, verificar el token `TEST-` y volver a empezar |

---

## 13. Al terminar: limpieza

1. **Cerrá los túneles** con `Ctrl + C` en las dos terminales de `cloudflared`.
2. **Restaurá `js/config.js`** a los valores originales:

   ```js
   catalog: { apiBaseUrl: "http://127.0.0.1:3000" },
   payments: { provider: "whatsapp", apiBaseUrl: "" }
   ```

3. **Borrá las credenciales de `server/.env`** (dejá las variables vacías) o borrá el archivo si lo vas a volver a crear.
4. **Opcional:** eliminá la base de prueba con `Remove-Item server\data\orders.sqlite`. Se vuelve a crear sola, con el catálogo, al iniciar la API.
5. **Verificá que nada sensible quedó en Git**:

   ```powershell
   git status --short
   ```

   No debe aparecer `server/.env` (está ignorado) ni direcciones de túnel en archivos versionados.
6. Si alguna credencial TEST se compartió por error en una captura o un chat, **regenerala** desde el panel de Mercado Pago. Las credenciales de prueba no mueven dinero, pero igual conviene rotarlas.

---

## 14. Checklist final de la prueba

- [ ] `npm run check:mp` termina sin `[error]`.
- [ ] `/api/health` responde `ok`.
- [ ] La tienda carga el catálogo desde el túnel de la API.
- [ ] El checkout crea una preferencia y redirige al **sandbox**.
- [ ] Un pago aprobado deja el pedido en `paid` y `gracias.html` lo muestra.
- [ ] Un pago rechazado deja el pedido en `failed`.
- [ ] El webhook repetido no duplica estados.
- [ ] `GET /api/orders/:id` no expone datos personales.
- [ ] El panel (si está activo) muestra el pedido sin DNI.
- [ ] Al terminar, `js/config.js` volvió a `whatsapp` y no quedan secretos en Git.

Cuando todo esto esté marcado, la integración está lista para planificar el despliegue con HTTPS y disco persistente (ver la sección **"Preparación de despliegue del backend"** del `README.md`). **Los cobros reales siguen bloqueados** hasta que el titular lo autorice explícitamente y se reemplacen las credenciales TEST por las de producción en un entorno controlado.
