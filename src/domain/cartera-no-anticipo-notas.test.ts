import { describe, expect, test } from "vitest";
import {
  anexarMarcadorNoAnticipoCartera,
  CARTERA_NO_ANTICIPO_NOTAS_MARKER,
  notasIndicanExcluirAnticipoCartera,
} from "@/domain/cartera-no-anticipo-notas";

describe("cartera-no-anticipo-notas", () => {
  test("detecta marcador", () => {
    expect(notasIndicanExcluirAnticipoCartera(null)).toBe(false);
    expect(notasIndicanExcluirAnticipoCartera("")).toBe(false);
    expect(notasIndicanExcluirAnticipoCartera(`algo\n${CARTERA_NO_ANTICIPO_NOTAS_MARKER}`)).toBe(true);
  });

  test("anexa una sola vez", () => {
    expect(anexarMarcadorNoAnticipoCartera(null)).toBe(CARTERA_NO_ANTICIPO_NOTAS_MARKER);
    expect(anexarMarcadorNoAnticipoCartera("x")).toBe(`x\n${CARTERA_NO_ANTICIPO_NOTAS_MARKER}`);
    const twice = anexarMarcadorNoAnticipoCartera(`x\n${CARTERA_NO_ANTICIPO_NOTAS_MARKER}`);
    expect(twice).toBe(`x\n${CARTERA_NO_ANTICIPO_NOTAS_MARKER}`);
  });
});
