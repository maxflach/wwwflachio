import { useEffect, useState } from "react";
import Home from "./Home";
import NotFound from "./NotFound";
import { printDevtoolsBanner } from "./devtools";

function currentPath() {
  if (typeof window === "undefined") return "/";
  return window.location.pathname;
}

function App() {
  const [path, setPath] = useState(currentPath());

  useEffect(() => {
    printDevtoolsBanner();
  }, []);

  useEffect(() => {
    function onPop() { setPath(currentPath()); }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  if (path === "/" || path === "") return <Home />;
  return <NotFound />;
}

export default App;
