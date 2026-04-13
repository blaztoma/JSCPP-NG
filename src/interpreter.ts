import { resolveIdentifier } from "./shared/string_utils";
import { CRuntime, FunctionCallInstance, MemberMap, MemberObject, OpSignature, RuntimeScope } from "./rt";
import { ArithmeticVariable, ClassType, ClassVariable, InitArithmeticVariable, MaybeLeft, MaybeUnboundArithmeticVariable, ObjectType, PointerType, Variable, variables, MaybeUnboundVariable, InitIndexPointerVariable, FunctionType, ResultOrGen, Gen, MaybeLeftCV, Function, FunctionValue, ArithmeticSig, InitPointerVariable } from "./variables";
import { createInitializerList } from "./initializer_list";

const sampleGeneratorFunction = function*(): Generator<null, void, void> {
    return yield null;
};

const sampleGenerator = sampleGeneratorFunction();

const isGenerator = (g: any): boolean => {
    return (g != null ? g.constructor : undefined) === sampleGenerator.constructor;
};

export function asResult<T>(g: ResultOrGen<T> | null): T | null {
    if (g !== null && (g as Gen<T>).constructor === sampleGenerator.constructor) {
        return null;
    }
    return g as T | null;
};

const isGeneratorFunction = (f: any): boolean => {
    return (f != null ? f.constructor : undefined) === sampleGeneratorFunction.constructor;
};

export class BaseInterpreter<TNode> {
    rt: CRuntime;
    currentNode: TNode;
    source: string;
    constructor(rt: CRuntime) {
        this.rt = rt;
    }
}

function isIterable(obj: any) {
    // checks for null and undefined
    if (obj == null) {
        return false;
    }
    return typeof obj[Symbol.iterator] === 'function';
}

export interface StatementMeta {
    sLine: number,
    sColumn: number,
    sOffset: number,
    eLine: number,
    eColumn: number,
    eOffset: number
};
export interface XIdentifier extends StatementMeta {
    type: "Identifier",
    Identifier: string
};
export interface XIdentifierExpression extends StatementMeta {
    type: "IdentifierExpression",
    Identifier: string
};
export interface XCompoundStatement extends StatementMeta {
    type: "CompoundStatement",
    Statements: object[]
}
export interface XFunctionDefinition extends StatementMeta {
    type: "FunctionDefinition",
    Declarator: XDirectDeclarator,
    DeclarationSpecifiers: string[],
    CompoundStatement: XCompoundStatement,
};
export interface XPostfixExpression_MethodInvocation extends StatementMeta {
    type: "PostfixExpression_MethodInvocation",
    Expression: XIdentifierExpression | PostfixExpression,
    args: object[],
};
export interface XPostfixExpression_ArrayAccess extends StatementMeta {
    type: "PostfixExpression_ArrayAccess",
    Expression: XIdentifierExpression,
    index: XConstantExpression,
};
export interface XPostfixExpression_MemberAccess extends StatementMeta {
    type: "PostfixExpression_MemberAccess",
    Expression: XIdentifierExpression,
    member: string,
};
export type PostfixExpression = XPostfixExpression_MethodInvocation | XPostfixExpression_ArrayAccess | XPostfixExpression_MemberAccess;

export interface XInitDeclarator extends StatementMeta {
    type: "InitDeclarator",
    Declarator: XDirectDeclarator,
    Initializers: XInitializerExpr | XInitializerArray | null,
}
export interface XParameterDeclaration extends StatementMeta {
    type: "ParameterDeclaration"
    DeclarationSpecifiers: string[],
    Declarator: XInitDeclarator | XAbstractDeclarator | null,
}
export interface XParameterTypeList extends StatementMeta {
    type: "ParameterTypeList",
    ParameterList: XParameterDeclaration[],
    varargs: boolean,
}
export interface XDirectDeclarator extends StatementMeta {
    type: "DirectDeclarator",
    left: XIdentifier | XDirectDeclarator,
    right: XDirectDeclarator_modifier_ParameterTypeList | XDirectDeclarator_modifier_IdentifierList | DirectDeclaratorModifier[],
    Reference?: [][],
    Pointer: [][] | null,
}
type DirectDeclaratorModifier = XDirectDeclarator_modifier_ParameterTypeList | XDirectDeclarator_modifier_IdentifierList | XDirectDeclarator_modifier_Array;
export interface XDirectDeclarator_modifier_Array extends StatementMeta {
    type: "DirectDeclarator_modifier_array",
    /** Array length specifier */
    Expression: XConstantExpression | null,
    Modifier: any[],
}
export interface XDirectDeclarator_modifier_ParameterTypeList extends StatementMeta {
    type: "DirectDeclarator_modifier_ParameterTypeList",
    ParameterTypeList: XParameterTypeList,
}
export interface XDirectDeclarator_modifier_IdentifierList extends StatementMeta {
    type: "DirectDeclarator_modifier_IdentifierList",
    IdentifierList: any,
}
export interface XDeclaration extends StatementMeta {
    type: "Declaration",
    DeclarationSpecifiers: (string | XScopedIdentifier | XScopedMaybeTemplatedIdentifier)[],
    InitDeclaratorList: XInitDeclarator[],
}
export interface XTypedefDeclaration extends StatementMeta {
    type: "Declaration",
    DeclarationSpecifiers: string[],
    Declarators: XDirectDeclarator[],
}
export interface XDecimalConstant extends StatementMeta {
    type: "DecimalConstant",
    value: string
}
export interface XOctalConstant extends StatementMeta {
    type: "OctalConstant",
    value: string
}
export interface XConstantExpression extends StatementMeta {
    type: "ConstantExpression",
    Expression: XDecimalConstant | XOctalConstant,
}
export interface XInitializerExpr extends StatementMeta {
    type: "Initializer_expr",
    Expression: XConstantExpression | XStringLiteralExpression,
    shorthand?: InitArithmeticVariable,
}
export interface XInitializerArray extends StatementMeta {
    type: "Initializer_array",
    Initializers: (XInitializerExpr | XInitializerArray)[],
}
export interface XStructDeclaration extends StatementMeta {
    type: "StructDeclaration",
    DeclarationIdentifiers: string[],
    StructMemberList: XStructMember[],
    InitVariables: boolean,
}
export interface XStructMember extends StatementMeta {
    type: "StructMember",
    MemberType: string[],
    Declarators: XInitDeclarator[],
}
export interface XBinOpExpression extends StatementMeta {
    type: "BinOpExpression" | "LogicalANDExpression" | "LogicalORExpression",
    op: string,
    left: XIdentifierExpression | XPostfixExpression_ArrayAccess,
    right: XConstantExpression | XPostfixExpression_ArrayAccess,
}
export interface XStringLiteral extends StatementMeta {
    type: "StringLiteral",
    value: string,
    prefix: string | null;
}
export interface XStringLiteralExpression extends StatementMeta {
    type: "StringLiteralExpression",
    value: XStringLiteral,
}
export interface XTypeName extends StatementMeta {
    type: "TypeName",
    base: string[],
    extra: XAbstractDeclarator | null,
}
export interface XAbstractDeclarator extends StatementMeta {
    type: "AbstractDeclarator",
    Pointer: [][] | null,
}
export interface XCastExpression extends StatementMeta {
    type: "CastExpression",
    TypeName: XTypeId,
    Expression: XIdentifierExpression | PostfixExpression
}
export interface XNewExpression extends StatementMeta {
    type: "NewExpression",
    TypeName: string[] | XScopedMaybeTemplatedIdentifier,
    pointerRank: number,
    arraySizeExpression?: XIdentifierExpression | XConstantExpression | null
}
export interface XDeleteStatement extends StatementMeta {
    type: "DeleteStatement",
    Expression: XIdentifierExpression | XConstantExpression | null,
    brackets: boolean,
}
export interface XUnaryExpression_Sizeof_Type extends StatementMeta {
    type: "UnaryExpression_Sizeof_Type",
    TypeName: XTypeName,
}
export interface XScopedIdentifier extends StatementMeta {
    type: "ScopedIdentifier",
    scope: XScopedIdentifier | null,
    Identifier: string,
}
export interface XScopedMaybeTemplatedIdentifier extends StatementMeta {
    type: "ScopedMaybeTemplatedIdentifier",
    ScopedIdentifier: string | XScopedIdentifier,
    TemplateType: ((string | XScopedIdentifier | XScopedMaybeTemplatedIdentifier)[])[] | null,
}
export interface XUnknown {
    type: "<stub>"
}
export interface XIterationStatement_foreach extends StatementMeta {
    type: "IterationStatement_foreach"
    Expression: XIdentifierExpression,
    Initializer?: XDeclaration,
    Statement: XCompoundStatement,
}
export interface XTypeId extends StatementMeta {
    type: "TypeId"
    spec: TypeSpecifier,
}
export type TypeSpecifier = TypeSpecifier_basic | TypeSpecifier_decltype | XScopedMaybeTemplatedIdentifier;
export type TypeSpecifier_basic = {
    type: "TypeSpecifier_basic",
    id: "b" | "f" | "d" | "ld" | "v" | "a" | "c" | "si" | "li" | "lli" | "i",
    mod_sign?: "s" | "u",
    mod_cv?: "c" | "v"
}
export type TypeSpecifier_decltype = {
    type: "TypeSpecifier_decltype",
    expression: any, /* XExpression */
}

type DeclaratorYield = { name: string, type: MaybeLeft<ObjectType> };

type InterpStatement = any;

type ParameterTypeListResult = {
    argTypes: MaybeLeftCV<ObjectType>[],
    argNames: (string | null)[],
    optionalArgs: MemberObject[],
};

type DirectDeclaratorResult = {
    type: MaybeLeft<ObjectType>,
    name: string
}

function resolveTypeId(rt: CRuntime, s: XTypeId): MaybeLeftCV<ObjectType> | "VOID" | "AUTO" {

    debugger;
    const isConst = ("mod_cv" in s.spec) && ((s.spec as any).mod_cv === "c");
    switch (s.spec.type) {
        case "TypeSpecifier_basic":
            const isUnsigned = ("mod_sign" in s.spec) && (s.spec.mod_sign === "u");
            switch (s.spec.id) {
                case "a":
                    return "AUTO";
                case "v":
                    return "VOID";
                case "c":
                    return { t: { sig: isUnsigned ? "U8" : "I8" }, v: { lvHolder: null, isConst } }
                case "si":
                    return { t: { sig: isUnsigned ? "U16" : "I16" }, v: { lvHolder: null, isConst } }
                case "i":
                    return { t: { sig: isUnsigned ? "U32" : "I32" }, v: { lvHolder: null, isConst } }
                case "li":
                    return { t: { sig: isUnsigned ? "U32" : "I32" }, v: { lvHolder: null, isConst } }
                case "lli":
                    return { t: { sig: isUnsigned ? "U64" : "I64" }, v: { lvHolder: null, isConst } }
                case "f":
                    return { t: { sig: "F32" }, v: { lvHolder: null, isConst } }
                case "d":
                    return { t: { sig: "F64" }, v: { lvHolder: null, isConst } }
                case "ld":
                    return { t: { sig: "F64" }, v: { lvHolder: null, isConst } }
                case "b":
                    return { t: { sig: "BOOL" }, v: { lvHolder: null, isConst } }
                default:
                    rt.raiseException("Type-id error: unreachable");
            }
        case "TypeSpecifier_decltype":
            rt.raiseException("Type-id error: Not yet implemented");
        case "ScopedMaybeTemplatedIdentifier":
            let r = rt.simpleType([s.spec]);
            if (r === "VOID") {
                return r;
            }
            (r.v as any).isConst = isConst
            return r as MaybeLeftCV<ObjectType>;
    }


}

