import { describe, expect, it } from "vitest";
import { extraerProductosDeMatrix } from "./lista-precios-xlsx";

describe("lista-precios-xlsx", () => {
  it("Membranex: CÓDIGO + ARTÍCULO + PRECIO", () => {
    const matrix = [
      ["CÓDIGO", "ARTÍCULO", "PRECIO UN"],
      ["X1", "PINTURA 1 LT", 1000],
    ];
    const { productos } = extraerProductosDeMatrix(matrix, {
      proveedorLista: "T",
      archivoOrigen: "t.xlsx",
      hoja: "S",
    });
    expect(productos).toHaveLength(1);
    expect(productos[0]!.codigo).toBe("X1");
    expect(productos[0]!.descripcion).toContain("PINTURA");
    expect(productos[0]!.precioUnitario).toBe(1000);
  });

  it("LEÓN: ARTICULO + DETALLE + LISTA (articulo = código)", () => {
    const matrix = [
      ["ARTICULO", "DETALLE", "LISTA"],
      [1, "MOTOR 1/2HP", "181533,64"],
    ];
    const { productos } = extraerProductosDeMatrix(matrix, {
      proveedorLista: "LEÓN",
      archivoOrigen: "l.xlsx",
      hoja: "S",
    });
    expect(productos).toHaveLength(1);
    expect(productos[0]!.codigo).toBe("1");
    expect(productos[0]!.descripcion).toContain("MOTOR");
    expect(productos[0]!.precioUnitario).toBeCloseTo(181533.64, 1);
  });

  it("BELCER: Art. + Descripcion + Precio", () => {
    const matrix = [
      ["Art.", "Descripcion", "Precio", "IVA"],
      ["HB03", "Caballete", 72000, 21],
    ];
    const { productos } = extraerProductosDeMatrix(matrix, {
      proveedorLista: "B",
      archivoOrigen: "b.xlsx",
      hoja: "S",
    });
    expect(productos).toHaveLength(1);
    expect(productos[0]!.codigo).toBe("HB03");
    expect(productos[0]!.ivaPct).toBe(21);
  });
});
