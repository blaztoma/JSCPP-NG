import { CRuntime } from "../rt";
import { InitArithmeticVariable, MaybeLeft, variables } from "../variables";
import { IOManipTokenType, IOManipTokenVariable, iomanip_token_mode, IStreamVariable, OStreamVariable } from "../shared/ios_base";
import { FunHandler, OpHandler } from "../shared/common";

function overloadIomanip(rt: CRuntime, structName: string) {
    const opHandlers: OpHandler[] = [{
        op: "o(_<<_)",
        type: `FUNCTION LREF CLASS ${structName} < > ( LREF CLASS ${structName} < > CLASS iomanip_token < > )`,
        default(rt: CRuntime, _templateTypes: [], l: OStreamVariable, r: IOManipTokenVariable): OStreamVariable {
            switch (r.v.members.mode.v.value) {
                case iomanip_token_mode.setbase:
                    const base = rt.arithmeticValue(r.v.members.param);
                    if (base !== 8 && base !== 10 && base !== 16) {
                        l.v.members.base.v.value = 10;
                    } else {
                        l.v.members.base.v.value = base;
                    }
                    break;
                case iomanip_token_mode.setfill:
                    l.v.members.fill.v.value = rt.arithmeticValue(r.v.members.param);
                    break;
                case iomanip_token_mode.setprecision:
                    l.v.members.precision.v.value = rt.arithmeticValue(r.v.members.param);
                    break;
                case iomanip_token_mode.setw:
                    l.v.members.width.v.value = rt.arithmeticValue(r.v.members.param);
                    break;
                case iomanip_token_mode.fixed:
                case iomanip_token_mode.scientific:
                case iomanip_token_mode.hexfloat:
                case iomanip_token_mode.defaultfloat:
                    l.v.members.float_display_mode.v.value = r.v.members.mode.v.value;
                    break;
                case iomanip_token_mode.left:
                case iomanip_token_mode.right:
                case iomanip_token_mode.internal:
                    l.v.members.position_mode.v.value = r.v.members.mode.v.value;
                    break;
                case iomanip_token_mode.boolalpha:
                    l.v.members.boolalpha.v.value = 1;
                    break;
                case iomanip_token_mode.noboolalpha:
                    l.v.members.boolalpha.v.value = 0;
                    break;
                default:
                    rt.raiseException("Unknown iomanip token mode");
            }

            return l;
        }
    }];

    opHandlers.forEach((x) => {
        rt.regFunc(x.default, "{global}", x.op, rt.typeSignature(x.type), []);
    });

}

function overloadIomanipInput(rt: CRuntime, structName: string) {
    const opHandlers: OpHandler[] = [{
        op: "o(_>>_)",
        type: `FUNCTION LREF CLASS ${structName} < > ( LREF CLASS ${structName} < > CLASS iomanip_token < > )`,
        default(rt: CRuntime, _templateTypes: [], l: IStreamVariable, r: IOManipTokenVariable): any {
            switch (r.v.members.mode.v.value) {
                case iomanip_token_mode.setbase:
                    rt.raiseException("Not yet implemented")
                /*const base = rt.arithmeticValue(r.v.members.param);
                if (base !== 8 && base !== 10 && base !== 16) {
                    l.v.members.base.v.value = 10;
                } else {
                    l.v.members.base.v.value = base;
                }
                break;*/
                case iomanip_token_mode.setfill:
                    rt.raiseException("Not yet implemented")
                /*l.v.members.fill.v.value = rt.arithmeticValue(r.v.members.param);
                break;*/
                case iomanip_token_mode.setprecision:
                    rt.raiseException("Not yet implemented")
                /*l.v.members.precision.v.value = rt.arithmeticValue(r.v.members.param);
                break;*/
                case iomanip_token_mode.setw:
                    rt.raiseException("Not yet implemented")
                /*l.v.members.width.v.value = rt.arithmeticValue(r.v.members.param);
                break;*/
                case iomanip_token_mode.setfill:
                    rt.raiseException("Not yet implemented")
                /*l.v.members.fill.v.value = rt.arithmeticValue(r.v.members.param);
                break;*/
                case iomanip_token_mode.fixed:
                case iomanip_token_mode.scientific:
                case iomanip_token_mode.hexfloat:
                case iomanip_token_mode.defaultfloat:
                    rt.raiseException("Not yet implemented")
                /*l.v.members.float_display_mode.v.value = r.v.members.mode.v.value;
                break;*/
                case iomanip_token_mode.left:
                case iomanip_token_mode.right:
                case iomanip_token_mode.internal:
                    rt.raiseException("Not yet implemented")
                /*l.v.members.position_mode.v.value = r.v.members.mode.v.value;
                break;*/
                case iomanip_token_mode.boolalpha:
                    l.v.members.boolalpha.v.value = 1;
                    break;
                case iomanip_token_mode.noboolalpha:
                    l.v.members.boolalpha.v.value = 0;
                    break;
                case iomanip_token_mode.skipws:
                    l.v.members.skipws.v.value = 1;
                    break;
                case iomanip_token_mode.noskipws:
                    l.v.members.skipws.v.value = 0;
                    break;
                default:
                    rt.raiseException("Unknown iomanip token mode");
            }

            return l;
        }
    }];

    opHandlers.forEach((x) => {
        rt.regFunc(x.default, "{global}", x.op, rt.typeSignature(x.type), []);
    });
}

