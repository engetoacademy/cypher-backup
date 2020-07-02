import {databases} from "./config";
import {makeDriver} from "./drivers/makeDriver";
import {Driver, Node, Relationship} from "./drivers/IDriver";
import {promises as fs} from "fs";


async function exportNodes(outfile: fs.FileHandle, driver: Driver) {
    await outfile.write("NODES\n");
    const nodes = await driver.query<{ n: Node, id: number }>("MATCH (n) RETURN n, id(n) AS id");
    console.info(`Exporting ${nodes.length} nodes`);

    for (const row of nodes) {
        const obj = {
            labels: row.n.labels,
            properties: row.n.properties
        };
        await outfile.write(`${row.id} ${JSON.stringify(obj)}\n`);
    }
}

async function exportRelationships(outfile: fs.FileHandle, driver: Driver) {
    await outfile.write("RELATIONSHIPS\n")
    const rels = await driver.query<{ source: number, r: Relationship, target: number }>("MATCH (m)-[r]->(n) RETURN id(m) AS source, r, id(n) AS target");
    console.info(`Exporting ${rels.length} relationships`);

    for (const row of rels) {
        const obj = {
            type: row.r.type,
            properties: row.r.properties
        }
        await outfile.write(`${row.source} ${row.target} ${JSON.stringify(obj)}\n`);
    }
}

async function runExport(outfile: fs.FileHandle, driver: Driver) {
    await exportNodes(outfile, driver);

    await exportRelationships(outfile, driver);
}

export async function exportCmd(argv: { $0: string, source: string, destination: string }) {
    if (!databases) {
        console.error(`You have not created a config file yet. Run \`${argv.$0} configure\``)
        return;
    }

    const outfile = await fs.open(argv.destination, "w");
    const driver = makeDriver(databases[argv.source]);

    try {
        await runExport(outfile, driver);
    } finally {
        await outfile.close();
        await driver.disconnect();
    }
}