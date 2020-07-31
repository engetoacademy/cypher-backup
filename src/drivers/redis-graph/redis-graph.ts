import {parametrize, QueryTemplate, RedisGraphValue} from "./QueryTemplate";
import {Redis} from "../redis";
import {ResultBuilder} from "./ResultBuilder";
import {RedisGraphConfigRecord} from "../../config";
import {log} from "util";
import {Driver} from "../IDriver";
import {makeSafePropName, makeSafeType} from "../../util/sanitize";


type RedisGraphResponse<T extends object> = [
    [1, keyof T][],
    any[][],
    string[]
];

const queryCache: { [statement: string]: ReturnType<typeof QueryTemplate> } = {}

export class RedisGraph implements Driver {
    private key: string;
    private redis: Redis;
    private results: ResultBuilder;

    constructor(config: RedisGraphConfigRecord) {
        this.redis = new Redis(config);
        this.key = config.key;
        this.results = new ResultBuilder(this.redis);
    }


    async query<T extends {} = {}>(statement: string, parameters: { [param: string]: RedisGraphValue } = {}): Promise<T[]> {
        const template = this.compile(statement);

        const fullQuery = template(parameters);

        const [columns, records, metadata] = await this.redis.sendCommand<RedisGraphResponse<T>>(
            "GRAPH.QUERY",
            ["portal-graph", fullQuery, "--compact"]
        )

        const result: T[] = [];
        for (let record of records || []) {
            const obj: Partial<T> = {};
            for (let [index, sourceValue] of record.entries()) {
                const [_, key] = columns[index];
                obj[key] = sourceValue
                    ? await this.results.convertValue(sourceValue) as any
                    : null
                ;
            }

            result.push(obj as T);
        }

        return result;
    }

    compile(statement: string) {
        if (statement in queryCache) {
            return queryCache[statement];
        }

        const template = parametrize(statement);

        queryCache[statement] = template;

        return template;
    }

    async disconnect() {
        if (this.redis) {
            await this.redis.quit();
        }
    };

    async index(label: string, property: string) {
        await this.redis.sendCommand(
            "GRAPH.QUERY",
            ["portal-graph", `CREATE INDEX ON ${makeSafeType(label)}(${makeSafePropName(property)})`, "--compact"]
        )
    }
}
