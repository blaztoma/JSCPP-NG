import { AnyType, variables } from "./variables";

export class TypeParseError extends Error {
    constructor(...params: any[]) {
        super(...params);
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, TypeParseError);
        }
        this.name = "TypeParseError";
        Object.setPrototypeOf(this, TypeParseError.prototype)
    }
}

const arithmeticSig = {
    "I8": Object,
    "U8": Object,
    "I16": Object,
    "U16": Object,
    "I32": Object,
    "U32": Object,
    "I64": Object,
    "U64": Object,
    "F32": Object,
    "F64": Object,
    "BOOL": Object,
}
export type ArithmeticSig = keyof (typeof arithmeticSig);

const term = {
    "FUNCTION": Object,
    "VOID": Object,
    "NULLPTR": Object,
    "LREF": Object,
    "CLREF": Object,
    "ARRAY": Object,
    "CLASS": Object,
    "MEMBERTYPE": Object,
    "PTR": Object,
    "I8": Object,
    "U8": Object,
    "I16": Object,
    "U16": Object,
    "I32": Object,
    "U32": Object,
    "I64": Object,
    "U64": Object,
    "F32": Object,
    "F64": Object,
    "BOOL": Object,
    "NULLPTR_T": Object,
    //"STRINGLITERAL": Object, // unused
    //"CHARLITERAL": Object, // unused
    //"INTLITERAL": Object, // unused
    //"FLOATLITERAL": Object, // unused
    "<": Object,
    ">": Object,
    "(": Object,
    ")": Object
} as const;
export type Term = keyof (typeof term);

const nonTerm = {
    "TemplateParamPlus": Object,
    "TemplateParamOrEnd": Object,
    "FunctionParamPlus": Object,
    "FunctionParamOrEnd": Object,
    "Function": Object,
    "Type": Object,
    "Object": Object,
    "ParamObject": Object,
    "Parametric": Object,
    "LRef": Object,
    "CLRef": Object,
    "LValue": Object,
    "Pointer": Object,
    "Pointee": Object,
    "Array": Object,
    "ArraySize": Object,
    "Class": Object,
    "MemberType": Object,
    "Arithmetic": Object,
    //"Literal": Object, // unused
    "ObjectOrFunction": Object,
    "Return": Object
} as const;
export type NonTerm = keyof (typeof nonTerm);

const specTerm = {
    "identifier": Object,
    "positiveint": Object,
};
export type SpecTerm = keyof (typeof specTerm);

export type LexSym = Term | NonTerm | SpecTerm;

export type LLParser = { [symbol: string]: LLParserEntry[] }
export type LLParserEntry = { [startsWith: string]: NonTerm | SpecTerm | null };

/** Creates an LL(1) parser for type language from the given Backus-Naur form (BNF).
 */
export function constructTypeParser(): LLParser {
    const typeBNF: { [symbol: string]: LexSym[][] } = {
        "Type": [["Object", "VOID", "Function", "LRef"]],
        "Object": [["ParamObject", "Array"]],
        "ParamObject": [["Class", "Arithmetic", "NULLPTR_T", "Pointer"]],
        "Parametric": [["ParamObject", "LRef", "CLRef", "MemberType"]],
        "LRef": [["LREF"], ["LValue"]],
        "CLRef": [["CLREF"], ["LValue"]],
        "LValue": [["Object", "Function", "MemberType"]],
        "Pointee": [["LValue", "VOID"]],
        "Pointer": [["PTR"], ["Pointee"]],
        "Array": [["ARRAY"], ["Object"], ["ArraySize"]],
        "ArraySize": [["positiveint"]],
        "Class": [["CLASS"], ["identifier"], ["<"], ["TemplateParamOrEnd"]],
        "MemberType": [["MEMBERTYPE"], ["identifier"], ["Class"]],
        "Arithmetic": [["I8", "U8", "I16", "U16", "I32", "U32", "I64", "U64", "F32", "F64", "BOOL"]],
        "Function": [["FUNCTION"], ["Return"], ["("], ["FunctionParamOrEnd"]],
        "FunctionParamOrEnd": [["FunctionParamPlus", ")"]],
        "FunctionParamPlus": [["Parametric"], ["FunctionParamOrEnd"]],
        "TemplateParamOrEnd": [["TemplateParamPlus", ">"]],
        "TemplateParamPlus": [["Parametric"], ["TemplateParamOrEnd"]],
        "Return": [["Parametric", "VOID"]]
    };
    let result: LLParser = {};
    Object.keys(typeBNF).forEach((key: string) => {
        result[key] = new Array();
        typeBNF[key].forEach((union: LexSym[], fieldIdx: number) => {
            result[key].push({});
            union.forEach((element: LexSym) => {
                if (element in term || element in specTerm) {
                    result[key][fieldIdx][element] = null;
                }
            })
        })
        result[key][0][key as NonTerm] = null;
    })
    let i = 0;
    while (true) {
        let dirty: boolean = false;
        Object.keys(typeBNF).forEach((key: string) => {
            typeBNF[key].forEach((union: LexSym[], fieldIdx: number) => {
                union.forEach((nterm: LexSym) => {
                    if (nterm in nonTerm) {
                        if (!(nterm in result)) {
                            throw new TypeParseError(`NonTerm ${nterm} is outside the grammar tree`);
                        }
                        Object.keys(result[nterm][0]).forEach((startsWith) => {
                            if (!(startsWith in result[key][fieldIdx])) {
                                result[key][fieldIdx][startsWith] = nterm as NonTerm;
                                dirty = true;
                            }
                        })
                    }
                })
            })
        })
        if (!dirty) {
            break;
        }
        i++;
        if (i > 1000) {
            throw new TypeParseError("Perpetual loop detected")
        }
    }

    return result;
}

export const wildcardDeclarator: string = '!';
export const wildcardSpecifier: string = '?';
export const prototypeListSpecifier: string = '__list_prototype';

