import {DatabaseConfigRecord} from "../config";
import { Driver } from "./IDriver";
import {Neo4jDriver} from "./neo4j";
import {RedisGraph} from "./redis-graph";

export function makeDriver(config: DatabaseConfigRecord & object): Driver {
    if (config.type === "neo4j") {
        return new Neo4jDriver(config)
    } else if (config.type === "redis-graph") {
        return new RedisGraph(config)
    } else {
        throw new RangeError("Unknown driver for type:" + config["type"])
    }
}