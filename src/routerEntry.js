import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import DefaultErrorComponent from "./router";

export function getRouter() {
  const router = createRouter({
    routeTree,
    context: {},
    defaultErrorComponent: DefaultErrorComponent,
  });

  return router;
}