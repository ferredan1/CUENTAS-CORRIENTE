import { describe, expect, test } from "vitest";
import {
  assertPagoChequeCompleto,
  calcularTotalMovimiento,
} from "@/domain/movimientos/rules";

describe("calcularTotalMovimiento", () => {
  test("redondea a 2 decimales", () => {
    expect(calcularTotalMovimiento(2, 1.235)).toBe(2.47);
    expect(calcularTotalMovimiento(1, 10)).toBe(10);
  });

  test("rechaza no finitos", () => {
    expect(() => calcularTotalMovimiento(NaN, 1)).toThrow("no válidos");
  });
});

describe("assertPagoChequeCompleto", () => {
  const vto = new Date("2030-06-15T12:00:00");
  const rec = new Date("2026-01-10T12:00:00");

  test("no exige datos si no es pago con cheque", () => {
    expect(() =>
      assertPagoChequeCompleto("venta", "cheque", null, null, vto, rec),
    ).not.toThrow();
    expect(() => assertPagoChequeCompleto("pago", "efectivo", null, null, vto, rec)).not.toThrow();
  });

  test("lanza si falta banco del cheque", () => {
    expect(() => assertPagoChequeCompleto("pago", "cheque", "123", null, vto, rec)).toThrow(
      "banco del cheque",
    );
  });

  test("lanza si falta número de cheque", () => {
    expect(() => assertPagoChequeCompleto("pago", "cheque", null, "Galicia", vto, rec)).toThrow(
      "número de cheque",
    );
  });
});
