import { prisma } from "@/lib/prisma";
import { extraerTextoDePdf } from "@/lib/pdf/extract-text";
import {
  extraerItemsDelTextoComprobante,
  extraerSugerenciaComprobante,
  segmentarComprobantesDesdeTexto,
} from "@/services/extraer-lineas-comprobante";
import {
  agregarErroresExtraccion,
  crearExtraccionArchivo,
  PARSER_VERSION_AUTO_IMPORT,
} from "@/services/extracciones.service";
import { importarComprobanteVentas } from "@/services/importar-comprobante";
import { registrarArchivo } from "@/services/archivos";

export type ResultadoAutoImportPdf = {
  comprobantes: {
    comprobante: string;
    items: number;
    movimientos: number;
    fecha?: string;
  }[];
  advertencias: string[];
};

async function marcarArchivo(archivoId: string, estado: "extraido" | "error") {
  await prisma.archivo
    .updateMany({
      where: { id: archivoId },
      data: { estado },
    })
    .catch((err) => console.error("[archivo] No se pudo actualizar estado:", archivoId, err));
}

async function guardarMetadatosArchivoDesdeSegmento(params: {
  archivoId: string;
  comprobante?: string | null;
  segmento: {
    letra: "A" | "B" | "C" | "X" | null;
    cae: string | null;
    caeFechaVto: Date | null;
    cuitCliente: string | null;
  };
}) {
  const { archivoId, segmento, comprobante } = params;
  await prisma.archivo
    .updateMany({
      where: { id: archivoId },
      data: {
        letra: segmento.letra,
        cae: segmento.cae,
        caeFechaVto: segmento.caeFechaVto,
        cuitCliente: segmento.cuitCliente,
        ...(comprobante !== undefined
          ? { comprobante: comprobante?.trim() ? comprobante.trim() : null }
          : {}),
      },
    })
    .catch((err) =>
      console.error("[archivo] No se pudieron guardar metadatos Dux:", archivoId, err),
    );
}

/**
 * Tras guardar el PDF: extrae texto, segmenta por Nº de comprobante (si hay varios en un archivo)
 * e importa ventas en el cliente/obra indicados.
 */
