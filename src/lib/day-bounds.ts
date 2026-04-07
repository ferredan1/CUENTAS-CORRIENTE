/** Inicio y fin del día calendario en hora local del servidor (suficiente para KPIs diarios). */
export function boundsDiaLocal(d = new Date()): { desde: Date; hasta: Date } {
  const desde = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const hasta = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  return { desde, hasta };
}
