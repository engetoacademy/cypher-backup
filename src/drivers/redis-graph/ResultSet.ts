import {RedisGraphInputType} from "./QueryTemplate";

type RedisGraphOutputNode = [
    ["id", number],
    ["labels", string[]],
    ["properties", [string, string][]]
];

type RedisGraphOutputRelation = [
    ["id", number],
    ["type", string[]],
    ["src_node", number],
    ["dest_node", number],
    ["properties", [string, string][]]
]

export type RedisGraphOutputType =
    string // JSON representation of a list or a scalar
    | RedisGraphOutputNode
    | RedisGraphOutputRelation
    ;

function convertProperties(srcProperties: [string, string][]): object {
    const properties: {[key:string]: any} = {};
    for (let [key, value] of srcProperties) {
        properties[key] = value;
    }
    return properties
}

interface RGNode {
    id: number;
    properties: object;
    labels: string[];
}

export function convertNode<TProperties extends object = object>(
    [
        [_, id], [$, labels], [__, srcProperties]
    ]: RedisGraphOutputNode
): RGNode {
    return {
        id,
        labels,
        properties: convertProperties(srcProperties)
    }
}

type RGRelation = { dest_node: number; src_node: number; id: number; type: string[]; properties: object };

export function convertRelation<TProperties extends object = object>(
    [
        [_, id],
        [$, type],
        [__, src_node],
        [_$, dest_node],
        [$_, srcProperties]
    ]: RedisGraphOutputRelation
): RGRelation {
    return {
        id,
        type,
        src_node,
        dest_node,
        properties: convertProperties(srcProperties)
    }
}

export function convertRecordValue(sourceValue: RedisGraphOutputType):
    RedisGraphInputType | RGNode | RGRelation {
    if (sourceValue === "false") {
        return false;
    } else if (typeof sourceValue === "string" || typeof sourceValue === "number") {
        return sourceValue;
    } else if (sourceValue.length === 3) { // node
        return convertNode(sourceValue);
    } else if (sourceValue.length === 5) { // relation
        return convertRelation(sourceValue);
    } else {
        throw new Error("Unknown type of record value - not a string, number, node, or relation")
    }
}