export = {
    load(rt: CRuntime) {

        rt.defineStruct("{global}", "iomanip_token", [
            {
                name: "mode",
                variable: variables.uninitArithmetic("I32", "SELF"),
            },
            {
                name: "param",
                variable: variables.uninitArithmetic("I32", "SELF"),
            },
        ], {});

        ["ostream", "ofstream"].forEach((x) => { if (x in rt.typeMap) { overloadIomanip(rt, x) } });
        ["istream", "ifstream"].forEach((x) => { if (x in rt.typeMap) { overloadIomanipInput(rt, x) } });

        const iomanipTokenType = rt.simpleType(["iomanip_token"]) as MaybeLeft<IOManipTokenType>;

        function createIOManipToken(rt: CRuntime, mode: number, param: number | null): IOManipTokenVariable {
            const iomanip_token = rt.defaultValue(iomanipTokenType.t, null) as IOManipTokenVariable;
            variables.arithmeticAssign(rt, iomanip_token.v.members.mode, mode);
            if (param !== null) {
                variables.arithmeticAssign(rt, iomanip_token.v.members.param, param);
            }
            return iomanip_token;

        }

        const funHandlers: FunHandler[] = [
            {
                op: "setbase",
                type: "FUNCTION CLASS iomanip_token < > ( I32 )",
                default(rt: CRuntime, _templateTypes: [], r: InitArithmeticVariable): IOManipTokenVariable {
                    return createIOManipToken(rt, iomanip_token_mode.setbase, r.v.value);
                }
            },
            {
                op: "setfill",
                type: "FUNCTION CLASS iomanip_token < > ( I8 )",
                default(rt: CRuntime, _templateTypes: [], r: InitArithmeticVariable): IOManipTokenVariable {
                    return createIOManipToken(rt, iomanip_token_mode.setfill, r.v.value);
                }
            },
            {
                op: "setprecision",
                type: "FUNCTION CLASS iomanip_token < > ( I32 )",
                default(rt: CRuntime, _templateTypes: [], r: InitArithmeticVariable): IOManipTokenVariable {
                    return createIOManipToken(rt, iomanip_token_mode.setprecision, r.v.value);
                }
            },
            {
                op: "setw",
                type: "FUNCTION CLASS iomanip_token < > ( I32 )",
                default(rt: CRuntime, _templateTypes: [], r: InitArithmeticVariable): IOManipTokenVariable {
                    return createIOManipToken(rt, iomanip_token_mode.setw, r.v.value);
                }
            },
        ]

        funHandlers.forEach((x) => {
            rt.regFunc(x.default, "{global}", x.op, rt.typeSignature(x.type), []);
        });

        ["fixed", "scientific", "hexfloat", "defaultfloat", "left", "right", "internal", "boolalpha", "noboolalpha", "noskipws", "skipws"].forEach((x: keyof typeof iomanip_token_mode) => {
            const token = createIOManipToken(rt, iomanip_token_mode[x], null);
            rt.addToNamespace("std", x, token, true);
        })

        rt.addToNamespace("std", "oct", createIOManipToken(rt, iomanip_token_mode.setbase, 8), true);
        rt.addToNamespace("std", "dec", createIOManipToken(rt, iomanip_token_mode.setbase, 10), true);
        rt.addToNamespace("std", "hex", createIOManipToken(rt, iomanip_token_mode.setbase, 16), true);


    }
}

