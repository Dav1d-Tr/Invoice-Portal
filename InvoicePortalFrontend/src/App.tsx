import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import Login from "./Pages/Login";
import Home from "./Pages/Home";
import Remitidos from "./Pages/Remitidos";
import Rechazadas from "./Pages/Rechazadas";
import Historial from "./Pages/Historial";
import HistorialProcesadas from "./Pages/HistorialProcesadas";
import Configuracion from "./Pages/Configuracion";
import FacturaDetalle from "./Pages/FacturaDetalle";
import Usuarios from "./Pages/Usuarios";

import AppLayout from "./Layout/AppLayout";

import ProtectedRoute from "./Components/ProtectedRoute";
import AreaRoute from "./Components/AreaRoute";

/* =========================================================
   PLACEHOLDER
========================================================= */

const PlaceholderPage = ({
  title,
}: {
  title: string;
}) => {
  return (
    <section>
      <h1 className="text-2xl font-bold text-slate-800">
        {title}
      </h1>

      <p className="mt-2 text-sm text-slate-500">
        Esta sección estará disponible próximamente.
      </p>
    </section>
  );
};

/* =========================================================
   APP
========================================================= */

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* LOGIN */}

        <Route
          path="/login"
          element={<Login />}
        />

        {/* RAIZ */}

        <Route
          path="/"
          element={
            <Navigate
              to="/facturas"
              replace
            />
          }
        />

        {/* RUTAS AUTENTICADAS */}

        <Route
          element={
            <ProtectedRoute />
          }
        >
          <Route
            element={
              <AppLayout />
            }
          >
            {/* FACTURAS */}

            <Route
              path="/facturas"
              element={<Home />}
            />

            <Route
              path="/facturas/:id"
              element={<FacturaDetalle />}
            />

            {/* REMITIDOS - TODAS LAS AREAS */}

            <Route
              path="/remitidos"
              element={<Remitidos />}
            />

            {/* APROBADAS */}

            <Route
              path="/aprobadas"
              element={
                <PlaceholderPage
                  title="Facturas aprobadas"
                />
              }
            />

            {/* RECHAZADAS */}

            <Route
              path="/rechazadas"
              element={<Rechazadas />}
            />

            {/* HISTORIAL DE REMISIONES */}

            <Route
              path="/historial"
              element={<Historial />}
            />

            {/* SOLO CONTABILIDAD */}

            <Route
              element={
                <AreaRoute
                  allowedAreas={[
                    "CONTABILIDAD",
                  ]}
                />
              }
            >
              <Route
                path="/historial-procesadas"
                element={<HistorialProcesadas />}
              />
            </Route>

            {/* SOLO SISTEMAS */}

            <Route
              element={
                <AreaRoute
                  allowedAreas={[
                    "SISTEMAS",
                  ]}
                />
              }
            >
              <Route
                path="/configuracion"
                element={<Configuracion />}
              />

              <Route
                path="/usuarios"
                element={<Usuarios />}
              />
            </Route>
          </Route>
        </Route>

        {/* 404 */}

        <Route
          path="*"
          element={
            <Navigate
              to="/facturas"
              replace
            />
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
