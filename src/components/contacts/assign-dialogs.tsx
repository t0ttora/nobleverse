'use client';
import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Calendar as DayCalendar } from '@/components/ui/calendar';
import { Textarea } from '@/components/ui/textarea';
import { createTask } from '@/lib/tasks';
import { createEvent, notifyUsersAboutEvent } from '@/lib/calendar';
import { toast } from 'sonner';

export function AssignTaskDialog({
  open,
  onOpenChange,
  userId
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string | null;
}) {
  const [title, setTitle] = React.useState('');
  const [date, setDate] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  async function submit() {
    if (!userId || !title.trim()) return;
    setBusy(true);
    try {
      const deadline = date ? new Date(date).toISOString() : null;
      const res = await createTask({
        title: title.trim(),
        assigned_to: userId,
        deadline
      });
      if (!res.ok) throw new Error(res.error || 'TASK_FAILED');
      toast.success('Task created');
      onOpenChange(false);
      setTitle('');
      setDate('');
    } catch (e: any) {
      toast.error(e?.message || 'Task failed');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign task</DialogTitle>
          <DialogDescription>
            Create a quick task for this teammate.
          </DialogDescription>
        </DialogHeader>
        <div className='space-y-3'>
          <div>
            <Label className='text-xs'>Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className='h-9'
            />
          </div>
          <div>
            <Label className='text-xs'>Due date</Label>
            <Input
              type='date'
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className='h-9'
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant='ghost' onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!title.trim() || busy}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AssignEventDialog({
  open,
  onOpenChange,
  userId
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string | null;
}) {
  const [title, setTitle] = React.useState('');
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(
    new Date()
  );
  const [time, setTime] = React.useState('09:00');
  const [note, setNote] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  async function submit() {
    if (!userId || !title.trim() || !selectedDate) return;
    setBusy(true);
    try {
      const [hh, mm] = time.split(':').map((x) => parseInt(x, 10));
      const starts = new Date(selectedDate);
      starts.setHours(hh || 9, mm || 0, 0, 0);
      const evt: any = {
        title: title.trim(),
        starts_at: starts.toISOString(),
        notes: note.trim() || null
      };
      const res = await createEvent(evt);
      if (!res.ok) throw new Error(res.error || 'EVENT_FAILED');
      await notifyUsersAboutEvent([userId], evt);
      toast.success('Event created and invite sent');
      onOpenChange(false);
      setTitle('');
      setNote('');
    } catch (e: any) {
      toast.error(e?.message || 'Event failed');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[520px]'>
        <DialogHeader>
          <DialogTitle>Schedule event</DialogTitle>
          <DialogDescription>
            Pick a date/time and send the invite.
          </DialogDescription>
        </DialogHeader>
        <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
          <div>
            <Label className='text-xs'>Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className='h-9'
            />
          </div>
          <div>
            <Label className='text-xs'>Time</Label>
            <Input
              type='time'
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className='h-9'
            />
          </div>
          <div className='sm:col-span-2'>
            <Label className='text-xs'>Date</Label>
            <div className='rounded border p-2'>
              <DayCalendar
                mode='single'
                selected={selectedDate}
                onSelect={(d: any) => d && setSelectedDate(new Date(d))}
                showOutsideDays
              />
            </div>
          </div>
          <div className='sm:col-span-2'>
            <Label className='text-xs'>Invite message</Label>
            <Textarea
              className='min-h-[72px]'
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder='Add a short note (optional)…'
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant='ghost' onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={!title.trim() || !selectedDate || busy}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AssignShipmentDialog({
  open,
  onOpenChange,
  onGo
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onGo: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign shipment</DialogTitle>
          <DialogDescription>
            Open the Shipments workspace to create and link a shipment.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant='ghost' onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={onGo}>Open Shipments</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AssignRequestDialog({
  open,
  onOpenChange,
  onGo
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onGo: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign request</DialogTitle>
          <DialogDescription>
            Open Requests to create and track a new request.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant='ghost' onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={onGo}>Open Requests</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
