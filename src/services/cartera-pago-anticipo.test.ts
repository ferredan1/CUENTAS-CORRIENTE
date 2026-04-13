import { describe, expect, test } from "vitest";
import { anticipoMontoPago } from "@/services/cartera-pago-anticipo";

describe("anticipoMontoPago", () => {
  test("pago liquidador no deja anticipo", () => {
    expect(anticipoMontoPago({ total: 1000, esLiquidador: true, sumaAplicaciones: 400 })).toBe(0);
  });

  test("pago con aplicación parcial deja el resto como anticipo", () => {
    expect(anticipoMontoPago({ total: 1000, esLiquidador: false, sumaAplicaciones: 400 })).toBe(600);
  });

  test("pago sin aplicar ni liquidar es todo anticipo", () => {
    expect(anticipoMontoPago({ total: 500, esLiquidador: false, sumaAplicaciones: 0 })).toBe(500);
  });

  test("aplicaciones que cubren el total dejan cero", () => {
    expect(anticipoMontoPago({ total: 400, esLiquidador: false, sumaAplicaciones: 400 })).toBe(0);
  });
});
