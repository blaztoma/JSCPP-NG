import { CRuntime } from "../rt";
import * as common from "../shared/common";
import * as ios_base_impl from "../shared/ios_base_impl";
import { ArithmeticBigVariable, ArithmeticNumVariable, ClassVariable, Gen, InitArithmeticBigVariable, InitArithmeticNumValue, InitArithmeticNumVariable, InitArithmeticVariable, InitPointerVariable, MaybeLeft, PointerVariable, Variable, variables } from "../variables";
import * as unixapi from "../shared/unixapi";
import * as utf8 from "../utf8";
import { IStreamType, IStreamVariable, OStreamType, OStreamVariable } from "../shared/ios_base";
import { sizeUntilNull, StringVariable } from "../shared/string_utils";

export = {
    load(rt: CRuntime) {

        rt.include("cctype"); // gcc-specific
        rt.include("string");
        rt.include("cstdio"); // gcc-specific
        rt.include("iomanip"); // ensure manipulators like boolalpha are available via <iostream>
        const charType = variables.arithmeticNumType("I8");
        rt.defineStruct("{global}", "istream", [
            {
                name: "buf",
                variable: variables.indexPointer<ArithmeticNumVariable>(variables.arrayMemory<ArithmeticNumVariable>(charType, []), 0, false, "SELF")
            },
            {
                name: "fd",
                variable: variables.uninitArithmeticNum("I32", "SELF"),
            },
            {
                name: "eofbit",
                variable: variables.arithmeticNum("BOOL", 0, "SELF"),
            },
            {
                name: "badbit",
                variable: variables.arithmeticNum("BOOL", 0, "SELF"),
            },
            {
                name: "failbit",
                variable: variables.arithmeticNum("BOOL", 0, "SELF"),
            },
            {
                name: "boolalpha",
                variable: variables.arithmeticNum("BOOL", 0, "SELF"),
            },
            {
                name: "skipws",
                variable: variables.arithmeticNum("BOOL", 1, "SELF"),
            },
        ], {});
        const cinType = rt.simpleType(["istream"]) as MaybeLeft<IStreamType>;
        const cin = variables.clone(rt, rt.defaultValue(cinType.t, "SELF") as IStreamVariable, "SELF", false);
        cin.members.fd.value = unixapi.FD_STDIN;

        rt.addToNamespace("std", "cin", cin, true);

        ios_base_impl.defineOstream(rt, "ostream", []);
        const coutType = rt.simpleType(["ostream"]) as MaybeLeft<OStreamType>;
        const cout = variables.clone(rt, rt.defaultValue(coutType.t, "SELF") as OStreamVariable, "SELF", false);
        cout.members.fd.value = unixapi.FD_STDOUT;

        rt.addToNamespace("std", "cout", cout, true);

        if (!("ws_t" in rt.typeMap)) {
            const endl = rt.getCharArrayFromString("\n");
            rt.addToNamespace("std", "endl", endl, true);

            rt.defineStruct("{global}", "ws_t", [], {});
            const ws: ClassVariable = {
                t: {
                    sig: "CLASS",
                    identifier: "ws_t",
                    memberOf: null,
                    templateSpec: [],
                },
                isConst: true,
                lvHolder: "SELF",
                members: {},
                state: "INIT"
            }
            rt.addToNamespace("std", "ws", ws, true);
        }

        function readChar(rt: CRuntime, l: IStreamVariable): Gen<InitArithmeticNumVariable> {
            const stdio = rt.stdio();
            stdio.cinStop();

            const retv = variables.uninitArithmeticNum("I32", null);
            const inputPromise: Promise<[boolean, IStreamVariable, ArithmeticNumVariable]> = new Promise((resolve) => {
                let result = l.members.buf;
                // + 1 because of trailing '\0'
                if (result.index + 1 >= result.pointee.values.length) {
                    stdio.getInput().then((result) => {
                        variables.indexPointerAssign(rt, l.members.buf, rt.getCharArrayFromString(result.concat("\n")).pointee, 0);
                        if (rt.config.printStdin === true) {
                            unixapi.write(rt, [], variables.arithmeticNum("I32", unixapi.FD_STDOUT, null), l.members.buf, variables.arithmeticNum("I32", sizeUntilNull(rt, l.members.buf), null));
                        }
                        resolve([false, l, retv]);
                    }, () => {
                        l.members.eofbit.value = 1;
                        l.members.failbit.value = 1;
                        try {
                            rt.raiseException("Unexpected end of input");
                        } catch (err) {
                            stdio.promiseError(err);
                        }
                    });
                } else {
                    resolve([true, l, retv]);
                }
            });
            inputPromise.then(([_is_raw, l, retv]) => {
                let buf = l.members.buf;
                if (l.members.eofbit.value === 1 || buf.pointee.values.length <= buf.index) {
                    l.members.eofbit.value = 1;
                    l.members.failbit.value = 1;
                    return variables.arithmeticNum("I32", -1, null);
                }
                const topv = rt.arithmeticNumValue2(variables.arrayMember(buf.pointee, buf.index));

                //variables.arithmeticAssign(retv, topv, rt.raiseException);
                retv.state = "INIT";
                (retv as InitArithmeticNumValue).value = topv;
                stdio.cinProceed();
            }).catch((err) => {
                stdio.promiseError(err);
            })
            function* stubGenerator() {
                yield retv as InitArithmeticNumVariable;
                return retv as InitArithmeticNumVariable;
            }
            return stubGenerator();
        }

        const whitespaceChars = [0, 9, 10, 11, 12, 13, 32];

        common.regOps(rt, [{
            op: "o(_>>_)",
            type: "FUNCTION LREF CLASS istream < > ( LREF CLASS istream < > LREF Arithmetic )",
            *default(rt: CRuntime, _templateTypes, ...args: Variable[]): Gen<IStreamVariable> {
                const [l, r] = args as [IStreamVariable, ArithmeticNumVariable | ArithmeticBigVariable];
                const eofbit = l.members.eofbit;
                const failbit = l.members.failbit;
                const buf = l.members.buf;
                let char: InitArithmeticNumVariable;
                while (true) {
                    char = yield* readChar(rt, l);
                    if (eofbit.value === 1 || failbit.value === 1) {
                        failbit.value = 1;
                        return l;
                    }
                    if (l.members.skipws.value === 0 || !(whitespaceChars.includes(char.value))) {
                        break;
                    }
                    variables.indexPointerAssignIndex(rt, buf, buf.index + 1);
                }
                if (r.t.sig === "I8") {
                    variables.arithmeticNumAssign(rt, r as ArithmeticNumVariable, char.value);
                    variables.indexPointerAssignIndex(rt, buf, buf.index + 1);
                    const stdio = rt.stdio();
                    if (stdio.isMochaTest) {
                        stdio.write(String.fromCodePoint(char.value) + "\n");
                    }
                } else {
                    let wordValues: number[] = [];
                    while (!(whitespaceChars.includes(char.value))) {
                        wordValues.push(char.value);
                        variables.indexPointerAssignIndex(rt, buf, buf.index + 1);
                        char = yield* readChar(rt, l);
                        if (eofbit.value === 1 || failbit.value === 1) {
                            failbit.value = 1;
                            return l;
                        }
                    }
                    if (wordValues.length === 0) {
                        failbit.value = 1;
                        return l;
                    }
                    const wordString = utf8.fromUtf8CharArray(new Uint8Array(wordValues));
                    const stdio = rt.stdio();
                    if (stdio.isMochaTest) {
                        stdio.write(wordString + "\n");
                    }

                    // Special handling for reading into BOOL: accept "true"/"false" (case-insensitive),
                    // and also numeric 0/1 (or any non-zero as true) for user convenience.
                    let handled = false;
                    if (r.t.sig === "BOOL") {
                        const ws = wordString.trim().toLowerCase();
                        if (ws === "true" || ws === "false") {
                            variables.arithmeticNumAssign(rt, r as ArithmeticNumVariable, ws === "true" ? 1 : 0);
                            handled = true;
                        }
                    }

                    if (!handled) {
                        if (r.t.sig in variables.arithmeticNumSig) {
                            const num = Number.parseFloat(wordString);
                            if (Number.isNaN(num)) {
                                l.members.failbit.value = 1;
                                return l;
                            }
                            variables.arithmeticNumAssign(rt, r as ArithmeticNumVariable, num);
                        } else {
                            let num: bigint;
                            try {
                                num = BigInt(wordString);
                            } catch (e) {
                                l.members.failbit.value = 1;
                                return l;
                            }
                            variables.arithmeticBigAssign(rt, r as ArithmeticBigVariable, num);
                            rt.adjustArithmeticBigValue(r as InitArithmeticBigVariable);
                        }
                    }

                }
                rt.adjustArithmeticAnyValue((r as InitArithmeticVariable));
                return l;
            }
        },
        {
            op: "o(_>>_)",
            type: "FUNCTION LREF CLASS istream < > ( LREF CLASS istream < > PTR I8 )",
            *default(rt: CRuntime, _templateTypes, ...args: Variable[]): Gen<IStreamVariable> {
                const [l, _r] = args as [IStreamVariable, PointerVariable<ArithmeticNumVariable>];
                const r = variables.asTrueIndexPointerOfElem(_r, variables.uninitArithmeticNum("I8", null)) ?? rt.raiseException("Unexpected null- or invalid pointer " + (rt.getVariableNames(_r) ?? "<internal>"));
                const eofbit = l.members.eofbit;
                const failbit = l.members.failbit;
                const buf = l.members.buf;
                let char: InitArithmeticNumVariable;
                while (true) {
                    char = yield* readChar(rt, l);
                    if (eofbit.value === 1 || failbit.value === 1) {
                        failbit.value = 1;
                        return l;
                    }
                    if (!(whitespaceChars.includes(char.value))) {
                        break;
                    }
                    variables.indexPointerAssignIndex(rt, buf, buf.index + 1);
                }

                let i = 0;
                while (!(whitespaceChars.includes(char.value))) {
                    variables.arithmeticNumValueAssign(rt, (rt.unbound(variables.arrayMember(r.pointee, r.index + i)) as ArithmeticNumVariable), char.value)
                    i++;
                    variables.indexPointerAssignIndex(rt, buf, buf.index + 1);
                    char = yield* readChar(rt, l);
                    if (eofbit.value === 1 || failbit.value === 1) {
                        failbit.value = 1;
                        return l;
                    }
                }
                variables.arithmeticNumValueAssign(rt, (rt.unbound(variables.arrayMember(r.pointee, r.index + i)) as ArithmeticNumVariable), 0)
                if (i === 0) {
                    failbit.value = 1;
                    return l;
                }

                return l;
            }
        },
        {
            op: "o(_>>_)",
            type: "FUNCTION LREF CLASS istream < > ( LREF CLASS istream < > CLREF CLASS ws_t < > )",
            *default(rt: CRuntime, _templateTypes, ...args: Variable[]): Gen<IStreamVariable> {
                const [l, _r] = args as [IStreamVariable, ClassVariable];
                const eofbit = l.members.eofbit;
                const failbit = l.members.failbit;
                const buf = l.members.buf;
                let char: InitArithmeticNumVariable;
                while (true) {
                    char = yield* readChar(rt, l);
                    if (eofbit.value === 1 || failbit.value === 1) {
                        failbit.value = 1;
                        return l;
                    }
                    if (!(whitespaceChars.includes(char.value))) {
                        break;
                    }
                    variables.indexPointerAssignIndex(rt, buf, buf.index + 1);
                }


                return l;
            }
        },
        {
            op: "o(_>>_)",
            type: "FUNCTION LREF CLASS istream < > ( LREF CLASS istream < > CLREF CLASS string < > )",
            *default(rt: CRuntime, _templateTypes, ...args: Variable[]): Gen<IStreamVariable> {
                const [l, r] = args as [IStreamVariable, StringVariable];
                const memory = variables.arrayMemory<ArithmeticNumVariable>(variables.arithmeticNumType("I8"), []);
                const eofbit = l.members.eofbit;
                const failbit = l.members.failbit;
                const buf = l.members.buf;
                let char: InitArithmeticNumVariable;
                while (true) {
                    char = yield* readChar(rt, l);
                    if (eofbit.value === 1 || failbit.value === 1) {
                        failbit.value = 1;
                        return l;
                    }
                    if (!(whitespaceChars.includes(char.value))) {
                        break;
                    }
                    variables.indexPointerAssignIndex(rt, buf, buf.index + 1);
                }

                let i = 0;
                while (!(whitespaceChars.includes(char.value))) {
                    memory.values.push(variables.arithmeticNum("I8", char.value, { array: memory, index: memory.values.length }));
                    i++;
                    variables.indexPointerAssignIndex(rt, buf, buf.index + 1);
                    char = yield* readChar(rt, l);
                    if (eofbit.value === 1 || failbit.value === 1) {
                        failbit.value = 1;
                        return l;
                    }
                }
                memory.values.push(variables.arithmeticNum("I8", 0, { array: memory, index: memory.values.length }));
                r.members._ptr = variables.indexPointer(memory, 0, false, "SELF");
                r.members._size.value = memory.values.length - 1;
                if (i === 0) {
                    failbit.value = 1;
                    return l;
                }

                return l;
            }
        },
        ]);

        function _getline(rt: CRuntime, l: IStreamVariable, _s: InitPointerVariable<ArithmeticNumVariable>, _count: ArithmeticNumVariable, _delim: ArithmeticNumVariable): IStreamVariable {
            const stdio = rt.stdio();
            stdio.cinStop();

            const inputPromise: Promise<[boolean, IStreamVariable]> = new Promise((resolve) => {
                let result = l.members.buf;
                // + 1 because of trailing '\0'
                if (result.index + 1 >= result.pointee.values.length) {
                    stdio.getInput().then((result) => {
                        variables.indexPointerAssign(rt, l.members.buf, rt.getCharArrayFromString(result.concat("\n")).pointee, 0);
                        resolve([false, l]);
                    }, () => {
                        l.members.eofbit.value = 1;
                        l.members.failbit.value = 1;
                        try {
                            rt.raiseException("Unexpected end of input");
                        } catch (err) {
                            stdio.promiseError(err);
                        }
                    });
                } else {
                    resolve([true, l]);
                }
            });
            inputPromise.then(([is_raw, l]) => {
                let b = l.members.buf;
                const count = rt.arithmeticNumValue(_count);
                const delim = rt.arithmeticNumValue(_delim);
                const s = variables.asTrueIndexPointerOfElem(_s, variables.uninitArithmeticNum("I8", null));
                if (s === null) {
                    rt.raiseException("Unexpected null- or invalid pointer" + (rt.getVariableNames(_s) ?? "<internal>"));
                }
                const oldiptr = variables.clone(rt, b, "SELF", false);
                if (b.index >= b.pointee.values.length) {
                    l.members.eofbit.value = 1;
                }
                let cnt = 0;
                while (cnt < count - 1) {
                    const si = rt.unbound(variables.arrayMember(s.pointee, s.index + cnt)) as ArithmeticNumVariable;
                    const bi = rt.arithmeticNumValue2(variables.arrayMember(b.pointee, b.index));
                    if (bi === delim || bi === 0) {
                        // consume the delimiter
                        variables.indexPointerAssignIndex(rt, b, b.index + 1);
                        variables.arithmeticNumAssign(rt, si, 0);
                        break;
                    }
                    variables.arithmeticNumAssign(rt, si, bi);
                    variables.indexPointerAssignIndex(rt, b, b.index + 1);
                    cnt++;
                }
                if (cnt === 0) {
                    l.members.failbit.value = 1;
                }

                if (!is_raw) {
                    unixapi.write(rt, [], variables.arithmeticNum("I32", unixapi.FD_STDOUT, null), oldiptr, variables.arithmeticNum("I32", sizeUntilNull(rt, oldiptr), null));
                }


                stdio.cinProceed();
            }).catch((err) => {
                //console.log(err);
                stdio.promiseError(err);
            })
            return l;
        }
        function _getlineStr(rt: CRuntime, l: IStreamVariable, s: StringVariable, _delim: ArithmeticNumVariable): IStreamVariable {
            const stdio = rt.stdio();
            stdio.cinStop();

            const inputPromise: Promise<[boolean, IStreamVariable]> = new Promise((resolve) => {
                let result = l.members.buf;
                // + 1 because of trailing '\0'
                if (result.index + 1 >= result.pointee.values.length) {
                    stdio.getInput().then((result) => {
                        variables.indexPointerAssign(rt, l.members.buf, rt.getCharArrayFromString(result.concat("\n")).pointee, 0);
                        resolve([false, l]);
                    }, () => {
                        l.members.eofbit.value = 1;
                        l.members.failbit.value = 1;
                        try {
                            rt.raiseException("Unexpected end of input");
                        } catch (err) {
                            stdio.promiseError(err);
                        }
                    });
                } else {
                    resolve([true, l]);
                }
            });
            inputPromise.then(([is_raw, l]) => {
                let b = l.members.buf;
                const delim = rt.arithmeticValue(_delim);
                const i8type = s.members._ptr.t.pointee;
                const oldiptr = variables.clone(rt, b, "SELF", false);
                if (b.index >= b.pointee.values.length) {
                    l.members.eofbit.value = 1;
                    l.members.failbit.value = 1;
                    return;
                }
                let cnt = 0;
                const memory = variables.arrayMemory<ArithmeticNumVariable>(i8type, []);
                while (true) {
                    const bi = rt.arithmeticNumValue2(variables.arrayMember(b.pointee, b.index));
                    if (bi === delim || bi === 0) {
                        // consume the delimiter
                        variables.indexPointerAssignIndex(rt, b, b.index + 1);
                        break;
                    }
                    memory.values.push(variables.arithmeticNum(i8type.sig, bi, { array: memory, index: cnt }));
                    variables.indexPointerAssignIndex(rt, b, b.index + 1);
                    cnt++;
                }
                memory.values.push(variables.arithmeticNum(i8type.sig, 0, { array: memory, index: cnt }));
                if (cnt === 0) {
                    l.members.failbit.value = 1;
                }
                variables.indexPointerAssign(rt, s.members._ptr, memory, 0);
                s.members._size.value = cnt;

                if (!is_raw) {
                    unixapi.write(rt, [], variables.arithmeticNum("I32", unixapi.FD_STDOUT, null), oldiptr, variables.arithmeticNum("I32", sizeUntilNull(rt, oldiptr), null));
                }


                stdio.cinProceed();
            }).catch((err) => {
                //console.log(err);
                stdio.promiseError(err);
            })
            return l;
        }

        common.regMemberFuncs(rt, "istream", [
            {
                op: "get",
                type: "FUNCTION I32 ( LREF CLASS istream < > )",
                *default(rt: CRuntime, _templateTypes, ...args: Variable[]): Gen<ArithmeticNumVariable> {
                    const [l] = args as [IStreamVariable];
                    const retv = yield* readChar(rt, l);
                    const buf = l.members.buf;
                    variables.indexPointerAssignIndex(rt, buf, buf.index + 1);
                    return retv;
                }
            },
            {
                op: "getline",
                type: "FUNCTION LREF CLASS istream < > ( LREF CLASS istream < > PTR I8 I32 I8 )",
                default(rt: CRuntime, _templateTypes, ...args: Variable[]): IStreamVariable {
                    const [l, _s, _count, _delim] = args as [IStreamVariable, InitPointerVariable<ArithmeticNumVariable>, ArithmeticNumVariable, ArithmeticNumVariable];
                    return _getline(rt, l, _s, _count, _delim);
                }
            },
            {
                op: "getline",
                type: "FUNCTION LREF CLASS istream < > ( LREF CLASS istream < > PTR I8 I32 )",
                default(rt: CRuntime, _templateTypes, ...args: Variable[]): IStreamVariable {
                    const [l, _s, _count] = args as [IStreamVariable, InitPointerVariable<ArithmeticNumVariable>, ArithmeticNumVariable];
                    return _getline(rt, l, _s, _count, variables.arithmeticNum("I8", 10, "SELF"));
                }
            }
        ]);

        common.regGlobalFuncs(rt, [
            {
                op: "getline",
                type: "FUNCTION LREF CLASS istream < > ( LREF CLASS istream < > CLREF CLASS string < > I8 )",
                default(rt: CRuntime, _templateTypes, ...args: Variable[]): IStreamVariable {
                    const [input, str, delim] = args as [IStreamVariable, StringVariable, ArithmeticNumVariable];
                    _getlineStr(rt, input, str, delim);
                    return input;
                }
            },
            {
                op: "getline",
                type: "FUNCTION LREF CLASS istream < > ( LREF CLASS istream < > CLREF CLASS string < > )",
                default(rt: CRuntime, _templateTypes, ...args: Variable[]): IStreamVariable {
                    const [input, str] = args as [IStreamVariable, StringVariable];
                    _getlineStr(rt, input, str, variables.arithmeticNum("I8", 10, null));
                    return input;
                }
            },
        ]);

    }
}


