"use client";

import { CenteredFormModal } from "@/components/CenteredFormModal";
import { useState } from "react";
import { NuevoClienteForm } from "../NuevoClienteForm";

export function NuevoClienteToggle() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
        Nuevo cliente
      </button>
      <CenteredFormModal open={open} onClose={() => setOpen(false)} title="Nuevo cliente">
        <NuevoClienteForm
          variant="compact"
          embeddedInModal
          onCreated={() => setOpen(false)}
        />
      </CenteredFormModal>
    </>
  );
}
