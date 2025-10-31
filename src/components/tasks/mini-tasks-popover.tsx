'use client';
import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip';
import { Plus, Check, Pencil, Trash2, ListTodo, UserRound } from 'lucide-react';
import {
  Task,
  listTasks,
  createTask,
  toggleDone,
  updateTask,
  deleteTask,
  getMyId,
  subscribeTasks
} from '@/lib/tasks';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabaseClient';
import { safeFormat } from '@/lib/calendar';

export type MiniTasksProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  isMobile?: boolean;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
  alignOffset?: number;
  active?: boolean;
};

export default function MiniTasksPopover({
  open,
  onOpenChange,
  isMobile = false,
  side = 'bottom',
  align = 'end',
  sideOffset = 4,
  alignOffset = 0,
  active = false
}: MiniTasksProps) {
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [title, setTitle] = React.useState('');
  const [date, setDate] = React.useState('');
  const [assignee, setAssignee] = React.useState<string | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editingTitle, setEditingTitle] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [tab, setTab] = React.useState<'open' | 'done' | 'all'>('open');
  const [peopleOpen, setPeopleOpen] = React.useState(false);
  const [team, setTeam] = React.useState<Array<{ id: string; name: string }>>(
    []
  );
  const [contacts, setContacts] = React.useState<
    Array<{ id: string; name: string }>
  >([]);
  const [search, setSearch] = React.useState('');

  const load = React.useCallback(async () => {
    setLoading(true);
    const data = await listTasks({ status: tab === 'all' ? undefined : tab });
    setTasks(data);
    setLoading(false);
  }, [tab]);

  React.useEffect(() => {
    void load();
  }, [load]);

  // Realtime updates
  React.useEffect(() => {
    const unsub = subscribeTasks(() => void load());
    return () => {
      unsub?.();
    };
  }, [load]);

  // Fetch team/contacts for assignee picker
  React.useEffect(() => {
    let alive = true;
    async function fetchPeople() {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id;
        if (!uid) return;
        // contacts via mapping table
        const { data: pairs } = await supabase
          .from('contacts')
          .select('contact_id')
          .eq('user_id', uid);
        const ids = (pairs || []).map((p: any) => p.contact_id);
        if (ids.length) {
          const { data: profs } = await supabase
            .from('profiles')
            .select('id,display_name,username')
            .in('id', ids);
          if (!alive) return;
          setContacts(
            (profs || []).map((p: any) => ({
              id: p.id,
              name: (p.display_name || p.username || 'User') as string
            }))
          );
        } else {
          setContacts([]);
        }
        // team by company name
        const { data: me } = await supabase
          .from('profiles')
          .select('id,company_name')
          .eq('id', uid)
          .single();
        const company = (me as any)?.company_name || null;
        if (company) {
          const { data: tprofs } = await supabase
            .from('profiles')
            .select('id,display_name,username,company_name')
            .eq('company_name', company);
          if (!alive) return;
          setTeam(
            (tprofs || [])
              .filter((p: any) => p.id !== uid)
              .map((p: any) => ({
                id: p.id,
                name: (p.display_name || p.username || 'User') as string
              }))
          );
        }
      } catch {
        /* ignore */
      }
    }
    void fetchPeople();
    return () => {
      alive = false;
    };
  }, []);

  async function add() {
    if (!title.trim()) return;
    const uid = await getMyId();
    const res = await createTask({
      title: title.trim(),
      assigned_to: assignee || uid,
      deadline: date ? new Date(date).toISOString() : null
    });
    if (res.ok) {
      setTitle('');
      setDate('');
      setAssignee(null);
      await load();
    }
  }

  async function setDone(id: string, done: boolean) {
    await toggleDone(id, done);
    await load();
  }

  async function saveEdit(id: string) {
    if (!editingTitle.trim()) {
      setEditingId(null);
      return;
    }
    await updateTask(id, { title: editingTitle.trim() });
    setEditingId(null);
    setEditingTitle('');
    await load();
  }

  async function remove(id: string) {
    await deleteTask(id);
    await load();
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          size='icon'
          variant='ghost'
          className={'rounded-lg ' + (active ? 'bg-foreground/10' : '')}
          aria-label='Tasks'
        >
          <ListTodo className='size-4' />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        sideOffset={sideOffset}
        alignOffset={alignOffset}
        collisionPadding={{ bottom: 24 }}
        className='z-[85] flex w-[360px] flex-col overflow-hidden p-0'
      >
        {/* Header */}
        <div className='flex items-center justify-between border-b px-3 py-2'>
          <div className='text-sm font-semibold'>Tasks</div>
          <div className='flex items-center gap-1'>
            {/* Add task popover */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  size='icon'
                  className='h-8 w-8'
                  style={{
                    color: '#10b981',
                    backgroundColor: 'rgba(16,185,129,0.20)'
                  }}
                >
                  <Plus className='h-3.5 w-3.5' />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                side='bottom'
                align='end'
                className='bg-muted text-foreground w-[420px] space-y-4 border p-4 shadow-lg'
                sideOffset={8}
              >
                <div className='pt-1'>
                  <div className='text-sm font-semibold'>Create task</div>
                  <div className='text-muted-foreground mt-1.5 text-xs'>
                    Add a title and optional due date.
                  </div>
                </div>
                <div className='grid grid-cols-6 gap-2'>
                  <div className='col-span-2'>
                    <Label className='text-xs'>Title</Label>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder='Task title'
                      className='h-9'
                    />
                  </div>
                  <div className='col-span-2'>
                    <Label className='text-xs'>Assign to</Label>
                    <Popover open={peopleOpen} onOpenChange={setPeopleOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant='outline'
                          className='h-9 w-full justify-start'
                        >
                          <UserRound className='mr-2 size-4' />
                          {assignee ? 'Selected' : 'Me'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        align='start'
                        side='bottom'
                        className='w-[320px] p-3'
                      >
                        <div className='mb-2'>
                          <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder='Search people'
                            className='h-8'
                          />
                        </div>
                        <div className='mb-2'>
                          <button
                            className='text-xs underline'
                            onClick={() => {
                              setAssignee(null);
                              setPeopleOpen(false);
                            }}
                          >
                            Assign to me
                          </button>
                        </div>
                        <div className='max-h-60 space-y-2 overflow-auto'>
                          <PeopleGroup
                            title='Team'
                            list={team}
                            search={search}
                            onPick={(id) => {
                              setAssignee(id);
                              setPeopleOpen(false);
                            }}
                          />
                          <PeopleGroup
                            title='Contacts'
                            list={contacts}
                            search={search}
                            onPick={(id) => {
                              setAssignee(id);
                              setPeopleOpen(false);
                            }}
                          />
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className='col-span-2'>
                    <Label className='text-xs'>Due date</Label>
                    <Input
                      type='date'
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className='h-9'
                    />
                  </div>
                </div>
                <div className='flex items-center justify-between gap-2'>
                  <Button
                    size='sm'
                    onClick={() => void add()}
                    disabled={!title.trim()}
                    className='h-8'
                  >
                    Create
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
        {/* Body */}
        <div className='flex-1 p-3 pt-2'>
          {/* Filters */}
          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as any)}
            className='mb-2'
          >
            <TabsList>
              <TabsTrigger value='open'>Open</TabsTrigger>
              <TabsTrigger value='done'>Done</TabsTrigger>
              <TabsTrigger value='all'>All</TabsTrigger>
            </TabsList>
          </Tabs>
          <ScrollArea className='mt-1 h-[300px] pr-1'>
            <TaskGroups
              tasks={tasks}
              editingId={editingId}
              editingTitle={editingTitle}
              onEditChange={setEditingTitle}
              onStartEdit={(id, title) => {
                setEditingId(id);
                setEditingTitle(title);
              }}
              onSaveEdit={saveEdit}
              onToggle={setDone}
              onDelete={remove}
            />
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function PeopleGroup({
  title,
  list,
  search,
  onPick
}: {
  title: string;
  list: Array<{ id: string; name: string }>;
  search: string;
  onPick: (id: string) => void;
}) {
  const filtered = React.useMemo(
    () =>
      list.filter((p) => p.name.toLowerCase().includes(search.toLowerCase())),
    [list, search]
  );
  if (filtered.length === 0) return null;
  return (
    <div>
      <div className='mb-1 text-[11px] font-medium tracking-wide uppercase opacity-70'>
        {title}
      </div>
      <ul className='space-y-1 text-sm'>
        {filtered.map((p) => (
          <li key={p.id}>
            <button
              className='hover:bg-accent w-full rounded px-2 py-1 text-left'
              onClick={() => onPick(p.id)}
            >
              {p.name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TaskGroups({
  tasks,
  editingId,
  editingTitle,
  onEditChange,
  onStartEdit,
  onSaveEdit,
  onToggle,
  onDelete
}: {
  tasks: Task[];
  editingId: string | null;
  editingTitle: string;
  onEditChange: (v: string) => void;
  onStartEdit: (id: string, title: string) => void;
  onSaveEdit: (id: string) => void;
  onToggle: (id: string, done: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const groups = React.useMemo(() => groupTasksByDue(tasks), [tasks]);
  const order: Array<keyof typeof groups> = [
    'today',
    'tomorrow',
    'upcoming',
    'past',
    'none'
  ];
  const labels: Record<string, string> = {
    today: 'Today',
    tomorrow: 'Tomorrow',
    upcoming: 'Upcoming',
    past: 'Past',
    none: 'No due date'
  };
  const noData = order.every((k) => (groups as any)[k].length === 0);
  if (noData)
    return (
      <div className='bg-muted/30 mx-auto w-full rounded-xl border p-6 text-center shadow-sm'>
        <div className='text-sm font-semibold'>No tasks in this filter</div>
        <div className='text-muted-foreground mt-1 text-xs leading-relaxed'>
          Use + to add a new task, then assign and set a due date.
        </div>
      </div>
    );
  return (
    <div className='space-y-3'>
      {order.map((key) => (
        <div key={key}>
          {(groups as any)[key].length > 0 && (
            <>
              <div className='text-muted-foreground mb-1 text-[11px] tracking-wide'>
                {labels[key]}
              </div>
              <div className='space-y-2'>
                {(groups as any)[key].map((t: Task) => {
                  const done = (t.status || '').toLowerCase() === 'done';
                  return (
                    <div
                      key={t.id}
                      className='bg-background/60 flex items-center gap-2 rounded-md border px-2 py-2 text-sm'
                    >
                      <Checkbox
                        checked={done}
                        onCheckedChange={(v) => onToggle(t.id!, Boolean(v))}
                      />
                      {editingId === t.id ? (
                        <div className='flex w-full items-center gap-2'>
                          <Input
                            className='h-8 flex-1'
                            value={editingTitle}
                            onChange={(e) => onEditChange(e.target.value)}
                          />
                          <Button
                            size='sm'
                            className='h-8'
                            onClick={() => onSaveEdit(t.id!)}
                          >
                            <Check className='size-4' />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className='min-w-0 flex-1'>
                            <div
                              className={
                                'truncate ' +
                                (done ? 'line-through opacity-70' : '')
                              }
                            >
                              {t.title}
                            </div>
                            <div className='text-muted-foreground text-[11px]'>
                              {t.deadline
                                ? safeFormat(t.deadline)
                                : 'No due date'}
                            </div>
                          </div>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                className='text-muted-foreground hover:text-foreground'
                                onClick={() => onStartEdit(t.id!, t.title)}
                                title='Edit title'
                              >
                                <Pencil className='size-4' />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>Edit</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                className='text-muted-foreground hover:text-foreground'
                                onClick={() => onDelete(t.id!)}
                                title='Delete task'
                              >
                                <Trash2 className='size-4' />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>Delete</TooltipContent>
                          </Tooltip>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function groupTasksByDue(items: Task[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const dayAfter = new Date(today);
  dayAfter.setDate(today.getDate() + 2);
  const groups = {
    today: [] as Task[],
    tomorrow: [] as Task[],
    upcoming: [] as Task[],
    past: [] as Task[],
    none: [] as Task[]
  };
  for (const t of items) {
    if (!t.deadline) {
      groups.none.push(t);
      continue;
    }
    const d = new Date(t.deadline);
    d.setHours(0, 0, 0, 0);
    if (d.getTime() === today.getTime()) groups.today.push(t);
    else if (d.getTime() === tomorrow.getTime()) groups.tomorrow.push(t);
    else if (d.getTime() < today.getTime()) groups.past.push(t);
    else if (d.getTime() >= dayAfter.getTime()) groups.upcoming.push(t);
  }
  // optional sort within groups by time
  const sorter = (a: Task, b: Task) =>
    new Date(a.deadline || 0).getTime() - new Date(b.deadline || 0).getTime();
  for (const k of Object.keys(groups) as (keyof typeof groups)[])
    (groups as any)[k].sort(sorter);
  return groups;
}
