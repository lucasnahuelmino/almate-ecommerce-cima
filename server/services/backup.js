/* ==========================================================================
   backup.js — Respaldos verificables de la base (Etapa 5)
   --------------------------------------------------------------------------
   Copia la base ANTES de operaciones de riesgo (importaciones y cambios
   masivos) usando el mecanismo de copia segura de SQLite (online backup API
   de better-sqlite3): no interfiere con escrituras concurrentes.
   • La copia se VERIFICA abriéndola en solo lectura con PRAGMA integrity_check.
   • Se conservan solo los respaldos más recientes (retención fija).
   • Si el directorio no está configurado, no hace nada (devuelve null):
     las pruebas y desarrollos sin BACKUP_DIR no escriben archivos.
   ========================================================================== */

const fs = require("node:fs");
const path = require("node:path");
const Database = require("better-sqlite3");

/** Cantidad de respaldos que se conservan en disco. */
const RETAINED_BACKUPS = 30;
const BACKUP_PATTERN = /^backup-[0-9TZ-]+\.sqlite$/;

/** Lista los archivos de respaldo ordenados del más viejo al más nuevo. */
const listBackupFiles = (directory) => {
  try {
    return fs.readdirSync(directory)
      .filter((name) => BACKUP_PATTERN.test(name))
      .sort(); // los nombres son ISO: orden lexicográfico = orden cronológico
  } catch {
    return [];
  }
};

/** Elimina los respaldos que superen la retención (deja los más nuevos). */
const pruneBackups = (directory) => {
  const files = listBackupFiles(directory);
  const excess = files.length - RETAINED_BACKUPS;
  for (let index = 0; index < excess; index += 1) {
    try {
      fs.unlinkSync(path.join(directory, files[index]));
    } catch (error) {
      console.error(`[backup] No se pudo eliminar "${files[index]}": ${error.message}`);
    }
  }
};

/** Nombre único de respaldo basado en la fecha y hora (ISO). */
const backupFileName = (directory) => {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  let candidate = `backup-${stamp}.sqlite`;
  let suffix = 1;
  while (fs.existsSync(path.join(directory, candidate))) {
    candidate = `backup-${stamp}-${suffix}.sqlite`;
    suffix += 1;
  }
  return candidate;
};

/**
 * Crea un respaldo verificable de la base.
 * Devuelve { file, bytes, integrity: "ok" } o null si no hay directorio.
 * Lanza error (y no deja archivos sueltos) si la copia no pasa la verificación.
 */
const createDatabaseBackup = async (database, { directory, reason = "" } = {}) => {
  if (!directory) return null;
  fs.mkdirSync(directory, { recursive: true });
  const file = backupFileName(directory);
  const target = path.join(directory, file);

  // Copia segura de SQLite: funciona aunque haya escrituras en curso.
  await database.backup(target);

  // Verificación: la copia debe abrir y pasar integrity_check.
  let integrity = "";
  try {
    const check = new Database(target, { readonly: true });
    try {
      const [row] = check.pragma("integrity_check");
      integrity = row ? row.integrity_check : "";
    } finally {
      check.close();
    }
  } catch (error) {
    integrity = `error: ${error.message}`;
  }
  if (integrity !== "ok") {
    try { fs.unlinkSync(target); } catch { /* el archivo ya no está */ }
    throw new Error(`El respaldo no pasó la verificación (${integrity || "sin resultado"}).`);
  }

  pruneBackups(directory);
  void reason; // el motivo lo registra quien invoca (en el historial del panel)
  return { file, bytes: fs.statSync(target).size, integrity: "ok" };
};

module.exports = {
  RETAINED_BACKUPS,
  createDatabaseBackup,
  listBackupFiles
};
