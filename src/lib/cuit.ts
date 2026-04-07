function soloDigitos(s: string): string {
  return s.replace(/\D/g, "");
}

/**
 * Valida CUIT/CUIL (Argentina) con dígito verificador (módulo 11).
 * Acepta entrada con o sin separadores: 20-12345678-9 / 20123456789.
 */
export function validarCuit(cuit: string): boolean {
  const d = soloDigitos(cuit);
  if (d.length !== 11) return false;
  if (!/^\d{11}$/.test(d)) return false;

  const nums = d.split("").map((x) => Number.parseInt(x, 10));
  if (nums.some((n) => !Number.isFinite(n))) return false;

  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let suma = 0;
  for (let i = 0; i < 10; i++) {
    suma += (nums[i] ?? 0) * pesos[i]!;
  }
  const mod = suma % 11;
  let dv = 11 - mod;
  if (dv === 11) dv = 0;
  if (dv === 10) dv = 9;

  return nums[10] === dv;
}

