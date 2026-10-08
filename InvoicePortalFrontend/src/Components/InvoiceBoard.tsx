import {
  Eye,
} from "lucide-react";

import {
  useNavigate,
} from "react-router-dom";

import type {
  Invoice,
  InvoiceStatusCode,
} from "../services/facturasService";

interface Props {
  invoices:
    Invoice[];

  loading:
    boolean;
}

const getStatusClass = (
  status:
    InvoiceStatusCode,
) => {
  switch (status) {
    case "PENDIENTE":
      return "bg-amber-50 text-amber-700";

    case "APROBADA":
      return "bg-emerald-50 text-emerald-700";

    case "RECHAZADA":
      return "bg-red-50 text-red-700";

    case "REMITIDA":
      return "bg-blue-50 text-blue-700";

    case "PROCESADA":
      return "bg-violet-50 text-violet-700";
  }
};

const InvoiceBoard = ({
  invoices,
  loading,
}: Props) => {
  const navigate =
    useNavigate();

  if (loading) {
    return (
      <section
        className="
          mt-6
          flex
          min-h-64
          items-center
          justify-center
          rounded-2xl
          border
          border-slate-200
          bg-white
        "
      >
        <p className="text-sm text-slate-500">
          Cargando facturas...
        </p>
      </section>
    );
  }

  return (
    <section
      className="
        mt-6
        overflow-hidden
        rounded-2xl
        border
        border-slate-200
        bg-white
        p-5
        shadow-sm
      "
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-225">
          <thead>
            <tr className="bg-[#F6F9FA]">
              {[
                "Estado",
                "Factura",
                "Proveedor",
                "Correo",
                "Fecha",
                "Acción",
              ].map(
                (title) => (
                  <th
                    key={
                      title
                    }
                    className="
                      px-4
                      py-3
                      text-left
                      text-[10px]
                      font-bold
                      uppercase
                      text-slate-500
                    "
                  >
                    {title}
                  </th>
                ),
              )}
            </tr>
          </thead>

          <tbody>
            {invoices.map(
              (invoice) => (
                <tr
                  key={
                    invoice.id
                  }
                  className="
                    border-b
                    border-slate-100
                    hover:bg-slate-50
                  "
                >
                  <td className="px-4 py-4">
                    <span
                      className={`
                        rounded-full
                        px-2.5
                        py-1
                        text-[10px]
                        font-semibold

                        ${getStatusClass(
                          invoice.estadoCodigo,
                        )}
                      `}
                    >
                      {
                        invoice.estado
                      }
                    </span>
                  </td>

                  <td className="px-4 py-4">
                    <p
                      className="
                        text-xs
                        font-bold
                        text-[#00739B]
                      "
                    >
                      {invoice.numeroFactura ??
                        "Sin número"}
                    </p>
                  </td>

                  <td className="px-4 py-4">
                    <p className="text-xs font-bold text-slate-800">
                      {
                        invoice.proveedor
                      }
                    </p>

                    <p className="mt-1 text-[10px] text-slate-400">
                      {invoice.nit
                        ? `NIT ${invoice.nit}`
                        : "Sin NIT"}
                    </p>
                  </td>

                  <td className="px-4 py-4 text-[11px] text-slate-500">
                    {invoice.correo ??
                      "No disponible"}
                  </td>

                  <td className="px-4 py-4 text-[11px] text-slate-500">
                    {invoice.fechaRecepcion
                      ? new Date(
                          invoice.fechaRecepcion,
                        ).toLocaleDateString(
                          "es-CO",
                        )
                      : "-"}
                  </td>

                  <td className="px-4 py-4">
                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          `/facturas/${invoice.id}`,
                        )
                      }
                      className="
                        inline-flex
                        h-9
                        items-center
                        gap-2
                        rounded-xl
                        border
                        border-[#13A7C7]
                        bg-[#F2FBFD]
                        px-3
                        text-[11px]
                        font-semibold
                        text-[#00739B]

                        hover:bg-[#DFF6FA]
                      "
                    >
                      <Eye
                        size={14}
                      />

                      Ver detalle
                    </button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>

        {invoices.length ===
          0 && (
          <div
            className="
              flex
              min-h-52
              items-center
              justify-center
              text-sm
              text-slate-400
            "
          >
            No hay facturas que
            coincidan con los filtros.
          </div>
        )}
      </div>
    </section>
  );
};

export default InvoiceBoard;