function preparse(sentence: string[], strict_order: boolean = true): { sentence: string[], wildcardMap: number[] } {
    let targets: string[] = new Array();
    while (sentence.length > 0 && sentence[0].startsWith(wildcardDeclarator)) {
        targets.push(sentence[0].slice(1));
        sentence = sentence.slice(1);
    }
    let wildcardMap: number[] = [];
    let expectedMaxId: number = 0;
    let anonWildcardId: number = targets.length;
    let isIdentifier: boolean = false;
    return {
        sentence: sentence.map((x: string) => {
            if (x.startsWith(wildcardSpecifier)) {
                // identifiers cannot have a wildcardSpecifier or wildcardDeclarator prefix
                const wildcardId: number = parseInt(x.slice(1));
                if (!(wildcardId >= 0 && wildcardId < targets.length)) {
                    throw new TypeParseError(`Wildcard ${x} is out of bounds`);
                }
                if (strict_order && expectedMaxId < wildcardId) {
                    throw new TypeParseError(`Wildcard ${x} precedes ?${expectedMaxId}`);
                }
                if (wildcardId === expectedMaxId) {
                    expectedMaxId++;
                }
                wildcardMap.push(wildcardId);
                return targets[wildcardId];
            } else if (x.startsWith(wildcardDeclarator)) {
                throw new TypeParseError('Wildcard declarator detected after the start of the sentence')
            } else {
                if (isIdentifier) {
                    isIdentifier = false;
                } else {
                    if (x in nonTerm) {
                        wildcardMap.push(anonWildcardId++);
                    } else if (x === "CLASS" || x === "MEMBERLIST") {
                        isIdentifier = true;
                    }
                }
                return x;
            }
        }),
        wildcardMap
    };
}

/** Tests if the given string is a valid sentence.
 *  @param parser The LL(1) Parser, created using `constructTypeParser`.
 *  @param sentence Sequence of tokens, which describes the variable type.
 *  @param scope The topmost nonterminal token of both statements (default = `'Type'`).
 *  @param strict_order Ensure that typed wildcard statements are going from ?0 in ascending order in the sequence (default = `true`).
 *  @throws TypeParseError on invalid preparsing (see: `strict_order`).
 **/
export function parse(parser: LLParser, sentence: string[], scope: NonTerm = 'Type', strict_order: boolean = true): boolean {
    const preparseResult = preparse(sentence, strict_order);
    return parseInner(parser, scope, preparseResult.sentence) !== null;
}

function parseInner(parser: LLParser, scope: NonTerm, sentence: string[]): string[] | null {
    let endLoop: boolean = false;
    let result: string[] | null = sentence;
    parser[scope].forEach((argument) => {
        if (result === null || endLoop) {
            return;
        }
        if (result.length > 0 && result[0] in argument) {
            const innerScope: NonTerm | null = argument[result[0]] as NonTerm | null;
            if (innerScope === null) {
                if (result[0] === scope) {
                    endLoop = true;
                }
                result = result.slice(1);
            } else {
                result = parseInner(parser, innerScope as NonTerm, result);
            }
        } else if (result.length > 0 && "identifier" in argument) {
            result = result.slice(1);
        } else if (result.length > 0 && "positiveint" in argument) {
            if (!(parseInt(result[0]) > 0)) {
                result = null;
            } else {
                result = result.slice(1);
            }
        } else {
            result = null;
        }
    });
    return result;
}

type SigPair = {
    subtype: string[],
    subwc: number[],
    supertype: string[]
    superwc: number[],
    wildcards: (number | string[])[],
};

type FunctionMatchSigPair = SigPair & {
    /** Triggered on FunctionParamOrEnd call. 0 means not a parameter; 
      * In "FUNCTION R ( A B FUNCTION C ( D ) )", `param_depth` R is 0, for A, B and C it is 1, and 2 for D. */
    paramDepth: number,
    firstLevelParamBreadth: number,
};

type SubsetSigPair = SigPair & {
    allow_lvalue_substitution: boolean,
};

export function arrayValuesEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) {
        return false;
    }
    for (let i: number = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
            return false;
        }
    }
    return true;
}

export type CastAction = {
    type: "ARITHMETIC",
    targetSig: ArithmeticSig,
} | {
    type: "CTOR"
    fnsig: string,
    domain: string,
} | {
    type: "FNPTR"
} | {
    type: "LIST",
    isInitList: boolean,
    ops: ParseFunctionMatchInnerResult
    targetSig: string[]
} | {
    type: "MEMBERTYPE",
    ops: ParseFunctionMatchInnerResult
};

/** For every destination, stored as an inline type signature, an array of viable source types, stored as inline type signatures, is given.
 **/
export type ImplicitConversionTable = { [dst: string]: { [src: string]: ImplicitConversionResult } };
export type ImplicitConversionResult = { fnsig: string, domain: string };

export type ListConversionTable = { [identifier: string]: { dst: string[], src: string[][] } };
export type MemberTypeInfo = {
    src: string[],
    dst: string[]
}
export type MemberTypeConversionTable = { [classId: string]: { [memberTypeId: string]: MemberTypeInfo[] } };

export type ConversionTables = {
    implicit: ImplicitConversionTable,
    list: ListConversionTable
    memberType: MemberTypeConversionTable,
}

export type ParseFunctionMatchInnerResult = {
    valueActions: ("CLONE" | "BORROW" | "CAST")[],
    castActions: { index: number, cast: CastAction }[],
};

export type ParseFunctionMatchResult = ParseFunctionMatchInnerResult & {
    templateTypes: string[][],
};

/** Tests if `subtype` function is a valid match for `supertype`, provides preparatory actions for argument conversion.
 *  @param parser The LL(1) Parser, created using `constructTypeParser`.
 *  @param subtype Sequence of tokens, which describes the subset of types.
 *  @param supertype Sequence of tokens, which describes the superset of types.
 *  @param scope The topmost nonterminal token of both statements (default = `'Type'`).
 *  @param strict_order Ensure that typed wildcard statements are going from ?0 in ascending order in the sequence (default = `true`).
 *  @remarks It is assumed that `parse(parser, subtype)` and `parse(parser, supertype)` return `true` (i.e., `subtype` and `supertype` are always valid). This function does NOT check if given sentences are valid.
 *  @throws TypeParseError on preparsing errors (see: `strict_order`).
 **/