export class Interpreter extends BaseInterpreter<InterpStatement> {
    visitors: { [name: string]: (interp: Interpreter, s: InterpStatement, param?: any) => any };
    constructor(rt: CRuntime) {
        super(rt);
        this.visitors = {
            *TranslationUnit(interp, s, _param) {
                ({ rt } = interp);
                let i = 0;
                while (i < s.ExternalDeclarations.length) {
                    const dec = s.ExternalDeclarations[i];
                    yield* interp.visit(interp, dec);
                    i++;
                }
            },
            *DirectDeclarator(interp, s: XDirectDeclarator, param: { basetype: MaybeLeft<ObjectType> }): Gen<DirectDeclaratorResult> {
                ({ rt } = interp);
                let { basetype } = param;
                basetype = interp.buildRecursivePointerType(rt, s.Pointer, basetype, 0) as MaybeLeft<ObjectType>;
                const right = (!(s.right instanceof Array)) ? s.right : ((s.right.length === 1) ? s.right[0] : null);
                if (right !== null) {
                    //let varargs: boolean | null = null;
                    let ptl: XParameterTypeList | null = null;
                    if (right.type === "DirectDeclarator_modifier_ParameterTypeList") {
                        ptl = right.ParameterTypeList;
                        //({ varargs } = ptl);
                    } else if ((right.type === "DirectDeclarator_modifier_IdentifierList") && (right.IdentifierList === null)) {
                        rt.raiseException("Direct declarator error: Type error or not yet implemented");
                        //ptl = right.ParameterTypeList;
                        //varargs = false;
                    }
                    if (ptl != null) {
                        const argTypes: (MaybeLeftCV<ObjectType>)[] = [];
                        for (const _param of ptl.ParameterList) {
                            const _basetype = rt.simpleType(_param.DeclarationSpecifiers);
                            let _type: MaybeLeft<ObjectType> | "VOID";
                            if (_param.Declarator != null) {
                                if (_param.Declarator.type === "InitDeclarator" && "Pointer" in _param.Declarator) {
                                    rt.raiseException("Direct declarator error: Not yet implemented");
                                }
                                const _pointer = (_param.Declarator.type === "AbstractDeclarator") ? _param.Declarator.Pointer : null;
                                _type = interp.buildRecursivePointerType(rt, _pointer, _basetype, 0);
                                if ("right" in _param.Declarator) {
                                    rt.raiseException("Direct declarator error: Not yet implemented");
                                }
                                /*if ((_param.Declarator.right != null) && (_param.Declarator.right.length > 0)) {
                                    const dimensions = [];
                                    for (let j = 0; j < _param.Declarator.right.length; j++) {
                                        let dim = _param.Declarator.right[j];
                                        if (dim.type !== "DirectDeclarator_modifier_array") {
                                            rt.raiseException("Direct declarator error: unacceptable array initialization", dim);
                                        }
                                        if (dim.Expression !== null) {
                                            dim = (rt.cast(variables.arithmeticType("I32"), (yield* interp.visit(interp, dim.Expression, param))) as ArithmeticVariable).v.value;
                                        } else if (j > 0) {
                                            rt.raiseException("Direct declarator error: multidimensional array must have bounds for all dimensions except the first", dim);
                                        } else {
                                            dim = -1;
                                        }
                                        dimensions.push(dim);
                                    }
                                    _type = interp.arrayType(dimensions, _type);
                                }*/
                            } else {
                                _type = _basetype;
                            }
                            if (_type === "VOID") {
                                rt.raiseException("Direct declarator error: function arguments cannot have void type");
                            }
                            argTypes.push({ t: _type.t, v: { isConst: false, ..._type.v } });
                        }
                        basetype = { t: variables.pointerType(variables.functionType(rt.createFunctionTypeSignature("{global}", basetype, argTypes).array), null), v: { lvHolder: null } };
                        if (s.left.type === "DirectDeclarator" && s.left.Pointer !== null) {
                            s.left = s.left.left;
                        } else {
                            rt.raiseException("Invalid function pointer type;\nC-like function pointer is declared as follows:\n /*return-value*/ (*/*name-of-a-pointer*/)(/*nameless-arguments*/)");
                        }
                    }
                }
                if ((s.right instanceof Array) && (s.right.length > 0) && (s.right[0].type === "DirectDeclarator_modifier_array")) {
                    const dimensions = [];
                    for (let j = 0; j < s.right.length; j++) {
                        const Xdim = s.right[j];
                        if (Xdim.type !== "DirectDeclarator_modifier_array") {
                            rt.raiseException("Direct declarator error: unacceptable array initialization", Xdim);
                        }
                        let dim: number;
                        if (Xdim.Expression !== null) {
                            const castResult = (rt.cast(variables.arithmeticType("I32"), (yield* interp.visit(interp, Xdim.Expression, param))) as ArithmeticVariable);
                            dim = castResult.v.state === "INIT" ? castResult.v.value : -1;
                        } else if (j > 0) {
                            rt.raiseException("Direct declarator error: multidimensional array must have bounds for all dimensions except the first", Xdim);
                        } else {
                            dim = -1;
                        }
                        dimensions.push(dim);
                    }
                    let top: number | undefined;
                    while ((top = dimensions.pop()) !== undefined) {
                        basetype = { t: variables.pointerType(basetype.t, (top !== -1) ? top : null), v: basetype.v };
                    }
                }

                if (s.left.type === "Identifier") {
                    return { type: basetype, name: s.left.Identifier };
                } else {
                    const _basetype = param.basetype;
                    param.basetype = basetype;
                    const ret = (yield* interp.visit(interp, s.left, param)) as DirectDeclaratorResult;
                    param.basetype = _basetype;
                    return ret;
                }
            },
            *TypedefDeclaration(interp, s: XTypedefDeclaration, param): Gen<void> {
                ({
                    rt
                } = interp);
                const basetype = rt.simpleType(s.DeclarationSpecifiers);
                const _basetype = param.basetype;
                param.basetype = basetype;
                for (const declarator of s.Declarators) {
                    const { type, name } = (yield* interp.visit(interp, declarator, param)) as DirectDeclaratorResult;
                    rt.registerTypedef(type, name);
                }
                param.basetype = _basetype;
            },
            *ParameterTypeList(interp, s: XParameterTypeList, param): Gen<ParameterTypeListResult> {
                const argTypes: MaybeLeftCV<ObjectType>[] = [];
                const argNames: (string | null)[] = [];
                const optionalArgs: MemberObject[] = [];

                for (const _param of s.ParameterList) {
                    let _type: MaybeLeftCV<ObjectType>;
                    let _init: XInitializerArray | XInitializerExpr | null = null;
                    let _name: string | null = null;
                    let isConst = false;
                    if (param.insideDirectDeclarator_modifier_ParameterTypeList) {
                        const _basetype = rt.simpleType(_param.DeclarationSpecifiers);
                        if (_basetype === "VOID") {
                            rt.raiseException("Parameter type list error: Type error or not yet implemented");
                        }
                        _type = { t: _basetype.t, v: { isConst: false, ..._basetype.v } };
                    } else {
                        if (_param.Declarator == null) {
                            rt.raiseException("Parameter type list error: missing declarator for argument", _param);
                        }
                        if (_param.Declarator.type === "AbstractDeclarator") {
                            rt.raiseException("Parameter type list error: Type error or not yet implemented");
                        }
                        _init = _param.Declarator.Initializers;

                        const _declarationSpecifiers = _param.DeclarationSpecifiers.flatMap((specifier: string | { DeclarationSpecifiers: string[] }) => (typeof specifier === "string") ? specifier : specifier.DeclarationSpecifiers);
                        const _basetype = rt.simpleType(_param.DeclarationSpecifiers);
                        if (_basetype === "VOID") {
                            rt.raiseException("Parameter type list error: Type error or not yet implemented");
                        }
                        const _reference = _param.Declarator.Declarator.Reference;
                        isConst = _declarationSpecifiers.some((specifier) => ["const", "static"].includes(specifier));

                        if (_reference) {
                            _type = { t: _basetype.t, v: { isConst, lvHolder: "SELF" } };
                        } else {
                            const _pointer = _param.Declarator.Declarator.Pointer;
                            const __type = interp.buildRecursivePointerType(rt, _pointer, _basetype, 0);
                            if (__type === "VOID") {
                                rt.raiseException("Parameter type list error: Type error or not yet implemented");
                            }
                            _type = { t: __type.t, v: { isConst, ...__type.v } };
                        }

                        if (_param.Declarator.Declarator.left.type === "DirectDeclarator") {
                            const __basetype = param.basetype;
                            param.basetype = _basetype;
                            const { name } = (yield* interp.visit(interp, _param.Declarator.Declarator.left, param)) as DeclaratorYield;
                            param.basetype = __basetype;
                            _name = name;
                        } else {
                            if (_param.Declarator.Declarator.left.type !== "Identifier") {
                                rt.raiseException("Parameter type list error: Type error or not yet implemented");
                            }
                            _name = _param.Declarator.Declarator.left.Identifier;
                        }
                        const right: DirectDeclaratorModifier[] = (_param.Declarator.Declarator.right instanceof Array) ? _param.Declarator.Declarator.right : [_param.Declarator.Declarator.right];
                        if (right.length > 0) {
                            if (right[0].type === "DirectDeclarator_modifier_ParameterTypeList") {
                                const dim = right[0];
                                param.insideDirectDeclarator_modifier_ParameterTypeList = true;
                                const { argTypes: _argTypes, optionalArgs: _optionalArgs } = (yield* interp.visit(interp, dim.ParameterTypeList, param)) as ParameterTypeListResult;
                                param.insideDirectDeclarator_modifier_ParameterTypeList = false;
                                if (_optionalArgs.length !== 0) {
                                    rt.raiseException("Parameter type list error: function pointer types cannot contain optional parameters");
                                }
                                _type = { t: variables.pointerType(variables.functionType(rt.createFunctionTypeSignature("{global}", _basetype, _argTypes).array), null), v: { isConst: false, lvHolder: null } };
                            } else {
                                for (let j = right.length - 1; j >= 0; j--) {
                                    const dimObj = right[j];
                                    if (dimObj.type !== "DirectDeclarator_modifier_array") {
                                        rt.raiseException("Parameter type list error: Unacceptable array initialization", dimObj);
                                    }
                                    if (dimObj.Expression !== null) {
                                        const sizeConstraint = rt.arithmeticValue(rt.cast(variables.arithmeticType("I32"), (yield* interp.visit(interp, dimObj.Expression, param))) as ArithmeticVariable);
                                        _type = { t: variables.pointerType(_type.t, sizeConstraint), v: { isConst, lvHolder: _type.v.lvHolder } };
                                    } else if (j > 0) {
                                        rt.raiseException("Parameter type list error: Multidimensional array must have bounds for all dimensions except the first", dimObj);
                                    } else {
                                        _type = { t: variables.pointerType(_type.t, null), v: { isConst, lvHolder: _type.v.lvHolder } };
                                    }
                                }
                            }
                        }
                    }
                    if (_init !== null) {
                        if (_init.type !== "Initializer_expr") {
                            rt.raiseException("Parameter type list error: Type error or not yet implemented");
                        }
                        const initvarYield = interp.visit(interp, _init.Expression) as Gen<Variable>;
                        const initvar = asResult(initvarYield) ?? (yield* (initvarYield as Gen<Variable>));
                        optionalArgs.push({
                            name: _name ?? rt.raiseException("Parameter type list error: expected a name"),
                            variable: variables.clone(rt, initvar, null, false)
                        });
                    } else {
                        if (optionalArgs.length > 0) {
                            rt.raiseException("Parameter type list error: All default arguments must be at the end of arguments list", _param);
                        }
                        argTypes.push(_type);
                        argNames.push(_name);
                    }
                };
                return { argTypes, argNames, optionalArgs };
            },
            *FunctionDefinition(interp, s: XFunctionDefinition, param) {
                ({
                    rt
                } = interp);
                const {
                    scope
                } = param;
                const typedScope = scope === "{global}" ? "{global}" : rt.raiseException("Function definition error: Not yet implemented");
                if (s.Declarator.left.type !== "Identifier") {
                    rt.raiseException("Function definition error: Not yet implemented");
                }
                const name = s.Declarator.left.Identifier;
                let basetype = rt.simpleType(s.DeclarationSpecifiers);
                const pointer = s.Declarator.Pointer;
                basetype = interp.buildRecursivePointerType(rt, pointer, basetype, 0);
                let ptl: XParameterTypeList | { ParameterList: [] };
                let varargs;
                if (s.Declarator.right instanceof Array) {
                    rt.raiseException("Function definition error: unacceptable argument list", s.Declarator.right);
                }
                if (s.Declarator.right.type === "DirectDeclarator_modifier_ParameterTypeList") {
                    ptl = s.Declarator.right.ParameterTypeList;
                    ({
                        varargs
                    } = ptl);
                } else if ((s.Declarator.right.type === "DirectDeclarator_modifier_IdentifierList") && (s.Declarator.right.IdentifierList === null)) {
                    ptl = { ParameterList: [] };
                    varargs = false;
                } else {
                    rt.raiseException("Function definition error: unacceptable argument list", s.Declarator.right);
                }
                const { argTypes, argNames, optionalArgs }: ParameterTypeListResult = yield* interp.visit(interp, ptl, param);
                const stat = s.CompoundStatement;
                rt.defFunc(typedScope, name, basetype, argTypes, argNames.map(x => x ?? rt.raiseException("Function definition error: expected a named parameter")), optionalArgs, stat, interp);
            },
            *Declaration(interp, s: XDeclaration, param: { deducedType: MaybeLeft<ObjectType>, basetype?: MaybeUnboundVariable | MaybeLeft<ObjectType>, node?: XInitializerExpr | XInitializerArray | null, typeHint?: ObjectType | null }): ResultOrGen<void> {
                const { rt } = interp;
                const deducedType = s.DeclarationSpecifiers.includes("auto");
                const isConst = s.DeclarationSpecifiers.some((specifier: any) => ["const", "static"].includes(specifier));
                const basetypeOrVoid: ResultOrGen<MaybeUnboundVariable | MaybeLeft<ObjectType> | "VOID"> = deducedType ? (param.deducedType ?? (yield* interp.visit(interp, s.InitDeclaratorList[0].Initializers, param) as Gen<MaybeUnboundVariable | MaybeLeft<ObjectType> | "VOID">)) : rt.simpleType(s.DeclarationSpecifiers);
                const basetype: MaybeUnboundVariable | MaybeLeft<ObjectType> = (basetypeOrVoid === "VOID") ? rt.raiseException("Declaration error: Declared variable cannot have a void type") : basetypeOrVoid;

                let i = 0;
                for (const dec of s.InitDeclaratorList) {
                    let visitResult: DeclaratorYield;
                    {
                        const _basetype = param.basetype;
                        param.basetype = basetype;
                        visitResult = (yield* interp.visit(interp, dec.Declarator, param)) as DeclaratorYield;
                        param.basetype = _basetype;
                    }
                    let decType: MaybeLeft<ObjectType> = (dec.Declarator.Pointer instanceof Array) ? variables.uninitPointer(basetype.t, null, "SELF") : basetype;
                    const { name, type } = visitResult;
                    let initSpec = dec.Initializers;

                    if (!(dec.Declarator.right instanceof Array)) {
                        rt.raiseException("Declaration error: Not yet implemented");
                    }
                    const rhs = dec.Declarator.right as DirectDeclaratorModifier[];
                    for (const modifier of rhs.reverse()) {
                        if (modifier.type === "DirectDeclarator_modifier_array") {
                            if (modifier.Modifier.length > 0) {
                                rt.raiseException("Declaration error: Type error or not yet implemented");
                            }
                            let arraySize: number = -1;
                            if (modifier.Expression !== null) {
                                const arraySizeExpr = yield* interp.visit(interp, modifier.Expression, param) as Gen<MaybeUnboundVariable | "VOID">;
                                if (arraySizeExpr === "VOID") {
                                    rt.raiseException("Declaration error: Expected a non-void value in an array size expression");
                                } else {
                                    const arraySizeArithmeticVar = variables.asArithmetic(rt.unbound(arraySizeExpr)) ??
                                        rt.raiseException("Declaration error: Expected an arithmetic value in an array size expression");
                                    if (arraySizeArithmeticVar.v.lvHolder !== null && !arraySizeArithmeticVar.v.isConst) {
                                        rt.raiseException("Declaration error: Expected a constant value in an array size expression")
                                    }
                                    arraySize = rt.arithmeticValue(arraySizeArithmeticVar);
                                    if (arraySize < 0) {
                                        rt.raiseException("Declaration error: Expected a non-negative value in an array size expression")
                                    }
                                }
                            }
                            decType = variables.uninitPointer(decType.t, arraySize, decType.v.lvHolder);
                        } else if (modifier.type as string === "DirectDeclarator_modifier_Constructor") {
                            if (rhs.length !== 1) {
                                rt.raiseException("Declaration error: Too many modifiers or not yet implemented");
                            }
                            const constructorArgs = [];
                            for (const dim of rhs) {
                                if ((dim as any).Expressions !== null) {
                                    for (const argumentExpression of (dim as any).Expressions) {
                                        const resolvedArgument = yield* interp.visit(interp, argumentExpression, param);
                                        constructorArgs.push(resolvedArgument);
                                    }
                                }
                            }
                            const _classType = variables.asClassType(type.t);
                            const classType = (_classType === null) ? rt.raiseException("Declaration error: Not yet implemented / Type Error") : _classType;
                            const classStr = variables.toStringSequence(rt, classType, false, false);

                            //const initClass = variables.class(classType, {}, "SELF");
                            const xinitYield = rt.invokeCall(rt.getFuncByParams(classType, "o(_ctor)", constructorArgs, [classStr]), [classType], ...constructorArgs);
                            const xinitOrVoid = asResult(xinitYield) ?? (yield* (xinitYield as Gen<MaybeUnboundVariable | "VOID">))
                            if (xinitOrVoid === "VOID") {
                                rt.raiseException("Declaration error: Expected a non-void value");
                            } else {
                                if (isConst) {
                                    (xinitOrVoid.v as any).isConst = true;
                                }
                                rt.defVar(name, rt.unbound(xinitOrVoid));
                            }
                        }
                    }
                    if (rhs.length > 0 && rhs[0].type as string === "DirectDeclarator_modifier_Constructor") {
                    } else {
                        if (initSpec !== null && initSpec.type === "Initializer_array") {
                            const _typeHint = param.typeHint;
                            param.typeHint = decType.t;
                            const initVar: Variable | null = (yield* interp.visit(interp, initSpec, param)) as Variable;
                            param.typeHint = _typeHint;
                            if (isConst) {
                                (initVar.v as any).isConst = true;
                            }
                            rt.defVar(name, initVar);
                        } else {
                            const initVarYield = (initSpec === null) ? rt.defaultValue2(decType.t, "SELF") : ((i === 0 && "state" in basetype.v) ? basetype as MaybeUnboundVariable : interp.visit(interp, (initSpec as XInitializerExpr).Expression) as Gen<MaybeUnboundVariable | "VOID">);
                            const initVarOrVoid = asResult(initVarYield) ?? (yield* (initVarYield as Gen<MaybeUnboundVariable | "VOID">));
                            if (initVarOrVoid === "VOID") {
                                rt.raiseException("Declaration error: Expected a non-void value");
                            } else {
                                let initVar = initSpec === null ? variables.clone(rt, rt.unbound(initVarOrVoid), "SELF", false, true) : rt.unbound(initVarOrVoid);
                                if (dec.Declarator.Reference === undefined && initVar.v.lvHolder !== null) {
                                    initVar = variables.clone(rt, initVar, "SELF", false, true);
                                }
                                if (!variables.typesEqual(initVar.t, decType.t)) {
                                    const ptrDecType = variables.asPointerType(decType.t);
                                    const ptrInitVar = variables.asPointer(initVar);
                                    if (ptrDecType !== null && ptrInitVar !== null && variables.typesEqual(ptrDecType.pointee, ptrInitVar.t.pointee)) {
                                        const decSize = ptrDecType.sizeConstraint;
                                        const initSize = ptrInitVar.t.sizeConstraint;

                                        if (decSize === null) {
                                            initVar = { t: variables.pointerType(ptrInitVar.t.pointee, null), v: ptrInitVar.v };
                                        } else if (decSize < 1 && initSize !== null && initSize >= 0) {
                                            // pass
                                        } else if (initSpec !== null && initSpec.Expression.type === "StringLiteralExpression" && initSize !== null && initSize <= decSize) {
                                            const decArithmeticPointee = variables.asArithmeticType(ptrDecType.pointee) ?? rt.raiseException("Declaration error: Expected a pointer to a char values");
                                            const iptr = variables.asInitIndexPointerOfElem(ptrInitVar, variables.uninitArithmetic(decArithmeticPointee.sig, null)) ?? rt.raiseException("Declaration error: Expected an initialiser to be an initialised arithmetic pointer");
                                            const memory = iptr.v.pointee;
                                            for (let i = memory.values.length - iptr.v.index; i < decSize; i++) {
                                                memory.values.push(variables.uninitArithmetic(decArithmeticPointee.sig, { array: memory, index: iptr.v.index + i }).v);
                                            }
                                        } else {
                                            rt.raiseException("Declaration error: Array size mismatch");
                                        }
                                    } else {
                                        const preDecVarYield = rt.defaultValue2(decType.t, "SELF");
                                        const preDecVar = variables.clone(rt, asResult(preDecVarYield) ?? (yield* preDecVarYield as Gen<Variable>), "SELF", false, true);
                                        const callInst = rt.getFuncByParams("{global}", "o(_=_)", [preDecVar, initVar], []);
                                        const retvYield = rt.invokeCall(callInst, [], preDecVar, initVar)
                                        const retv = asResult(retvYield) ?? (yield* retvYield as Gen<MaybeUnboundVariable | "VOID">)
                                        if (retv === "VOID") {
                                            rt.raiseException("Declaration error: expected non-void return value in assignment operator");
                                        } else {
                                            initVar = rt.expectValue(rt.unbound(retv));
                                        }
                                    }
                                }
                                if (isConst) {
                                    (initVar.v as any).isConst = true;
                                }
                                rt.defVar(name, initVar);
                            }
                        }
                        i++;
                    }
                }
            },
            *StructDeclaration(interp, s: XStructDeclaration, param) {
                ({ rt } = interp);
                // TODO: handle recursive references

                for (const identifier of s.DeclarationIdentifiers) {
                    const structMemberList: MemberObject[] = [];
                    for (const structMember of s.StructMemberList) {
                        for (const dec of structMember.Declarators) {
                            const init = dec.Initializers;

                            if (init !== null && init.type === "Initializer_array") {
                                rt.raiseException("Struct declaration error: type error");
                            }

                            const _simpleTypeYield = rt.simpleType(structMember.MemberType);
                            param.basetype = _simpleTypeYield;
                            const { name, type } = (yield* interp.visit(interp, dec.Declarator, param)) as DeclaratorYield;

                            const initvarYield = (init == null) ? rt.defaultValue2(type.t, "SELF") : interp.visit(interp, init.Expression) as Gen<Variable>;
                            const initvar = asResult(initvarYield) ?? (yield* (initvarYield as Gen<Variable>));

                            structMemberList.push({
                                name,
                                variable: variables.clone(rt, initvar, "SELF", false, true)
                            });
                        }
                    }

                    if (s.InitVariables) {
                        rt.raiseException("Struct declaration error: not yet implemented");
                        //const structType = rt.newStruct(`initialized_struct_${identifier}`, structMemberList);
                        //rt.defVar(identifier, rt.defaultValue2(structType));
                    } else {
                        if (rt.scope.length !== 1) {
                            rt.raiseException("Struct declaration error: Nested classes are not yet implemented");
                        }
                        rt.defineStruct("{global}", identifier, structMemberList, {});
                    }
                }
            },
            *Initializer_expr(interp, s: XInitializerExpr, param): Gen<Variable> {
                ({
                    rt
                } = interp);
                return yield* interp.visit(interp, s.Expression, param);
            },
            *Initializer_array(interp, s: XInitializerArray, param: { typeHint?: ObjectType }): Gen<Variable> {
                function* getListItem(rt: CRuntime, item: XInitializerExpr | XInitializerArray, memIdx: number, childType: ObjectType | null): Gen<Variable> {
                    const _typeHint = param.typeHint;
                    param.typeHint = childType ?? undefined;
                    const _rawVariable = yield* interp.visit(interp, item, param);
                    if (!("t" in _rawVariable && "sig" in _rawVariable.t)) {
                        if (_rawVariable === "VOID") {
                            rt.raiseException(`Initialiser list error: List member at index ${memIdx}: Expected a variable, got void`);
                        }
                        rt.raiseException(`Initialiser list error: List member at index ${memIdx}: Expected a variable`);
                    }
                    if (_rawVariable.t.sig === "FUNCTION") {
                        rt.raiseException(`Initialiser list error: List member at index ${memIdx}: Expected a variable, got function (perhaps you meant a function pointer?)`);
                    }
                    const rawVariable = _rawVariable as Variable;
                    param.typeHint = _typeHint;
                    if (childType && !variables.typesEqual(rawVariable.t, childType)) {
                        const targetArithmetic = variables.asArithmeticType(childType);
                        const sourceArithmetic = variables.asArithmetic(rawVariable);
                        if (targetArithmetic !== null && sourceArithmetic !== null) {
                            const result = variables.arithmetic(targetArithmetic.sig, rt.arithmeticValue(sourceArithmetic), null);
                            rt.adjustArithmeticValue(result);
                            return result;
                        } else {
                            const targetStr = variables.toStringSequence(rt, childType, false, false).join(" ");
                            const sourceStr = variables.toStringSequence(rt, rawVariable.t, false, false).join(" ");
                            if (targetStr in rt.ct.implicit && sourceStr in rt.ct.implicit[targetStr]) {
                                const func = rt.getFuncByParams(variables.asClassType(childType) ?? rt.raiseException(`Initialiser list error: List member at index ${memIdx}: not yet implemented`), "o(_ctor)", [rawVariable], [targetStr]);
                                const callYield = rt.invokeCall(func, [], rawVariable);
                                const callResult = asResult(callYield) ?? (yield* callYield as Gen<MaybeUnboundVariable | "VOID">);
                                if (callResult === "VOID") {
                                    rt.raiseException(`Initialiser list error: List member at index ${memIdx}: Expected a variable, got void`)
                                }
                                return rt.unbound(callResult);
                            } else {
                                rt.raiseException(`Initialiser list error: List member at index ${memIdx}: cannot implicitly convert from '${rt.makeTypeStringOfVar(rawVariable)}' to '${rt.makeTypeString(childType)}'`);
                            }
                        }
                    } else {
                        return rawVariable;
                    }
                }
                ({
                    rt
                } = interp);
                const typeHint = param.typeHint ?? null;
                const ptrTypeHint = typeHint !== null ? variables.asPointerType(typeHint) : null;
                if (ptrTypeHint !== null && ptrTypeHint.pointee.sig === "FUNCTION") {
                    rt.raiseException("Initialiser list error: Cannot declare array of functions (perhaps you meant array of function pointers?)");
                }
                let childTypeHint = (ptrTypeHint !== null && ptrTypeHint.sizeConstraint !== null) ? ptrTypeHint.pointee as ObjectType : null;
                if (typeHint === null) {
                    let initList: Variable[] = [];
                    let i = 0;
                    for (const item of s.Initializers) {
                        initList.push(yield* getListItem(rt, item, i, null))
                        i++;
                    }
                    const classMembers: { [name: string]: Variable } = {};
                    initList.forEach((xv, xi) => classMembers[xi.toString()] = xv);
                    const protoStruct = variables.class(variables.classType("__list_prototype", initList.map((x) => x.t), null), classMembers, null);
                    return protoStruct;
                    //rt.raiseException("Initialiser list error: Cannot determine type from the context");
                }
                if (childTypeHint === null) {
                    const classTypeHint = variables.asClassType(typeHint) ?? rt.raiseException("Initialiser list error: Not yet implemented");
                    if (classTypeHint.identifier in rt.explicitListInitTable) {
                        childTypeHint = rt.explicitListInitTable[classTypeHint.identifier](typeHint);
                    } else {
                        if (!(classTypeHint.identifier in rt.typeMap)) {
                            rt.raiseException(`Initialiser list error: cannot find class named '${classTypeHint.identifier}'`);
                        }
                        const memNames = rt.typeMap[classTypeHint.identifier].dataMemberNames;
                        /*if (memListFactory.numTemplateArgs !== classTypeHint.templateSpec.length) {
                            rt.raiseException(`Initialiser list error: expected ${memListFactory.numTemplateArgs} template arguments, got ${classTypeHint.templateSpec.length}`);
                        }*/
                        const memMapFactory = rt.typeMap[classTypeHint.identifier].memberObjectListCreator;
                        const memMapYield: ResultOrGen<MemberMap> = memMapFactory.factory(classTypeHint);
                        const memMap: MemberMap = asResult(memMapYield) ?? (yield* memMapYield as Gen<MemberMap>);
                        let resultMembers: { [member: string]: Variable } = {};
                        let i = 0;
                        for (const member of memNames) {
                            if (!(member in memMap)) {
                                rt.raiseException(`Initialiser list error: Internal error (member '${member}' is defined but not found in factory implementation)`)
                            }
                        }
                        if (s.Initializers.length > Object.entries(memMap).length) {
                            rt.raiseException(`Initialiser list error: Expected ${Object.entries(memMap).length} elements, got ${s.Initializers.length};\nExpected brace-enclosed initialiser layout:\n  {${memNames.map((s) => rt.makeTypeString(memMap[s].t)).join(", ")}}`);
                        }
                        for (const member of memNames) {
                            resultMembers[member] = (i < s.Initializers.length) ? yield* getListItem(rt, s.Initializers[i], i, memMap[member].t) : memMap[member];
                            i++;
                        }
                        return variables.class(classTypeHint, resultMembers, null, false);
                    }
                }
                // childTypeHint is non-null at this point 
                let initList: Variable[] = [];
                let i = 0;
                for (const item of s.Initializers) {
                    initList.push(yield* getListItem(rt, item, i, childTypeHint))
                    i++;
                }
                if (ptrTypeHint !== null && ptrTypeHint.sizeConstraint !== null) {
                    if (ptrTypeHint.sizeConstraint >= 0 && initList.length > ptrTypeHint.sizeConstraint) {
                        rt.raiseException(`Initialiser list error: expected at most ${ptrTypeHint.sizeConstraint} elements, got ${initList.length};`)
                    }
                    const size = (ptrTypeHint.sizeConstraint >= 0) ? ptrTypeHint.sizeConstraint : initList.length;
                    const memory = variables.arrayMemory<Variable>(childTypeHint, []);
                    let i = 0;
                    for (const item of initList) {
                        memory.values.push(variables.clone(rt, item, { array: memory, index: i }, false, true).v);
                        i++;
                    }
                    if (i < size) {
                        while (i < size) {
                            // do not put defaultValue outside the for-loop
                            const defaultValueYield = rt.defaultValue2(childTypeHint, null);
                            const defaultValue = asResult(defaultValueYield) ?? (yield* defaultValueYield as Gen<Variable>);
                            memory.values.push(variables.clone(rt, defaultValue, { array: memory, index: i }, false, true).v);
                            i++;
                        }
                    }
                    return variables.indexPointer(memory, 0, true, null);
                } else {
                    const ilist = createInitializerList<Variable>(childTypeHint, initList.map(x => x.v));
                    if (param.typeHint !== undefined) {
                        const classTypeHint = variables.asClassType(typeHint) ?? rt.raiseException("Initialiser list error: Not yet implemented");
                        const ctorInst = rt.getFuncByParams(classTypeHint, "o(_ctor)", [ilist], [variables.toStringSequence(rt, classTypeHint, false, false)]);
                        const ctorYield = rt.invokeCall(ctorInst, [classTypeHint], ilist);
                        const ctorResult = asResult(ctorYield) ?? (yield* ctorYield as Gen<MaybeUnboundVariable | "VOID">);
                        if (ctorResult === "VOID") {
                            rt.raiseException("Initialiser list error: expected a constructor returning a non-void value");
                        }
                        return rt.unbound(ctorResult);
                    } else {
                        return ilist;
                    }
                }
            },
            *Label_case(interp, s, param) {
                ({
                    rt
                } = interp);
                const ce = yield* interp.visit(interp, s.ConstantExpression);
                if (param["switch"] === undefined) {
                    rt.raiseException("Label 'case' error: Cannot use 'case' keyword outside the 'switch' block");
                }
                if (param.scope === "SelectionStatement_switch_cs") {
                    return [
                        "switch",
                        (rt.cast(ce.t, param["switch"]) as Variable).v === ce.v
                    ];
                } else {
                    rt.raiseException("Label 'case' error: you can only use case directly in a switch block");
                }
            },
            Label_default(interp, _s, param) {
                ({
                    rt
                } = interp);
                if (param["switch"] === undefined) {
                    rt.raiseException("Label 'default' error: you cannot use default outside switch block");
                }
                if (param.scope === "SelectionStatement_switch_cs") {
                    return [
                        "switch",
                        true
                    ];
                } else {
                    rt.raiseException("Label 'default' error: you can only use default directly in a switch block");
                }
            },
            *CompoundStatement(interp, s, param) {
                let stmt;
                ({
                    rt
                } = interp);
                const stmts = s.Statements;
                let r;
                let i;
                const _scope = param.scope;
                if (param.scope === "SelectionStatement_switch") {
                    param.scope = "SelectionStatement_switch_cs";
                    rt.enterScope(param.scope);
                    let switchon = false;
                    i = 0;
                    while (i < stmts.length) {
                        stmt = stmts[i];
                        if ((stmt.type === "Label_case") || (stmt.type === "Label_default")) {
                            r = yield* interp.visit(interp, stmt, param);
                            if (r[1]) {
                                switchon = true;
                            }
                        } else if (switchon) {
                            r = yield* interp.visit(interp, stmt, param);
                            if (r instanceof Array) {
                                return r;
                            }
                        }
                        i++;
                    }
                    rt.exitScope(param.scope);
                    param.scope = _scope;
                } else {
                    param.scope = "CompoundStatement";
                    rt.enterScope(param.scope);
                    for (stmt of stmts) {
                        r = yield* interp.visit(interp, stmt, param);
                        if (r instanceof Array) {
                            break;
                        }
                    }
                    rt.exitScope(param.scope);
                    param.scope = _scope;
                    return r;
                }
            },
            *ExpressionStatement(interp, s, param) {
                ({
                    rt
                } = interp);
                if (s.Expression != null) {
                    yield* interp.visit(interp, s.Expression, param);
                }
            },
            *SelectionStatement_if(interp, s, param) {
                ({
                    rt
                } = interp);
                const scope_bak = param.scope;
                param.scope = "SelectionStatement_if";
                rt.enterScope(param.scope);
                const e = yield* interp.visit(interp, s.Expression, param);
                let ret;
                let castYield = rt.cast(variables.arithmeticType("BOOL"), e) as ResultOrGen<ArithmeticVariable>;
                if (rt.arithmeticValue(asResult(castYield) ?? (yield* castYield as Gen<ArithmeticVariable>))) {
                    ret = yield* interp.visit(interp, s.Statement, param);
                } else if (s.ElseStatement) {
                    ret = yield* interp.visit(interp, s.ElseStatement, param);
                }
                rt.exitScope(param.scope);
                param.scope = scope_bak;
                return ret;
            },
            *SelectionStatement_switch(interp, s, param) {
                ({
                    rt
                } = interp);
                const scope_bak = param.scope;
                param.scope = "SelectionStatement_switch";
                rt.enterScope(param.scope);
                const e = yield* interp.visit(interp, s.Expression, param);
                const switch_bak = param["switch"];
                param["switch"] = e;
                const r = yield* interp.visit(interp, s.Statement, param);
                param["switch"] = switch_bak;
                let ret;
                if (r instanceof Array) {
                    if (r[0] !== "break") {
                        ret = r;
                    }
                }
                rt.exitScope(param.scope);
                param.scope = scope_bak;
                return ret;
            },
            *IterationStatement_while(interp, s, param) {
                let return_val;
                ({
                    rt
                } = interp);
                const scope_bak = param.scope;
                param.scope = "IterationStatement_while";
                rt.enterScope(param.scope);
                while (true) {
                    if (s.Expression != null) {
                        const cond = yield* interp.visit(interp, s.Expression, param);
                        const castYield = rt.cast(variables.arithmeticType("BOOL"), cond) as ResultOrGen<ArithmeticVariable>;
                        const castBool = rt.arithmeticValue(asResult(castYield) ?? (yield* castYield as Gen<ArithmeticVariable>));
                        if (!castBool) { break; }
                    }
                    const r = yield* interp.visit(interp, s.Statement, param);
                    if (r instanceof Array) {
                        let end_loop;
                        switch (r[0]) {
                            case "continue":
                                break;
                            case "break":
                                end_loop = true;
                                break;
                            case "return":
                                return_val = r;
                                end_loop = true;
                                break;
                        }
                        if (end_loop) { break; }
                    }
                }
                rt.exitScope(param.scope);
                param.scope = scope_bak;
                return return_val;
            },
            *IterationStatement_do(interp, s, param) {
                let return_val;
                ({
                    rt
                } = interp);
                const scope_bak = param.scope;
                param.scope = "IterationStatement_do";
                rt.enterScope(param.scope);
                while (true) {
                    const r = yield* interp.visit(interp, s.Statement, param);
                    if (r instanceof Array) {
                        let end_loop;
                        switch (r[0]) {
                            case "continue":
                                break;
                            case "break":
                                end_loop = true;
                                break;
                            case "return":
                                return_val = r;
                                end_loop = true;
                                break;
                        }
                        if (end_loop) { break; }
                    }
                    if (s.Expression != null) {
                        const cond = yield* interp.visit(interp, s.Expression, param);
                        const castYield = rt.cast(variables.arithmeticType("BOOL"), cond) as ResultOrGen<MaybeUnboundArithmeticVariable>;
                        const castBool = rt.arithmeticValue(asResult(castYield) ?? (yield* castYield as Gen<MaybeUnboundArithmeticVariable>));
                        if (!castBool) { break; }
                    }
                }
                rt.exitScope(param.scope);
                param.scope = scope_bak;
                return return_val;
            },
            *IterationStatement_foreach(interp, s: XIterationStatement_foreach, param) {
                let return_val;
                ({ rt } = interp);
                const scope_bak = param.scope;
                param.scope = "IterationStatement_foreach";
                rt.enterScope(param.scope);

                const _iterable: MaybeUnboundVariable | Function | "VOID" = yield* interp.visit(interp, s.Expression, param);
                if (_iterable === "VOID") {
                    rt.raiseException("Range-based-for statement error: Expected iterable expression, got void");
                }
                if (variables.asFunctionType(_iterable.t)) {
                    rt.raiseException("Range-based-for statement error: Expected iterable expression, got function");
                }
                const iterable = _iterable as Variable;
                function printTypes(): string {
                    const iteratorType = rt.makeTypeStringOfVar(iterable);
                    if (beginVar) {
                        const elementHandlerType = rt.makeTypeStringOfVar(beginVar);
                        if (derefTestVar) {
                            const elementType = derefTestVar === "VOID" ? "void" : rt.makeTypeStringOfVar(derefTestVar);
                            return `\nDiagnostic information: [\n  IteratorType = ${iteratorType},\n  ElementHandlerType = ${elementHandlerType},\n  ElementType = ${elementType}\n]`;
                        }
                        return `\nDiagnostic information: [\n  IteratorType = ${iteratorType},\n  ElementHandlerType = ${elementHandlerType}\n]`;
                    }
                    return `\nDiagnostic information: [\n  IteratorType = ${iteratorType}\n]`;
                }

                let beginVar: Variable;
                let endVar: Variable;
                let classIterable: ClassVariable | null;
                if (iterable.t.sig === "PTR" && iterable.t.sizeConstraint !== null) {
                    const arrayIterable = iterable as InitIndexPointerVariable<Variable>;
                    beginVar = variables.indexPointer(arrayIterable.v.pointee, arrayIterable.v.index, false, "SELF");
                    endVar = variables.indexPointer(arrayIterable.v.pointee, arrayIterable.v.index + (arrayIterable.t.sizeConstraint as number), false, "SELF");
                } else if ((classIterable = variables.asClass(iterable)) !== null) {
                    const beginInst = rt.tryGetFuncByParams(classIterable.t, "begin", [classIterable], []);
                    const endInst = rt.tryGetFuncByParams(classIterable.t, "end", [classIterable], []);
                    if (beginInst !== null && endInst !== null) {
                        const beginYield = rt.invokeCall(beginInst, [], classIterable);
                        const endYield = rt.invokeCall(endInst, [], classIterable);
                        const beginResult = asResult(beginYield) ?? (yield* beginYield as Gen<MaybeUnboundVariable | "VOID">);
                        const endResult = asResult(endYield) ?? (yield* endYield as Gen<MaybeUnboundVariable | "VOID">);
                        beginVar = (beginResult !== "VOID") ? variables.clone(rt, rt.unbound(beginResult), "SELF", false) : rt.raiseException("Range-based-for statement error: Expected 'begin' to be a variable, got void" + printTypes());
                        endVar = (endResult !== "VOID") ? variables.clone(rt, rt.unbound(endResult), "SELF", false) : rt.raiseException("Range-based-for statement error: Expected 'end' to be a variable, got void" + printTypes());
                    } else {
                        rt.raiseException("Range-based-for statement error: Expression is not iterable (missing 'begin' and 'end' member functions)" + printTypes());
                    }
                } else {
                    rt.raiseException("Range-based-for statement error: Expression is not iterable" + printTypes());
                }
                if (!variables.typesEqual(beginVar.t, endVar.t)) {
                    rt.raiseException(`Range-based-for statement error: Incompatible types between begin-expression '${rt.makeTypeStringOfVar(beginVar)}' and end-expression '${rt.makeTypeStringOfVar(endVar)}'${printTypes()}`);
                }
                const derefInst = rt.getOpByParams("{global}", "o(*_)", [beginVar], []);
                const derefTestYield = rt.invokeCall(derefInst, [], beginVar);
                const derefTestVar = asResult(derefTestYield) ?? (yield* derefTestYield as Gen<MaybeUnboundVariable | "VOID">);
                if (derefTestVar === "VOID") {
                    rt.raiseException("Range-based-for statement error: Expected *x (given x of type ElementHandlerType) to be a variable, got void" + printTypes());
                }
                const ppInst = rt.getOpByParams("{global}", "o(++_)", [beginVar], []);
                const neqInst = rt.getOpByParams("{global}", "o(_!=_)", [beginVar, beginVar], []);
                const neqTestYield = rt.invokeCall(neqInst, [], beginVar, beginVar);
                const neqTestVar = asResult(neqTestYield) ?? (yield* neqTestYield as Gen<MaybeUnboundVariable | "VOID">);
                if (neqTestVar === "VOID") {
                    rt.raiseException("Range-based-for statement error: Expected result of operator == between ElementHandlerType types to have a boolean type, got void" + printTypes());
                }
                if (neqTestVar.t.sig !== "BOOL") {
                    rt.raiseException(`Range-based-for statement error: Expected result of operator == between ElementHandlerType types to have a boolean type, got ${rt.makeTypeString(neqTestVar.t)}${printTypes()}`);
                }

                while (true) {
                    const neqYield = rt.invokeCall(neqInst, [], beginVar, endVar) as ResultOrGen<ArithmeticVariable>;
                    const neqVar = asResult(neqYield) ?? (yield* neqYield as Gen<ArithmeticVariable>);
                    if (rt.arithmeticValue(neqVar) === 0) {
                        break;
                    }

                    if (s.Initializer) {
                        const elemTmpYield = rt.invokeCall(derefInst, [], beginVar) as ResultOrGen<MaybeUnboundVariable>;
                        let elemTmpVar = asResult(elemTmpYield) ?? (yield* elemTmpYield as Gen<MaybeUnboundVariable>);

                        if (s.Initializer.InitDeclaratorList.length !== 1) {
                            rt.raiseException("Range-based-for statement error: Expected at most one variable to be declared" + printTypes());
                        }
                        const dec = s.Initializer.InitDeclaratorList[0];
                        const declSpec = s.Initializer.DeclarationSpecifiers;
                        let basetype: MaybeLeft<ObjectType>;
                        let isConst: boolean;
                        if (declSpec.length > 0 && declSpec[declSpec.length - 1] === "auto") {
                            basetype = elemTmpVar;
                            isConst = iterable.v.isConst;
                            if (!dec.Declarator.Reference) {
                                (elemTmpVar.v as any).isConst = iterable.v.isConst;
                                elemTmpVar = variables.clone(rt, rt.unbound(elemTmpVar), "SELF", iterable.v.isConst);
                            }
                        } else if (declSpec.length > 1 && declSpec[0] === "const") {
                            isConst = true;
                            const basetypeOrVoid = rt.simpleType(declSpec);
                            basetype = basetypeOrVoid !== "VOID" ? basetypeOrVoid : rt.raiseException("Range-based-for statement error: Declared variable cannot have a void type" + printTypes());
                            if (!dec.Declarator.Reference) {
                                (elemTmpVar.v as any).isConst = true;
                                elemTmpVar = variables.clone(rt, rt.unbound(elemTmpVar), "SELF", true);
                            }
                        } else {
                            isConst = false;
                            const basetypeOrVoid = rt.simpleType(declSpec);
                            basetype = basetypeOrVoid !== "VOID" ? basetypeOrVoid : rt.raiseException("Range-based-for statement error: Declared variable cannot have a void type" + printTypes());
                            if (dec.Declarator.Reference) {
                                // mutable borrow
                                if (iterable.v.isConst) {
                                    rt.raiseException(`Range-based-for statement error: Cannot declare '${rt.makeTypeString(basetype.t, true)}' to '${rt.makeTypeString(elemTmpVar.t, false, true)}' (perhaps you meant '${rt.makeTypeString(basetype.t, true, true)}'?)` + printTypes());
                                }
                            } else {
                                // clone
                                elemTmpVar = variables.clone(rt, rt.unbound(elemTmpVar), "SELF", false);
                            }
                        }
                        let visitResult: DeclaratorYield;
                        {
                            const _basetype = param.basetype;
                            param.basetype = basetype;
                            visitResult = (yield* interp.visit(interp, dec.Declarator, param)) as DeclaratorYield;
                            param.basetype = _basetype;
                        }
                        const decType: MaybeLeft<ObjectType> = (dec.Declarator.Pointer instanceof Array) ? variables.uninitPointer(basetype.t, null, "SELF") : basetype;
                        const { name/*, type*/ } = visitResult;
                        if (!(dec.Declarator.right instanceof Array) || dec.Declarator.right.length !== 0) {
                            rt.raiseException("Range-based-for statement error: Type error or not yet implemented" + printTypes());

                        }
                        if (dec.Initializers !== null) {
                            rt.raiseException("Range-based-for statement error: Declared variable cannot have initialisers" + printTypes());
                        }
                        // initVar <=> elemTmpVar
                        if (!variables.typesEqual(elemTmpVar.t, decType.t)) {
                            rt.raiseException("Range-based-for statement error: Not yet implemented" + printTypes());
                        }
                        if (isConst) {
                            (elemTmpVar.v as any).isConst = true;
                        }
                        rt.defVar(name, rt.unbound(elemTmpVar), true);
                    } else {
                        rt.raiseException("Range-based-for statement error: Not yet implemented" + printTypes());
                    }


                    const r = yield* interp.visit(interp, s.Statement, param);
                    if (r instanceof Array) {
                        let end_loop = false;
                        switch (r[0]) {
                            case "continue":
                                break;
                            case "break":
                                end_loop = true;
                                break;
                            case "return":
                                return_val = r;
                                end_loop = true;
                                break;
                        }
                        if (end_loop) { break; }
                    }

                    const ppYield = rt.invokeCall(ppInst, [], beginVar);
                    asResult(ppYield) ?? (yield* ppYield as Gen<"VOID">);
                }

                rt.exitScope(param.scope);
                param.scope = scope_bak;
                return return_val;
            },
            *IterationStatement_for(interp, s, param) {
                let return_val;
                ({
                    rt
                } = interp);
                const scope_bak = param.scope;
                param.scope = "IterationStatement_for";
                rt.enterScope(param.scope);
                if (s.Initializer) {
                    if (s.Initializer.type === "Declaration") {
                        yield* interp.visit(interp, s.Initializer, param);
                    } else {
                        yield* interp.visit(interp, s.Initializer, param);
                    }
                }
                while (true) {
                    if (s.Expression != null) {
                        const cond = yield* interp.visit(interp, s.Expression, param);
                        const castYield = rt.cast(variables.arithmeticType("BOOL"), cond) as ResultOrGen<ArithmeticVariable>;
                        const castBool = rt.arithmeticValue(asResult(castYield) ?? (yield* castYield as Gen<ArithmeticVariable>));
                        if (!castBool) { break; }
                    }
                    const r = yield* interp.visit(interp, s.Statement, param);
                    if (r instanceof Array) {
                        let end_loop;
                        switch (r[0]) {
                            case "continue":
                                break;
                            case "break":
                                end_loop = true;
                                break;
                            case "return":
                                return_val = r;
                                end_loop = true;
                                break;
                        }
                        if (end_loop) { break; }
                    }
                    if (s.Loop) {
                        yield* interp.visit(interp, s.Loop, param);
                    }
                }
                rt.exitScope(param.scope);
                param.scope = scope_bak;
                return return_val;
            },
            JumpStatement_goto(interp, _s, _param) {
                ({
                    rt
                } = interp);
                rt.raiseException("Go-to statement error: not implemented");
            },
            JumpStatement_continue(interp, _s, _param) {
                ({
                    rt
                } = interp);
                return ["continue"];
            },
            JumpStatement_break(interp, _s, _param) {
                ({
                    rt
                } = interp);
                return ["break"];
            },
            *JumpStatement_return(interp, s, param) {
                ({
                    rt
                } = interp);
                if (s.Expression) {
                    let ret = yield* interp.visit(interp, s.Expression, param);

                    return [
                        "return",
                        ret
                    ];
                }
                return ["return"];
            },
            *DeleteStatement(interp, s: XDeleteStatement, param): Gen<"VOID"> {
                ({
                    rt
                } = interp);
                const expr = (yield* interp.visit(interp, s.Expression, param)) as MaybeUnboundVariable | "VOID";
                if (expr === "VOID") {
                    rt.raiseException("Delete-statement error: Expected non-void expression");
                }
                const ptrExpr = variables.asInitPointer(rt.unbound(expr)) ?? rt.raiseException("Delete-statement error: Expected an init pointer expression");
                if (ptrExpr.t.pointee.sig === "FUNCTION") {
                    rt.raiseException("Delete-statement error: Cannot delete a function pointer");
                }
                variables.indexPointerAssign(rt, ptrExpr as InitPointerVariable<Variable>, variables.arrayMemory(ptrExpr.t.pointee, []), 0);
                return "VOID";
            },

            IdentifierExpression(interp, s: XIdentifierExpression, param: { functionArgs?: MaybeLeftCV<ObjectType>[] }) {
                ({ rt } = interp);

                const globalScope = rt.scope.find((scope) => scope.$name === "{global}");
                const currentScope = rt.scope[rt.scope.length - 1];
                const declarationScope = rt.scope.slice().reverse().find((scope, idx) => scope.$name.includes("function") && rt.scope[idx + 1].$name === "CompoundStatement") || ({ variables: {} }) as RuntimeScope;

                const varname = resolveIdentifier(s.Identifier);
                if (param.functionArgs === undefined) {
                    return rt.readScopedVar(currentScope, varname) || rt.readScopedVar(declarationScope, varname) || (globalScope !== undefined && rt.readScopedVar(globalScope, varname)) || rt.getFromNamespace(varname) || rt.readVarOrFunc(varname);
                } else {
                    const funvar = rt.tryReadVar(varname);
                    if (funvar !== null) {
                        return funvar;
                    }
                    const funsym = rt.getFuncByParams("{global}", varname, param.functionArgs, []);
                    return funsym;
                }
            },
            *ParenthesesExpression(interp, s, param) {
                ({
                    rt
                } = interp);
                return yield* interp.visit(interp, s.Expression, param);
            },
            *PostfixExpression_ArrayAccess(interp, s: XPostfixExpression_ArrayAccess, param) {
                ({
                    rt
                } = interp);
                const ret = (yield* interp.visit(interp, s.Expression, param)) as Variable;
                const index = yield* interp.visit(interp, s.index, param);

                param.structType = ret.t;
                const funsym = rt.getOpByParams("{global}", "o(_[_])", [ret, index], []);
                const r = rt.invokeCall(funsym, [], ret, index);
                if (isGenerator(r)) {
                    return yield* r as Generator;
                } else {
                    return r;
                }
            },
            *PostfixExpression_MethodInvocation(interp, s: XPostfixExpression_MethodInvocation, param): ResultOrGen<MaybeUnboundVariable | "VOID"> {
                ({
                    rt
                } = interp);
                let args: Variable[] = yield* (function*() {
                    const result = [];
                    for (const e of s.args) {
                        const thisArg = yield* interp.visit(interp, e, param);
                        if (thisArg === "VOID") {
                            rt.raiseException("Method invocation error: Expected a non-void value in parameter");
                        }
                        result.push(rt.unbound(thisArg));
                    }
                    return result;
                }).call(this);
                if (s.Expression.type === "PostfixExpression_MemberAccess") {
                    // TODO: optimise (remove double visitation)
                    const holderClass = variables.asClass(rt.unbound(yield* interp.visit(interp, s.Expression.Expression, {})));
                    if (holderClass === null) {
                        rt.raiseException("Method invocation error: Could not visit holder class");
                    }
                    args = [holderClass, ...args];
                }
                const ret: Variable | FunctionCallInstance = yield* interp.visit(interp, s.Expression, { functionArgs: args });

                if ("actions" in ret) {
                    const resultOrGen = rt.invokeCall(ret, [], ...args);
                    const result = asResult(resultOrGen) ?? (yield* resultOrGen as Gen<MaybeUnboundVariable | "VOID">);
                    if (result === "VOID") {
                        return "VOID";
                    }
                    return rt.expectValue(result);
                } else {
                    const fret = variables.asFunction(ret);
                    if (fret !== null) {
                        const resultOrGen = rt.invokeCallFromVariable(fret, ...args);
                        const result = asResult(resultOrGen) ?? (yield* resultOrGen as Gen<MaybeUnboundVariable | "VOID">);
                        if (result === "VOID") {
                            return "VOID";
                        }
                        return rt.expectValue(result);
                    }
                    const fpret = variables.asInitDirectPointer(ret);
                    if (fpret !== null && variables.asFunctionType(fpret.t.pointee) !== null) {
                        const fn = { t: fpret.t.pointee as FunctionType, v: fpret.v.pointee as FunctionValue };
                        const resultOrGen = rt.invokeCallFromVariable(fn, ...args);
                        const result = asResult(resultOrGen) ?? (yield* resultOrGen as Gen<MaybeUnboundVariable | "VOID">);
                        if (result === "VOID") {
                            return "VOID";
                        }
                        return rt.expectValue(result);

                    }
                    rt.raiseException("Method invocation error: Expected a function")
                }
            },
            *PostfixExpression_MemberAccess(interp, s: XPostfixExpression_MemberAccess, param: { functionArgs?: MaybeLeftCV<ObjectType>[] }): ResultOrGen<Variable | FunctionCallInstance> {
                ({
                    rt
                } = interp);
                const functionArgs = param.functionArgs;
                param.functionArgs = undefined;
                const ret = (yield* interp.visit(interp, s.Expression, param)) as MaybeUnboundVariable | "VOID";
                if (ret === "VOID") {
                    rt.raiseException("Member access error: Expected a non-void value")
                }
                const rclass = variables.asClass(rt.unbound(ret));
                if (rclass === null) {
                    rt.raiseException("Member access error: Expected a class/struct object");
                }
                param.functionArgs = functionArgs;
                if (param.functionArgs === undefined) {
                    return rt.getMember(rclass, s.member);
                } else {
                    return rt.getFuncByParams(rclass.t, s.member, param.functionArgs, [])
                }
            },
            *PostfixExpression_MemberPointerAccess(interp, s, param) {
                ({
                    rt
                } = interp);
                const retYield = yield* interp.visit(interp, s.Expression, param);
                const ret: Variable = rt.expectValue(asResult(retYield) ?? (yield* retYield as Gen<Variable>));

                const maybePtrType = variables.asPointerType(ret.t);
                if (maybePtrType !== null) {
                    const ptc = variables.asClassType(maybePtrType.pointee);
                    if (ptc !== null) {
                        const { member } = s;
                        return rt.getMember(rt.unbound(variables.deref(ret as InitPointerVariable<ClassVariable>) as MaybeUnboundVariable) as ClassVariable, member);
                    } else {
                        rt.raiseException(`Member pointer access error: Expected a pointer to class or struct, got ${rt.makeTypeStringOfVar(ret)}`);
                    }
                } else {
                    rt.raiseException(`Member pointer access error: Expected a pointer to class or struct, got ${rt.makeTypeStringOfVar(ret)}`);
                    /*const member = yield* interp.visit(interp, {
                        type: "IdentifierExpression",
                        Identifier: s.member
                    }, param);
                    const target = rt.invokeCall(rt.getOpByParams("{global}", "o(_->_)", [retc], []), [], retc) as Generator;
                    if (isGenerator(ret)) {
                        return rt.getMember(yield* target as Generator, member);
                    } else {
                        rt.raiseException("Member pointer access error: Expected a generator");
                    }*/
                }
            },
            *PostfixExpression_PostIncrement(interp, s, param) {
                ({
                    rt
                } = interp);
                const ret = yield* interp.visit(interp, s.Expression, param);
                const r = rt.invokeCall(rt.getOpByParams("{global}", "o(_++)", [ret], []), [], ret);
                if (isGenerator(r)) {
                    return yield* r as Generator;
                } else {
                    return r;
                }
            },
            *PostfixExpression_PostDecrement(interp, s, param) {
                ({
                    rt
                } = interp);
                const ret = yield* interp.visit(interp, s.Expression, param);
                const r = rt.invokeCall(rt.getOpByParams("{global}", "o(_--)", [ret], []), [], ret);
                if (isGenerator(r)) {
                    return yield* r as Generator;
                } else {
                    return r;
                }
            },
            *UnaryExpression_PreIncrement(interp, s, param) {
                ({
                    rt
                } = interp);
                const ret = yield* interp.visit(interp, s.Expression, param);
                const r = rt.invokeCall(rt.getOpByParams("{global}", "o(++_)", [ret], []), [], ret);
                if (isGenerator(r)) {
                    return yield* r as Generator;
                } else {
                    return r;
                }
            },
            *UnaryExpression_PreDecrement(interp, s, param) {
                ({
                    rt
                } = interp);
                const ret = yield* interp.visit(interp, s.Expression, param);
                const r = rt.invokeCall(rt.getOpByParams("{global}", "o(--_)", [ret], []), [], ret);
                if (isGenerator(r)) {
                    return yield* r as Generator;
                } else {
                    return r;
                }
            },
            *UnaryExpression(interp, s, param) {
                ({
                    rt
                } = interp);
                const ret = yield* interp.visit(interp, s.Expression, param);
                const r = rt.invokeCall(rt.getOpByParams("{global}", `o(${s.op}_)` as OpSignature, [ret], []), [], ret);
                if (isGenerator(r)) {
                    return yield* r as Generator;
                } else {
                    return r;
                }
            },
            *UnaryExpression_Sizeof_Expr(interp, s, param) {
                ({
                    rt
                } = interp);
                const ret = yield* interp.visit(interp, s.Expression, param);
                return variables.arithmetic("I32", rt.getSizeByType(ret.t), null);
            },
            *UnaryExpression_Sizeof_Type(interp, s: XUnaryExpression_Sizeof_Type, param) {
                ({
                    rt
                } = interp);
                const type = (yield* interp.visit(interp, s.TypeName, param)) as MaybeLeft<ObjectType> | "VOID";
                if (type === "VOID") {
                    rt.raiseException("Sizeof statement error: Cannot apply sizeof to void");
                }
                return variables.arithmetic("I32", rt.getSizeByType(type.t), null);
            },
            *CastExpression(interp, s: XCastExpression, param) {
                ({
                    rt
                } = interp);
                let ret = yield* interp.visit(interp, s.Expression, param);
                ret = variables.clone(rt, ret, null, false);
                const type = resolveTypeId(rt, s.TypeName);
                if (type === "VOID") {
                    rt.raiseException("Cast error: Cannot cast to void");
                } else if (type === "AUTO") {
                    rt.raiseException("Cast error: Cannot cast to auto");
                }
                return rt.cast(type.t, ret, true);
            },
            *NewExpression(interp, s: XNewExpression, param): Gen<Variable> {
                ({
                    rt
                } = interp);
                const xtype = rt.simpleType((s.TypeName instanceof Array) ? s.TypeName : [s.TypeName]) as MaybeLeft<ObjectType> | "VOID";
                if (xtype === "VOID") {
                    rt.raiseException("New-expression error: Type cannot be void (void-pointers are not yet implemented");
                }
                let xt = xtype.t;
                for (let i = 0; i < s.pointerRank; i++) {
                    xt = variables.pointerType(xt, null);
                }
                if (s.arraySizeExpression === null || s.arraySizeExpression === undefined) {
                    const defaultValYield = rt.defaultValue2(xt, "SELF")
                    const defaultVal = asResult(defaultValYield) ?? (yield* defaultValYield as Gen<Variable>);
                    return variables.directPointer(defaultVal, "SELF", false);
                } else {
                    const arrSzVar = (yield* interp.visit(interp, s.arraySizeExpression, param)) as MaybeUnboundVariable;
                    const arrSz = rt.arithmeticValue(variables.asArithmetic(rt.unbound(arrSzVar)) ?? rt.raiseException("New-expression error: Array size is expected to be an arithmetic value"));
                    if (arrSz <= 0) {
                        rt.raiseException("New-expression error: Array size is expected to hold a positive value");
                    }
                    const memory = variables.arrayMemory<Variable>(xt, []);
                    for (let index = 0; index < arrSz; index++) {
                        const defaultValYield = rt.defaultValue2(xt, { index, array: memory })
                        const defaultVal = asResult(defaultValYield) ?? (yield* defaultValYield as Gen<Variable>);
                        memory.values.push(defaultVal.v);
                    }
                    return variables.indexPointer(memory, 0, false, null);
                }
            },
            TypeName(interp, s: XTypeName, _param): MaybeLeft<ObjectType> | "VOID" {
                ({
                    rt
                } = interp);
                const typename = [];
                for (const baseType of s.base) {
                    if (baseType !== "const") {
                        typename.push(baseType);
                    }
                }
                if (s.extra) {
                    return interp.buildRecursivePointerType(rt, s.extra.Pointer, rt.simpleType(typename), 0);
                }
                return rt.simpleType(typename);
            },
            *BinOpExpression(interp, s: XBinOpExpression, param) {
                ({
                    rt
                } = interp);
                const {
                    op
                } = s;
                if (op === "&&") {
                    s.type = "LogicalANDExpression";
                    return yield* interp.visit(interp, s, param);
                } else if (op === "||") {
                    s.type = "LogicalORExpression";
                    return yield* interp.visit(interp, s, param);
                } else {
                    const _left: MaybeUnboundVariable | "VOID" = yield* interp.visit(interp, s.left, param);
                    if (_left === "VOID") {
                        rt.raiseException("Binary operation expression error: Expected a non-void value on the left-hand side of operation");
                    }
                    const left = rt.unbound(_left);
                    const _typeHint = param.typeHint;
                    param.typeHint = left.t;
                    const _right: MaybeUnboundVariable | "VOID" = yield* interp.visit(interp, s.right, param);
                    param.typeHint = _typeHint;
                    if (_right === "VOID") {
                        rt.raiseException("Binary operation expression error: Expected a non-void value on the right-hand side of operation");
                    }
                    const right = rt.unbound(_right);

                    const r = rt.invokeCall(rt.getFuncByParams("{global}", rt.makeBinaryOperatorFuncName(op), [left, right], []), [], left, right);
                    if (isGenerator(r)) {
                        return yield* r as Generator;
                    } else {
                        return r;
                    }
                }
            },
            *LogicalANDExpression(interp, s: XBinOpExpression, param): ResultOrGen<InitArithmeticVariable> {
                const left = rt.expectValue((yield* interp.visit(interp, s.left, param)) as Variable);
                const leftArithmetic = variables.asArithmetic(left) as InitArithmeticVariable;
                let lhsVal: InitArithmeticVariable;
                if (leftArithmetic === null) {
                    const boolType = variables.arithmeticType("BOOL");
                    const lhsBoolYield = rt.cast(boolType, left);
                    lhsVal = rt.expectValue(asResult(lhsBoolYield) ?? (yield* lhsBoolYield as Gen<ArithmeticVariable>)) as InitArithmeticVariable;
                } else {
                    lhsVal = leftArithmetic;
                }
                if (lhsVal.v.value === 0) {
                    return variables.arithmetic("BOOL", 0, null);
                }
                const right = rt.expectValue((yield* interp.visit(interp, s.right, param)) as Variable);
                const rightArithmetic = variables.asArithmetic(right) as InitArithmeticVariable;
                let rhsVal: InitArithmeticVariable;
                if (rightArithmetic === null) {
                    const boolType = variables.arithmeticType("BOOL");
                    const rhsBoolYield = rt.cast(boolType, right);
                    rhsVal = rt.expectValue(asResult(rhsBoolYield) ?? (yield* rhsBoolYield as Gen<ArithmeticVariable>)) as InitArithmeticVariable;
                } else {
                    rhsVal = rightArithmetic;
                }
                return variables.arithmetic("BOOL", ((lhsVal.v.value & rhsVal.v.value) !== 0) ? 1 : 0, null);
            },
            *LogicalORExpression(interp, s: XBinOpExpression, param): ResultOrGen<InitArithmeticVariable> {
                const left = rt.expectValue((yield* interp.visit(interp, s.left, param)) as Variable);
                const leftArithmetic = variables.asArithmetic(left) as InitArithmeticVariable;
                let lhsVal: InitArithmeticVariable;
                if (leftArithmetic === null) {
                    const boolType = variables.arithmeticType("BOOL");
                    const lhsBoolYield = rt.cast(boolType, left);
                    lhsVal = rt.expectValue(asResult(lhsBoolYield) ?? (yield* lhsBoolYield as Gen<ArithmeticVariable>)) as InitArithmeticVariable;
                } else {
                    lhsVal = leftArithmetic;
                }
                if (lhsVal.v.value === 1) {
                    return variables.arithmetic("BOOL", 1, null);
                }
                const right = rt.expectValue((yield* interp.visit(interp, s.right, param)) as Variable);
                const rightArithmetic = variables.asArithmetic(right) as InitArithmeticVariable;
                let rhsVal: InitArithmeticVariable;
                if (rightArithmetic === null) {
                    const boolType = variables.arithmeticType("BOOL");
                    const rhsBoolYield = rt.cast(boolType, right);
                    rhsVal = rt.expectValue(asResult(rhsBoolYield) ?? (yield* rhsBoolYield as Gen<ArithmeticVariable>)) as InitArithmeticVariable;
                } else {
                    rhsVal = rightArithmetic;
                }
                return variables.arithmetic("BOOL", ((lhsVal.v.value | rhsVal.v.value) !== 0) ? 1 : 0, null);
            },
            *ConditionalExpression(interp, s, param) {
                ({
                    rt
                } = interp);
                const obj = yield* interp.visit(interp, s.cond, param);
                const boolType = variables.arithmeticType("BOOL");
                const boolYield = rt.cast(boolType, obj) as ResultOrGen<ArithmeticVariable>;
                const cond = rt.expectValue((asResult(boolYield) ?? (yield* boolYield as Gen<ArithmeticVariable>)));
                return yield* interp.visit(interp, rt.arithmeticValue(cond as ArithmeticVariable) ? s.t : s.f, param);
            },
            *ConstantExpression(interp, s: XConstantExpression, param) {
                ({
                    rt
                } = interp);
                return yield* interp.visit(interp, s.Expression, param);
            },
            *StringLiteralExpression(interp, s: XStringLiteralExpression, param) {
                return yield* interp.visit(interp, s.value, param);
            },
            *StructExpression(interp, s, param: { structType: ClassType }) {
                ({ rt } = interp);

                const convertToObjectArray = function*(expr: any) {
                    if (expr.type === 'StructExpression') {
                        return expr.values.map((value: any) => convertToObjectArray(value.Expression).next().value);
                    } else {
                        return yield* interp.visit(interp, expr, param);
                    }
                };

                const valuesToStruct = function*(arrayValues: any) {
                    const fillerStructYield = rt.defaultValue2(param.structType, null) as ResultOrGen<ClassVariable>;
                    const fillerStruct = rt.unbound(asResult(fillerStructYield) ?? (yield* (fillerStructYield as Gen<ClassVariable>))) as ClassVariable;
                    const orderedKeys = Object.keys(fillerStruct.v.members);

                    for (let k = 0; k < arrayValues.length; k++) {
                        const memberName = orderedKeys[k];
                        const memberValue = arrayValues[k];
                        fillerStruct.v.members[memberName].v = memberValue.v;
                    }

                    return fillerStruct;
                };

                const arrayValues = yield* convertToObjectArray(s);

                if (Array.isArray(arrayValues[0])) {
                    const structArray = [];
                    for (const valueArray of arrayValues) {
                        structArray.push(valuesToStruct(valueArray));
                    }
                    rt.raiseException("Struct expression error: Not yet implemented");
                    //return variables.indexPointer(param.structType, structArray.length), rt.makeArrayPointerValue(structArray, 0));
                }

                return valuesToStruct(arrayValues);
            },
            StringLiteral(interp, s: XStringLiteral, _param): InitIndexPointerVariable<ArithmeticVariable> {
                ({
                    rt
                } = interp);
                // TODO: fix a bug that treats single-byte escape literals beyond \x7f as Unicode code points.
                switch (s.prefix) {
                    case null:
                        return rt.getCharArrayFromString(s.value);
                    case "L":
                        rt.raiseException("String literal error: Not yet implemented");
                    //return rt.makeCharArrayFromString(s.value, "wchar_t");
                    case "u8":
                        rt.raiseException("String literal error: Not yet implemented");
                    //return rt.makeCharArrayFromString(s.value, "char");
                    case "u":
                        rt.raiseException("String literal error: Not yet implemented");
                    //return rt.makeCharArrayFromString(s.value, "char16_t");
                    case "U":
                        rt.raiseException("String literal error: Not yet implemented");
                    //return rt.makeCharArrayFromString(s.value, "char32_t");
                }
                rt.raiseException(`Invalid string prefix error: '${s.prefix}'`);
            },
            BooleanConstant(interp, s, _param) {
                ({
                    rt
                } = interp);
                return variables.arithmetic("BOOL", s.value === "true" ? 1 : 0, null);
            },
            CharacterConstant(interp, s, _param) {
                ({
                    rt
                } = interp);
                const a = s.Char;
                if (a.length !== 1) {
                    rt.raiseException("Character constant error: a character constant must have and only have one character.");
                }
                return variables.arithmetic("I8", a[0].charCodeAt(0), null);
            },
            *FloatConstant(interp, s, param): ResultOrGen<ArithmeticVariable> {
                ({
                    rt
                } = interp);
                const val = yield* interp.visit(interp, s.Expression, param);
                return variables.arithmetic("F64", val.v.value, null);
            },
            DecimalFloatConstant(interp, s, _param): ArithmeticVariable {
                ({
                    rt
                } = interp);
                return variables.arithmetic("F64", parseFloat(s.value), null);
            },
            HexFloatConstant(interp, s, _param): ArithmeticVariable {
                ({
                    rt
                } = interp);
                return variables.arithmetic("F64", parseInt(s.value, 16), null);
            },
            DecimalConstant(interp, s: XDecimalConstant, _param): ArithmeticVariable {
                ({
                    rt
                } = interp);
                const num = parseInt(s.value, 10);
                if (Number.isNaN(num)) {
                    rt.raiseException(`Decimal constant error: '${s.value}' is not a valid decimal constant`);
                }
                const sigPriority: ArithmeticSig[] = ["I32", "I64"];
                for (const sig of sigPriority) {
                    const props = variables.arithmeticProperties[sig];
                    if (num >= props.minv && num <= props.maxv) {
                        return variables.arithmetic(sig, num, null);
                    }
                }
                rt.raiseException(`Decimal constant error: '${num}' is off the limits`);
            },
            HexConstant(interp, s, _param) {
                ({
                    rt
                } = interp);
                const num = parseInt(s.value, 16);
                if (Number.isNaN(num)) {
                    rt.raiseException(`Hexadecimal constant error: '${s.value}' is not a valid hexadecimal constant`);
                }
                const sigPriority: ArithmeticSig[] = ["I32", "U32", "I64", "U64"];
                for (const sig of sigPriority) {
                    const props = variables.arithmeticProperties[sig];
                    if (num >= props.minv && num <= props.maxv) {
                        return variables.arithmetic(sig, num, null);
                    }
                }
                rt.raiseException(`Hexadecimal constant error: '${num}' is off the limits`);
            },
            BinaryConstant(interp, s, _param) {
                ({
                    rt
                } = interp);
                const num = parseInt(s.value, 2);
                if (Number.isNaN(num)) {
                    rt.raiseException(`Binary constant error: '${s.value}' is not a valid binary constant`);
                }
                const sigPriority: ArithmeticSig[] = ["I32", "U32", "I64", "U64"];
                for (const sig of sigPriority) {
                    const props = variables.arithmeticProperties[sig];
                    if (num >= props.minv && num <= props.maxv) {
                        return variables.arithmetic(sig, num, null);
                    }
                }
                rt.raiseException(`Binary constant error: '${num}' is off the limits`);
            },
            OctalConstant(interp, s, _param) {
                ({
                    rt
                } = interp);
                const num = parseInt(s.value, 8);
                if (Number.isNaN(num)) {
                    rt.raiseException(`Octal constant error: '${s.value}' is not a valid octal constant`);
                }
                const sigPriority: ArithmeticSig[] = ["I32", "U32", "I64", "U64"];
                for (const sig of sigPriority) {
                    const props = variables.arithmeticProperties[sig];
                    if (num >= props.minv && num <= props.maxv) {
                        return variables.arithmetic(sig, num, null);
                    }
                }
                rt.raiseException(`Octal constant error: '${num}' is off the limits`);
            },
            NamespaceDefinition(interp, _s, _param) {
                ({
                    rt
                } = interp);
                rt.raiseException("Namespace definition error: not implemented");
            },
            UsingDirective(interp, s, _param) {
                ({ rt } = interp);

                const id = s.Identifier;
                const currentScope = rt.scope[rt.scope.length - 1];

                Object.assign(currentScope.variables, { ...rt.namespace[id], [id]: rt.namespace[id] });
            },
            UsingDeclaration(interp, _s, _param) {
                ({
                    rt
                } = interp);
                rt.raiseException("Using-declaration error: not implemented");
            },
            NamespaceAliasDefinition(interp, _s, _param) {
                ({
                    rt
                } = interp);
                rt.raiseException("Namespace alias definition error: not implemented");
            },
            unknown(interp, s, _param) {
                ({
                    rt
                } = interp);
                rt.raiseException("unhandled syntax " + s.type);
            }
        };
    }

