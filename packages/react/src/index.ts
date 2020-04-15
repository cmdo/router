import * as React from "react";
import { router, Route } from "router";


const { useState, useEffect } = React;

/**
 * Sets up a route listener.
 *
 * @param preload - Preload function run before initial route is executed.
 * @param onError - Error handler function.
 *
 * @returns react view
 */
export function useRouter(preload: () => Promise<void>, onError: (err: any) => JSX.Element | undefined): JSX.Element | null {
  const [view, setView] = useState<JSX.Element | null>(null);

  useEffect(() => {
    const { pathname, search, state } = router.history.location;
    preload().then(() => {
      router.listen({
        render: async (route: Route) => {
          let props: any = {};
          if (route.before) {
            props = await route.before();
          }
          setView(createReactElement([...route.components], props));
          if (route.after) {
            route.after();
          }
        },
        error: (err: any) => {
          const component = onError(err);
          if (component) {
            setView(component);
          }
        }
      });
      router.goTo(`${pathname}${search}`, state);
    });
  }, [preload, onError]);

  return view;
}

/*
 |--------------------------------------------------------------------------------
 | Utilities
 |--------------------------------------------------------------------------------
 */

/**
 * Get a compiled react element from a possible multiple route components.
 *
 * @param list - List of route components to compile.
 * @param props - The root properties to pass down.
 *
 * @returns react element
 */
function createReactElement(list: any[], props: any = {}): any {
  const Component = list.shift();
  if (list.length > 0) {
    return React.createElement(Component, props, createReactElement(list, props));
  }
  return React.createElement(Component, props);
}
