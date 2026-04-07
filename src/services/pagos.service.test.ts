import { Prisma } from "@prisma/client";
import { describe, expect, test } from "vitest";
import {
  assertImporteAplicadoNoExcedeSaldoVenta,
  assertSumaAplicacionesNoExcedeTotalPago,
} from "./pagos.service";

describe("assertSumaAplicacionesNoExcedeTotalPago", () => {
  test("permite suma igual al total", () => {
    expect(() =>
      assertSumaAplicacionesNoExcedeTotalPago(
        new Prisma.Decimal(30),
        new Prisma.Decimal(70),
        new Prisma.Decimal(100),
      ),
    ).not.toThrow();
  });

  test("rechaza si la suma supera el total", () => {
    expect(() =>
      assertSumaAplicacionesNoExcedeTotalPago(
        new Prisma.Decimal(40),
        new Prisma.Decimal(70),
        new Prisma.Decimal(100),
      ),
    ).toThrow(/supera el importe total/);
  });
});

describe("assertImporteAplicadoNoExcedeSaldoVenta", () => {
  test("permite aplicación parcial", () => {
    expect(() =>
      assertImporteAplicadoNoExcedeSaldoVenta(
        new Prisma.Decimal(25),
        new Prisma.Decimal(100),
        "A-1",
      ),
    ).not.toThrow();
  });

  test("rechaza si supera saldo pendiente", () => {
    expect(() =>
      assertImporteAplicadoNoExcedeSaldoVenta(new Prisma.Decimal(101), new Prisma.Decimal(100), null),
    ).toThrow(/supera el saldo pendiente/);
  });
});
