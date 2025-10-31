import { ZodSchema, ZodObject, ZodOptional, ZodNullable, ZodArray, ZodEnum, ZodDefault } from 'zod';
import { Schema } from 'mongoose';

/**
 * Extract field information from a Zod schema
 */
export interface ZodFieldInfo {
  name: string;
  required: boolean;
  type: string;
  nested?: ZodFieldInfo[];
}

/**
 * Extract field information from a Mongoose schema
 */
export interface MongooseFieldInfo {
  name: string;
  required: boolean;
  type: string;
  nested?: MongooseFieldInfo[];
}

/**
 * Extract fields from a Zod schema recursively
 */
export function extractZodFields(schema: ZodSchema, prefix = ''): ZodFieldInfo[] {
  const fields: ZodFieldInfo[] = [];

  if (schema instanceof ZodObject) {
    const shape = schema.shape;
    
    for (const [key, value] of Object.entries(shape)) {
      const fieldName = prefix ? `${prefix}.${key}` : key;
      const fieldSchema = value as ZodSchema;
      
      let required = true;
      let actualSchema = fieldSchema;
      let type = 'unknown';

      // Check if optional
      if (fieldSchema instanceof ZodOptional) {
        required = false;
        actualSchema = fieldSchema._def.innerType;
      }

      // Check if nullable
      if (fieldSchema instanceof ZodNullable) {
        required = false;
        actualSchema = fieldSchema._def.innerType;
      }

      // Check if default
      if (fieldSchema instanceof ZodDefault) {
        required = false;
        actualSchema = fieldSchema._def.innerType;
      }

      // Determine type
      if (actualSchema instanceof ZodObject) {
        type = 'object';
        const nestedFields = extractZodFields(actualSchema, fieldName);
        fields.push({
          name: fieldName,
          required,
          type,
          nested: nestedFields,
        });
      } else if (actualSchema instanceof ZodArray) {
        type = 'array';
        const innerType = actualSchema._def.type;
        if (innerType instanceof ZodObject) {
          const nestedFields = extractZodFields(innerType, `${fieldName}[]`);
          fields.push({
            name: fieldName,
            required,
            type,
            nested: nestedFields,
          });
        } else {
          fields.push({
            name: fieldName,
            required,
            type,
          });
        }
      } else if (actualSchema instanceof ZodEnum) {
        type = 'enum';
        fields.push({
          name: fieldName,
          required,
          type,
        });
      } else {
        // Try to infer type from Zod type
        const zodType = (actualSchema as any)._def?.typeName;
        type = zodType || 'unknown';
        fields.push({
          name: fieldName,
          required,
          type,
        });
      }
    }
  }

  return fields;
}

/**
 * Extract fields from a Mongoose schema recursively
 */
export function extractMongooseFields(schema: Schema, prefix = ''): MongooseFieldInfo[] {
  const fields: MongooseFieldInfo[] = [];
  const paths = schema.paths;

  for (const [key, path] of Object.entries(paths)) {
    const fieldName = prefix ? `${prefix}.${key}` : key;
    
    // Skip _id and __v
    if (key === '_id' || key === '__v') {
      continue;
    }

    const fieldInfo: MongooseFieldInfo = {
      name: fieldName,
      required: path.isRequired || false,
      type: path.instance || 'unknown',
    };

    // Handle nested schemas
    if (path.schema) {
      fieldInfo.type = 'object';
      fieldInfo.nested = extractMongooseFields(path.schema, fieldName);
    }

    // Handle arrays
    if (path.instance === 'Array') {
      fieldInfo.type = 'array';
      const arraySchema = (path as any).schema;
      if (arraySchema) {
        fieldInfo.nested = extractMongooseFields(arraySchema, `${fieldName}[]`);
      }
    }

    fields.push(fieldInfo);
  }

  return fields;
}

/**
 * Compare Zod and Mongoose field lists
 */
export function compareFields(
  zodFields: ZodFieldInfo[],
  mongooseFields: MongooseFieldInfo[]
): {
  missingInMongoose: ZodFieldInfo[];
  missingInZod: MongooseFieldInfo[];
  mismatched: Array<{ field: string; zod: ZodFieldInfo; mongoose: MongooseFieldInfo }>;
} {
  const zodMap = new Map(zodFields.map(f => [f.name, f]));
  const mongooseMap = new Map(mongooseFields.map(f => [f.name, f]));

  const missingInMongoose: ZodFieldInfo[] = [];
  const missingInZod: MongooseFieldInfo[] = [];
  const mismatched: Array<{ field: string; zod: ZodFieldInfo; mongoose: MongooseFieldInfo }> = [];

  // Check Zod fields
  for (const zodField of zodFields) {
    const mongooseField = mongooseMap.get(zodField.name);
    if (!mongooseField) {
      missingInMongoose.push(zodField);
    } else {
      // Compare required status (allow Mongoose to be more lenient)
      if (zodField.required && !mongooseField.required) {
        mismatched.push({
          field: zodField.name,
          zod: zodField,
          mongoose: mongooseField,
        });
      }
    }
  }

  // Check Mongoose fields (excluding id, createdAt, updatedAt which are handled separately)
  for (const mongooseField of mongooseFields) {
    if (mongooseField.name === 'id' || mongooseField.name === 'createdAt' || mongooseField.name === 'updatedAt') {
      continue; // These are handled separately
    }
    const zodField = zodMap.get(mongooseField.name);
    if (!zodField) {
      missingInZod.push(mongooseField);
    }
  }

  return {
    missingInMongoose,
    missingInZod,
    mismatched,
  };
}

