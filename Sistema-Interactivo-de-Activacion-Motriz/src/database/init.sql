-- ==========================================================
-- init.sql - Base de datos SQLite para Sistema Interactivo de Activación Motriz (SIAM)
-- ==========================================================

PRAGMA foreign_keys = ON;

BEGIN TRANSACTION;

/* =========================
   USUARIOS Y PERFILES
   ========================= */

CREATE TABLE IF NOT EXISTS usuario (
    id_usuario INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    rol TEXT NOT NULL CHECK (
        rol IN ('ADMINISTRADOR', 'TERAPEUTA', 'OPERADOR', 'CUIDADOR', 'PACIENTE', 'ABUELO')
    ),
    activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1))
);

CREATE TABLE IF NOT EXISTS perfil (
    id_perfil INTEGER PRIMARY KEY AUTOINCREMENT,
    id_usuario INTEGER NOT NULL,
    estatura_cm REAL NOT NULL CHECK (estatura_cm > 0),
    edad INTEGER CHECK (edad IS NULL OR edad >= 0),
    mano_dominante TEXT NOT NULL DEFAULT 'DERECHA' CHECK (
        mano_dominante IN ('IZQUIERDA', 'DERECHA')
    ),
    dificultad TEXT DEFAULT 'facil',
    avatar TEXT DEFAULT '👴',

    FOREIGN KEY (id_usuario)
        REFERENCES usuario(id_usuario)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

/* =========================
   MINIJUEGOS Y DISPOSITIVOS
   ========================= */

CREATE TABLE IF NOT EXISTS minijuego (
    id_minijuego INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL UNIQUE,
    modalidad TEXT
);

CREATE TABLE IF NOT EXISTS dispositivo (
    id_dispositivo INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT NOT NULL CHECK (
        tipo IN ('CAMARA', 'BALANCE_BOARD', 'WII_REMOTE', 'OTRO')
    ),
    descripcion TEXT
);

/* =========================
   SESIONES
   ========================= */

CREATE TABLE IF NOT EXISTS sesion (
    id_sesion INTEGER PRIMARY KEY AUTOINCREMENT,
    id_perfil INTEGER NOT NULL,
    id_minijuego INTEGER NOT NULL,
    inicio TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fin TEXT,
    estado TEXT NOT NULL DEFAULT 'INICIADA' CHECK (
        estado IN ('INICIADA', 'PAUSADA', 'FINALIZADA', 'CANCELADA')
    ),

    FOREIGN KEY (id_perfil)
        REFERENCES perfil(id_perfil)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    FOREIGN KEY (id_minijuego)
        REFERENCES minijuego(id_minijuego)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CHECK (fin IS NULL OR fin >= inicio)
);

/* =========================
   CONFIGURACIÓN MOTRIZ
   ========================= */

CREATE TABLE IF NOT EXISTS configuracion (
    id_configuracion INTEGER PRIMARY KEY AUTOINCREMENT,
    id_sesion INTEGER NOT NULL,
    velocidad REAL,
    altura_objeto REAL,
    sensibilidad REAL,
    punto_central TEXT,

    FOREIGN KEY (id_sesion)
        REFERENCES sesion(id_sesion)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

/* =========================
   TELEMETRÍA Y MÉTRICAS
   ========================= */

CREATE TABLE IF NOT EXISTS telemetria (
    id_telemetria INTEGER PRIMARY KEY AUTOINCREMENT,
    id_sesion INTEGER NOT NULL,
    id_dispositivo INTEGER,
    tiempo_activo REAL,
    tiempo_descanso REAL,
    puntaje REAL,
    vector_movimiento TEXT,
    centro_gravedad TEXT,

    FOREIGN KEY (id_sesion)
        REFERENCES sesion(id_sesion)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    FOREIGN KEY (id_dispositivo)
        REFERENCES dispositivo(id_dispositivo)
        ON UPDATE CASCADE
        ON DELETE SET NULL
);

/* =========================
   REPORTES
   ========================= */

CREATE TABLE IF NOT EXISTS reporte (
    id_reporte INTEGER PRIMARY KEY AUTOINCREMENT,
    id_sesion INTEGER NOT NULL UNIQUE,
    tipo TEXT NOT NULL,
    generado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resumen TEXT,

    FOREIGN KEY (id_sesion)
        REFERENCES sesion(id_sesion)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

/* =========================
   AUDITORÍA
   ========================= */

CREATE TABLE IF NOT EXISTS auditoria (
    id_auditoria INTEGER PRIMARY KEY AUTOINCREMENT,
    id_usuario INTEGER,
    accion TEXT NOT NULL,
    resultado TEXT NOT NULL CHECK (
        resultado IN ('EXITOSO', 'DENEGADO')
    ),
    fecha TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (id_usuario)
        REFERENCES usuario(id_usuario)
        ON UPDATE CASCADE
        ON DELETE SET NULL
);

/* =========================
   ÍNDICES
   ========================= */

CREATE INDEX IF NOT EXISTS idx_perfil_usuario ON perfil(id_usuario);
CREATE INDEX IF NOT EXISTS idx_sesion_perfil ON sesion(id_perfil);
CREATE INDEX IF NOT EXISTS idx_sesion_minijuego ON sesion(id_minijuego);
CREATE INDEX IF NOT EXISTS idx_telemetria_sesion ON telemetria(id_sesion);
CREATE INDEX IF NOT EXISTS idx_telemetria_dispositivo ON telemetria(id_dispositivo);
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario_fecha ON auditoria(id_usuario, fecha);

/* =========================
   VISTA DE REPORTES
   ========================= */

CREATE VIEW IF NOT EXISTS vw_reporte_sesion AS
SELECT
    s.id_sesion,
    p.id_perfil,
    u.nombre AS usuario,
    u.rol,
    p.mano_dominante,
    p.estatura_cm,
    p.edad,
    m.nombre AS minijuego,
    s.inicio,
    s.fin,
    s.estado,
    MAX(t.puntaje) AS puntaje,
    SUM(COALESCE(t.tiempo_activo, 0)) AS tiempo_activo,
    SUM(COALESCE(t.tiempo_descanso, 0)) AS tiempo_descanso,
    r.tipo AS tipo_reporte,
    r.generado_en,
    r.resumen
FROM sesion AS s
INNER JOIN perfil AS p
    ON p.id_perfil = s.id_perfil
INNER JOIN usuario AS u
    ON u.id_usuario = p.id_usuario
INNER JOIN minijuego AS m
    ON m.id_minijuego = s.id_minijuego
LEFT JOIN telemetria AS t
    ON t.id_sesion = s.id_sesion
LEFT JOIN reporte AS r
    ON r.id_sesion = s.id_sesion
GROUP BY
    s.id_sesion,
    p.id_perfil,
    u.nombre,
    u.rol,
    p.mano_dominante,
    p.estatura_cm,
    p.edad,
    m.nombre,
    s.inicio,
    s.fin,
    s.estado,
    r.tipo,
    r.generado_en,
    r.resumen;

COMMIT;

