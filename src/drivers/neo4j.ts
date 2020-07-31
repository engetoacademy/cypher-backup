import {AnyRow, Driver, Properties} from "./IDriver";
import neo4j, {Driver as NDriver} from "neo4j-driver";
import {Neo4jConfigRecord} from "../config";
import {makeSafePropName, makeSafeType} from "../util/sanitize";

function convertIntegerToNumber(obj: { [key: string]: any }) {
    for (let [key, val] of Object.entries(obj)) {
        if (neo4j.isInt(val)) {
            obj[key] = val.toNumber();
        } else if (typeof val === "object") {
            obj[key] = convertIntegerToNumber(val);
        } else {
            obj[key] = val;
        }
    }
    return obj;
}

export class Neo4jDriver implements Driver {
    constructor(config: Neo4jConfigRecord) {
        this.driver = neo4j.driver(
            config.url,
            neo4j.auth.basic(config.username, config.password)
        )
    }

    driver: NDriver;

    async query<T extends AnyRow>(cypher: string, params?: Properties): Promise<T[]> {
        const session = this.driver.session();
        const results = await session.run(cypher, params);

        return results.records.map(r => convertIntegerToNumber(r.toObject()) as T)
    }

    async disconnect(): Promise<void> {
        await this.driver.close();
    }

    async index(label: string, property: string): Promise<void> {
        await this.query(
            `CREATE INDEX ${makeSafePropName(label+"__"+property)} 
            FOR (n${makeSafeType(label)}) 
            ON (n.${makeSafePropName(property)}) 
        `)
    }
}