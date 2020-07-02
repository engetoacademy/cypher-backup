declare module "nexline" {
    import { ReadStream } from "fs";
    type NexlineInput = number | ReadStream | string | Buffer;

    type NexlineOptions = {
        input: NexlineInput | NexlineInput[]
        lineSeparator?: string | string[]
        encoding?: string
        reverse?: boolean
        autoCloseFile?: boolean
    }

    class nexline {
        constructor(opts: NexlineOptions);
        next(): Promise<string | null>
        close(): void
    }

    export default nexline;
}