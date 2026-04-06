import { CRuntime } from "../rt";
import * as common from "../shared/common";
import * as ios_base_impl from "../shared/ios_base_impl";
import { ArithmeticVariable, ClassVariable, Gen, InitArithmeticValue, InitArithmeticVariable, InitPointerVariable, MaybeLeft, PointerVariable, variables } from "../variables";
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
        const charType = variables.arithmeticType("I8");
        rt.defineStruct("{global}", "istream", [
            {
                name: "buf",
                variable: variables.indexPointer<ArithmeticVariable>(variables.arrayMemory(charType, []), 0, false, "SELF")
            },
            {
                name: "fd",
                variable: variables.uninitArithmetic("I32", "SELF"),
            },
            {
                name: "eofbit",
                variable: variables.arithmetic("BOOL", 0, "SELF"),
            },
            {
                name: "badbit",
                variable: variables.arithmetic("BOOL", 0, "SELF"),
            },
            {
                name: "failbit",
                variable: variables.arithmetic("BOOL", 0, "SELF"),
            },
            {
                name: "boolalpha",
                variable: variables.arithmetic("BOOL", 0, "SELF"),
            },
            {
                name: "skipws",
                variable: variables.arithmetic("BOOL", 1, "SELF"),
            },
        ], {});
        const cinType = rt.simpleType(["istream"]) as MaybeLeft<IStreamType>;
        const cin = variables.clone(rt, rt.defaultValue(cinType.t, "SELF") as IStreamVariable, "SELF", false);
        variables.arithmeticAssign(rt, cin.v.members.fd, unixapi.FD_STDIN);

        rt.addToNamespace("std", "cin", cin, true);

        ios_base_impl.defineOstream(rt, "ostream", []);
        const coutType = rt.simpleType(["ostream"]) as MaybeLeft<OStreamType>;
        const cout = variables.clone(rt, rt.defaultValue(coutType.t, "SELF") as OStreamVariable, "SELF", false);
        variables.arithmeticAssign(rt, cout.v.members.fd, unixapi.FD_STDOUT);

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
                v: {
                    isConst: true,
                    lvHolder: "SELF",
                    members: {},
                    state: "INIT"
                }
            }
            rt.addToNamespace("std", "ws", ws, true);
        }

        function readChar(rt: CRuntime, l: IStreamVariable): Gen<InitArithmeticVariable> {
            const stdio = rt.stdio();
            stdio.cinStop();

            const retv = variables.uninitArithmetic("I32", null);
            const inputPromise: Promise<[boolean, IStreamVariable, ArithmeticVariable]> = new Promise((resolve) => {
                let result = l.v.members.buf;
                // + 1 because of trailing '\0'
                if (result.v.index + 1 >= result.v.pointee.values.length) {
                    stdio.getInput().then((result) => {
                        variables.indexPointerAssign(rt, l.v.members.buf, rt.getCharArrayFromString(result.concat("\n")).v.pointee, 0);
                        if (rt.config.printStdin === true) {
                            unixapi.write(rt, [], variables.arithmetic("I32", unixapi.FD_STDOUT, null), l.v.members.buf, variables.arithmetic("I32", sizeUntilNull(rt, l.v.members.buf), null));
                        }
                        resolve([false, l, retv]);
                    }, () => {
                        l.v.members.eofbit.v.value = 1;
                        l.v.members.failbit.v.value = 1;
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
                let buf = l.v.members.buf;
                if (l.v.members.eofbit.v.value === 1 || buf.v.pointee.values.length <= buf.v.index) {
                    l.v.members.eofbit.v.value = 1;
                    l.v.members.failbit.v.value = 1;
                    return variables.arithmetic("I32", -1, null);
                }
                const topv = rt.arithmeticValue(variables.arrayMember(buf.v.pointee, buf.v.index));

                //variables.arithmeticAssign(retv, topv, rt.raiseException);
                retv.v.state = "INIT";
                (retv.v as InitArithmeticValue).value = topv;
                stdio.cinProceed();
            }).catch((err) => {
                stdio.promiseError(err);
            })
            function* stubGenerator() {
                yield retv as InitArithmeticVariable;
                return retv as InitArithmeticVariable;
            }
            return stubGenerator();
        }

        const whitespaceChars = [0, 9, 10, 32];

        common.regOps(rt, [{
            op: "o(_>>_)",
            type: "FUNCTION LREF CLASS istream < > ( LREF CLASS istream < > LREF Arithmetic )",
            *default(rt: CRuntime, _templateTypes: [], l: IStreamVariable, r: ArithmeticVariable): Gen<IStreamVariable> {
                const eofbit = l.v.members.eofbit;
                const failbit = l.v.members.failbit;
                const buf = l.v.members.buf;
                let char: InitArithmeticVariable;
                while (true) {
                    char = yield* readChar(rt, l);
                    if (eofbit.v.value === 1 || failbit.v.value === 1) {
                        failbit.v.value = 1;
                        return l;
                    }
                    if (l.v.members.skipws.v.value === 0 || !(whitespaceChars.includes(char.v.value))) {
                        break;
                    }
                    variables.indexPointerAssignIndex(rt, buf, buf.v.index + 1);
                }
                if (r.t.sig === "I8") {
                    variables.arithmeticAssign(rt, r, char.v.value);
                    variables.indexPointerAssignIndex(rt, buf, buf.v.index + 1);
                    const stdio = rt.stdio();
                    if (stdio.isMochaTest) {
                        stdio.write(String.fromCodePoint(char.v.value) + "\n");
                    }
                } else {
                    let wordValues: number[] = [];
                    while (!(whitespaceChars.includes(char.v.value))) {
                        wordValues.push(char.v.value);
                        variables.indexPointerAssignIndex(rt, buf, buf.v.index + 1);
                        char = yield* readChar(rt, l);
                        if (eofbit.v.value === 1 || failbit.v.value === 1) {
                            failbit.v.value = 1;
                            return l;
                        }
                    }
                    if (wordValues.length === 0) {
                        failbit.v.value = 1;
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
                            variables.arithmeticAssign(rt, r, ws === "true" ? 1 : 0);
                            handled = true;
                        }
                    }

                    if (!handled) {
                        const num = Number.parseFloat(wordString);
                        if (Number.isNaN(num)) {
                            variables.arithmeticAssign(rt, l.v.members.failbit, 1);
                            return l;
                        }
                        variables.arithmeticAssign(rt, r, num);
                    }

                }
                rt.adjustArithmeticValue((r as InitArithmeticVariable));
                return l;
            }
        },
        {
            op: "o(_>>_)",
            type: "FUNCTION LREF CLASS istream < > ( LREF CLASS istream < > PTR I8 )",
            *default(rt: CRuntime, _templateTypes: [], l: IStreamVariable, _r: PointerVariable<ArithmeticVariable>): Gen<IStreamVariable> {
                const r = variables.asInitIndexPointerOfElem(_r, variables.uninitArithmetic("I8", null)) ?? rt.raiseException("Variable is not an initialised index pointer");
                const eofbit = l.v.members.eofbit;
                const failbit = l.v.members.failbit;
                const buf = l.v.members.buf;
                let char: InitArithmeticVariable;
                while (true) {
                    char = yield* readChar(rt, l);
                    if (eofbit.v.value === 1 || failbit.v.value === 1) {
                        failbit.v.value = 1;
                        return l;
                    }
                    if (!(whitespaceChars.includes(char.v.value))) {
                        break;
                    }
                    variables.indexPointerAssignIndex(rt, buf, buf.v.index + 1);
                }

                let i = 0;
                while (!(whitespaceChars.includes(char.v.value))) {
                    variables.arithmeticValueAssign(rt, (rt.unbound(variables.arrayMember(r.v.pointee, r.v.index + i)) as ArithmeticVariable).v, char.v.value)
                    i++;
                    variables.indexPointerAssignIndex(rt, buf, buf.v.index + 1);
                    char = yield* readChar(rt, l);
                    if (eofbit.v.value === 1 || failbit.v.value === 1) {
                        failbit.v.value = 1;
                        return l;
                    }
                }
                variables.arithmeticValueAssign(rt, (rt.unbound(variables.arrayMember(r.v.pointee, r.v.index + i)) as ArithmeticVariable).v, 0)
                if (i === 0) {
                    failbit.v.value = 1;
                    return l;
                }

                return l;
            }
        },
        {
            op: "o(_>>_)",
            type: "FUNCTION LREF CLASS istream < > ( LREF CLASS istream < > CLREF CLASS ws_t < > )",
            *default(rt: CRuntime, _templateTypes: [], l: IStreamVariable, _r: ClassVariable): Gen<IStreamVariable> {
                const eofbit = l.v.members.eofbit;
                const failbit = l.v.members.failbit;
                const buf = l.v.members.buf;
                let char: InitArithmeticVariable;
                while (true) {
                    char = yield* readChar(rt, l);
                    if (eofbit.v.value === 1 || failbit.v.value === 1) {
                        failbit.v.value = 1;
                        return l;
                    }
                    if (!(whitespaceChars.includes(char.v.value))) {
                        break;
                    }
                    variables.indexPointerAssignIndex(rt, buf, buf.v.index + 1);
                }


                return l;
            }
        },
        {
            op: "o(_>>_)",
            type: "FUNCTION LREF CLASS istream < > ( LREF CLASS istream < > CLREF CLASS string < > )",
            *default(rt: CRuntime, _templateTypes: [], l: IStreamVariable, r: StringVariable): Gen<IStreamVariable> {
                const memory = variables.arrayMemory<ArithmeticVariable>(variables.arithmeticType("I8"), []);
                const eofbit = l.v.members.eofbit;
                const failbit = l.v.members.failbit;
                const buf = l.v.members.buf;
                let char: InitArithmeticVariable;
                while (true) {
                    char = yield* readChar(rt, l);
                    if (eofbit.v.value === 1 || failbit.v.value === 1) {
                        failbit.v.value = 1;
                        return l;
                    }
                    if (!(whitespaceChars.includes(char.v.value))) {
                        break;
                    }
                    variables.indexPointerAssignIndex(rt, buf, buf.v.index + 1);
                }

                let i = 0;
                while (!(whitespaceChars.includes(char.v.value))) {
                    memory.values.push(variables.arithmetic("I8", char.v.value, { array: memory, index: memory.values.length }).v);
                    i++;
                    variables.indexPointerAssignIndex(rt, buf, buf.v.index + 1);
                    char = yield* readChar(rt, l);
                    if (eofbit.v.value === 1 || failbit.v.value === 1) {
                        failbit.v.value = 1;
                        return l;
                    }
                }
                memory.values.push(variables.arithmetic("I8", 0, { array: memory, index: memory.values.length }).v);
                r.v.members._ptr = variables.indexPointer(memory, 0, false, "SELF");
                r.v.members._size.v.value = memory.values.length - 1;
                if (i === 0) {
                    failbit.v.value = 1;
                    return l;
                }

                return l;
            }
        },
        ]);

        function _getline(rt: CRuntime, l: IStreamVariable, _s: InitPointerVariable<ArithmeticVariable>, _count: ArithmeticVariable, _delim: ArithmeticVariable): IStreamVariable {
            const stdio = rt.stdio();
            stdio.cinStop();

            const inputPromise: Promise<[boolean, IStreamVariable]> = new Promise((resolve) => {
                let result = l.v.members.buf;
                // + 1 because of trailing '\0'
                if (result.v.index + 1 >= result.v.pointee.values.length) {
                    stdio.getInput().then((result) => {
                        variables.indexPointerAssign(rt, l.v.members.buf, rt.getCharArrayFromString(result.concat("\n")).v.pointee, 0);
                        resolve([false, l]);
                    }, () => {
                        l.v.members.eofbit.v.value = 1;
                        l.v.members.failbit.v.value = 1;
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
                let b = l.v.members.buf;
                const count = rt.arithmeticValue(_count);
                const delim = rt.arithmeticValue(_delim);
                const s = variables.asInitIndexPointerOfElem(_s, variables.uninitArithmetic("I8", null));
                if (s === null) {
                    rt.raiseException("Not an index pointer");
                }
                const oldiptr = variables.clone(rt, b, "SELF", false);
                if (b.v.index >= b.v.pointee.values.length) {
                    variables.arithmeticAssign(rt, l.v.members.eofbit, 1);
                }
                let cnt = 0;
                while (cnt < count - 1) {
                    const si = rt.unbound(variables.arrayMember(s.v.pointee, s.v.index + cnt)) as ArithmeticVariable;
                    const bi = rt.arithmeticValue(variables.arrayMember(b.v.pointee, b.v.index));
                    if (bi === delim || bi === 0) {
                        // consume the delimiter
                        variables.indexPointerAssignIndex(rt, b, b.v.index + 1);
                        variables.arithmeticAssign(rt, si, 0);
                        break;
                    }
                    variables.arithmeticAssign(rt, si, bi);
                    variables.indexPointerAssignIndex(rt, b, b.v.index + 1);
                    cnt++;
                }
                if (cnt === 0) {
                    variables.arithmeticAssign(rt, l.v.members.failbit, 1);
                }

                if (!is_raw) {
                    unixapi.write(rt, [], variables.arithmetic("I32", unixapi.FD_STDOUT, null), oldiptr, variables.arithmetic("I32", sizeUntilNull(rt, oldiptr), null));
                }


                stdio.cinProceed();
            }).catch((err) => {
                //console.log(err);
                stdio.promiseError(err);
            })
            return l;
        }
        function _getlineStr(rt: CRuntime, l: IStreamVariable, s: StringVariable, _delim: ArithmeticVariable): IStreamVariable {
            const stdio = rt.stdio();
            stdio.cinStop();

            const inputPromise: Promise<[boolean, IStreamVariable]> = new Promise((resolve) => {
                let result = l.v.members.buf;
                // + 1 because of trailing '\0'
                if (result.v.index + 1 >= result.v.pointee.values.length) {
                    stdio.getInput().then((result) => {
                        variables.indexPointerAssign(rt, l.v.members.buf, rt.getCharArrayFromString(result.concat("\n")).v.pointee, 0);
                        resolve([false, l]);
                    }, () => {
                        l.v.members.eofbit.v.value = 1;
                        l.v.members.failbit.v.value = 1;
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
                let b = l.v.members.buf;
                const delim = rt.arithmeticValue(_delim);
                const i8type = s.v.members._ptr.t.pointee;
                const oldiptr = variables.clone(rt, b, "SELF", false);
                if (b.v.index >= b.v.pointee.values.length) {
                    variables.arithmeticAssign(rt, l.v.members.eofbit, 1);
                    variables.arithmeticAssign(rt, l.v.members.failbit, 1);
                    return;
                }
                let cnt = 0;
                const memory = variables.arrayMemory<ArithmeticVariable>(i8type, []);
                while (true) {
                    const bi = rt.arithmeticValue(variables.arrayMember(b.v.pointee, b.v.index));
                    if (bi === delim || bi === 0) {
                        // consume the delimiter
                        variables.indexPointerAssignIndex(rt, b, b.v.index + 1);
                        break;
                    }
                    memory.values.push(variables.arithmetic(i8type.sig, bi, { array: memory, index: cnt }).v);
                    variables.indexPointerAssignIndex(rt, b, b.v.index + 1);
                    cnt++;
                }
                memory.values.push(variables.arithmetic(i8type.sig, 0, { array: memory, index: cnt }).v);
                if (cnt === 0) {
                    variables.arithmeticAssign(rt, l.v.members.failbit, 1);
                }
                variables.indexPointerAssign(rt, s.v.members._ptr, memory, 0);
                s.v.members._size.v.value = cnt;

                if (!is_raw) {
                    unixapi.write(rt, [], variables.arithmetic("I32", unixapi.FD_STDOUT, null), oldiptr, variables.arithmetic("I32", sizeUntilNull(rt, oldiptr), null));
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
                *default(rt: CRuntime, _templateTypes: [], l: IStreamVariable): Gen<ArithmeticVariable> {
                    const retv = yield* readChar(rt, l);
                    const buf = l.v.members.buf;
                    variables.indexPointerAssignIndex(rt, buf, buf.v.index + 1);
                    return retv;
                }
            },
            {
                op: "getline",
                type: "FUNCTION LREF CLASS istream < > ( LREF CLASS istream < > PTR I8 I32 I8 )",
                default(rt: CRuntime, _templateTypes: [], l: IStreamVariable, _s: InitPointerVariable<ArithmeticVariable>, _count: ArithmeticVariable, _delim: ArithmeticVariable): IStreamVariable {
                    return _getline(rt, l, _s, _count, _delim);
                }
            },
            {
                op: "getline",
                type: "FUNCTION LREF CLASS istream < > ( LREF CLASS istream < > PTR I8 I32 )",
                default(rt: CRuntime, _templateTypes: [], l: IStreamVariable, _s: InitPointerVariable<ArithmeticVariable>, _count: ArithmeticVariable): IStreamVariable {
                    return _getline(rt, l, _s, _count, variables.arithmetic("I8", 10, "SELF"));
                }
            }
        ]);

        common.regGlobalFuncs(rt, [
            {
                op: "getline",
                type: "FUNCTION LREF CLASS istream < > ( LREF CLASS istream < > CLREF CLASS string < > I8 )",
                default(rt: CRuntime, _templateTypes: [], input: IStreamVariable, str: StringVariable, delim: ArithmeticVariable) {
                    _getlineStr(rt, input, str, delim);
                    return input;
                }
            },
            {
                op: "getline",
                type: "FUNCTION LREF CLASS istream < > ( LREF CLASS istream < > CLREF CLASS string < > )",
                default(rt: CRuntime, _templateTypes: [], input: IStreamVariable, str: StringVariable) {
                    _getlineStr(rt, input, str, variables.arithmetic("I8", 10, null));
                    return input;
                }
            },
        ]);

    }
}
