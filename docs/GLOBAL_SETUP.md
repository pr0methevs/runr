# Global Installation

## Option A: Local Development Link

To run runr as a command anywhere on your machine while developing:

```bash
npm link
# OR
bun link
```
Now you can just type runr in any terminal window.

## Option B: Run via npx

Once published or linked, you can run:

```bash
npx runr
```

## Option C: Create a Single-File Binary (Native)

Since you are using Bun, you can even compile this into a single, truly standalone executable that doesn't even need node_modules or a local Bun/Node installation to run:

```bash
bun build ./index.ts --compile --outfile runr-bin
```

This will create a runr-bin file that you can move anywhere and run as ./runr-bin.