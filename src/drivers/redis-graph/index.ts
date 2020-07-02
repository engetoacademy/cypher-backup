import {parametrize, QueryTemplate, RedisGraphInputType} from "./QueryTemplate";
import {RedisClient} from "redis";
import {convertRecordValue, RedisGraphOutputType} from "./ResultSet";
import {AnyRow, Driver} from "../IDriver";
import {promisify} from "util";
import {RedisGraphConfigRecord} from "../../config";

type RedisGraphResponse<T extends object> = [
    (keyof T)[],
    (RedisGraphOutputType)[][],
    string[]
];

const queryCache: { [statement: string]: ReturnType<typeof QueryTemplate> } = {}

const compile = (statement: string) => {
    if (statement in queryCache) {
        return queryCache[statement];
    }

    const template = parametrize(statement);

    queryCache[statement] = template;

    return template;
};

export class RedisGraph implements Driver {
    private key: string;
    constructor(config: RedisGraphConfigRecord) {
        this.redis = new RedisClient({
            host: config.host,
            port: config.port,
            password: config.password
        });
        this.key = config.key;
    }

    redis: RedisClient;

    async query<T extends AnyRow>(statement: string, parameters: { [param: string]: RedisGraphInputType } = {}): Promise<T[]> {
        const template = compile(statement);

        const fullQuery = template(parameters);

        const commandPromise = new Promise<RedisGraphResponse<T>>((resolve, reject) => {
            this.redis.sendCommand(
                "GRAPH.QUERY", [this.key, fullQuery],
                (err, reply) => {
                    if (err) {
                        reject(err)
                    } else {
                        resolve(reply);
                    }
                }
            )
        })

        const [columns, records, metadata]: RedisGraphResponse<T> = await commandPromise;

        const result: T[] = [];
        for (let record of records || []) {
            const obj: Partial<T> = {};
            for (let [index, sourceValue] of record.entries()) {
                obj[columns[index]] = sourceValue
                    ? convertRecordValue(sourceValue) as any
                    : null
                ;
            }

            result.push(obj as T);
        }

        return result;
    }

    async disconnect(): Promise<void> {
        await promisify(this.redis.quit.bind(this.redis))()
    }
}
