import {databases} from "./config";
import {makeDriver} from "./drivers/makeDriver";
import {Driver, Node, Relationship} from "./drivers/IDriver";
import {promises as fs} from "fs";
import {startProgress} from './util/progress';


async function exportNodes(outfile: fs.FileHandle, driver: Driver) {
    const [{count}] = await driver.query<{ count: number }>("MATCH (n) RETURN count(n) as `count`");
    await outfile.write(`NODES (${count})\n`);
    console.info(`Exporting ${count} nodes`);


    const progress = startProgress(count, 100);


    const chunk = 5_000;
    for (let offset = 0; ; offset += chunk) {
        const nodes = await driver.query<{ n: Node, id: number }>(`MATCH (n) RETURN n, id(n) AS id SKIP ${offset} LIMIT ${chunk}`);

        if (nodes.length === 0) {
            break;
        }

        for (const row of nodes) {
            const obj = {
                labels: row.n.labels,
                properties: row.n.properties
            };
            await outfile.write(`${row.id} ${JSON.stringify(obj)}\n`);
            progress.increment();
        }
    }
    progress.end();
}

async function exportRelationships(outfile: fs.FileHandle, driver: Driver) {
    const [{count}] = await driver.query<{ count: number }>("MATCH (m)-[r]->(n) RETURN count(r) as `count`");
    await outfile.write(`RELATIONSHIPS (${count})\n`);
    console.info(`Exporting ${count} relationships`);

    const progress = startProgress(count, 100);
    const chunk = 5_000;
    for (let offset = 0; ; offset += chunk) {
        const rels = await driver.query<{ source: number, r: Relationship, target: number }>(
            `MATCH (m)-[r]->(n) RETURN id(m) AS source, r, id(n) AS target SKIP ${offset} LIMIT ${chunk}`
        );

        if (rels.length === 0) {
            break;
        }

        for (const row of rels) {
            const obj = {
                type: row.r.type,
                properties: row.r.properties
            }
            await outfile.write(`${row.source} ${row.target} ${JSON.stringify(obj)}\n`);

            progress.increment();
        }
    }
    progress.end();
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