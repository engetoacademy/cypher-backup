import {databases} from "./config";
import {createReadStream, ReadStream} from "fs";
import nexline from "nexline";
import {makeDriver} from "./drivers/makeDriver";
import {Driver, Node, Properties, Relationship} from "./drivers/IDriver";
import {startProgress} from './util/progress';

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

async function indexNodes(nodeLabels: Set<string>, driver: Driver) {
    console.log(`Will index ${nodeLabels.size} labels`);
    const progress = startProgress(nodeLabels.size, 1);
    for (let label of nodeLabels) {
        await driver.query(`CREATE INDEX ON :${makeSafeType(label)}(__import_original_id)`)
        progress.increment()
    }
    progress.end();
}

async function readNodes(lineReader: nexline, driver: Driver) {
    const firstLineRegex = /^NODES \((\d+)\)$/
    const nodeRegex = /^(\d+) (.*)$/;
    const nodeLabels = new Set<string>();

    const firstLine = await lineReader.next();
    const match = firstLineRegex.exec(firstLine!);
    if (!match) {
        throw new Error("Expected first line to be 'NODES (<count>)'")
    }
    const expectedCount = parseInt(match[1]);

    console.log(`Importing ${expectedCount} nodes`);

    const progress = startProgress(expectedCount);

    let count = 0;
    let line = await lineReader.next();
    for (
        ;
        line !== null && !line.startsWith("RELATIONSHIPS ");
        line = await lineReader.next(), count++
    ) {
        const [_, id, nodejson] = nodeRegex.exec(line) || []

        const node: Node = JSON.parse(nodejson);

        for (let label of node.labels) {
            nodeLabels.add(label);
        }

        const safeLabels = node.labels
            .map(label => makeSafeType(label))
            .join('')
        ;

        const safeProperties = makeSafeProperties({...node.properties, __import_original_id: id});

        await driver.query(`CREATE (${safeLabels} ${safeProperties})`);

        progress.increment();
    }
    progress.end();
    console.log(`Created ${count} nodes`);

    await indexNodes(nodeLabels, driver);
    return line;
}

async function readRelationships(lineReader: nexline, relationshipsLine: string | null, driver: Driver) {
    const firstLineRegex = /^RELATIONSHIPS \((\d+)\)$/
    const relRegex = /^(\d+) (\d+) (.*)$/;

    const match = firstLineRegex.exec(relationshipsLine ?? "");
    if (!match) {
        throw new Error("Expected first line after all nodes to be 'RELATIONSHIPS (<count>)'")
    }
    const expectedCount = parseInt(match[1]);

    console.log(`Importing ${expectedCount} relationships`);
    const progress = startProgress(expectedCount);

    let count = 0
    for (
        let line = await lineReader.next();
        line !== null;
        line = await lineReader.next()
    ) {
        if (!line.length) { // permit empty lines at end of file
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

        count++;
        progress.increment();
    }
    progress.end();
    console.log(`Created ${count} relationships`)
}

async function runImport(infile: ReadStream, driver: Driver) {
    const lineReader = new nexline({input: infile});

    await flushAll(driver);

    const relationshipsLine = await readNodes(lineReader, driver);

    await readRelationships(lineReader, relationshipsLine, driver);
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