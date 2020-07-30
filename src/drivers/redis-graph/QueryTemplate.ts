import {ANTLRInputStream, CommonTokenStream} from "antlr4ts";
import {CypherLexer} from "./opencypher/CypherLexer";
import {CypherParser} from "./opencypher/CypherParser";
import {Listener, ParameterOccurrence} from "./ParseListener";

class SyntaxError extends Error {
}

export type RedisGraphValue = string | number | boolean | null | RedisGraphValue[];
export const QueryTemplate = (
    source: string, parameterOccurrences: ParameterOccurrence[]
) => (
    params: { [param: string]: RedisGraphValue }
) => {
    function verifyValuesArePresent() {
        let missingKeys = new Set();
        for (let o of parameterOccurrences) {
            if (o.key in params) {
                continue;
            }

            missingKeys.add(o.key);
        }
        if (missingKeys.size > 0) {
            throw new Error(`Not all query parameters have values (missing ${Array.from(missingKeys).join(',')})`);
        }
    }

    function applyParam(source: string, o: ParameterOccurrence): string {
        const value = params[o.key] ?? null;

        const valueRepr = JSON.stringify(value);

        return source.slice(0, o.start) + valueRepr + source.slice(o.stop + 1);
    }

    verifyValuesArePresent();

    const o = [...parameterOccurrences].sort(((a, b) => b.start - a.start));

    return o.reduce(applyParam, source)
}

export function parametrize(statement) {
    const input = new ANTLRInputStream(statement);
    const lexer = new CypherLexer(input);
    const tokenStream = new CommonTokenStream(lexer);
    const parser = new CypherParser(tokenStream);
    const listener = new Listener(statement);

    parser.addParseListener(listener);

    const errors: string[] = [];
    parser.removeErrorListeners();
    parser.addErrorListener({
        syntaxError: (recognizer, offendingSymbol, line, charPositionInLine, msg) => {
            if (offendingSymbol) {
                errors.push(`Unexpected '${offendingSymbol.text}' at line ${line}, pos ${charPositionInLine}`)
            } else {
                errors.push(`line ${line}, pos ${charPositionInLine}: ${msg}`)
            }
        }
    })

    parser.oC_Cypher();

    if (errors.length > 0) {
        const error = errors[0];
        throw new SyntaxError(error);
    }

    const template = listener.makeTemplate();
    return template;
}