import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ExternalLink,
  FileText,
  LoaderCircle,
  Mail,
  Paperclip,
  RefreshCw,
  Search,
} from "lucide-react";

import {
  getCommercialOutlookInvoices,
} from "../services/outlookService";

import type {
  OutlookInvoiceEmail,
} from "../services/outlookService";

const OutlookInvoiceBoard = () => {
  const [
    emails,
    setEmails,
  ] =
    useState<
      OutlookInvoiceEmail[]
    >([]);

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  /* =======================================================
     CARGAR OUTLOOK
  ======================================================= */

  const loadEmails =
    useCallback(
      async () => {
        try {
          setLoading(true);

          setError(null);

          const data =
            await getCommercialOutlookInvoices();

          setEmails(data);
        } catch (error) {
          console.error(
            "Error cargando Outlook:",
            error,
          );

          setError(
            error instanceof Error
              ? error.message
              : "No fue posible consultar Outlook.",
          );
        } finally {
          setLoading(false);
        }
      },
      [],
    );

  useEffect(() => {
    void loadEmails();
  }, [loadEmails]);

  /* =======================================================
     FILTRO LOCAL
  ======================================================= */

  const filteredEmails =
    useMemo(() => {
      const value =
        search
          .trim()
          .toLocaleLowerCase(
            "es-CO",
          );

      if (!value) {
        return emails;
      }

      return emails.filter(
        (email) => {
          const searchable =
            [
              email.provider,
              email.subject,
              email.fromName,
              email.fromEmail,
              email.bodyPreview,
            ]
              .join(" ")
              .toLocaleLowerCase(
                "es-CO",
              );

          return searchable.includes(
            value,
          );
        },
      );
    }, [
      emails,
      search,
    ]);

  /* =======================================================
     FECHA
  ======================================================= */

  const formatDate = (
    value: string,
  ) => {
    if (!value) {
      return "-";
    }

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime(),
      )
    ) {
      return value;
    }

    return new Intl.DateTimeFormat(
      "es-CO",
      {
        timeZone:
          "America/Bogota",

        day: "2-digit",
        month: "short",
        year: "numeric",

        hour: "2-digit",
        minute: "2-digit",
      },
    ).format(date);
  };

  /* =======================================================
     LOADING
  ======================================================= */

  if (
    loading &&
    emails.length === 0
  ) {
    return (
      <section
        className="
          mt-6
          flex
          min-h-60
          items-center
          justify-center
          rounded-2xl
          border
          border-slate-200
          bg-white
          shadow-sm
        "
      >
        <div
          className="
            flex
            flex-col
            items-center
            gap-3
            text-slate-500
          "
        >
          <LoaderCircle
            size={28}
            className="
              animate-spin
              text-[#0780A5]
            "
            aria-hidden="true"
          />

          <p className="text-sm">
            Consultando Outlook...
          </p>

          <p
            className="
              text-xs
              text-slate-400
            "
          >
            Buscando CAMACOL e ISI
            EMERGING
          </p>
        </div>
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
        shadow-sm
      "
      aria-labelledby="outlook-invoices-title"
    >
      {/* ===================================================
          HEADER
      ==================================================== */}

      <header
        className="
          flex
          flex-col
          gap-4
          border-b
          border-slate-200
          px-5
          py-5

          lg:flex-row
          lg:items-center
          lg:justify-between
        "
      >
        <div>
          <div
            className="
              flex
              items-center
              gap-2
            "
          >
            <Mail
              size={19}
              className="text-[#0780A5]"
              aria-hidden="true"
            />

            <h2
              id="outlook-invoices-title"
              className="
                text-base
                font-bold
                text-slate-800
              "
            >
              Facturas desde Outlook
            </h2>
          </div>

          <p
            className="
              mt-1
              text-xs
              text-slate-500
            "
          >
            Correos de CAMACOL e ISI
            EMERGING recibidos desde
            el 1 de enero.
          </p>
        </div>

        <div
          className="
            flex
            items-center
            gap-3
          "
        >
          <span
            className="
              rounded-full
              bg-[#DFF6FA]
              px-3
              py-1.5
              text-xs
              font-semibold
              text-[#00739B]
            "
          >
            {emails.length} correos
          </span>

          <button
            type="button"
            onClick={() =>
              void loadEmails()
            }
            disabled={loading}
            className="
              flex
              h-9
              items-center
              gap-2
              rounded-xl
              border
              border-slate-200
              bg-white
              px-3
              text-xs
              font-semibold
              text-slate-600
              transition

              hover:border-[#13A7C7]
              hover:text-[#00739B]

              disabled:cursor-not-allowed
              disabled:opacity-50
            "
          >
            <RefreshCw
              size={14}
              className={
                loading
                  ? "animate-spin"
                  : ""
              }
              aria-hidden="true"
            />

            Actualizar
          </button>
        </div>
      </header>

      {/* ===================================================
          ERROR
      ==================================================== */}

      {error && (
        <div
          role="alert"
          className="
            m-5
            rounded-xl
            border
            border-red-200
            bg-red-50
            px-4
            py-3
            text-sm
            text-red-700
          "
        >
          <strong>
            No fue posible consultar
            Outlook.
          </strong>

          <p className="mt-1 text-xs">
            {error}
          </p>
        </div>
      )}

      {/* ===================================================
          BUSCADOR
      ==================================================== */}

      <div
        className="
          border-b
          border-slate-100
          p-4
        "
      >
        <div
          className="
            relative
            max-w-xl
          "
        >
          <Search
            size={17}
            aria-hidden="true"
            className="
              pointer-events-none
              absolute
              left-3
              top-1/2
              -translate-y-1/2
              text-slate-400
            "
          />

          <input
            type="search"
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value,
              )
            }
            placeholder="Buscar proveedor, remitente o asunto..."
            className="
              h-10
              w-full
              rounded-xl
              border
              border-slate-200
              bg-[#F8FBFC]
              pl-10
              pr-4
              text-xs
              outline-none
              transition

              focus:border-[#13A7C7]
              focus:ring-2
              focus:ring-[#13A7C7]/15
            "
          />
        </div>
      </div>

      {/* ===================================================
          TABLA
      ==================================================== */}

      <div
        className="
          overflow-x-auto
          p-4
          pt-2
        "
      >
        <table
          className="
            w-full
            min-w-275
            border-collapse
          "
        >
          <caption className="sr-only">
            Correos de facturas
            electrónicas recibidos
            desde Outlook
          </caption>

          <thead>
            <tr
              className="
                bg-[#F6F9FA]
                text-[11px]
                uppercase
                text-slate-500
              "
            >
              <th
                scope="col"
                className="
                  rounded-l-xl
                  px-4
                  py-3
                  text-left
                  font-bold
                "
              >
                Proveedor
              </th>

              <th
                scope="col"
                className="
                  px-4
                  py-3
                  text-left
                  font-bold
                "
              >
                Asunto
              </th>

              <th
                scope="col"
                className="
                  px-4
                  py-3
                  text-left
                  font-bold
                "
              >
                Remitente
              </th>

              <th
                scope="col"
                className="
                  px-4
                  py-3
                  text-left
                  font-bold
                "
              >
                Fecha
              </th>

              <th
                scope="col"
                className="
                  px-4
                  py-3
                  text-center
                  font-bold
                "
              >
                Adjuntos
              </th>

              <th
                scope="col"
                className="
                  rounded-r-xl
                  px-4
                  py-3
                  text-left
                  font-bold
                "
              >
                Acción
              </th>
            </tr>
          </thead>

          <tbody>
            {filteredEmails.map(
              (email) => (
                <tr
                  key={email.id}
                  className="
                    border-b
                    border-slate-100
                    transition
                    last:border-0
                    hover:bg-slate-50/70
                  "
                >
                  {/* PROVEEDOR */}

                  <td
                    className="
                      px-4
                      py-4
                    "
                  >
                    <span
                      className="
                        inline-flex
                        rounded-full
                        bg-[#DFF6FA]
                        px-3
                        py-1.5
                        text-[11px]
                        font-bold
                        text-[#00739B]
                      "
                    >
                      {email.provider}
                    </span>
                  </td>

                  {/* ASUNTO */}

                  <td
                    className="
                      max-w-md
                      px-4
                      py-4
                    "
                  >
                    <div
                      className="
                        flex
                        items-start
                        gap-2
                      "
                    >
                      <FileText
                        size={15}
                        className="
                          mt-0.5
                          shrink-0
                          text-slate-400
                        "
                        aria-hidden="true"
                      />

                      <div
                        className="
                          min-w-0
                        "
                      >
                        <p
                          className="
                            truncate
                            text-xs
                            font-semibold
                            text-slate-800
                          "
                          title={
                            email.subject
                          }
                        >
                          {
                            email.subject
                          }
                        </p>

                        <p
                          className="
                            mt-1
                            line-clamp-1
                            text-[10px]
                            text-slate-400
                          "
                        >
                          {
                            email.bodyPreview
                          }
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* REMITENTE */}

                  <td
                    className="
                      px-4
                      py-4
                    "
                  >
                    <p
                      className="
                        text-xs
                        font-semibold
                        text-slate-700
                      "
                    >
                      {email.fromName}
                    </p>

                    <p
                      className="
                        mt-1
                        text-[10px]
                        text-slate-400
                      "
                    >
                      {email.fromEmail}
                    </p>
                  </td>

                  {/* FECHA */}

                  <td
                    className="
                      whitespace-nowrap
                      px-4
                      py-4
                      text-[11px]
                      text-slate-500
                    "
                  >
                    {formatDate(
                      email.receivedDateTime,
                    )}
                  </td>

                  {/* ADJUNTOS */}

                  <td
                    className="
                      px-4
                      py-4
                      text-center
                    "
                  >
                    {email.hasAttachments ? (
                      <span
                        className="
                          inline-flex
                          items-center
                          gap-1
                          rounded-lg
                          bg-emerald-50
                          px-2
                          py-1
                          text-[10px]
                          font-semibold
                          text-emerald-700
                        "
                      >
                        <Paperclip
                          size={12}
                          aria-hidden="true"
                        />

                        Sí
                      </span>
                    ) : (
                      <span
                        className="
                          text-[10px]
                          text-slate-400
                        "
                      >
                        No
                      </span>
                    )}
                  </td>

                  {/* ACCIÓN */}

                  <td
                    className="
                      px-4
                      py-4
                    "
                  >
                    {email.webLink ? (
                      <a
                        href={
                          email.webLink
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="
                          inline-flex
                          h-8
                          items-center
                          gap-1.5
                          rounded-xl
                          border
                          border-[#13A7C7]
                          bg-[#F2FBFD]
                          px-3
                          text-[10px]
                          font-semibold
                          text-[#00739B]
                          transition

                          hover:bg-[#DFF6FA]
                        "
                      >
                        <ExternalLink
                          size={13}
                          aria-hidden="true"
                        />

                        Abrir correo
                      </a>
                    ) : (
                      <span
                        className="
                          text-[10px]
                          text-slate-400
                        "
                      >
                        Sin enlace
                      </span>
                    )}
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>

        {/* ESTADO VACÍO */}

        {!loading &&
          !error &&
          filteredEmails.length ===
            0 && (
            <div
              className="
                flex
                min-h-56
                flex-col
                items-center
                justify-center
                text-center
              "
            >
              <Mail
                size={32}
                className="
                  mb-3
                  text-slate-300
                "
                aria-hidden="true"
              />

              <p
                className="
                  text-sm
                  font-semibold
                  text-slate-600
                "
              >
                No encontramos correos
              </p>

              <p
                className="
                  mt-1
                  text-xs
                  text-slate-400
                "
              >
                No existen resultados
                para CAMACOL o ISI
                EMERGING con los filtros
                actuales.
              </p>
            </div>
          )}
      </div>
    </section>
  );
};

export default OutlookInvoiceBoard;