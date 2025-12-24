import { _Test, _TestingModule } from '@nestjs/testing';
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

  const bodyMeta: any = { type: 'body' };
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    pipe = new ZodValidationPipe(testSchema);
  });

  beforeAll(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
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

    const result = pipe.transform(validData, bodyMeta as any);
    expect(result).toEqual(validData);
  });

  it('should throw BadRequestException for invalid data', () => {
    const invalidData = {
      name: '', // Empty string violates min(1)
      age: 25,
    } as any;

    expect(() => pipe.transform(invalidData, bodyMeta as any)).toThrow(BadRequestException);
  });

  it('should throw BadRequestException with formatted errors', () => {
    const invalidData = {
      name: '',
      age: -5, // Negative violates positive()
      email: 'not-an-email',
    } as any;

    try {
      pipe.transform(invalidData, bodyMeta as any);
      fail('Should have thrown BadRequestException');
    } catch (error: any) {
      expect(error).toBeInstanceOf(BadRequestException);
      const response = error.getResponse();
      expect(response).toHaveProperty('message', 'Validation failed');
      expect(response).toHaveProperty('errors');
      expect(Array.isArray(response.errors)).toBe(true);
      expect(response.errors.length).toBeGreaterThan(0);
    }
  });

  it('should skip validation for non-body metadata', () => {
    const result = pipe.transform({ any: 'value' }, {} as any);
    expect(result).toEqual({ any: 'value' });
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
    } as any;

    try {
      nestedPipe.transform(invalidNestedData, bodyMeta as any);
      fail('Should have thrown BadRequestException');
    } catch (error: any) {
      expect(error).toBeInstanceOf(BadRequestException);
      const response = error.getResponse();
      expect(response.errors).toBeDefined();
      expect(response.errors.length).toBeGreaterThan(0);
      // Check that path includes nested field
      expect(response.errors.some((e: any) => String(e.path).includes('user'))).toBe(true);
    }
  });

  it('should wrap non-Zod errors into BadRequestException', () => {
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
      problemPipe.transform({ value: 'error' } as any, bodyMeta as any);
    }).toThrow(BadRequestException);
  });
});
