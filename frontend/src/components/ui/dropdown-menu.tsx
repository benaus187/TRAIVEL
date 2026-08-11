"use client"

import { Menu as MenuPrimitive } from "@base-ui/react/menu"

import { cn } from "@/lib/utils"

function DropdownMenu(props: MenuPrimitive.Root.Props) {
  return <MenuPrimitive.Root {...props} />
}

function DropdownMenuTrigger({
  className,
  openOnHover = true,
  delay = 15,
  closeDelay = 150,
  ...props
}: MenuPrimitive.Trigger.Props) {
  return (
    <MenuPrimitive.Trigger
      data-slot="dropdown-menu-trigger"
      openOnHover={openOnHover}
      delay={delay}
      closeDelay={closeDelay}
      className={cn("outline-none", className)}
      {...props}
    />
  )
}

function DropdownMenuContent({
  className,
  sideOffset = 8,
  align = "end",
  children,
  ...props
}: MenuPrimitive.Popup.Props &
  Pick<MenuPrimitive.Positioner.Props, "sideOffset" | "align" | "side">) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner
        sideOffset={sideOffset}
        align={align}
        className="z-50 outline-none"
      >
        <MenuPrimitive.Popup
          data-slot="dropdown-menu-content"
          className={cn(
            "min-w-44 origin-[var(--transform-origin)] rounded-md border border-line-strong bg-popover p-1 text-popover-foreground shadow-lg outline-none",
            "transition-[opacity,transform] duration-150 ease-out",
            "data-[starting-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:-translate-y-1",
            "data-[ending-style]:opacity-0 data-[ending-style]:scale-95",
            className
          )}
          {...props}
        >
          {children}
        </MenuPrimitive.Popup>
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  )
}

function DropdownMenuItem({
  className,
  ...props
}: MenuPrimitive.Item.Props) {
  return (
    <MenuPrimitive.Item
      data-slot="dropdown-menu-item"
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-sm px-2.5 py-1.5 font-mono text-xs outline-none select-none",
        "data-[highlighted]:bg-muted data-[highlighted]:text-foreground",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dropdown-menu-separator"
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  )
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
}
