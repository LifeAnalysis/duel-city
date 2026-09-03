import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
} from "react-router-dom";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Navigate to="/world" replace />,
  },
  {
    path: "/world",
    lazy: () => import("./Plaza"),
  },
  {
    path: "/world/replay",
    lazy: () => import("./Duel/Main"),
  },
  {
    lazy: () => import("./Layout"),
    children: [
      {
        path: "/legacy-start",
        lazy: () => import("./Start"),
      },
      {
        path: "/match/*",
        lazy: () => import("./Match"),
      },
      {
        path: "/build",
        lazy: () => import("./BuildDeck"),
      },
      {
        path: "/waitroom",
        lazy: () => import("./WaitRoom"),
      },
      {
        path: "/duel",
        lazy: () => import("./Duel/Main"),
      },
      {
        path: "/side",
        lazy: () => import("./Side"),
      },
    ],
  },
  {
    path: "*",
    element: <Navigate to="/world" replace />,
  },
]);

export const NeosRouter = () => <RouterProvider router={router} />;
