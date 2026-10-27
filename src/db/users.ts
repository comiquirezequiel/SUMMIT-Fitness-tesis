import { db } from './index.ts';
import { users } from './schema.ts';

export async function getOrCreateUser(uid: string, email: string) {
  const result = await db
    .insert(users)
    .values({
      uid,
      email,
      dni: `U-${uid.substring(0, 6)}`,
      nombreCompleto: email.split('@')[0],
      rol: 'ADMIN',
      estado: 'ACTIVO',
    })
    .onConflictDoUpdate({
      target: users.uid,
      set: {
        email,
      },
    })
    .returning();

  return result[0];
}
