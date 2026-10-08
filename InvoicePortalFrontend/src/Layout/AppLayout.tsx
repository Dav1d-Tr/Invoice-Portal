import {
  Outlet,
} from "react-router-dom";

import Sidebar from "./Sidebar";

const AppLayout = () => {
  return (
    <div
      className="
        flex
        h-screen
        overflow-hidden
        bg-[#F7F9FB]
      "
    >
      <Sidebar />

      <main
        id="main-content"
        tabIndex={-1}
        className="
          h-full
          min-w-0
          flex-1
          overflow-y-auto
          p-8
          font-philosopher
        "
      >
        <Outlet />
      </main>
    </div>
  );
};

export default AppLayout;