export async function autoImportarPdfTrasSubida(
  buffer: Buffer,
  clienteId: string,
  obraId: string | null,
  archivoId: string,
  opts?: { signal?: AbortSignal },
): Promise<ResultadoAutoImportPdf> {
  const advertencias: string[] = [];
  const comprobantes: ResultadoAutoImportPdf["comprobantes"] = [];
  const signal = opts?.signal;

  let texto: string;
  try {
    signal?.throwIfAborted();
    texto = await extraerTextoDePdf(buffer);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al leer PDF";
    await marcarArchivo(archivoId, "error");
    await crearExtraccionArchivo({
      archivoId,
      estado: "error",
      errores: msg,
      versionParser: PARSER_VERSION_AUTO_IMPORT,
    }).catch((err) => console.error("[extraccion] No se pudo registrar fallo PDF:", err));
    return {
      comprobantes: [],
      advertencias: [`No se importó automáticamente el detalle: ${msg}`],
    };
  }

  await marcarArchivo(archivoId, "extraido");

  if (!texto.trim()) {
    await crearExtraccionArchivo({
      archivoId,
      estado: "error",
      errores: "PDF sin texto seleccionable (posible escaneo sin capa de texto).",
      versionParser: PARSER_VERSION_AUTO_IMPORT,
    }).catch((err) => console.error("[extraccion] No se pudo registrar:", err));
    return {
      comprobantes: [],
      advertencias: [
        "El PDF no tiene texto seleccionable (¿escaneo?). Solo se guardó el archivo; cargue ítems a mano o use OCR.",
      ],
    };
  }

  const segmentos = segmentarComprobantesDesdeTexto(texto);
  let extraccionId: string | null = null;
  try {
    const ex = await crearExtraccionArchivo({
      archivoId,
      estado: "pendiente",
      textoExtraido: texto,
      jsonExtraido: {
        segmentosCount: segmentos.length,
        etapa: "pre_import",
      },
      versionParser: PARSER_VERSION_AUTO_IMPORT,
    });
    extraccionId = ex.id;
  } catch (err) {
    console.error("[extraccion] No se pudo crear registro de extracción:", err);
  }

  const archivoRow = await prisma.archivo.findFirst({
    where: { id: archivoId },
    select: { id: true, url: true, nombre: true },
  });
  if (!archivoRow) {
    return {
      comprobantes: [],
      advertencias: ["El registro de archivo no existe o no pertenece al cliente."],
    };
  }

  for (let si = 0; si < segmentos.length; si++) {
    signal?.throwIfAborted();
    const seg = segmentos[si]!;
    const items = extraerItemsDelTextoComprobante(seg.texto);
    const compBase =
      seg.comprobanteCompleto.replace(/\s/g, "") ||
      extraerSugerenciaComprobante(seg.texto)?.replace(/\s/g, "").replace(/–/g, "-");
    const comp = compBase || `PDF-${Date.now()}-${si}`;

    if (items.length === 0) {
      if (segmentos.length > 1 || seg.comprobante) {
        advertencias.push(`Sin ítems detectados para el tramo con comprobante «${comp}».`);
      }
      continue;
    }

    let archivoIdEfectivo: string;
    if (si === 0) {
      archivoIdEfectivo = archivoId;
    } else {
      const baseNombre = archivoRow.nombre?.trim() || "PDF";
      const nuevo = await registrarArchivo({
        url: archivoRow.url,
        nombre: `${baseNombre} · ${comp}`,
        clienteId,
        obraId,
        comprobante: comp,
      });
      if (!nuevo) {
        advertencias.push(`No se pudo crear registro de archivo para comprobante «${comp}».`);
        continue;
      }
      archivoIdEfectivo = nuevo.id;
      await marcarArchivo(archivoIdEfectivo, "extraido");
    }

    await guardarMetadatosArchivoDesdeSegmento({
      archivoId: archivoIdEfectivo,
      comprobante: comp,
      segmento: {
        letra: seg.letra,
        cae: seg.cae,
        caeFechaVto: seg.caeFechaVto,
        cuitCliente: seg.cuitCliente,
      },
    });

    try {
      const movs = await importarComprobanteVentas({
        clienteId,
        obraId,
        archivoId: archivoIdEfectivo,
        comprobante: comp,
        fecha: seg.fecha ?? undefined,
        extraccionId,
        items: items.map((i) => ({
          codigo: i.codigo,
          descripcion: i.descripcion,
          cantidad: i.cantidad,
          precioUnitario: i.precioUnitario,
        })),
      });

      comprobantes.push({
        comprobante: comp,
        items: items.length,
        movimientos: movs.length,
        fecha: seg.fecha ? seg.fecha.toISOString().slice(0, 10) : undefined,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error desconocido";
      advertencias.push(
        `Error al importar comprobante «${comp}» (${items.length} ítem(s) detectados): ${msg}`,
      );
      if (extraccionId) {
        void agregarErroresExtraccion(extraccionId, `Import «${comp}»: ${msg}`).catch(() => {});
      }
    }
  }

  if (segmentos.length > 1 && comprobantes.length > 0) {
    const nIni = await prisma.movimiento.count({
      where: { archivoId, tipo: "venta" },
    });
    if (nIni === 0) {
      const orphan = await prisma.archivo.findFirst({
        where: {
          id: archivoId,
          movimientos: { none: {} },
        },
        select: { id: true },
      });
      if (orphan) {
        await prisma.archivo.delete({ where: { id: orphan.id } }).catch((err) => {
          console.error("[archivo] No se pudo eliminar archivo inicial sin movimientos:", err);
        });
      }
    }
  }

  if (comprobantes.length === 0) {
    const itemsGlobal = extraerItemsDelTextoComprobante(texto);
    if (itemsGlobal.length > 0) {
      signal?.throwIfAborted();
      advertencias.push(
        "La importación por cada número de comprobante no generó movimientos; se reintenta con todos los ítems detectados en el PDF bajo un solo número de comprobante sugerido (revise en cuenta corriente).",
      );
      try {
        const comp =
          extraerSugerenciaComprobante(texto)?.replace(/\s/g, "").replace(/–/g, "-") ||
          `PDF-${Date.now()}`;
        await prisma.archivo
          .updateMany({
            where: { id: archivoId },
            data: { comprobante: comp },
          })
          .catch((err) => console.error("[archivo] No se pudo guardar comprobante sugerido:", err));
        const movs = await importarComprobanteVentas({
          clienteId,
          obraId,
          archivoId,
          comprobante: comp,
          extraccionId,
          items: itemsGlobal.map((i) => ({
            codigo: i.codigo,
            descripcion: i.descripcion,
            cantidad: i.cantidad,
            precioUnitario: i.precioUnitario,
          })),
        });
        comprobantes.push({
          comprobante: comp,
          items: itemsGlobal.length,
          movimientos: movs.length,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Error desconocido";
        advertencias.push(`Importación en bloque único falló: ${msg}`);
        if (extraccionId) {
          void agregarErroresExtraccion(extraccionId, `Bloque único: ${msg}`).catch(() => {});
        }
      }
    } else if (advertencias.length === 0) {
      advertencias.push(
        "No se detectaron productos en el PDF. El archivo quedó guardado; puede analizarlo abajo o cargar ítems a mano.",
      );
    }
  }

  return { comprobantes, advertencias };
}