export function parseFunctionMatch(parser: LLParser, subtype: string[], supertype: string[], ct: ConversionTables, templateTypes: string[][], strict_order = true): ParseFunctionMatchResult | null {
    let subData = preparse(subtype, strict_order);
    let superData = preparse(supertype, strict_order);
    const pair: FunctionMatchSigPair = {
        subtype: subData.sentence,
        subwc: subData.wildcardMap,
        supertype: superData.sentence,
        superwc: superData.wildcardMap,
        wildcards: new Array<number | string[]>(),
        paramDepth: 0,
        firstLevelParamBreadth: 0,
    }
    const result = {
        valueActions: new Array(),
        castActions: new Array(),
    };
    const retv = parseFunctionMatchInner(parser, 'Function', pair, ct, result);
    if (retv && pair.subtype.length === 0 && pair.supertype.length === 0) {
        const templateTypeResults: string[][] = templateTypes.map((x) => x.flatMap(((y) => {
            if (y.startsWith(wildcardSpecifier)) {
                const wildcardId: number = parseInt(y.slice(1));
                const wildcard = pair.wildcards[wildcardId];
                if (wildcard === undefined) {
                    throw new TypeParseError(`Function match parser (template type substitution): Wildcard ${y} is undefined`);
                }
                if (typeof wildcard === "number") {
                    throw new TypeParseError(`Function match parser (template type substitution): Unable to detertmine the exact type of wildcard ${y}`);
                }
                return wildcard;
            } else if (y.startsWith(wildcardDeclarator)) {
                throw new TypeParseError("Function match parser (template type substitution): Unexpected wildcard declarator in function template specifier");
            } else {
                return y;
            }
        })))
        return { templateTypes: templateTypeResults, ...result };

    } else {
        return null;
    }
}

function matchNontermOrWildcard(parser: LLParser, scope: NonTerm, argument: LLParserEntry, pair: FunctionMatchSigPair, supertop: string, ct: ConversionTables, result: ParseFunctionMatchInnerResult): boolean | null {
    const innerScope: NonTerm | null = argument[supertop] as NonTerm | null;
    if (innerScope === null) {
        if (supertop === scope) {
            // wildcard management
            pair.supertype = pair.supertype.slice(1);
            const subtype0 = pair.subtype;
            let r = parseInner(parser, scope, pair.subtype);
            if (r !== null) {
                const wcInstance = subtype0.slice(0, subtype0.length - r.length);
                let subresult: number | string[];
                if (wcInstance.length === 1 && wcInstance[0] in nonTerm) {
                    // subset is also a wildcard
                    subresult = pair.subwc[0];
                    pair.subwc = pair.subwc.slice(1);
                } else {
                    subresult = wcInstance;
                }
                const superwc: number | string[] = pair.wildcards[pair.superwc[0]];
                if (superwc === undefined) {
                    pair.wildcards[pair.superwc[0]] = subresult;
                } else if (typeof superwc === "number") {
                    if (superwc !== subresult) {
                        return false;
                    }
                } else {
                    // superwc is an array
                    if (typeof subresult === "number" || !arrayValuesEqual(superwc, subresult)) {
                        return false;
                    }
                }
            }
            if (r !== null) {
                pair.subtype = r;
                pair.superwc = pair.superwc.slice(1);
            }
            return r !== null;
        } else {
            if (!(pair.subtype.length > 0 && pair.subtype[0] === supertop)) {
                return false;
            }
            pair.supertype = pair.supertype.slice(1);
            pair.subtype = pair.subtype.slice(1);
        }
    } else {
        const delta = (scope === "Function" && innerScope === "FunctionParamOrEnd") ? 1 : (scope === "Function" && innerScope === "Return") ? 2 : (scope === "Class" && innerScope === "TemplateParamOrEnd") ? 2 : 0;
        pair.paramDepth += delta;
        const nestedRetv = parseFunctionMatchInner(parser, innerScope as NonTerm, pair, ct, result);
        pair.paramDepth -= delta;
        if (!nestedRetv) {
            return false;
        }
    }
    return null;
}

function tryImplicitCast(pair: FunctionMatchSigPair, subtype: string[], supertype: string[]): CastAction | null {
    if (supertype[0] in arithmeticSig && subtype[0] in arithmeticSig) {
        // implicit arithmetic conversions
        return { type: "ARITHMETIC", targetSig: supertype[0] as ArithmeticSig };
    } else if (supertype[0] === "Arithmetic" && subtype[0] in arithmeticSig) {
        // implicit arithmetic conversions with inferred wildcard type
        const superwc: number | string[] = pair.wildcards[pair.superwc[0]];
        if (superwc === undefined || typeof superwc === "number") {
            throw new TypeParseError("Cannot infer a function parameter in a given implicit arithmetic conversion (not yet implemented)");
        } else if (superwc.length === 1 && superwc[0] in arithmeticSig) {
            return { type: "ARITHMETIC", targetSig: superwc[0] as ArithmeticSig };
        } else {
            return null;
        }
    } else {
        return null;
    }
}

