import { describe, expect, test } from "vitest";
import { DESCRIPCION_DEFAULT_SALDO_ANTERIOR, etiquetaTipoMovimientoCliente } from "./etiqueta-tipo";

describe("etiquetaTipoMovimientoCliente", () => {
  test("ajuste genérico mantiene tipo", () => {
    expect(etiquetaTipoMovimientoCliente({ tipo: "ajuste", descripcion: "Corrección" })).toBe("ajuste");
  });

  test("ajuste con prefijo saldo anterior", () => {
    expect(
      etiquetaTipoMovimientoCliente({ tipo: "ajuste", descripcion: DESCRIPCION_DEFAULT_SALDO_ANTERIOR }),
    ).toBe("saldo anterior");
    expect(
      etiquetaTipoMovimientoCliente({ tipo: "ajuste", descripcion: "  Saldo anterior — cuotas viejas" }),
    ).toBe("saldo anterior");
  });
});
