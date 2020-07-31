import {Properties} from "../drivers/IDriver";

export function makeSafePropName(prop: string) {
    return "`" +
        prop.replace(/`/g, "``") +
        "`";
}

export function makeSafeProperties(properties: Properties) {
    return "{" +
        Object.entries(properties).map(([prop, value]) =>
            makeSafePropName(prop) + ":" +
            JSON.stringify(value)
        ).join(",") +
        "}";
}

export function makeSafeType(label: string) {
    return ":`" +
        label.replace(/`/g, "``") +
        "`";
}