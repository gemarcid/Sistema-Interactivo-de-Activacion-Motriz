# Sistema Interactivo de Activación Motriz (SIAM)

> **Plataforma interactiva de estimulación física y cognitiva para adultos mayores basada en visión artificial, control gestual sin contacto y evaluación biomecánica en tiempo real.**

---

> [!IMPORTANT]
> ### Nota sobre la Fase del Proyecto y Empaquetación con Electron
> **Esta versión corresponde a la fase de pruebas y validación biomecánica**, ejecutándose actualmente sobre un entorno web interactivo optimizado con **Vite + Vue 3** y un middleware local para la persistencia en **SQLite**.  
> 
> La estructura del proyecto ya cuenta con las bases modulares (`src/main/main.js`, `src/main/preload.js`, base de datos desacoplada), pero **la empaquetación final como ejecutable de escritorio nativo multiplataforma (Windows, Linux, macOS) mediante Electron se llevará a cabo en una etapa posterior**, priorizando en esta fase la precisión algorítmica, la accesibilidad ergonómica y las pruebas de usabilidad con pacientes.

---

## Descripción del Proyecto

El **Sistema Interactivo de Activación Motriz (SIAM)** es una solución tecnológica diseñada para kinesiología, terapia ocupacional y activación física en adultos mayores. Elimina por completo la necesidad de controles manuales, wearables o mandos físicos complejos: el paciente interactúa de forma totalmente natural utilizando **su propio cuerpo y manos frente a una cámara web convencional**.

### Pilares y Características Principales

1. **Visión Artificial en el Navegador (Edge AI):**
   * Impulsado por `@mediapipe/tasks-vision` de Google.
   * Detección tridimensional en tiempo real de 33 puntos corporales clave (*landmarks*).
   * Aceleración por **GPU** con fallback automático y seguro a **CPU** si el hardware del equipo no dispone de aceleración gráfica.

2. **Control Gestual sin Contacto (*Virtual Hand Cursor & Dwell Click*):**
   * El paciente puede controlar la interfaz simplemente levantando su mano.
   * **Dwell Click (Clic por permanencia):** Al sostener la mano sobre cualquier botón o tarjeta por un segundo, se activa un aro de progreso visual que ejecuta el clic de manera automática sin requerir ratón ni teclado.

3. **Ergonomía Adaptativa y Accesibilidad Kinesiológica:**
   * **Botones en el tercio superior:** Todos los botones de acción principal ("Comenzar", "Continuar", "Descansar") están situados en la parte superior de la pantalla para evitar que el adulto mayor tenga que agacharse o bajar los brazos, previniendo pérdidas de equilibrio o fatiga postural.
   * **Lateralidad Zurdo / Diestro:** La interfaz se reconfigura dinámicamente según la mano dominante del paciente (`useProfiles`), desplazando los menús al lado correspondiente y la silueta corporal al lado opuesto.

4. **Privacidad Médica de Retención Cero (RNF6):**
   * El flujo de video de la cámara web se procesa estrictamente en la memoria RAM del equipo del usuario.
   * **Ninguna imagen, video o fotografía se almacena en disco ni se envía a servidores externos o nubes**, garantizando la privacidad de los pacientes.

---

## Flujo Guiado de la Partida

Al presionar **NUEVA PARTIDA**, el sistema guía al usuario a través de una sesión de activación motriz completa y continua:

```
[MENÚ PRINCIPAL]
      │  (Clic en "NUEVA PARTIDA")
      ▼
[1. TEST DE CAMINATA]
      ├─ Calibración de Tren Inferior: Silueta enfocada de la cintura para abajo.
      ├─ Prueba activa de 30 segundos: Registro en vivo de pasos y postura.
      └─ Resumen Biomecánico: 6 métricas evaluadas ➔ Botón "CONTINUAR AL DESCANSO"
      │
      ▼
[2. MÓDULO DE PAUSA ACTIVA / DESCANSO]
      ├─ Temporizador visual de 30 segundos con aro de progreso.
      ├─ Pregunta: "¿Deseas continuar o descansar 30 segundos más?"
      ├─ Bucle automático: Si no hay respuesta tras 30s, espera otros 30s en bucle respetando el ritmo del paciente.
      └─ Botón superior para "CONTINUAR AL SIGUIENTE JUEGO".
      │
      ▼
[3. MUEVE Y RECUERDA (Tren Superior)]
      ├─ Calibración de Tren Superior: Figurita tipo busto (únicamente de la cintura para arriba).
      ├─ Fase de Memorización: Secuencia de 4 posturas de brazos (12 segundos o botón "¡Ya memoricé!").
      ├─ Fase de Ejecución: El paciente replica las posturas con su cuerpo.
      └─ Resultados ➔ Botón superior "FINALIZAR SESIÓN".
      │
      ▼
[4. SESIÓN COMPLETADA]
      └─ Pantalla de gratificación: Trofeo dorado, estrellas y opción de volver al inicio.
```

