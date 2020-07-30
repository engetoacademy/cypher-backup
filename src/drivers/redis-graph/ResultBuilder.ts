import {RedisGraphValue} from "./QueryTemplate"
import {Redis} from "../redis";

// inspired by https://github.com/RedisGraph/RedisGraph/blob/be483c0738dd8604f169a70dfe4d56071ef19568/src/resultset/formatters/resultset_replycompact.c#L104
type RedisGraphOutputNode = [
    number, // Node ID (integer)
    number[], // Label string indicies
    RedisGraphProperty[]
];

// inspired by https://github.com/RedisGraph/RedisGraph/blob/be483c0738dd8604f169a70dfe4d56071ef19568/src/resultset/formatters/resultset_replycompact.c#L135
type RedisGraphOutputRelation = [
    number, // Relationship ID (integer)
    number, // Relationship type string index (integer)
    number, // Source node ID
    number, // Destination node ID
    RedisGraphProperty[]
];

type RedisGraphProperty = [
    number, // property key string index
    ValueTypeCode,
    RedisGraphValue
]

// inspired by https://github.com/RedisGraph/RedisGraph/blob/be483c0738dd8604f169a70dfe4d56071ef19568/src/resultset/formatters/resultset_formatter.h#L21
enum ValueTypeCode {
    VALUE_UNKNOWN = 0,
    VALUE_NULL = 1,
    VALUE_STRING = 2,
    VALUE_INTEGER = 3,
    VALUE_BOOLEAN = 4,
    VALUE_DOUBLE = 5,
    VALUE_ARRAY = 6,
    VALUE_EDGE = 7,
    VALUE_NODE = 8,
    VALUE_PATH = 9
}

interface RGNode {
    id: number;
    properties: object;
    labels: string[];
}

type RGRelation = {
    dest_node: number;
    src_node: number;
    id: number;
    type: string;
    properties: { [key: string]: RedisGraphValue }
};

export class ResultBuilder {
    labels: string[] = [];
    relationshipTypes: string[] = [];
    propertyKeys: string[] = [];

    constructor(private redis: Redis) {
    }

    getLabel = async (id: number) => {
        if (this.labels[id]) {
            return this.labels[id];
        }
        const [_, labelResponse] = await this.redis.sendCommand<[string,string[]]>("GRAPH.QUERY", ["portal-graph", "CALL db.labels()"])

        this.labels = labelResponse.map(([label]) => label);
        return this.labels[id];
    };

    getRelationshipType = async (id: number) => {
        if (this.relationshipTypes[id]) {
            return this.relationshipTypes[id];
        }
        const [_, typeResponse] = await this.redis.sendCommand<[string,string[]]>("GRAPH.QUERY", ["portal-graph", "CALL db.relationshipTypes()"])

        this.relationshipTypes = typeResponse.map(([type]) => type);
        return this.relationshipTypes[id];
    };

    getPropertyKey = async (id: number) => {
        if (this.propertyKeys[id]) {
            return this.propertyKeys[id];
        }
        const [_, keysResponse] = await this.redis.sendCommand<[string,string[]]>("GRAPH.QUERY", ["portal-graph", "CALL db.propertyKeys()"])

        this.propertyKeys = keysResponse.map(([key]) => key);
        return this.propertyKeys[id];

    };

    convertProperties = async (srcProperties: [number, number, any][]): Promise<{ [key: string]: RedisGraphValue }> => {
        const properties: { [key: string]: RedisGraphValue } = {};
        for (let [keyStringIndex, type, srcValue] of srcProperties) {
            const key = await this.getPropertyKey(keyStringIndex);
            properties[key] = await this.convertValue([type, srcValue]) as RedisGraphValue;
        }
        return properties
    };

    convertNode = async (
        [
            id,
            labelStringIds,
            srcProperties
        ]: RedisGraphOutputNode
    ): Promise<RGNode> => ({
        id,
        labels: await Promise.all(labelStringIds.map(this.getLabel)),
        properties: await this.convertProperties(srcProperties)
    });

    convertRelation = async <TProperties extends object = object>(
        [
            id,
            typeStringId,
            sourceId,
            destinationId,
            properties
        ]: RedisGraphOutputRelation
    ): Promise<RGRelation> => ({
        id,
        type: await this.getRelationshipType(typeStringId),
        src_node: sourceId,
        dest_node: destinationId,
        properties: await this.convertProperties(properties)
    });

    convertValue = async ([typeCode, sourceValue]: [ValueTypeCode, any]): Promise<RedisGraphValue | RGNode | RGRelation> => {
        switch (typeCode) {
            case ValueTypeCode.VALUE_UNKNOWN:
                throw new Error("Unknown type of record value");
            case ValueTypeCode.VALUE_NULL:
                return null;
            case ValueTypeCode.VALUE_STRING:
                return sourceValue;
            case ValueTypeCode.VALUE_INTEGER:
                return sourceValue;
            case ValueTypeCode.VALUE_BOOLEAN:
                return JSON.parse(sourceValue)
            case ValueTypeCode.VALUE_DOUBLE:
                return JSON.parse(sourceValue)
            case ValueTypeCode.VALUE_ARRAY:
                const result: any[] = [];
                for (const value of sourceValue) {
                    result.push(await this.convertValue(value));
                }
                return result;
            case ValueTypeCode.VALUE_EDGE:
                return await this.convertRelation(sourceValue);
            case ValueTypeCode.VALUE_NODE:
                return await this.convertNode(sourceValue)
            case ValueTypeCode.VALUE_PATH:
                throw new Error("Paths values are unsupported");
        }
    };
}