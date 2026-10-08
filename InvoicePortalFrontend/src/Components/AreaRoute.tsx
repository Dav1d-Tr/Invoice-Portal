import {
  Navigate,
  Outlet,
} from "react-router-dom";

import {
  getStoredArea,
} from "../services/authService";

import {
  normalizeAreaName,
} from "../utils/areaPermissions";

interface AreaRouteProps {
  allowedAreas: string[];
}

const AreaRoute = ({
  allowedAreas,
}: AreaRouteProps) => {
  const currentArea =
    getStoredArea();

  if (!currentArea) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  const current =
    normalizeAreaName(
      currentArea.nombre,
    );

  const allowed =
    allowedAreas.map(
      normalizeAreaName,
    );

  if (
    !allowed.includes(
      current,
    )
  ) {
    return (
      <Navigate
        to="/facturas"
        replace
      />
    );
  }

  return <Outlet />;
};

export default AreaRoute;