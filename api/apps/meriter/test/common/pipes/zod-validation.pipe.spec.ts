import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ZodSchema, z } from 'zod';
import { ZodValidationPipe } from '../../../src/common/pipes/zod-validation.pipe';

describe('ZodValidationPipe', () => {
  let pipe: ZodValidationPipe;
  const testSchema: ZodSchema = z.object({
    name: z.string().min(1),
    age: z.number().int().positive(),
    email: z.string().email().optional(),
  });

  beforeEach(() => {
    pipe = new ZodValidationPipe(testSchema);
  });

  it('should be defined', () => {
    expect(pipe).toBeDefined();
  });

  it('should validate and return valid data', () => {
    const validData = {
      name: 'John Doe',
      age: 25,
      email: 'john@example.com',
    };

    const result = pipe.transform(validData, {} as any);
    expect(result).toEqual(validData);
  });

  it('should throw BadRequestException for invalid data', () => {
    const invalidData = {
      name: '', // Empty string violates min(1)
      age: 25,
    };

    expect(() => pipe.transform(invalidData, {} as any)).toThrow(BadRequestException);
  });

  it('should throw BadRequestException with formatted errors', () => {
    const invalidData = {
      name: '',
      age: -5, // Negative violates positive()
      email: 'not-an-email',
    };

    try {
      pipe.transform(invalidData, {} as any);
      fail('Should have thrown BadRequestException');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect(error.getResponse()).toHaveProperty('message');
      expect(error.getResponse()).toHaveProperty('errors');
      expect(Array.isArray(error.getResponse().errors)).toBe(true);
    }
  });

  it('should handle optional fields correctly', () => {
    const validDataWithoutEmail = {
      name: 'John Doe',
      age: 25,
    };

    const result = pipe.transform(validDataWithoutEmail, {} as any);
    expect(result).toEqual(validDataWithoutEmail);
  });

  it('should handle nested errors correctly', () => {
    const nestedSchema = z.object({
      user: z.object({
        name: z.string().min(1),
        age: z.number(),
      }),
    });
    const nestedPipe = new ZodValidationPipe(nestedSchema);

    const invalidNestedData = {
      user: {
        name: '',
        age: 25,
      },
    };

    try {
      nestedPipe.transform(invalidNestedData, {} as any);
      fail('Should have thrown BadRequestException');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const response = error.getResponse();
      expect(response.errors).toBeDefined();
      expect(response.errors.length).toBeGreaterThan(0);
      // Check that path includes nested field
      expect(response.errors.some((e: any) => e.path.includes('user'))).toBe(true);
    }
  });

  it('should handle non-Zod errors gracefully', () => {
    // Create a pipe with a schema that might cause non-Zod errors
    const problemSchema = z.object({
      value: z.string().transform((val) => {
        if (val === 'error') {
          throw new Error('Custom error');
        }
        return val;
      }),
    });
    const problemPipe = new ZodValidationPipe(problemSchema);

    expect(() => {
      problemPipe.transform({ value: 'error' }, {} as any);
    }).toThrow(BadRequestException);
  });
});

