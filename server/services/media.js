/* ==========================================================================
   media.js — Gestión de imágenes subidas desde el panel
   --------------------------------------------------------------------------
   Reglas de seguridad:
   • El tipo de archivo se detecta por "bytes mágicos" (JPEG, PNG o WebP),
     nunca por la extensión ni por el nombre que mande el navegador.
   • El nombre final lo genera SIEMPRE el servidor (UUID); el cliente no
     puede decidir rutas, ni carpetas, ni nombres.
   • Se limita el tamaño en disco y las dimensiones de la imagen.
   Los archivos viven en una carpeta persistente junto a la base de datos
   (por defecto server/data/uploads/) y se sirven desde /media/<nombre>.
   ========================================================================== */

const { randomUUID } = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB por imagen
const MAX_DIMENSION = 12000; // píxeles por lado
const MAX_PIXELS = 50000000; // 50 megapíxeles

/** Tipos aceptados: el nombre del archivo importa cero, solo los bytes. */
const SUPPORTED_TYPES = {
  jpeg: { extension: "jpg", contentType: "image/jpeg" },
  png: { extension: "png", contentType: "image/png" },
  webp: { extension: "webp", contentType: "image/webp" }
};

/** Nombres que el servidor acepta borrar: UUID + extensión conocida. */
const isManagedName = (name) =>
  typeof name === "string" && /^[a-f0-9-]{36}\.(?:jpg|png|webp)$/i.test(name);

const httpError = (status, message) => Object.assign(new Error(message), { status });

/* ---------- Lectura de dimensiones según el formato ---------- */

/** PNG: los 8 bytes de firma, luego un bloque IHDR con ancho y alto (BE32). */
const readPngDimensions = (buffer) => {
  if (buffer.length < 24 || buffer.toString("ascii", 12, 16) !== "IHDR") return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
};

/**
 * JPEG: se recorren los marcadores hasta encontrar un SOF, que contiene
 * precisión, alto y ancho (BE16).
 */
const readJpegDimensions = (buffer) => {
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    let marker = buffer[offset + 1];
    while (marker === 0xff && offset + 2 < buffer.length) {
      offset += 1;
      marker = buffer[offset + 1];
    }
    // Marcadores sin longitud: RSTn, SOI, EOI y TEM.
    if ((marker >= 0xd0 && marker <= 0xd9) || marker === 0x01) {
      offset += 2;
      continue;
    }
    const length = buffer.readUInt16BE(offset + 2);
    const isSof = marker >= 0xc0 && marker <= 0xcf &&
      marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    if (length < 2) return null;
    offset += 2 + length;
  }
  return null;
};

/** WebP: se leen los chunks VP8X (extendido), VP8L (sin pérdida) o VP8. */
const readWebpDimensions = (buffer) => {
  let offset = 12; // RIFF(4) + tamaño(4) + "WEBP"(4)
  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const data = offset + 8;
    if (chunkId === "VP8X" && data + 10 <= buffer.length) {
      const width = 1 + buffer[data + 4] + (buffer[data + 5] << 8) + (buffer[data + 6] << 16);
      const height = 1 + buffer[data + 7] + (buffer[data + 8] << 8) + (buffer[data + 9] << 16);
      return { width, height };
    }
    if (chunkId === "VP8L" && data + 5 <= buffer.length && buffer[data] === 0x2f) {
      // 14 bits de ancho-1 y 14 bits de alto-1 empaquetados desde el bit 0.
      const bits = buffer.readUInt32LE(data + 1);
      return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) };
    }
    if (chunkId === "VP8 " && data + 10 <= buffer.length &&
        buffer[data + 3] === 0x9d && buffer[data + 4] === 0x01 && buffer[data + 5] === 0x2a) {
      return {
        width: buffer.readUInt16LE(data + 6) & 0x3fff,
        height: buffer.readUInt16LE(data + 8) & 0x3fff
      };
    }
    offset = data + chunkSize + (chunkSize % 2); // los chunks van alineados a 2 bytes
  }
  return null;
};

/** Detecta el tipo real mirando los bytes iniciales del archivo. */
const detectType = (buffer) => {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpeg";
  }
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "png";
  }
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
    return "webp";
  }
  return null;
};

const readDimensions = (type, buffer) => {
  if (type === "png") return readPngDimensions(buffer);
  if (type === "jpeg") return readJpegDimensions(buffer);
  return readWebpDimensions(buffer);
};

/* ---------- Servicio ---------- */

const createMediaService = ({ directory = path.join(__dirname, "..", "data", "uploads") } = {}) => {
  const ensureDirectory = () => fs.mkdir(directory, { recursive: true });

  return {
    directory,

    /** Valida el buffer y lo guarda con un nombre UUID generado por el servidor. */
    async store(buffer) {
      if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
        throw httpError(400, "Enviá el archivo de la imagen vacío o incompleto.");
      }
      if (buffer.length > MAX_IMAGE_BYTES) {
        throw httpError(400, `La imagen supera el tamaño máximo de ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`);
      }
      const type = detectType(buffer);
      if (!type) {
        throw httpError(400, "El archivo no es una imagen válida. Formatos permitidos: JPG, PNG o WebP.");
      }
      const dimensions = readDimensions(type, buffer);
      if (!dimensions || !Number.isInteger(dimensions.width) || !Number.isInteger(dimensions.height) ||
          dimensions.width < 1 || dimensions.height < 1) {
        throw httpError(400, "No se pudieron leer las dimensiones de la imagen; probá con otro archivo.");
      }
      if (dimensions.width > MAX_DIMENSION || dimensions.height > MAX_DIMENSION ||
          dimensions.width * dimensions.height > MAX_PIXELS) {
        throw httpError(400, `Las dimensiones de la imagen son excesivas (máximo ${MAX_DIMENSION} px por lado).`);
      }
      const { extension, contentType } = SUPPORTED_TYPES[type];
      const name = `${randomUUID()}.${extension}`;
      await ensureDirectory();
      // "wx" falla si el archivo ya existiera: nunca se pisa una imagen previa.
      await fs.writeFile(path.join(directory, name), buffer, { flag: "wx" });
      return {
        name,
        url: `/media/${name}`,
        width: dimensions.width,
        height: dimensions.height,
        size: buffer.length,
        contentType
      };
    },

    /** Borra un archivo gestionado. Devuelve false si no existía. */
    async remove(name) {
      if (!isManagedName(name)) {
        throw httpError(404, "Archivo no encontrado.");
      }
      try {
        await fs.unlink(path.join(directory, name));
        return true;
      } catch (error) {
        if (error.code === "ENOENT") return false;
        throw error;
      }
    },

    /** true si el archivo gestionado existe en disco. */
    async exists(name) {
      if (!isManagedName(name)) return false;
      try {
        await fs.access(path.join(directory, name));
        return true;
      } catch {
        return false;
      }
    }
  };
};

module.exports = {
  MAX_IMAGE_BYTES,
  SUPPORTED_TYPES,
  createMediaService,
  isManagedName
};
