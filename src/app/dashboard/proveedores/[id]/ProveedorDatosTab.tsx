"use client";

import { DatosProveedorForm } from "./DatosProveedorForm";
import type { ProveedorDTO } from "./proveedor-ficha-types";

export function ProveedorDatosTab({ proveedor }: { proveedor: ProveedorDTO }) {
  return (
    <DatosProveedorForm
      proveedorId={proveedor.id}
      nombre={proveedor.nombre}
      razonSocial={proveedor.razonSocial ?? null}
      cuit={proveedor.cuit ?? null}
      email={proveedor.email ?? null}
      telefono={proveedor.telefono ?? null}
      condicionIva={proveedor.condicionIva ?? null}
      notas={proveedor.notas ?? null}
    />
  );
}
