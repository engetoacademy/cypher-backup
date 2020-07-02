import {CypherListener} from "./opencypher/CypherListener";
import {OC_ParameterContext} from "./opencypher/CypherParser";
import {QueryTemplate} from "./QueryTemplate";
import {TerminalNode} from "antlr4ts/tree/TerminalNode";

export interface ParameterOccurrence {
    key: string,
    start: number,
    stop: number
}

export class Listener implements CypherListener {
    parameterOccurrences: ParameterOccurrence[] = [];

    constructor(public source: string) {
    }

    exitOC_Parameter = (ctx: OC_ParameterContext) => {
        const paramNameToken = ctx.oC_SymbolicName()!;
        let paramName;
        if (paramNameToken.UnescapedSymbolicName()) {
            paramName = paramNameToken.text;
        } else if (paramNameToken.EscapedSymbolicName()) {
            paramName = paramNameToken.text.slice(1,-1);
        } else {
            throw new Error("Cannot handle parameter "+paramNameToken.text);
        }


        const start = ctx.start.startIndex;
        const stop = ctx.stop!.stopIndex;

        this.parameterOccurrences.push({key: paramName, start, stop});
    }

    makeTemplate = () => {
        return QueryTemplate(this.source, this.parameterOccurrences);
    }

    /**
     * This is only to make TypeScript error go away:
     * Error: TS2559: Type 'Listener' has no properties in common with type 'ParseTreeListener'.
     */
    visitTerminal?: (node: TerminalNode) => void;
}