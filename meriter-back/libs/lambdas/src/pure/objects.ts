export const mapConcatKey = (key: string, obj: Record<string, unknown>) => (
  elem,
) => ({
  ...elem,
  [key]: { ...(elem[key] || {}), ...obj },
});

export const mapConcatMeta = (obj: Record<string, unknown>) =>
  mapConcatKey('meta', obj);

export function fillDefined<T>(obj: T) {
  return Object.entries(obj).reduce((obj, cur) => {
    if (typeof cur[1] !== 'undefined' && cur[0] !== 'undefined')
      obj[cur[0]] = cur[1];
    return obj;
  }, {}) as Partial<T>;
}

export const flattenObjectMeta = (obj: Record<string, unknown>) => {
  if (obj.meta && typeof obj.meta == 'object')
    return fillDefined({
      ...obj,
      meta: undefined,
      ...Object.fromEntries(Object.entries(([k, v]) => ['meta.' + k, v])),
    });
  else return obj;
};

export function objectSpreadMeta(metaCondition: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(metaCondition).map(([k, v]) => ['meta.' + k, v]),
  );
}
