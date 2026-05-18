import { useContext } from "react";

import { TypaiCoreContext } from "./TypaiProvider";
import type { TypaiCoreContextValue } from "./types";

export function useTypaiCore(): TypaiCoreContextValue {
  return useContext(TypaiCoreContext);
}
