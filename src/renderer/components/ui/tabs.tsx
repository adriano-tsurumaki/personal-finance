import { Tabs as TabsPrimitive } from '@base-ui/react/tabs';
import { cn } from '@lib/utils';

function Tabs(props: TabsPrimitive.Root.Props) {
  return <TabsPrimitive.Root data-slot="tabs" {...props} />;
}

function TabsList({ className, ...props }: TabsPrimitive.List.Props) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        'flex items-stretch gap-6 border-b border-border',
        className,
      )}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        'relative -mb-px inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap border-b-2 border-transparent bg-transparent p-0 text-sm font-medium text-muted-foreground outline-none transition-colors duration-150 motion-reduce:transition-none hover:text-foreground focus-visible:rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50 data-active:border-primary data-active:text-foreground data-active:[&_svg]:text-primary disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn(
        'outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50',
        className,
      )}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
