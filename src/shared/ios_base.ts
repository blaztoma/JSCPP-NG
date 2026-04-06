import { AbstractVariable, ArithmeticVariable, InitArithmeticVariable, InitIndexPointerVariable, InitValue } from "../variables";

export const openmode = {
    /** Seek to the end of the stream before each write. */
    app: 1 << 0,

    /** Open with the file-position indicator at the end of the file. */
    ate: 1 << 1,

    /** Open in binary mode. */
    binary: 1 << 2,

    /** Open for input operations. */
    in: 1 << 3,

    /** Open for output operations. */
    out: 1 << 4,

    /** Truncate the content of the file if it exists. */
    trunc: 1 << 5,
} as const;

/** Specifies stream state flags. Multiple can be set.
  * Ref: https://en.cppreference.com/w/cpp/io/ios_base/iostate
  */
export const iostate = {
    /** No error. */
    goodbit: 0,

    /** Irrecoverable stream error. */
    badbit: 1 << 0,

    /** Input/output operation failed (formatting or extraction error). */
    failbit: 1 << 1,

    /** Associated input sequence has reached end-of-file. */
    eofbit: 1 << 2,
} as const;

export function getBit(source: number, bitmask: number) {
    return (Math.trunc(source / bitmask) % 2) === 1;
}

export interface IStreamType {
    readonly sig: "CLASS",
    readonly identifier: "istream",
    readonly templateSpec: [],
    readonly memberOf: null,
};

export type IStreamVariable = AbstractVariable<IStreamType, IStreamValue>;

export interface IStreamValue extends InitValue<IStreamVariable> {
    members: {
        /** The input buffer. */
        "buf": InitIndexPointerVariable<ArithmeticVariable>,
        /** The UNIX-like input file descriptor (0 for stdin, >=3 for files). */
        "fd": InitArithmeticVariable,
        /** The end-of-file status flag. */
        "eofbit": InitArithmeticVariable,
        /** The bad status flag (system-level I/O error). */
        "badbit": InitArithmeticVariable,
        /** The fail status flag (no or unformatted input, bad file name, etc.) */
        "failbit": InitArithmeticVariable,
        /** The boolalpha input modifier flag (treat "true", "false" as bool values) */
        "boolalpha": InitArithmeticVariable,
        /** The skipws input modifier flag (skip whitespace) */
        "skipws": InitArithmeticVariable,
        
    },
}

export interface OStreamType {
    readonly sig: "CLASS",
    readonly identifier: "ostream",
    readonly templateSpec: [],
    readonly memberOf: null,
};

export interface OStreamValue extends InitValue<OStreamVariable> {
    members: {
        /** The UNIX-like input file descriptor (1 for stdin, >=3 for files). */
        "fd": InitArithmeticVariable,
        /** The end-of-file status flag. */
        "eofbit": InitArithmeticVariable,
        /** The bad status flag (system-level I/O error). */
        "badbit": InitArithmeticVariable,
        /** The fail status flag (no or unformatted input, bad file name, etc.) */
        "failbit": InitArithmeticVariable,
        /** The arithmetic base of integers.
          * One of 8, 10 and 16;
          * (default = 10) */
        "base": InitArithmeticVariable,
        /** The fill character (default = '\s') */
        "fill": InitArithmeticVariable,
        /** The floating-point precision or -1 (default = -1) */
        "precision": InitArithmeticVariable,
        /** The width of the next input field or -1 (default = -1) */
        "width": InitArithmeticVariable,
        /** The floating-point display mode 
          * One of `iomanip_token_mode.(fixed | scientific | hexfloat | defaultfloat)`
          * (default = `iomanip_token_mode.defaultfloat`) */
        "float_display_mode": InitArithmeticVariable,
        /** The positioning mode. 
          * One of `iomanip_token_mode.(left | right | internal)`
          * (default = `iomanip_token_mode.defaultfloat`) */
        "position_mode": InitArithmeticVariable,
        /** The boolalpha status flag. 
          * If false, outputs the values of booleans as 0 or 1;
          * If true, outputs the values of booleans as true or false. */
        "boolalpha": InitArithmeticVariable,
    },
}

export type OStreamVariable = AbstractVariable<OStreamType, OStreamValue>;

export interface IOManipTokenType {
    readonly sig: "CLASS",
    readonly identifier: "iomanip_token",
    readonly templateSpec: [],
    readonly memberOf: null,
}

export interface IOManipTokenValue extends InitValue<IOManipTokenVariable> {
    members: {
        "mode": InitArithmeticVariable,
        "param": ArithmeticVariable,
    }
};

export type IOManipTokenVariable = AbstractVariable<IOManipTokenType, IOManipTokenValue>;

export const iomanip_token_mode = {
    /** (Integer-only) Set arithmetic base for displaying integers (only 8, 10 or 16). */
    setbase: 0,

    /** Set the filler character. */
    setfill: 1,

    /** Set the displayed precision of floating-point numbers (non-negative). */
    setprecision: 2,

    /** Set the width of a next field, reset afterwards (non-negative). */
    setw: 3,

    /** Set the display of a floating-point number field to fixed notation. */
    fixed: 10,

    /** Set the display of a floating-point number field to scientific notation. */
    scientific: 11,

    /** Set the display of a floating-point number field to scientific notation. */
    hexfloat: 12,

    /** Set the display of a floating-point number field to scientific notation. */
    defaultfloat: 13,

    /** Set the positioning of a field to left. */
    left: 20,

    /** Set the positioning of a field to right (default). */
    right: 21,

    /** Set the positioning of a field to internal. */
    internal: 22,

    /** Set the input not to interpret "true" and "false" as bool values true and false. 
      * Set the output to write "0" or "1" for values of bool types true and false. */
    noboolalpha: 30,

    /** Set the input to interpret "true" and "false" as bool values true and false. 
      * Set the output to write "true" or "false" for values of bool types true and false. */
    boolalpha: 31,

    /** Set the input to read whitespace characters. 
      * Do nothing if the output stream is given. */
    noskipws: 40,

    /** Set the input to omit whitespace characters.
      * Do nothing if the output stream is given. */
    skipws: 41,
} as const;
