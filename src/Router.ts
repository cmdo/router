import { History, Location, UnregisterCallback } from "history";

import { Route } from "./Route";
import { Query } from "./Query";
import { ValueStore } from "./ValueStore";

export class Router {
  public readonly history: History;

  public routes: Route[] = [];
  public query: Query;
  public params: ValueStore;
  public state: ValueStore;
  public route?: Route;
  public location?: Location;
  public unregister?: UnregisterCallback;

  /**
   * Creates a new Router instance.
   *
   * @param history - History module instance.
   */
  constructor(history: History) {
    this.history = history;
    this.query = new Query(history);
    this.params = new ValueStore();
    this.state = new ValueStore();
  }

  /**
   * Start listening to transition requests.
   *
   * @param handler - Route handler function.
   */
  public listen(handler: Handler) {
    if (this.unregister) {
      this.unregister();
    }
    this.unregister = this.history.listen(async (location: Location) => {
      const result = this.get(location.pathname);
      if (result) {
        const route = result.route;
        const state = new ValueStore(location.state);
        const query = new Query(this.history, location.search);
        const params = getParams(result);

        // ### Policies
        // If policies has been defined, validate each policy before assigning
        // and routing the request.

        for (const policy of route.policies) {
          try {
            await policy({ route, query, params, state });
          } catch (err) {
            return handler.error(err);
          }
        }

        // ### Update Router
        // Set the new location, query, params, and route to the router.

        this.route = route;
        this.location = location; // store the current location
        this.state = state;
        this.query = query;
        this.params = params;

        // ### Render
        // Execute the defined render handler.

        try {
          await handler.render(route, location);
        } catch (err) {
          handler.error(err);
        }
      } else {
        handler.error({
          status: 404,
          code: "ROUTE_NOT_FOUND",
          message: "Route does not exist, or has been moved to another location."
        });
      }
    });
  }

  /**
   * Redirect the client to the provided pathname/link.
   *
   * @param path - Path to route to.
   * @param state - State to deliver with the route.
   */
  public goTo(path: string, state: any = {}) {
    this.history.push(path, state);
  }

  /**
   * Registers provided routes with the router.
   *
   * @param routes - List of routes to register with the router.
   */
  public register(routes: Route[]) {
    for (const route of routes) {
      this.routes.push(route);
    }
  }

  /**
   * Returns a route that validates against the given path.
   *
   * @param path - Routing path to return.
   *
   * @returns route or undefined
   */
  public get(path: string): RouteResult | undefined {
    for (const route of this.routes) {
      const match: boolean = route.match(path);
      if (match) {
        return {
          route,
          match
        };
      }
    }
    return undefined;
  }
}

/*
 |--------------------------------------------------------------------------------
 | Helper Functions
 |--------------------------------------------------------------------------------
 */

/**
 * Retrieve routing parameters from the provided route result container.
 *
 * @param container - Route result container.
 *
 * @returns route parameters
 */
function getParams(container: RouteResult): ValueStore {
  const params = container.route.params;
  const result: any = {};
  let index = 1;
  for (const param of params) {
    result[param.name] = container.match[index];
    index += 1;
  }
  return new ValueStore(result);
}

/*
 |--------------------------------------------------------------------------------
 | TypeScript Definitions
 |--------------------------------------------------------------------------------
 */

type Handler = {
  /**
   * Preload any required entities before a route, and its potential policies
   * are executed.
   *
   * @returns preload data that can be utilized by subsequent policies
   */
  preload?(data: { route: Route; query: Query; params: ValueStore; state: ValueStore }): Promise<any>;

  /**
   * Render routed view template and component.
   *
   * @param route - Route to render.
   * @param location - Current history location.
   */
  render(route: Route, location: Location, forced?: boolean): void;

  /**
   * Handles an error that occurs during a routing request.
   *
   * @param error - Error reported during invalid routing.
   */
  error(error: any): void;
};

type RouteResult = {
  route: Route;
  match: any;
};