    *visit(interp: Interpreter, s: any, param?: any) {
        let ret;
        const { rt } = interp;
        //console.log(`${s.sLine}: visiting ${s.type}`);
        if (!rt.debug.isTriggered
            && (rt.debug.lastLine === null || rt.debug.lastLine !== s.sLine)
            && s.type !== "CompoundStatement") {
            rt.debug.lastLine = s.sLine;
            let trigger: boolean = (!rt.debug.hasPassedFirstLine && rt.debug.depth > 0)
                || (rt.debug.proceedMode === "stepout" && rt.debug.depth < rt.debug.lastDepth)
                || (rt.debug.proceedMode === "stepover" && rt.debug.depth === rt.debug.lastDepth)
                || rt.debug.proceedMode === "stepin"
                || rt.debug.lineBreakpoints.has(s.sLine);
            if (trigger) {
                if (rt.config.stdio && rt.config.stdio.trap) {
                    rt.debug.hasPassedFirstLine = true;
                    rt.debug.isTriggered = true;
                    rt.debug.lastDepth = rt.debug.depth;
                    rt.config.stdio.cinStop();
                    rt.config.stdio.trap(rt.eapi);
                }
            }
        }
        if ("type" in s) {
            if (param === undefined) {
                param = { scope: "{global}" };
            }
            const _node = this.currentNode;
            this.currentNode = s;
            if (s.type in this.visitors) {
                const f = this.visitors[s.type];
                if (isGeneratorFunction(f)) {
                    const x = f(interp, s, param);
                    if (x != null) {
                        if (isIterable(x)) {
                            ret = yield* x;
                        } else {
                            ret = yield x;
                        }
                    } else {
                        ret = yield null;
                    }
                } else {
                    yield (ret = f(interp, s, param));
                }
            } else {
                ret = this.visitors["unknown"](interp, s, param);
            }
            this.currentNode = _node;
        } else {
            this.currentNode = s;
            interp.rt.raiseException("untyped syntax structure");
        }
        return ret;
    };

