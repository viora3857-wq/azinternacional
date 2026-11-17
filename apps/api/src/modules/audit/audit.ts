import type { DbClient } from '../../db/database';

export interface AuditEvent {
  actorId: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  ipHash?: string | null;
  /** Só metadados não sensíveis. Nunca e-mail, token, nota, texto do aluno etc. */
  metadata?: Record<string, string | number | boolean | null>;
}

export async function audit(client: DbClient, e: AuditEvent): Promise<void> {
  await client.query(
    `insert into private.audit_logs (actor_id, action, target_type, target_id, ip_hash, metadata)
     values ($1, $2, $3, $4, $5, $6)`,
    [
      e.actorId,
      e.action,
      e.targetType ?? null,
      e.targetId ?? null,
      e.ipHash ?? null,
      e.metadata ?? {},
    ],
  );
}
