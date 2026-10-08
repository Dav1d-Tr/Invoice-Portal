import {
  Navigate,
  Outlet,
} from "react-router-dom";

import {
  getStoredArea,
  getToken,
} from "../services/authService";

const ProtectedRoute = () => {
  const token =
    getToken();

  const area =
    getStoredArea();

  if (
    !token ||
    !area
  ) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  return <Outlet />;
};

export default ProtectedRoute;