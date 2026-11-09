import { z } from 'zod';

export const credentialsSchema = z.object({
  email: z.email('Некорректный формат email').transform((v) => v.trim().toLowerCase()),
  password: z.string().min(8, 'Пароль должен быть не короче 8 символов').max(128),
});

export type Credentials = z.infer<typeof credentialsSchema>;
