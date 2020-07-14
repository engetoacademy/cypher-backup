interface Progress {
    update(current: number): void
    increment(): void

    end(): void
}

export function startProgress(total: number, step: number = 50): Progress {
    let current = 0;
    let lastDisplayed = 0;

    function write(force?:boolean) {
        if (!force && Math.abs(lastDisplayed - current) < step) {
            return;
        }
        process.stdout.clearLine(-1)
        process.stdout.cursorTo(0)
        process.stdout.write(`${current} / ${total}`);
        lastDisplayed = current;
    }

    function update(c: number) {
        current = c;
        write();
    }

    function increment() {
        current++;
        write();
    }

    function end() {
        write(true);
        process.stdout.write("\n");
    }

    write();

    return {
        increment,
        update,
        end
    }
}