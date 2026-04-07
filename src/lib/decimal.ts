import { Prisma } from "@prisma/client";

export function toDecimal2(n: number): Prisma.Decimal {
  const rounded = Math.round(n * 100) / 100;
  return new Prisma.Decimal(rounded.toFixed(2));
}
