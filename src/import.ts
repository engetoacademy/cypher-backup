import {databases} from "./config";
import {createReadStream, ReadStream} from "fs";
import nexline from "nexline";
import {makeDriver} from "./drivers/makeDriver";
import {Driver, Node, Properties, Relationship} from "./drivers/IDriver";

async function flushAll(driver: Driver) {
    await driver.query("MATCH (n) DETACH DELETE n");
}

function makeSafeProperties(properties: Properties) {
    return "{" +
        Object.entries(properties).map(([prop, value]) =>
            "`" +
            prop.replace(/`/g, "``") +
            "`:" +
            JSON.stringify(value)
        ).join(",") +
        "}";
}

function makeSafeType(label: string) {
    return ":`" +
        label.replace(/`/g, "``") +
        "`";
}

async function readNodes(lineReader: nexline, driver: Driver) {
    const nodeRegex = /^(\d+) (.*)$/;

    let count = 0;
    for (
        let line = await lineReader.next();
        line !== null && line !== "RELATIONSHIPS";
        line = await lineReader.next(), count++
    ) {
        const [_, id, nodejson] = nodeRegex.exec(line) || []

        const node: Node = JSON.parse(nodejson);

        const safeLabels = node.labels
            .map(label => makeSafeType(label))
            .join('')
        ;

        const safeProperties = makeSafeProperties({...node.properties, __import_original_id: id});

        await driver.query(`CREATE (${safeLabels} ${safeProperties})`);
    }
    console.log(`Created ${count} nodes`);
}

async function readRelationships(lineReader: nexline, driver: Driver) {
    const relRegex = /^(\d+) (\d+) (.*)$/;

    let count = 0;
    for (
        let line = await lineReader.next();
        line !== null;
        line = await lineReader.next(), count++
    ) {
        if (!line.length) {
            continue
        }

        const [_, from, to, reljson] = relRegex.exec(line) || [];

        const rel: Relationship = JSON.parse(reljson);

        const safeType = makeSafeType(rel.type);

        const safeProperties = makeSafeProperties(rel.properties);

        await driver.query(`
            MATCH (m {__import_original_id: $from}) 
            MATCH (n {__import_original_id: $to}) 
            CREATE (m)-[${safeType} ${safeProperties}]->(n)
        `, {from, to});

    }
    console.log(`Created ${count} relationships`)
}

async function runImport(infile: ReadStream, driver: Driver) {
    const lineReader = new nexline({input: infile});

    if (await lineReader.next() !== "NODES") {
        throw new RangeError("Expected first line of file to be 'NODES'");
    }

    await flushAll(driver);

    await readNodes(lineReader, driver);

    await readRelationships(lineReader, driver);
}

export async function importCmd(argv: { $0: string, source: string, destination: string }) {
    if (!databases) {
        console.error(`You have not created a config file yet. Run \`${argv.$0} configure\``)
        return;
    }

    const infile = createReadStream(argv.source);
    const driver = makeDriver(databases[argv.destination]);

    try {
        await runImport(infile, driver);
    } finally {
        await driver.disconnect();
    }
}