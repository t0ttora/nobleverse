'use client';
import { supabase } from '@/lib/supabaseClient';

export type Task = {
  id?: string;
  title: string;
  status?: 'open' | 'done' | 'accepted' | string;
  assigned_to?: string | null;
  deadline?: string | null; // ISO date
  created_at?: string;
};

export async function getMyId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

export async function listTasks(opts?: {
  status?: string;
  limit?: number;
}): Promise<Task[]> {
  const q = supabase
    .from('tasks')
    .select('id,title,status,assigned_to,deadline,created_at')
    .order('created_at', { ascending: false });
  if (opts?.status) q.eq('status', opts.status);
  if (opts?.limit) q.limit(opts.limit);
  const { data, error } = await q;
  if (error) {
    console.warn('listTasks error', error);
    return [];
  }
  return (data ?? []) as unknown as Task[];
}

export async function createTask(
  task: Task
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const payload: any = {
      title: task.title,
      status: task.status ?? 'open',
      assigned_to: task.assigned_to ?? null,
      deadline: task.deadline ?? null
    };
    const { data, error } = await supabase
      .from('tasks')
      .insert(payload)
      .select('id')
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: (data?.id as string) || '' };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Unknown error' };
  }
}

export async function updateTask(id: string, patch: Partial<Task>) {
  const { error } = await supabase
    .from('tasks')
    .update(patch as any)
    .eq('id', id);
  if (error) throw error;
}

export async function deleteTask(id: string) {
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) throw error;
}

export async function toggleDone(id: string, done: boolean) {
  await updateTask(id, { status: done ? 'done' : 'open' });
}

export function subscribeTasks(onChange: () => void) {
  const ch = supabase
    .channel('tasks:self')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'tasks' },
      () => onChange()
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(ch);
  };
}