    *run(tree: any, source: string, param?: any) {
        if (tree.type === "TranslationUnit")
            this.processIncludes();

        this.rt.interp = this;
        this.source = source;
        return yield* this.visit(this, tree, param);
    };

    processIncludes() {
        const lastToLoad = ["iomanip"];
        if (this.rt.config.includes === undefined) {
            this.rt.raiseException("[Interpreter].rt.config.includes is undefined");
        }
        const { includes, loadedLibraries } = this.rt.config;

        let accessedLibraries = new Set<string>();

        for (const lib of loadedLibraries) {
            if (lastToLoad.includes(lib))
                continue;

            if (accessedLibraries.has(lib)) {
                continue;
            }
            accessedLibraries.add(lib);
            includes[lib].load(this.rt);
        }

        for (const lib of lastToLoad) {
            if (!loadedLibraries.includes(lib))
                continue;

            if (accessedLibraries.has(lib)) {
                continue;
            }
            accessedLibraries.add(lib);
            includes[lib].load(this.rt);
        }
    };

    buildRecursivePointerType(rt: CRuntime, pointer: any[] | null, basetype: MaybeLeft<ObjectType> | "VOID", level: number): MaybeLeft<ObjectType> | "VOID" {
        if (pointer && (pointer.length > level)) {
            if (basetype === "VOID") {
                rt.raiseException("Array initialisation error: not yet implemented");
            }
            const type = { t: variables.pointerType(basetype.t, null), v: { lvHolder: null } } as MaybeLeft<PointerType<ObjectType | FunctionType>>;
            return this.buildRecursivePointerType(rt, pointer, type, level + 1);
        } else {
            return basetype;
        }
    };
}
