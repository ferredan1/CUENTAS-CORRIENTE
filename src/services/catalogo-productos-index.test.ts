import { describe, expect, it } from "vitest";
import {
  buildCatalogIndex,
  emparejarDescripcionConCatalogo,
  enriquecerItemsConCatalogo,
} from "./catalogo-productos-index";

describe("catalogo-productos-index", () => {
  const filas = [
    { codigo: "H-1", descripcion: "MARTILLO GALPONERO (MANGO FIBRA) 16 OZ PROFESIONAL" },
    { codigo: "X", descripcion: "OTRO PRODUCTO CORTO" },
  ];
  const index = buildCatalogIndex(filas);

  it("empareja por inclusión cuando el PDF trae marca extra (BREMEN)", () => {
    const pdf =
      "MARTILLO GALPONERO (MANGO FIBRA) 16 OZ PROFESIONAL BREMEN® 4692";
    const m = emparejarDescripcionConCatalogo(pdf, index);
    expect(m).not.toBeNull();
    expect(m!.entrada.codigo).toBe("H-1");
    expect(m!.entrada.descripcion).toContain("MARTILLO");
  });

  it("enriquecerItemsConCatalogo rellena código y descripción canónica", () => {
    const items = [
      {
        codigo: "-",
        descripcion:
          "MARTILLO GALPONERO (MANGO FIBRA) 16 OZ PROFESIONAL BREMEN® 4692",
        cantidad: 1,
        precioUnitario: 17400,
      },
    ];
    const out = enriquecerItemsConCatalogo(items, index);
    expect(out[0]!.codigo).toBe("H-1");
    expect(out[0]!.descripcion).toBe(filas[0]!.descripcion);
    expect(out[0]!.precioUnitario).toBe(17400);
  });
});