---

## Métricas Biomecánicas Evaluadas en Vivo

Durante el módulo de caminata, el sistema registra simultáneamente:
* **Intensidad y Cadencia:** Detección de pasos alternados y cálculo de pasos por minuto.
* **Postura y Fatiga del Torso:** Porcentaje de encogimiento vertical respecto a la línea base e inclinación lateral en grados ($0^\circ = \text{recto}$).
* **Amplitud Articular (ROM):** Grados máximos de flexión y extensión en rodillas y codos mediante cálculo trigonométrico (`Math.atan2`).
* **Centro de Masa (CoM):** Estabilidad y porcentaje de oscilación horizontal y vertical del centro de gravedad.

---

## Tecnologías y Librerías Utilizadas

| Categoría | Tecnología | Uso en el Proyecto |
|---|---|---|
| **Framework Frontend** | `Vue 3` (Composition API) | Reactividad, componentes SFC (`.vue`), gestión de vistas y modales. |
| **Herramienta de Build** | `Vite 5` | Servidor de desarrollo ultrarrápido y middleware API local. |
| **Visión Artificial** | `@mediapipe/tasks-vision` | Detección corporal y extracción de *landmarks* en tiempo real. |
| **Base de Datos** | `sqlite3` + `init.sql` | Almacenamiento local de perfiles de pacientes, métricas y sesiones. |
| **Audio Sintetizado** | `Web Audio API` | Tonos y fanfarrias generados proceduralmente sin archivos pesados. |
| **Variables de Entorno** | `dotenv` | Configuración de rutas locales de la base de datos. |

---

## Guía de Instalación y Ejecución (Versión de Pruebas)

### 1. Requisitos Previos

Asegúrate de contar con las siguientes herramientas en tu sistema:
* **Node.js**: Versión `18.0.0` o superior (se recomienda Node 20 LTS).
* **npm**: Versión `9.0.0` o superior (incluido con Node.js).
* **Cámara web** conectada y funcional.
* **Navegador web moderno** con soporte WebGL (Google Chrome, Microsoft Edge, Brave o Mozilla Firefox).

---

### 2. Pasos de Instalación

1. **Abrir la terminal** en la carpeta raíz del proyecto:
   ```bash
   cd Sistema-Interactivo-de-Activacion-Motriz
   ```

2. **Instalar las dependencias del proyecto:**
   ```bash
   npm install
   ```

---

### 3. Ejecutar la Aplicación en Modo de Pruebas

Inicia el servidor local de desarrollo con Vite:

```bash
npm run dev
```

Una vez ejecutado el comando, la terminal mostrará la dirección local:

```text
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

Abre tu navegador e ingresa a:
**`http://localhost:5173`**

---

### 4. Instrucciones para la Primera Prueba

1. **Permitir el acceso a la cámara:** Al abrir la página, el navegador solicitará permiso para usar la cámara web. Haz clic en **"Permitir"**.
2. **Formulario Inicial:** Ingresa los datos del paciente (Nombre, Edad, Estatura y Mano Dominante). Estos datos se guardarán automáticamente en la base de datos local SQLite (`data/siam_prod.sqlite`).
3. **Control del cursor:** Puedes usar el cursor virtual levantando la mano frente a la lente o utilizar el ratón de forma nativa.
4. **Iniciar Sesión:** Presiona el botón rojo superior **"NUEVA PARTIDA"** para experimentar el flujo guiado completo (Caminata $\rightarrow$ Descanso $\rightarrow$ Mueve y Recuerda $\rightarrow$ Resultados).
5. **Zona de Pruebas (Opcional):** Si deseas probar componentes aislados, puedes entrar a **"ZONA DE PRUEBAS"** desde el menú lateral para acceder directamente a cualquier actividad o prototipo.

---

## Scripts Disponibles

* `npm run dev`: Inicia el servidor de desarrollo local con recarga en caliente (HMR).
* `npm run build`: Compila y empaqueta el frontend para producción verificando la sintaxis y tipos.
* `npm run preview`: Permite previsualizar localmente el resultado de la compilación de producción.

---

La empaquetacion con electron para la entrega final será el ultimo paso antes de las pruebas