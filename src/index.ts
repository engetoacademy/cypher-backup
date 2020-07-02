import yargs from 'yargs';
import {configureCmd, databases} from "./config";
import {exportCmd} from "./export";
import {importCmd} from "./import";

const dbkeys = databases ? Object.keys(databases) : [];

const parser = yargs
    .command("configure", "Create a configuration file in ~/.config/cypher-backup.yml", _ => _, configureCmd)
    .command({
        command: "export <source> [<destination>]",
        describe: "Dump all nodes and relationships into a file",
        handler: exportCmd as any,
        builder: _ => _
            .positional("source", {
                type: "string",
                description: "name of a database you defined in ~/.config/cypher-backup.yml",
                choices: dbkeys,

            })
            .positional("destination", {
                type: "string",
                description: "the name of the output file",
                default: new Date().toISOString().slice(0, "2020-02-02".length)+".cypher-backup"
            })
    })
    .command({
        command: "import <source> <destination>",
        describe: "Load nodes and relationships from a file into a database",
        handler: importCmd as any,
        builder: _ => _
            .positional("source", {
                type: "string",
                description: "the name of the output file"
            })
            .positional("destination", {
                type: "string",
                description: "name of a database you defined in ~/.config/cypher-backup.yml",
                choices: dbkeys
            })
    })
    .help()
    .demandCommand()

// This runs the parsers
parser.argv;

