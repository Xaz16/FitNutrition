import { BadRequestException, StandardSchemaValidationPipe } from '@nestjs/common';
import type { StandardSchemaV1 } from '@standard-schema/spec';

export interface FieldError {
  field: string;
  message: string;
}

function fieldName(issue: StandardSchemaV1.Issue): string {
  return (issue.path ?? [])
    .map((segment) => (typeof segment === 'object' ? String(segment.key) : String(segment)))
    .join('.');
}

export function validationPipe(): StandardSchemaValidationPipe {
  return new StandardSchemaValidationPipe({
    exceptionFactory: (issues) =>
      new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Проверьте введённые данные',
        fields: issues.map<FieldError>((issue) => ({ field: fieldName(issue), message: issue.message })),
      }),
  });
}