function parseFunctionMatchInner(parser: LLParser, scope: NonTerm, pair: FunctionMatchSigPair, ct: ConversionTables, result: ParseFunctionMatchInnerResult): boolean {
    let retv: boolean | null = null;
    parser[scope].forEach((argument) => {
        if (retv !== null) {
            return;
        }
        if (pair.supertype.length > 0 && pair.supertype[0] in argument) {
            if (pair.paramDepth === 1 && scope === "Parametric") {
                if (pair.subtype.length === 0) {
                    retv = false;
                    return;
                }
                function tryMatchMemberType(wsuper: string[], wsuperRadical: string[], wsubPrefix: string[], wsuperPrefix: string[]) {
                    const memberTypeName = wsuper[1];
                    let sourceClass: string[];
                    if (wsuper[2] === "Class") {
                        sourceClass = pair.wildcards[tmpSuperWc[0]] as string[];
                        pair.superwc = pair.superwc.slice(1);
                    } else {
                        throw new TypeParseError("Typecheck: Not yet implemented");
                    }
                    if (sourceClass[1] in ct.memberType && memberTypeName in ct.memberType[sourceClass[1]]) {
                        for (const xsuperCandidate of ct.memberType[sourceClass[1]][memberTypeName]) {
                            const xsuperData = preparse(xsuperCandidate.src);
                            const xsubData = preparse(sourceClass);
                            const xresult: ParseFunctionMatchInnerResult = {
                                valueActions: new Array<"CLONE" | "BORROW" | "CAST">(),
                                castActions: new Array<{ index: number, cast: CastAction }>(),
                            };
                            const xpair: FunctionMatchSigPair = {
                                subtype: xsubData.sentence,
                                subwc: xsubData.wildcardMap,
                                supertype: xsuperData.sentence,
                                superwc: xsuperData.wildcardMap,
                                wildcards: new Array(),
                                paramDepth: 0,
                                firstLevelParamBreadth: 0,
                            };
                            const xretv = parseFunctionMatchInner(parser, 'Class', xpair, ct, xresult);;
                            if (xretv) {
                                const projectedSuper: string[] = xsuperCandidate.dst.map((x) => {
                                    if (x.startsWith("?")) {
                                        const idx = parseInt(x.slice(1));
                                        if (!(idx in xpair.wildcards) || typeof (xpair.wildcards[idx]) === "number") {
                                            throw new TypeParseError("Typecheck: Error attempting to convert from brace-enclosed list (internal error)")
                                        }
                                        return xpair.wildcards[idx] as string[];
                                    } else {
                                        return x;
                                    }
                                }).flat();
                                const zpair = {
                                    subtype: [...wsubPrefix, ...pair.subtype],
                                    subwc: pair.subwc,
                                    supertype: [...wsuperPrefix, ...projectedSuper],
                                    superwc: pair.superwc,
                                    wildcards: pair.wildcards,
                                    paramDepth: 1,
                                    firstLevelParamBreadth: 0,
                                };
                                const zresult: ParseFunctionMatchInnerResult = {
                                    valueActions: [],
                                    castActions: [],
                                }
                                if (parseFunctionMatchInner(parser, 'Parametric', zpair, ct, zresult) === true) {
                                    retv = true;
                                    valueAction = "CAST";
                                    result.castActions.push({ index: pair.firstLevelParamBreadth, cast: { type: "MEMBERTYPE", ops: zresult } });
                                    pair.subtype = zpair.subtype;
                                    pair.supertype = wsuperRadical;
                                }
                            }
                        }
                    }

                }
                let valueAction: "BORROW" | "CLONE" | "CAST" = "CLONE";
                const tmpSub = pair.subtype;
                const tmpSuper = pair.supertype;
                const tmpSuperWc = pair.superwc;
                if (pair.subtype[0] === "LREF" || pair.subtype[0] === "CLREF") {
                    // lvalue is passed (eligible to passing as an lvalue reference)
                    if ((pair.supertype[0] === "LREF" && pair.subtype[0] === "LREF") || pair.supertype[0] === "CLREF") {
                        // cannot provide const T& to function that accepts only T&, but it is permitted vice-versa.
                        pair.subtype[0] = pair.supertype[0];
                        valueAction = "BORROW";
                        retv = matchNontermOrWildcard(parser, scope, argument, pair, pair.supertype[0], ct, result);
                    } else if (pair.supertype[0] === "LRef" || pair.supertype[0] === "CLRef") {
                        throw new Error("Typecheck: Not yet implemented (avoid using LRef and CLRef non-terms, replace them with LREF LValue or CLREF LValue)");
                    } else {
                        // implicit lvalue arithmetic conversion
                        pair.subtype = pair.subtype.slice(1);
                        retv = matchNontermOrWildcard(parser, scope, argument, pair, pair.supertype[0], ct, result);
                        if (retv !== false) {
                            valueAction = "CLONE";
                        }
                    }
                    if (retv === false && pair.supertype[0] !== "LREF") {
                        if (tmpSub.length > 1 && tmpSub[1] === "FUNCTION" && tmpSuper[0] === "PTR") {
                            pair.subtype = ["PTR", ...tmpSub.slice(1)];
                            //pair.supertype = [...tmpSuper];
                            retv = matchNontermOrWildcard(parser, scope, argument, pair, pair.supertype[0], ct, result);
                            if (retv === null) {
                                valueAction = "CAST";
                                result.castActions.push({ index: pair.firstLevelParamBreadth, cast: { type: "FNPTR" } });
                            }
                        }
                        if (retv === false) {
                            const tmpSubRadical = parseInner(parser, scope, tmpSub);
                            const tmpSuperRadical = parseInner(parser, scope, tmpSuper);
                            if (tmpSubRadical === null || tmpSuperRadical === null) {
                                // parameter size misalignment
                                return;
                            }
                            const subParamArray = tmpSub.slice(tmpSub[0] === "CLREF" || tmpSub[0] === "LREF" ? 1 : 0, tmpSub.length - tmpSubRadical.length);
                            const superParamArray = tmpSuper.slice(tmpSuper[0] === "CLREF" ? 1 : 0, tmpSuper.length - tmpSuperRadical.length);
                            let cast: CastAction | null;
                            if ((cast = tryImplicitCast(pair, subParamArray, superParamArray)) !== null) {
                                retv = null;
                                valueAction = "CAST";
                                result.castActions.push({ index: pair.firstLevelParamBreadth, cast });
                                pair.subtype = tmpSubRadical;
                                pair.supertype = tmpSuperRadical;
                            } else {
                                if (superParamArray[0] === "MEMBERTYPE") {
                                    const wsubPrefix = tmpSub.slice(0, tmpSub.length - (subParamArray.length + tmpSubRadical.length));
                                    const wsuperPrefix = tmpSuper.slice(0, tmpSuper.length - (superParamArray.length + tmpSuperRadical.length));
                                    debugger;
                                    tryMatchMemberType(superParamArray, tmpSuperRadical, wsubPrefix, wsuperPrefix);
                                } else {
                                    const subParamInline = (subParamArray[0] === "ARRAY" ? ["PTR", ...subParamArray.slice(1, -1)] : subParamArray).join(" ");
                                    const superParamInline = superParamArray.join(" ");
                                    if (superParamInline in ct.implicit && subParamInline in ct.implicit[superParamInline]) {
                                        retv = null;
                                        valueAction = "CAST";
                                        result.castActions.push({ index: pair.firstLevelParamBreadth, cast: { type: "CTOR", ...ct.implicit[superParamInline][subParamInline] } });
                                        pair.subtype = tmpSubRadical;
                                        pair.supertype = tmpSuperRadical;
                                    }
                                }
                            }
                        }
                    }
                } else {
                    // temporary value is passed
                    if (pair.supertype[0] === "CLREF") {
                        valueAction = "BORROW";
                        pair.supertype = pair.supertype.slice(1);
                        retv = matchNontermOrWildcard(parser, scope, argument, pair, pair.supertype[0], ct, result);
                    } else if (pair.supertype[0] === "CLRef") {
                        throw new Error("Typecheck: Not yet implemented");
                    } else if (pair.subtype[0] in arithmeticSig) {
                        // implicit non-lvalue arithmetic conversion
                        retv = matchNontermOrWildcard(parser, scope, argument, pair, pair.supertype[0], ct, result);
                        if (retv !== false) {
                            valueAction = "CLONE";
                        }
                    } else {
                        retv = matchNontermOrWildcard(parser, scope, argument, pair, pair.supertype[0], ct, result);
                    }
                    if (retv === false && pair.supertype[0] !== "LREF") {
                        const tmpSubRadical = parseInner(parser, scope, tmpSub);
                        const tmpSuperRadical = parseInner(parser, scope, tmpSuper);
                        if (tmpSubRadical === null || tmpSuperRadical === null) {
                            // parameter size misalignment
                            return;
                        }
                        const subParamArray = tmpSub.slice(tmpSub[0] === "CLREF" ? 1 : 0, tmpSub.length - tmpSubRadical.length);
                        let superParamArray = tmpSuper.slice(tmpSuper[0] === "CLREF" ? 1 : 0, tmpSuper.length - tmpSuperRadical.length);
                        let cast: CastAction | null;
                        if ((cast = tryImplicitCast(pair, subParamArray, superParamArray)) !== null) {
                            retv = null;
                            valueAction = "CAST";
                            result.castActions.push({ index: pair.firstLevelParamBreadth, cast });
                            pair.subtype = tmpSubRadical;
                            pair.supertype = tmpSuperRadical;
                        } else {
                            if (superParamArray[0] in nonTerm && tmpSuperWc.length > 0 && tmpSuperWc[0] in pair.wildcards && typeof (pair.wildcards[tmpSuperWc[0]]) !== "number") {
                                superParamArray = pair.wildcards[tmpSuperWc[0]] as string[];
                            } else if (superParamArray[0] === "MEMBERTYPE") {
                                tryMatchMemberType(superParamArray, tmpSuperRadical, [], []);
                            }
                            const subParamInline = (subParamArray[0] === "ARRAY" ? ["PTR", ...subParamArray.slice(1, -1)] : subParamArray).join(" ");
                            const superParamInline = superParamArray.join(" ");
                            if (superParamInline in ct.implicit && subParamInline in ct.implicit[superParamInline]) {
                                retv = null;
                                valueAction = "CAST";
                                result.castActions.push({ index: pair.firstLevelParamBreadth, cast: { type: "CTOR", ...ct.implicit[superParamInline][subParamInline] } });
                                pair.subtype = tmpSubRadical;
                                pair.supertype = tmpSuperRadical;
                            }
                            if (superParamInline.startsWith("CLASS initializer_list < ") && subParamInline.startsWith("CLASS __list_prototype < ")) {
                                pair.subtype = pair.subtype.slice(2);
                                const supertype = pair.supertype.slice(2);
                                pair.supertype = pair.supertype.slice(2);
                                retv = null;
                                let postSupertype: string[] | null = null;
                                let postSuperwc: number[] | null = null;
                                const listOps: ParseFunctionMatchInnerResult = {
                                    valueActions: [],
                                    castActions: [],
                                }
                                for (let i = 0; pair.subtype[0] !== ">" && retv === null; i++) {
                                    const tmpPair: FunctionMatchSigPair = {
                                        supertype: [...supertype],
                                        superwc: [...pair.superwc],
                                        firstLevelParamBreadth: i,
                                        paramDepth: 1,
                                        subtype: pair.subtype,
                                        subwc: pair.subwc,
                                        wildcards: pair.wildcards,
                                    };
                                    if (parseFunctionMatchInner(parser, "Parametric", tmpPair, ct, listOps) !== true) {
                                        retv = false;
                                        break;
                                    }
                                    pair.subtype = tmpPair.subtype;
                                    pair.subwc = tmpPair.subwc;
                                    postSupertype = tmpPair.supertype;
                                    postSuperwc = tmpPair.superwc;
                                }
                                if (retv !== false) {
                                    if (postSupertype === null || postSuperwc === null) {
                                        throw new Error("Typecheck: Not yet implemented (empty list)");
                                    }
                                    pair.supertype = postSupertype.slice(1);
                                    pair.superwc = postSuperwc;
                                    pair.subtype = pair.subtype.slice(1);
                                    valueAction = "CAST";
                                    result.castActions.push({ index: pair.firstLevelParamBreadth, cast: { type: "LIST", isInitList: true, ops: listOps, targetSig: [] } });
                                }
                            } else if (subParamInline.startsWith("CLASS __list_prototype < ") && superParamArray[0] === "CLASS" && superParamArray[1] in ct.list) {
                                const xsuperData = preparse(ct.list[superParamArray[1]].dst);
                                let xsubwc = pair.superwc;
                                const xsubParamArray: string[] = superParamArray.map((x) => {
                                    if (x in nonTerm) {
                                        const idx = xsubwc[0];
                                        xsubwc = xsubwc.slice(1);
                                        if (!(idx in pair.wildcards) || typeof (pair.wildcards[idx]) === "number") {
                                            throw new TypeParseError("Typecheck: Error attempting to convert from brace-enclosed list (internal error)")
                                        }
                                        return pair.wildcards[idx] as string[];
                                    } else {
                                        return x;
                                    }
                                }).flat();
                                const xsubData = preparse(xsubParamArray);
                                const xresult: ParseFunctionMatchInnerResult = {
                                    valueActions: new Array<"CLONE" | "BORROW" | "CAST">(),
                                    castActions: new Array<{ index: number, cast: CastAction }>(),
                                };
                                const xpair: FunctionMatchSigPair = {
                                    subtype: xsubData.sentence,
                                    subwc: xsubData.wildcardMap,
                                    supertype: xsuperData.sentence,
                                    superwc: xsuperData.wildcardMap,
                                    wildcards: new Array(),
                                    paramDepth: 0,
                                    firstLevelParamBreadth: 0,
                                };
                                const xretv = parseFunctionMatchInner(parser, 'ParamObject', xpair, ct, xresult);;
                                if (xretv) {
                                    for (const src of ct.list[xsubParamArray[1]].src) {
                                        if (retv !== false) {
                                            break;
                                        }
                                        const projectedSuper: string[] = src.map((x) => {
                                            if (x.startsWith("?")) {
                                                const idx = parseInt(x.slice(1));
                                                if (!(idx in xpair.wildcards) || typeof (xpair.wildcards[idx]) === "number") {
                                                    throw new TypeParseError("Typecheck: Error attempting to convert from brace-enclosed list (internal error)")
                                                }
                                                return xpair.wildcards[idx] as string[];
                                            } else {
                                                return x;
                                            }
                                        }).flat();
                                        retv = null;
                                        const zresult: ParseFunctionMatchInnerResult = {
                                            valueActions: [],
                                            castActions: [],
                                        }
                                        let zsuper = projectedSuper.slice(3);
                                        let zsub = tmpSub.slice(3);
                                        for (let i = 0; zsub[0] !== ">" && zsuper[0] !== ">" && retv === null; i++) {
                                            const zpair: FunctionMatchSigPair = {
                                                supertype: zsuper,
                                                superwc: pair.superwc,
                                                firstLevelParamBreadth: i,
                                                paramDepth: 1,
                                                subtype: zsub,
                                                subwc: pair.subwc,
                                                wildcards: pair.wildcards,
                                            };
                                            if (parseFunctionMatchInner(parser, "Parametric", zpair, ct, zresult) !== true) {
                                                retv = false;
                                                break;
                                            }
                                            zsuper = zpair.supertype;
                                            zsub = zpair.subtype;
                                            pair.subwc = zpair.subwc;
                                            pair.superwc = zpair.superwc;
                                        }
                                        if (retv !== false) {
                                            pair.supertype = tmpSuperRadical;
                                            pair.subtype = tmpSubRadical;
                                            valueAction = "CAST";
                                            result.castActions.push({ index: pair.firstLevelParamBreadth, cast: { type: "LIST", isInitList: false, ops: zresult, targetSig: xsubParamArray } });
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                pair.firstLevelParamBreadth++;
                result.valueActions.push(valueAction);
            } else {
                retv = matchNontermOrWildcard(parser, scope, argument, pair, pair.supertype[0], ct, result);
            }
        } else if (pair.supertype.length > 0 && "identifier" in argument) {
            if (!(pair.subtype.length > 0 && pair.subtype[0] === pair.supertype[0])) {
                retv = false;
                return;
            }
            pair.supertype = pair.supertype.slice(1);
            pair.subtype = pair.subtype.slice(1);
        } else if (pair.supertype.length > 0 && "positiveint" in argument) {
            if (!(pair.subtype.length > 0 && pair.subtype[0] === pair.supertype[0] && parseInt(pair.subtype[0]) >= 0)) {
                retv = false;
                return;
            }
            pair.supertype = pair.supertype.slice(1);
            pair.subtype = pair.subtype.slice(1);
        } else {
            retv = false;
        }
    });
    if (retv === null) {
        return true;
    }
    return retv;
}

/** Tests if `subtype` is a subset of or equivalent to `supertype`.
 *  @param parser The LL(1) Parser, created using `constructTypeParser`.
 *  @param subtype Sequence of tokens, which describes the subset of types.
 *  @param supertype Sequence of tokens, which describes the superset of types.
 *  @param scope The topmost nonterminal token of both statements (default = `'Type'`).
 *  @param strict_order Ensure that typed wildcard statements are going from ?0 in ascending order in the sequence (default = `true`).
 *  @param allow_lvalue_substitution allow substituting `"LREF Object"` to `"Object"` when checking lvalues in `subtype`.
 *  @remarks It is assumed that `parse(parser, subtype)` and `parse(parser, supertype)` return `true` (i.e., `subtype` and `supertype` are always valid). This function does NOT check if given sentences are valid.
 *  @throws TypeParseError on preparsing errors (see: `strict_order`).
 **/
export function parseSubset(parser: LLParser, subtype: string[], supertype: string[], scope: NonTerm = 'Type', strict_order = true, allow_lvalue_substitution = false): boolean {
    let subData = preparse(subtype, strict_order);
    let superData = preparse(supertype, strict_order);
    const pair: SubsetSigPair = {
        subtype: subData.sentence,
        subwc: subData.wildcardMap,
        supertype: superData.sentence,
        superwc: superData.wildcardMap,
        wildcards: new Array<number | string[]>(),
        allow_lvalue_substitution,
    }
    const p1: boolean = parseSubsetInner(parser, scope, pair);
    const p2: boolean = pair.subtype.length === 0 && pair.supertype.length === 0;
    return p1 && p2;
}

function parseSubsetInner(parser: LLParser, scope: NonTerm, pair: SubsetSigPair): boolean {
    let retv: boolean | null = null;
    parser[scope].forEach((argument) => {
        if (retv !== null) {
            return;
        }
        if (pair.supertype.length > 0 && pair.supertype[0] in argument) {
            if (pair.allow_lvalue_substitution && pair.subtype.length > 0 && pair.subtype[0] === "LREF" && !(pair.supertype[0] === "LREF" || pair.supertype[0] === "LRef")) {
                pair.subtype = pair.subtype.slice(1);
            }
            const innerScope: NonTerm | null = argument[pair.supertype[0]] as NonTerm | null;
            if (innerScope === null) {
                if (pair.supertype[0] === scope) {
                    // wildcard management
                    pair.supertype = pair.supertype.slice(1);
                    const subtype0 = pair.subtype;
                    let r = parseInner(parser, scope, pair.subtype);
                    if (r !== null) {
                        const wcInstance = subtype0.slice(0, subtype0.length - r.length);
                        let subresult: number | string[];
                        if (wcInstance.length === 1 && wcInstance[0] in nonTerm) {
                            // subset is also a wildcard
                            subresult = pair.subwc[0];
                            pair.subwc = pair.subwc.slice(1);
                        } else {
                            subresult = wcInstance;
                        }
                        const superwc: number | string[] = pair.wildcards[pair.superwc[0]];
                        if (superwc === undefined) {
                            pair.wildcards[pair.superwc[0]] = subresult;
                        } else if (typeof superwc === "number") {
                            if (superwc !== subresult) {
                                retv = false;
                            }
                        } else {
                            // superwc is an array
                            if (typeof subresult === "number" || !arrayValuesEqual(superwc, subresult)) {
                                retv = false;
                            }
                        }
                    }
                    if (retv === null) {
                        retv = r !== null;
                    }
                    if (retv === true && r !== null) {
                        pair.subtype = r;
                        pair.superwc = pair.superwc.slice(1);
                    }
                    return;
                } else {
                    if (!(pair.subtype.length > 0 && pair.subtype[0] === pair.supertype[0])) {
                        retv = false;
                        return;
                    }
                    pair.supertype = pair.supertype.slice(1);
                    pair.subtype = pair.subtype.slice(1);
                }
            } else {
                if (!parseSubsetInner(parser, innerScope as NonTerm, pair)) {
                    retv = false;
                    return;
                }
            }
        } else if (pair.supertype.length > 0 && "identifier" in argument) {
            if (!(pair.subtype.length > 0 && pair.subtype[0] === pair.supertype[0])) {
                retv = false;
                return;
            }
            pair.supertype = pair.supertype.slice(1);
            pair.subtype = pair.subtype.slice(1);
        } else if (pair.supertype.length > 0 && "positiveint" in argument) {
            if (!(pair.subtype.length > 0 && pair.subtype[0] === pair.supertype[0] && parseInt(pair.subtype[0]) >= 0)) {
                retv = false;
                return;
            }
            pair.supertype = pair.supertype.slice(1);
            pair.subtype = pair.subtype.slice(1);
        } else {
            retv = false;
        }
    });
    if (retv === null) {
        return true;
    }
    return retv;
}

/** Outputs a string given a variable type sentence and name (optionally).
 *  @param parser The LL(1) Parser, created using `constructTypeParser`.
 *  @param sentence Sequence of tokens, which describes the variable type.
 *  @param scope The topmost nonterminal token of both statements (default = `'Type'`).
 *  @param strict_order Ensure that typed wildcard statements are going from ?0 in ascending order in the sequence (default = `true`).
 *  @throws TypeParseError on invalid preparsing (see: `strict_order`).
 **/
export function parsePrint(parser: LLParser, sentence: string[], varName: string | null, scope: NonTerm = 'Type', strict_order: boolean = true): string | null {
    const preparseResult = preparse(sentence, strict_order);
    let isIdentifier: boolean = false;
    let keyFreqMap: { [key: string]: number } = {};
    let i: number = 0;
    let wcCount: number[] = [];
    for (const word of preparseResult.sentence) {
        if (!isIdentifier) {
            if (word in nonTerm) {
                const wci = preparseResult.wildcardMap[i++];
                if (!(wci in wcCount)) {
                    if (!(word in keyFreqMap)) {
                        keyFreqMap[word] = 1;
                    } else {
                        keyFreqMap[word]++;
                    }
                    wcCount[wci] = keyFreqMap[word];
                }
            }
            if (word === "CLASS" || word === "MEMBERTYPE") {
                isIdentifier = true;
            }
        } else {
            isIdentifier = false;
        }
    }
    let wcNames: string[] = [];
    isIdentifier = false;
    i = 0;
    for (const word of preparseResult.sentence) {
        if (!isIdentifier) {
            if (word in nonTerm) {
                const wci = preparseResult.wildcardMap[i++];
                if (!(wci in wcNames)) {
                    wcNames[wci] = "T" + word + ((keyFreqMap[word] > 1) ? wcCount[wci] : "")
                }
            }
            if (word === "CLASS" || word === "MEMBERTYPE") {
                isIdentifier = true;
            }
        } else {
            isIdentifier = false;
        }
    }
    const inout = { sentence: preparseResult.sentence, output: [], wcMap: preparseResult.wildcardMap, wcNames, namePass: true, varName };
    parsePrintInner(parser, scope, inout);
    return inout.output.join("");
}

function parsePrintInner(parser: LLParser, scope: NonTerm, inout: { sentence: string[], output: string[], wcMap: number[], wcNames: string[], namePass: boolean, varName: string | null }): void {
    let endLoop: boolean = false;
    let rhs: string | null = null;
    parser[scope].forEach((argument) => {
        if (endLoop) {
            return;
        }
        if (inout.sentence.length > 0 && inout.sentence[0] in argument) {
            const innerScope: NonTerm | null = argument[inout.sentence[0]] as NonTerm | null;
            const head = inout.sentence[0];
            if (innerScope === null) {
                if (head === scope) {
                    inout.output.push(inout.wcNames[inout.wcMap[0]]);
                    inout.wcMap = inout.wcMap.slice(1);
                    endLoop = true;
                } else {
                    switch (head) {
                        case "FUNCTION":
                            break;
                        case "MEMBERTYPE":
                            inout.output.push("typename ");
                            rhs = "::" + inout.sentence[1];
                            break;
                        case "LREF":
                            rhs = " &";
                            break;
                        case "CLREF":
                            inout.output.push("const ");
                            rhs = " &";
                            break;
                        case "PTR":
                            rhs = "*";
                            break;
                        case ">":
                            if (inout.output[inout.output.length - 1] !== "<") {
                                inout.output.push(head);
                            } else {
                                inout.output.pop();
                            }
                            break;
                        case "<":
                        case "(":
                        case ")":
                            inout.output.push(head);
                            break;
                        case "I8":
                        case "U8":
                        case "I16":
                        case "U16":
                        case "I32":
                        case "U32":
                        case "I64":
                        case "U64":
                        case "F32":
                        case "F32":
                        case "F64":
                        case "F64":
                        case "BOOL":
                            inout.output.push(variables.arithmeticProperties[head].name);
                            break;
                    }
                }
                inout.sentence = inout.sentence.slice(1);
            } else {
                if (scope === "Function" && innerScope === "FunctionParamOrEnd") {
                    inout.namePass = false;
                }
                parsePrintInner(parser, innerScope as NonTerm, inout);
            }
        } else if (inout.sentence.length > 0 && "identifier" in argument) {
            if (scope !== "MemberType") {
                inout.output.push(inout.sentence[0]);
            }
            inout.sentence = inout.sentence.slice(1);
        } else if (inout.sentence.length > 0 && "positiveint" in argument) {
            if (!(parseInt(inout.sentence[0]) > 0)) {
                throw new TypeParseError(`Typecheck: Malformed type signature`)
            } else {
                inout.sentence = inout.sentence.slice(1);
            }
        } else {
            throw new TypeParseError(`Typecheck: Malformed type signature`)
        }
    });
    if (scope === "Parametric" && !(inout.sentence[0] === ")" || inout.sentence[0] === ">")) {
        inout.output.push(", ");
    }
    if (scope === "Return") {
        inout.output.pop();
        if (inout.namePass && inout.varName !== null) {
            if (inout.output[inout.output.length - 1] !== " &") {
                inout.output.push(" ");
            }
            inout.output.push(inout.varName);
        }
    }
    if (rhs !== null) {
        inout.output.push(rhs);
    }
}

/** stub.
 *  Does NOT accept incomplete and/or template types.
 *  Does not throw an error, returns null on failure.
 *  @param parser The LL(1) Parser, created using `constructTypeParser`.
 *  @param sentence Sequence of tokens, which describes the variable type.
 *  @param scope The topmost nonterminal token of both statements (default = `'Type'`).
 *  @param strict_order Ensure that typed wildcard statements are going from ?0 in ascending order in the sequence (default = `true`).
 *  @returns ObjectType, on successful parse conversion, or null on failure
 **/
export function parseToObjectType(parser: LLParser, sentence: string[], scope: NonTerm = 'Type'): AnyType | null {
    if (preparse(sentence).wildcardMap.length > 0) {
        return null;
    }
    const inout = { sentence, output: null };
    parseToObjectTypeInner(parser, scope, inout);
    return inout.output;
}

function parseToObjectTypeInner(parser: LLParser, scope: NonTerm, inout: { sentence: string[], output: AnyType | null }): void {
    let endLoop: boolean = false;
    let localType: AnyType | null = null;
    let upperType: AnyType | null = null;
    parser[scope].forEach((argument) => {
        if (inout.sentence === null || endLoop) {
            return;
        }
        if (inout.sentence.length > 0 && inout.sentence[0] in argument) {
            const innerScope: NonTerm | null = argument[inout.sentence[0]] as NonTerm | null;
            const head = inout.sentence[0];
            if (innerScope === null) {
                if (inout.sentence[0] === scope) {
                    endLoop = true;
                }
                inout.sentence = inout.sentence.slice(1);
                switch (head) {
                    case "FUNCTION":
                        break;
                    case "CLASS":
                        localType = variables.classType(inout.sentence[0], [], null);
                        break;
                    case "LREF":
                        break;
                    case "CLREF":
                        break;
                    case "PTR":
                        localType = variables.pointerType(variables.arithmeticNumType("I8"), null);
                        break;
                    case "I8":
                    case "U8":
                    case "I16":
                    case "U16":
                    case "I32":
                    case "U32":
                    case "F32":
                    case "F64":
                    case "BOOL":
                        localType = variables.arithmeticNumType(head);
                        break;
                    case "I64":
                    case "U64":
                        localType = variables.arithmeticBigType(head);
                        break;
                }
            } else {
                if (upperType === null) {
                    upperType = inout.output ?? localType;
                }
                inout.output = upperType;
                parseToObjectTypeInner(parser, innerScope as NonTerm, inout);
                if (inout.output === null) {
                    return;
                }
                if (upperType !== null && inout.output !== upperType) {
                    switch (upperType.sig) {
                        case "FUNCTION":
                            debugger; // unimplemented
                            inout.output = null;
                            localType = null;
                            break;
                        case "CLASS":
                            if (/*inout.output.sig !== "VOID" &&*/ inout.output.sig !== "FUNCTION") {
                                if (scope === "Parametric") {
                                    upperType.templateSpec.push(inout.output);
                                }
                            } else {
                                localType = null;
                                inout.output = null;
                            }
                            break;
                        case "PTR":
                            /*if (inout.output.sig !== "VOID") {*/
                            upperType = variables.pointerType(inout.output, null);
                            /*} else {
                                localType = null;
                                inout.output = null;
                            }*/
                            break;
                        default:
                            localType = null;
                            inout.output = null;
                            break;
                    }
                }
            }
        } else if (inout.sentence.length > 0 && "identifier" in argument) {
            inout.sentence = inout.sentence.slice(1);
        } else if (inout.sentence.length > 0 && "positiveint" in argument) {
            if (!(parseInt(inout.sentence[0]) > 0)) {
                return null;
            } else {
                inout.sentence = inout.sentence.slice(1);
            }
        } else {
            return null;
        }
    });
    if (localType) {
        inout.output = localType;
    }
}

