import { asResult } from "../interpreter";
import { CRuntime, MemberMap } from "../rt";
import * as common from "../shared/common";
import { StringVariable } from "../shared/string_utils";
import { AbstractTemplatedClassType, AbstractVariable, ArithmeticSig, Gen, InitArithmeticVariable, InitIndexPointerVariable, InitValue, MaybeUnboundVariable, ObjectType, Variable, variables } from "../variables";

/* 
 * Generic function object type.
 */
interface FOType<TI extends string, T extends ObjectType> extends AbstractTemplatedClassType<null, [T]> {
    readonly identifier: TI,
}

/* 
 * Generic function object variable.
 */
type FOVariable<TI extends string, T extends Variable> = AbstractVariable<FOType<TI, T["t"]>, FOValue<TI, T>>;

/* 
 * Generic function object value.
 */
interface FOValue<TI extends string, T extends Variable> extends InitValue<FOVariable<TI, T>> {
    members: {}
}

export = {
    load(rt: CRuntime) {
        // For now, function objects do not work properly. 
        // Instead, overloaded __hash function is declared.
        rt.defineStruct2("{global}", "hash", {
            numTemplateArgs: 1,
            factory(_dataItem: FOType<"hash", ObjectType>) { return {} as MemberMap; }
        }, [], {});
        rt.defineStruct2("{global}", "greater", {
            numTemplateArgs: 1,
            factory(_dataItem: FOType<"greater", ObjectType>) { return {} as MemberMap; }
        }, [], {});
        rt.defineStruct2("{global}", "less", {
            numTemplateArgs: 1,
            factory(_dataItem: FOType<"less", ObjectType>) { return {} as MemberMap; }
        }, [], {});
        function arithmeticHashFn(sig: ArithmeticSig): common.FunHandler {
            return {
                op: "__hash",
                type: `FUNCTION I64 ( ${sig} )`,
                default(_rt: CRuntime, _template: [], x: InitArithmeticVariable): InitArithmeticVariable {
                    return variables.arithmetic("I64", x.v.value & 0x7FFFFFFF, null);
                }
            };
        }
        common.regOps(rt, [
            {
                op: "o(_call)",
                type: "!ParamObject FUNCTION BOOL ( CLREF CLASS greater < ?0 > CLREF ?0 CLREF ?0 )",
                templateTypes: [0],
                *default(rt: CRuntime, _templateTypes: ObjectType[], fnobj: FOVariable<"greater", Variable>, lhs: Variable, rhs: Variable) {
                    if (fnobj.t.templateSpec[0].sig in variables.arithmeticSig) {
                        return variables.arithmetic("BOOL", (rt.arithmeticValue(lhs) > rt.arithmeticValue(rhs)) ? 1 : 0, null);
                    }
                    const callInst = rt.tryGetOpByParams("{global}", "o(_>_)", [lhs, rhs], []);
                    if (callInst === null) {
                        rt.raiseException(`${rt.makeTypeString(fnobj.t, false, false)}(): No comparison function is found.`);
                    }
                    const resultOrGen = rt.invokeCall(callInst, [], lhs, rhs);
                    const result = asResult(resultOrGen) ?? (yield* resultOrGen as Gen<MaybeUnboundVariable | "VOID">);
                    if (result === "VOID") {
                        rt.raiseException(`${rt.makeTypeString(fnobj.t, false, false)}(): Expected boolean return value from operator >(), got void.`);
                    }
                    return variables.arithmetic("BOOL", rt.arithmeticValue(result) !== 0 ? 1 : 0, null);
                }
            },
            {
                op: "o(_call)",
                type: "!ParamObject FUNCTION BOOL ( CLREF CLASS less < ?0 > CLREF ?0 CLREF ?0 )",
                templateTypes: [0],
                *default(rt: CRuntime, _templateTypes: ObjectType[], fnobj: FOVariable<"less", Variable>, lhs: Variable, rhs: Variable) {
                    if (fnobj.t.templateSpec[0].sig in variables.arithmeticSig) {
                        return variables.arithmetic("BOOL", (rt.arithmeticValue(lhs) < rt.arithmeticValue(rhs)) ? 1 : 0, null);
                    }
                    const callInst = rt.tryGetOpByParams("{global}", "o(_<_)", [lhs, rhs], []);
                    if (callInst === null) {
                        rt.raiseException(`${rt.makeTypeString(fnobj.t, false, false)}(): No comparison function is found.`);
                    }
                    const resultOrGen = rt.invokeCall(callInst, [], lhs, rhs);
                    const result = asResult(resultOrGen) ?? (yield* resultOrGen as Gen<MaybeUnboundVariable | "VOID">);
                    if (result === "VOID") {
                        rt.raiseException(`${rt.makeTypeString(fnobj.t, false, false)}(): Expected boolean return value from operator <(), got void.`);
                    }
                    return variables.arithmetic("BOOL", rt.arithmeticValue(result) !== 0 ? 1 : 0, null);
                }
            },
        ]);
        // NOTE: These functions are explicit (do not allow param conversions)
        // This should be noted in the future
        common.regGlobalFuncs(rt, [
            arithmeticHashFn("BOOL"),
            arithmeticHashFn("U8"),
            arithmeticHashFn("U16"),
            arithmeticHashFn("U32"),
            arithmeticHashFn("U64"),
            arithmeticHashFn("I8"),
            arithmeticHashFn("I16"),
            arithmeticHashFn("I32"),
            arithmeticHashFn("I64"),
            arithmeticHashFn("F32"),
            arithmeticHashFn("F64"),
            {
                op: "__hash",
                type: "FUNCTION I64 ( CLREF CLASS string < > )",
                default(_rt: CRuntime, _template: [], x: StringVariable): InitArithmeticVariable {
                    // NOTE: original function uses copied CLASS string < > 
                    // but to avoid costly copying, CLREF is added.
                    let h: number = 7919;
                    if (x.v.members._ptr.v.state !== "UNINIT") {
                        const ptr = x.v.members._ptr as InitIndexPointerVariable<InitArithmeticVariable>;
                        for (let i = 0; i < x.v.members._size.v.value; i++) {
                            const chr = rt.arithmeticValue(variables.arrayMember(ptr.v.pointee, ptr.v.index + i));
                            h += 97;
                            h += chr * 7907;
                            h %= 1000000009;
                        }
                    }
                    return variables.arithmetic("I64", h, null);

                }
            }
        ])

    }
}
