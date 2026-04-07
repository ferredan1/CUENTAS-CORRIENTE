/** Enlaces del panel: compartidos entre barra lateral y menú móvil. */
export type DashboardLink = {
  href: string;
  label: string;
  /** Cómo detectar link activo en el cliente (sin funciones serializadas). */
  active: "exact" | "prefix";
};

export type DashboardNavSectionId = "panel" | "operacion" | "utilidades";

export type DashboardNavSection = {
  id: DashboardNavSectionId;
  /** Encabezado visible sobre el grupo (vacío = sin etiqueta, solo enlaces). */
  label: string;
  links: DashboardLink[];
};

/**
 * Orden mental: Inicio → operación diaria → utilidades.
 * `DASHBOARD_LINKS` aplana la misma fuente para compatibilidad.
 */
export const DASHBOARD_NAV_SECTIONS: DashboardNavSection[] = [
  {
    id: "panel",
    label: "",
    links: [{ href: "/dashboard", label: "Panel", active: "exact" }],
  },
  {
    id: "operacion",
    label: "Operación",
    links: [
      { href: "/dashboard/clientes", label: "Clientes", active: "prefix" },
      { href: "/dashboard/proveedores", label: "Proveedores", active: "prefix" },
      { href: "/dashboard/cheques", label: "Cheques", active: "prefix" },
      { href: "/dashboard/caja", label: "Caja", active: "prefix" },
    ],
  },
  {
    id: "utilidades",
    label: "Utilidades",
    links: [{ href: "/dashboard/auditoria", label: "Auditoría", active: "prefix" }],
  },
];

export const DASHBOARD_LINKS: DashboardLink[] = DASHBOARD_NAV_SECTIONS.flatMap((s) => s.links);
