import { describe, expect, test } from "vitest";
import { saldoProveedorDesdeTotales } from "./proveedores";

describe("saldoProveedorDesdeTotales", () => {
  test("compras menos pagos más ajustes", () => {
    expect(saldoProveedorDesdeTotales({ compra: 100, pago: 30, ajuste: 5 })).toBe(75);
  });

  test("sin movimientos", () => {
    expect(saldoProveedorDesdeTotales({})).toBe(0);
  });
});
