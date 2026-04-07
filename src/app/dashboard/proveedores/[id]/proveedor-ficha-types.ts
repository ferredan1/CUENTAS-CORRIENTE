export type ProveedorDTO = {
  id: string;
  nombre: string;
  razonSocial?: string | null;
  cuit?: string | null;
  email?: string | null;
  telefono?: string | null;
  condicionIva?: string | null;
  notas?: string | null;
  saldo: number;
  movimientosCount: number;
  ultimoMovimiento: { fecha: string | Date; descripcion: string; tipo: string } | null;
};
