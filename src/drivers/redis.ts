import {promisify} from "util";
import {RedisGraphConfigRecord} from "../config";
import {RedisClient, createClient} from "redis";

export class Redis {
    constructor(private config: RedisGraphConfigRecord) {
    }

    private static _client: RedisClient | null = null;

    get client(): RedisClient {
        if (!Redis._client) {
            Redis._client = createClient({
                port: this.config.port,
                host: this.config.host,
                password: this.config.password,
            });
        }
        return Redis._client
    }

    sendCommand<T>(command: string, args?: any[]): Promise<T> {
        return new Promise((resolve, reject) => {
            this.client.sendCommand(command, args, (err, reply: T) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(reply);
                }
            })
        })
    }

    async quit(): Promise<void> {
        if (Redis._client) {
            await promisify(Redis._client.quit.bind(Redis._client))();
            Redis._client = null;
        }
    }
}