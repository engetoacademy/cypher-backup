export type Scalar = string | number | null;

export type Properties = {
    [key: string]: Scalar
}

export interface Node {
    labels: string[]
    properties: Properties
}

export interface Relationship {
    type: string
    properties: Properties
}

export type AnyRow = {
    [key: string]: Node | Relationship | Scalar
}

export interface Driver {
    query<T extends AnyRow >(cypher: string, params?: Properties): Promise<T[]>
    index(label: string, property: string): Promise<void>
    disconnect(): Promise<void>
}