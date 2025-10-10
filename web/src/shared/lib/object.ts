// Re-export from objects.ts to maintain backward compatibility
export {
    fillDefined,
    fillDefinedAndNotEmpty,
    objectDeepModify,
    objectAddress,
    objectExceptKeys,
    objectSelectKeys,
    objectDeepFind,
    objectDeepSubst,
    strSubst,
    booleany
} from './objects';

export function arraysHasIntersection(array1: string[], array2: string[]) {
    return array1.find((e1) => array2.find((e2) => e1 === e2));
}

export function objectSpreadMeta(metaCondition: Record<string, unknown>) {
    return Object.fromEntries(
        Object.entries(metaCondition).map(([k, v]) => ["meta." + k, v])
    );
}
