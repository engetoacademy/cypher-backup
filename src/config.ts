import {promises as fs, readFileSync} from "fs";
import yaml from "yaml";
import {URL} from "url";
import {homedir} from "os";
import {join} from "path";


export function readDatabaseConfig() {
    let configString: string;

    try {
        configString = readFileSync(join(homedir(), ".config/cypher-backup.yml")).toString();
    } catch (e) {
        return null;
    }

    const config = yaml.parse(configString);

    if (validateDatabaseConfig(config)) {
        return config;
    } else {
        return null
    }
}

export type Neo4jConfigRecord = {
    type: "neo4j"
    url: string
    username: string
    password: string
}

export type RedisGraphConfigRecord = {
    type: "redis-graph"
    key: string
    host?: string
    port?: number
    username?: string
    password?: string
}

export type DatabaseConfigRecord = Neo4jConfigRecord | RedisGraphConfigRecord

type DatabaseConfig = {
    [key: string]: DatabaseConfigRecord
}

class ValidationError extends Error {
    name = "ValidationError"
}

function validateDatabaseConfig(config: object): config is DatabaseConfig {
    if (typeof config !== "object" || config === null) {
        throw new ValidationError("Configuration must be an object");
    }

    for (const [name, db] of Object.entries(config)) {
        const type = db["type"];
        if (!["neo4j", "redis-graph"].includes(type)) {
            throw new ValidationError(`(in ${name}) Type of ${name} must be either "neo4j" or "redis-graph". Found: ${type}`);
        }

        if (type === "redis-graph") {
            // noop - all optional
        } else if (type === "neo4j") {
            try {
                new URL(db["url"])
            } catch (e) {
                throw new ValidationError(`(in ${name}) Couldn't parse URL for neo4j. Found: ${type}`)
            }

            if (!db["username"] || !db["password"]) {
                throw new ValidationError(`(in ${name}) Username and password must be specified`);
            }
        }
    }

    return true
}

export async function configureCmd() {
    const configfile = join(homedir(), ".config/cypher-backup.yml");
    if (await fs.stat(configfile).catch(e => false)) {
        console.info(`A configuration already exists in ${configfile}.`)
        console.info("If you wish to create a new blank file, move or delete the old one.")
        return;
    }

    await fs.mkdir(join(homedir(), '.config'), {recursive: true});
    await fs.copyFile(join(__dirname, "example.yml"), configfile);
    console.info(`Successfully created example configuration in ${configfile}.`)
}

export const databases = readDatabaseConfig()