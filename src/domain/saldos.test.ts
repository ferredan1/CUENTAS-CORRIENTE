import { describe, expect, test } from "vitest";
import { acumularPorTipo, saldoDesdeTotalesPorTipo, totalesPendientesDesdeFilas } from "@/domain/saldos";
import { saldoProveedorDesdeTotales } from "@/services/proveedores";

describe("saldoDesdeTotalesPorTipo", () => {
  test("ventas + ajuste - pagos - devoluciones", () => {
    expect(
      saldoDesdeTotalesPorTipo({
        venta: 100,
        ajuste: 10,
        pago: 40,
        devolucion: 5,
      }),
    ).toBe(65);
  });
});

describe("acumularPorTipo", () => {
  test("agrupa totales", () => {
    expect(
      acumularPorTipo([
        { tipo: "venta", total: 10 },
        { tipo: "venta", total: 5 },
        { tipo: "pago", total: 3 },
      ]),
    ).toEqual({ venta: 15, pago: 3 });
  });
});

describe("totalesPendientesDesdeFilas", () => {
  test("excluye ventas liquidadas del saldo pendiente", () => {
    expect(
      totalesPendientesDesdeFilas([
        { tipo: "venta", total: 100, liquidadoAt: "2026-01-01T00:00:00.000Z" },
        { tipo: "venta", total: 50, liquidadoAt: null },
        { tipo: "pago", total: 10, liquidadoAt: null },
      ]),
    ).toEqual({ venta: 50, pago: 10 });
  });

  test("venta con saldoPendiente parcial ignora total y liquidadoAt", () => {
    expect(
      totalesPendientesDesdeFilas([
        { tipo: "venta", total: 100, liquidadoAt: null, saldoPendiente: 35 },
        { tipo: "pago", total: 10, liquidadoAt: null },
      ]),
    ).toEqual({ venta: 35, pago: 10 });
  });
});

describe("saldoProveedorDesdeTotales", () => {
  test("compras + ajuste - pagos", () => {
    expect(
      saldoProveedorDesdeTotales({
        compra: 100,
        ajuste: 10,
        pago: 40,
      }),
    ).toBe(70);
  });
});
