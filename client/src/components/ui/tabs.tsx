import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { motion } from "framer-motion"

import { cn } from "@/lib/utils"

type TabsContextValue = { layoutId: string; activeValue: string }
const TabsContext = React.createContext<TabsContextValue | null>(null)

const Tabs = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>
>(({ className, value: valueProp, defaultValue, onValueChange, ...props }, ref) => {
  const layoutId = React.useId()
  const [activeValue, setActiveValue] = React.useState(defaultValue ?? valueProp ?? "")

  const handleValueChange = React.useCallback(
    (v: string) => {
      setActiveValue(v)
      onValueChange?.(v)
    },
    [onValueChange]
  )

  React.useEffect(() => {
    if (valueProp !== undefined) setActiveValue(valueProp)
  }, [valueProp])

  const contextValue = React.useMemo(
    () => ({ layoutId, activeValue }),
    [layoutId, activeValue]
  )

  return (
    <TabsContext.Provider value={contextValue}>
      <TabsPrimitive.Root
        ref={ref}
        className={className}
        value={valueProp}
        defaultValue={defaultValue}
        onValueChange={handleValueChange}
        {...props}
      />
    </TabsContext.Provider>
  )
})
Tabs.displayName = TabsPrimitive.Root.displayName

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    data-tabs-list
    className={cn(
      "tabs-list-scrollbar-hide inline-flex h-11 min-h-11 items-center justify-center rounded-full bg-muted/50 p-1.5 text-muted-foreground gap-1 overflow-visible overflow-x-auto",
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const triggerBaseClasses =
  "relative flex h-full min-h-8 items-center rounded-full px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background disabled:pointer-events-none disabled:opacity-50 data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground data-[state=active]:text-primary-foreground"

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
 >(({ className, children, asChild, value, ...props }, ref) => {
  const tabsContext = React.useContext(TabsContext)
  const layoutId = tabsContext?.layoutId ?? null
  const isActive = tabsContext ? tabsContext.activeValue === value : false
  const bubbleId = layoutId ? `tabs-bubble-${layoutId}` : null

  const triggerContent = (
    <>
      {bubbleId && isActive && (
        <motion.span
          layoutId={bubbleId}
          className="absolute inset-0 z-10 rounded-full bg-primary"
          style={{ borderRadius: 9999, contain: "layout" }}
          transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
        />
      )}
      <span className="relative z-10 inline-flex items-center justify-center gap-1.5">
        {children}
      </span>
    </>
  )

  if (asChild && React.isValidElement(children)) {
    const child = React.Children.only(children) as React.ReactElement<{
      className?: string
      children?: React.ReactNode
    }>
    return (
      <TabsPrimitive.Trigger
        ref={ref}
        asChild
        value={value}
        className={className}
        {...props}
      >
        {React.cloneElement(child, {
          className: cn(triggerBaseClasses, child.props?.className),
          children: (
            <>
              {bubbleId && isActive && (
                <motion.span
                  layoutId={bubbleId}
                  className="absolute inset-0 z-10 rounded-full bg-primary"
                  style={{ borderRadius: 9999, contain: "layout" }}
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              <span className="relative z-10 inline-flex items-center justify-center gap-1.5">
                {child.props?.children}
              </span>
            </>
          ),
        })}
      </TabsPrimitive.Trigger>
    )
  }

  return (
    <TabsPrimitive.Trigger
      ref={ref}
      value={value}
      className={cn(triggerBaseClasses, className)}
      style={{ WebkitTapHighlightColor: "transparent" }}
      {...props}
    >
      {triggerContent}
    </TabsPrimitive.Trigger>
  )
})
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
