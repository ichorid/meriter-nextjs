import { createContext } from "react";

export const ProjectContext = createContext({
    project: "unknown",
    dispatcher: undefined,
    currentOffer: undefined,
    setCurrentOffer: undefined,
});
