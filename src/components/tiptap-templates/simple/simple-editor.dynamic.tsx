'use client';
import React, {
  forwardRef,
  Suspense,
  useImperativeHandle,
  useRef
} from 'react';
import type {
  SimpleEditorHandle as Handle,
  SimpleEditorProps as Props
} from './simple-editor';

const LazySimpleEditor = React.lazy(() =>
  import('./simple-editor').then((m) => ({ default: m.SimpleEditor }))
);

export type SimpleEditorHandle = Handle;
export type SimpleEditorProps = Props;

export const SimpleEditor = forwardRef<Handle, Props>(
  function SimpleEditor(props, ref) {
    const innerRef = useRef<Handle | null>(null);
    useImperativeHandle(ref, () => ({
      setContent: (html: string) => innerRef.current?.setContent(html),
      insertHTML: (html: string) => innerRef.current?.insertHTML(html),
      getHTML: () => innerRef.current?.getHTML() ?? '',
      getText: () => innerRef.current?.getText() ?? '',
      getEditor: () => innerRef.current?.getEditor() ?? null,
      setPageFormat: (fmt: any) => innerRef.current?.setPageFormat(fmt)
    }));
    return (
      <Suspense
        fallback={
          <div className='text-muted-foreground flex min-h-[200px] items-center justify-center text-sm'>
            Loading editor…
          </div>
        }
      >
        <LazySimpleEditor ref={innerRef} {...props} />
      </Suspense>
    );
  }
);

export default SimpleEditor;
